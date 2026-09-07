import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  interfaceAddresses,
  peerRemoteSubnets,
  peers,
  routers,
  routerOperationLocks,
  wireguardInterfaces,
} from "@/lib/db/schema";
import { decryptSecret } from "@/lib/security";
import { parseRouterOsBytes, parseRouterOsDuration, type RouterOsRecord } from "./parser";
import { inspectRouter, readRouterConfiguration } from "./client";
import type { RouterConnection } from "./ssh";

export async function getRouterConnection(routerId: string, requireTrusted = false): Promise<{ router: typeof routers.$inferSelect; connection: RouterConnection }> {
  const db = getDb();
  const [router] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1);
  if (!router) throw new Error("Không tìm thấy router");
  if (requireTrusted && !router.hostKeyFingerprint) throw new Error("Hãy kiểm tra và xác nhận SSH host fingerprint trước");
  return {
    router,
    connection: {
      host: router.host,
      port: router.sshPort,
      username: router.sshUsername,
      authType: router.sshAuthType,
      secret: decryptSecret(router.sshSecret),
      hostKeyFingerprint: router.hostKeyFingerprint,
    },
  };
}

export async function testRouter(routerId: string, trustFingerprint = false) {
  const db = getDb();
  const { router, connection } = await getRouterConnection(routerId);
  if (trustFingerprint) connection.hostKeyFingerprint = null;
  try {
    const result = await inspectRouter(connection);
    const versionMatch = result.version.match(/^(\d+)\.(\d+)/);
    if (!versionMatch || Number(versionMatch[1]) < 7 || (Number(versionMatch[1]) === 7 && Number(versionMatch[2]) < 15)) {
      throw new Error(`RouterOS ${result.version} không được hỗ trợ; yêu cầu tối thiểu 7.15`);
    }
    const now = new Date();
    await db.update(routers).set({
      status: "online",
      routerOsVersion: result.version,
      consecutiveFailures: 0,
      lastSuccessfulConnectionAt: now,
      lastError: null,
      updatedAt: now,
      ...(trustFingerprint && result.fingerprint ? { hostKeyFingerprint: result.fingerprint } : {}),
    }).where(eq(routers.id, routerId));
    return { ...result, trusted: Boolean(router.hostKeyFingerprint || trustFingerprint) };
  } catch (error) {
    await recordRouterFailure(routerId, error);
    throw error;
  }
}

async function recordRouterFailure(routerId: string, error: unknown) {
  const db = getDb();
  await db.update(routers).set({
    status: "error",
    consecutiveFailures: sql`${routers.consecutiveFailures} + 1`,
    lastError: error instanceof Error ? error.message : "Lỗi kết nối không xác định",
    updatedAt: new Date(),
  }).where(eq(routers.id, routerId));
}

export async function withRouterLock<T>(routerId: string, operation: () => Promise<T>): Promise<T> {
  const db = getDb();
  const owner = randomUUID();
  const expiresAt = new Date(Date.now() + 30_000);
  const acquired = await db.execute(sql`
    insert into ${routerOperationLocks} (router_id, owner, expires_at)
    values (${routerId}, ${owner}, ${expiresAt})
    on conflict (router_id) do update set owner = excluded.owner, expires_at = excluded.expires_at
    where ${routerOperationLocks.expiresAt} < now()
    returning owner
  `);
  if (!acquired.rows.length) throw new Error("Router đang xử lý một thao tác khác, vui lòng thử lại");
  try {
    return await operation();
  } finally {
    await db.delete(routerOperationLocks).where(and(eq(routerOperationLocks.routerId, routerId), eq(routerOperationLocks.owner, owner)));
  }
}

