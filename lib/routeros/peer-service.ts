import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { interfaceAddresses, internalSubnets, peerInternalSubnets, peerRemoteSubnets, peers, routers, wireguardInterfaces } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/security";
import { buildAddPeerCommand, buildRemovePeerCommand, buildSetPeerCommand, type PeerCommandInput } from "./commands";
import { readRouterConfiguration, runRouterCommand } from "./client";
import { getRouterConnection, withRouterLock } from "./service";

export async function getPeerContext(peerId: string) {
  const db = getDb();
  const [row] = await db.select({ peer: peers, wg: wireguardInterfaces, router: routers })
    .from(peers)
    .innerJoin(wireguardInterfaces, eq(peers.interfaceId, wireguardInterfaces.id))
    .innerJoin(routers, eq(wireguardInterfaces.routerId, routers.id))
    .where(eq(peers.id, peerId)).limit(1);
  if (!row) throw new Error("Không tìm thấy peer");
  const remote = await db.select().from(peerRemoteSubnets).where(eq(peerRemoteSubnets.peerId, peerId));
  const selectedInternal = await db.select({ cidr: internalSubnets.cidr })
    .from(peerInternalSubnets)
    .innerJoin(internalSubnets, eq(peerInternalSubnets.subnetId, internalSubnets.id))
    .where(eq(peerInternalSubnets.peerId, peerId));
  const allInternal = await db.select({ cidr: internalSubnets.cidr }).from(internalSubnets).where(eq(internalSubnets.interfaceId, row.wg.id));
  const addresses = await db.select({ cidr: interfaceAddresses.cidr }).from(interfaceAddresses).where(eq(interfaceAddresses.interfaceId, row.wg.id));
  return {
    ...row,
    remoteSubnets: remote.map((item) => item.cidr),
    internalCidrs: selectedInternal.map((item) => item.cidr),
    allInternalCidrs: allInternal.map((item) => item.cidr),
    interfaceCidrs: addresses.map((item) => item.cidr),
  };
}

function toCommandInput(context: Awaited<ReturnType<typeof getPeerContext>>): PeerCommandInput {
  return {
    interfaceName: context.wg.name,
    publicKey: context.peer.publicKey,
    presharedKey: context.peer.presharedKey ? decryptSecret(context.peer.presharedKey) : null,
    assignedAddress: context.peer.assignedAddress,
    remoteSubnets: context.peer.mode === "site_to_site" ? context.remoteSubnets : [],
    persistentKeepalive: context.peer.persistentKeepalive,
    disabled: context.peer.isDisabled,
    comment: context.peer.comment,
    remoteEndpointHost: context.peer.remoteEndpointHost,
    remoteEndpointPort: context.peer.remoteEndpointPort,
  };
}

export async function previewPeerCommand(peerId: string, revealSecrets = false) {
  const context = await getPeerContext(peerId);
  const input = toCommandInput(context);
  if (!revealSecrets && input.presharedKey) input.presharedKey = "••••••••";
  switch (context.peer.desiredAction) {
    case "delete": return buildRemovePeerCommand(context.peer.appliedPublicKey ?? context.peer.publicKey);
    case "update": return buildSetPeerCommand(context.peer.appliedPublicKey ?? context.peer.publicKey, input);
    case "create":
    case "restore": return buildAddPeerCommand(input);
    default: return "# Peer không có thay đổi chờ áp dụng";
  }
}

export async function applyPeer(peerId: string) {
  const context = await getPeerContext(peerId);
  return withRouterLock(context.router.id, async () => {
    const db = getDb();
    const latest = await getPeerContext(peerId);
    if (latest.peer.desiredAction === "none") return { ok: true, message: "Peer không có thay đổi" };
    const command = await previewPeerCommand(peerId, true);
    const { connection } = await getRouterConnection(latest.router.id, true);
    try {
      await runRouterCommand(connection, command);
      const after = await readRouterConfiguration(connection);
      const expectedPresent = latest.peer.desiredAction !== "delete";
      const isPresent = after.peers.some((item) => item["public-key"] === latest.peer.publicKey || item["public-key"] === latest.peer.appliedPublicKey);
      if (isPresent !== expectedPresent) throw new Error("RouterOS đã nhận command nhưng kết quả xác minh không khớp");
      const now = new Date();
      if (latest.peer.desiredAction === "delete") {
        await db.update(peers).set({
          desiredAction: "none",
          syncStatus: "deleted",
          deletedAt: now,
          routerOsId: null,
          lastApplyError: null,
          updatedAt: now,
        }).where(eq(peers.id, peerId));
      } else {
        await db.update(peers).set({
          desiredAction: "none",
          syncStatus: "synced",
          deletedAt: null,
          appliedPublicKey: latest.peer.publicKey,
          lastApplyError: null,
          updatedAt: now,
        }).where(eq(peers.id, peerId));
      }
      return { ok: true, message: "Đã áp dụng lên RouterOS", command };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể áp dụng peer";
      await db.update(peers).set({ syncStatus: "apply_failed", lastApplyError: message, updatedAt: new Date() }).where(eq(peers.id, peerId));
      throw new Error(message);
    }
  });
}