function revision(record: RouterOsRecord) {
  const stable = Object.fromEntries(Object.entries(record).filter(([key]) => !["last-handshake", "rx", "tx", "current-endpoint-address", "current-endpoint-port"].includes(key)).sort());
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function syncRouter(routerId: string) {
  return withRouterLock(routerId, async () => {
    const db = getDb();
    const { router, connection } = await getRouterConnection(routerId, true);
    try {
      const config = await readRouterConfiguration(connection);
      const now = new Date();
      const knownInterfaceIds: string[] = [];
      let importedPeers = 0;
      let updatedPeers = 0;

      for (const item of config.interfaces) {
        if (!item.name || !item["public-key"]) continue;
        const routerOsId = item[".id"] ?? item.name;
        const [saved] = await db.insert(wireguardInterfaces).values({
          routerId,
          routerOsId,
          name: item.name,
          listenPort: Number(item["listen-port"] ?? 13231),
          publicKey: item["public-key"],
          mtu: item.mtu ? Number(item.mtu) : null,
          isRunning: item._flags?.includes("R") ?? false,
          isDisabled: item.disabled === "yes" || item._flags?.includes("X") === true,
          clientEndpointHost: router.host,
          clientEndpointPort: Number(item["listen-port"] ?? 13231),
          lastSyncedAt: now,
        }).onConflictDoUpdate({
          target: [wireguardInterfaces.routerId, wireguardInterfaces.routerOsId],
          set: {
            name: item.name,
            listenPort: Number(item["listen-port"] ?? 13231),
            publicKey: item["public-key"],
            mtu: item.mtu ? Number(item.mtu) : null,
            isRunning: item._flags?.includes("R") ?? false,
            isDisabled: item.disabled === "yes" || item._flags?.includes("X") === true,
            lastSyncedAt: now,
            updatedAt: now,
          },
        }).returning();
        knownInterfaceIds.push(saved.id);

        const cidrs = config.addresses.filter((address) => address.interface === item.name && address.address?.includes(".")).map((address) => address.address);
        await db.delete(interfaceAddresses).where(eq(interfaceAddresses.interfaceId, saved.id));
        if (cidrs.length) await db.insert(interfaceAddresses).values(cidrs.map((cidr) => ({ interfaceId: saved.id, cidr })));
      }

      const interfaces = knownInterfaceIds.length
        ? await db.select().from(wireguardInterfaces).where(inArray(wireguardInterfaces.id, knownInterfaceIds))
        : [];
      const interfaceByName = new Map(interfaces.map((item) => [item.name, item]));
      const seenPeerIds: string[] = [];

      for (const item of config.peers) {
        const targetInterface = interfaceByName.get(item.interface);
        if (!targetInterface || !item["public-key"] || !item["allowed-address"]) continue;
        const publicKey = item["public-key"];
        const [existing] = await db.select().from(peers).where(and(eq(peers.interfaceId, targetInterface.id), eq(peers.publicKey, publicKey))).limit(1);
        const allowed = item["allowed-address"].split(",").map((value) => value.trim()).filter(Boolean);
        const assignedAddress = allowed.find((value) => value.endsWith("/32")) ?? allowed[0];
        const remote = allowed.filter((value) => value !== assignedAddress);
        const routerRevision = revision(item);
        const operational = {
          lastHandshakeAt: parseRouterOsDuration(item["last-handshake"]),
          currentEndpoint: [item["current-endpoint-address"], item["current-endpoint-port"]].filter(Boolean).join(":" ) || null,
          rxBytes: parseRouterOsBytes(item.rx),
          txBytes: parseRouterOsBytes(item.tx),
          lastStatusRefreshAt: now,
        };

        if (existing) {
          const syncStatus = existing.deletedAt
            ? "reappeared_on_router" as const
            : existing.desiredAction !== "none"
              ? existing.syncStatus
              : existing.routerRevision && existing.routerRevision !== routerRevision ? "drifted" as const : "synced" as const;
          await db.update(peers).set({
            routerOsId: item[".id"] ?? publicKey,
            appliedPublicKey: publicKey,
            ...(existing.desiredAction === "none" && !existing.deletedAt ? {
              name: item.name || existing.name,
              comment: item.comment || existing.comment,
              assignedAddress,
              persistentKeepalive: Number((item["persistent-keepalive"] ?? "25").replace(/s$/, "")),
              isDisabled: item.disabled === "yes" || item._flags?.includes("X") === true,
            } : {}),
            routerRevision,
            syncStatus,
            ...operational,
            updatedAt: now,
          }).where(eq(peers.id, existing.id));
          if (existing.desiredAction === "none" && !existing.deletedAt) {
            await db.delete(peerRemoteSubnets).where(eq(peerRemoteSubnets.peerId, existing.id));
            if (remote.length) await db.insert(peerRemoteSubnets).values(remote.map((cidr) => ({ peerId: existing.id, cidr })));
          }
          seenPeerIds.push(existing.id);
          updatedPeers += 1;
        } else {
          const [created] = await db.insert(peers).values({
            interfaceId: targetInterface.id,
            routerOsId: item[".id"] ?? publicKey,
            name: item.name || item.comment || `Peer ${publicKey.slice(0, 8)}`,
            comment: item.comment || "Imported from RouterOS",
            mode: remote.length ? "site_to_site" : "internal",
            publicKey,
            appliedPublicKey: publicKey,
            assignedAddress,
            persistentKeepalive: Number((item["persistent-keepalive"] ?? "25").replace(/s$/, "")),
            isDisabled: item.disabled === "yes" || item._flags?.includes("X") === true,
            origin: "router_import",
            desiredAction: "none",
            syncStatus: "synced",
            routerRevision,
            ...operational,
          }).returning();
          if (remote.length) await db.insert(peerRemoteSubnets).values(remote.map((cidr) => ({ peerId: created.id, cidr })));
          seenPeerIds.push(created.id);
          importedPeers += 1;
        }
      }

      if (knownInterfaceIds.length) {
        const condition = seenPeerIds.length
          ? and(inArray(peers.interfaceId, knownInterfaceIds), notInArray(peers.id, seenPeerIds), isNull(peers.deletedAt), eq(peers.desiredAction, "none"))
          : and(inArray(peers.interfaceId, knownInterfaceIds), isNull(peers.deletedAt), eq(peers.desiredAction, "none"));
        await db.update(peers).set({ syncStatus: "missing_on_router", updatedAt: now }).where(condition);
      }

      await db.update(routers).set({
        status: "online",
        consecutiveFailures: 0,
        lastSuccessfulConnectionAt: now,
        lastSyncedAt: now,
        lastError: null,
        updatedAt: now,
      }).where(eq(routers.id, routerId));
      return { interfaces: knownInterfaceIds.length, importedPeers, updatedPeers, syncedAt: now };
    } catch (error) {
      await recordRouterFailure(routerId, error);
      throw error;
    }
  });
}

export async function refreshRouterStatus(routerId: string) {
  return withRouterLock(routerId, async () => {
    const db = getDb();
    const { connection } = await getRouterConnection(routerId, true);
    try {
      const config = await readRouterConfiguration(connection);
      const interfaces = await db.select().from(wireguardInterfaces).where(eq(wireguardInterfaces.routerId, routerId));
      const interfaceByName = new Map(interfaces.map((item) => [item.name, item.id]));
      const now = new Date();
      let count = 0;
      for (const item of config.peers) {
        const interfaceId = interfaceByName.get(item.interface);
        if (!interfaceId || !item["public-key"]) continue;
        await db.update(peers).set({
          lastHandshakeAt: parseRouterOsDuration(item["last-handshake"]),
          currentEndpoint: [item["current-endpoint-address"], item["current-endpoint-port"]].filter(Boolean).join(":" ) || null,
          rxBytes: parseRouterOsBytes(item.rx),
          txBytes: parseRouterOsBytes(item.tx),
          lastStatusRefreshAt: now,
        }).where(and(eq(peers.interfaceId, interfaceId), eq(peers.publicKey, item["public-key"])));
        count += 1;
      }
      await db.update(routers).set({ status: "online", consecutiveFailures: 0, lastSuccessfulConnectionAt: now, lastError: null, updatedAt: now }).where(eq(routers.id, routerId));
      return { peers: count, refreshedAt: now };
    } catch (error) {
      await recordRouterFailure(routerId, error);
      throw error;
    }
  });
}
