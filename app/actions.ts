"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies, internalSubnets, networks, peerInternalSubnets, peerRemoteSubnets, peers, routers, wireguardInterfaces } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security";
import { generateWireGuardKeys, deriveWireGuardPublicKey } from "@/lib/wireguard/keys";
import { cidrsOverlap, ipToNumber, isPrivateCidr, isUsableHostInCidr, parseCidr } from "@/lib/validation/ip";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const idSchema = z.string().uuid();
const requiredText = z.string().trim().min(1).max(255);

export async function createCompany(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const name = requiredText.parse(text(form, "name"));
  const [company] = await db.insert(companies).values({ name, code: text(form, "code") || null, address: text(form, "address") || null, description: text(form, "description") || null }).returning();
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(form: FormData) {
  await requireAdmin();
  const companyId = idSchema.parse(text(form, "companyId"));
  await getDb().update(companies).set({
    name: requiredText.parse(text(form, "name")),
    code: text(form, "code") || null,
    address: text(form, "address") || null,
    description: text(form, "description") || null,
    updatedAt: new Date(),
  }).where(eq(companies.id, companyId));
  revalidatePath(`/companies/${companyId}`);
}

export async function createNetwork(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const companyId = idSchema.parse(text(form, "companyId"));
  const name = requiredText.parse(text(form, "name"));
  const [network] = await db.insert(networks).values({ companyId, name, address: text(form, "address") || null, description: text(form, "description") || null }).returning();
  redirect(`/networks/${network.id}`);
}

export async function updateNetwork(form: FormData) {
  await requireAdmin();
  const networkId = idSchema.parse(text(form, "networkId"));
  await getDb().update(networks).set({
    name: requiredText.parse(text(form, "name")),
    address: text(form, "address") || null,
    description: text(form, "description") || null,
    updatedAt: new Date(),
  }).where(eq(networks.id, networkId));
  revalidatePath(`/networks/${networkId}`);
}

export async function createRouter(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const networkId = idSchema.parse(text(form, "networkId"));
  const authType = z.enum(["private_key", "password"]).parse(text(form, "authType"));
  const secret = requiredText.parse(text(form, "secret"));
  const [router] = await db.insert(routers).values({
    networkId,
    name: requiredText.parse(text(form, "name")),
    host: requiredText.parse(text(form, "host")),
    sshPort: z.coerce.number().int().min(1).max(65535).parse(text(form, "sshPort") || 22),
    sshUsername: requiredText.parse(text(form, "username")),
    sshAuthType: authType,
    sshSecret: encryptSecret(secret),
    description: text(form, "description") || null,
  }).returning();
  redirect(`/routers/${router.id}`);
}

export async function updateRouter(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const routerId = idSchema.parse(text(form, "routerId"));
  const [current] = await db.select().from(routers).where(eq(routers.id, routerId)).limit(1);
  if (!current) throw new Error("Không tìm thấy router");
  const host = requiredText.parse(text(form, "host"));
  const sshPort = z.coerce.number().int().min(1).max(65535).parse(text(form, "sshPort"));
  const secret = text(form, "secret");
  await db.update(routers).set({
    name: requiredText.parse(text(form, "name")),
    host,
    sshPort,
    sshUsername: requiredText.parse(text(form, "username")),
    sshAuthType: z.enum(["private_key", "password"]).parse(text(form, "authType")),
    ...(secret ? { sshSecret: encryptSecret(secret) } : {}),
    ...(host !== current.host || sshPort !== current.sshPort ? { hostKeyFingerprint: null, status: "unknown" as const } : {}),
    description: text(form, "description") || null,
    updatedAt: new Date(),
  }).where(eq(routers.id, routerId));
  revalidatePath(`/routers/${routerId}`);
}

export async function configureInterface(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const interfaceId = idSchema.parse(text(form, "interfaceId"));
  const allocationCidr = text(form, "allocationCidr");
  if (allocationCidr && !isPrivateCidr(allocationCidr)) throw new Error("Allocation CIDR phải là private IPv4 CIDR");
  const pool = allocationCidr ? parseCidr(allocationCidr) : null;
  const allocationStart = text(form, "allocationStart");
  const allocationEnd = text(form, "allocationEnd");
  if (pool && allocationStart && (ipToNumber(allocationStart) <= pool.network || ipToNumber(allocationStart) >= pool.broadcast)) throw new Error("Allocation start nằm ngoài subnet hoặc không phải host address");
  if (pool && allocationEnd && (ipToNumber(allocationEnd) <= pool.network || ipToNumber(allocationEnd) >= pool.broadcast)) throw new Error("Allocation end nằm ngoài subnet hoặc không phải host address");
  if (allocationStart && allocationEnd && ipToNumber(allocationStart) > ipToNumber(allocationEnd)) throw new Error("Allocation start phải nhỏ hơn hoặc bằng allocation end");
  const rawSubnets = text(form, "internalSubnets").split(",").map((item) => item.trim()).filter(Boolean);
  for (const subnet of rawSubnets) {
    if (!isPrivateCidr(subnet)) throw new Error(`${subnet} không phải private IPv4 CIDR hợp lệ`);
    if (allocationCidr && cidrsOverlap(subnet, allocationCidr)) throw new Error(`${subnet} chồng lấn với allocation CIDR`);
  }
  for (let i = 0; i < rawSubnets.length; i += 1) for (let j = i + 1; j < rawSubnets.length; j += 1) {
    if (cidrsOverlap(rawSubnets[i], rawSubnets[j])) throw new Error(`${rawSubnets[i]} chồng lấn với ${rawSubnets[j]}`);
  }
  await db.update(wireguardInterfaces).set({
    allocationCidr: allocationCidr || null,
    allocationStart: allocationStart || null,
    allocationEnd: allocationEnd || null,
    clientEndpointHost: requiredText.parse(text(form, "endpointHost")),
    clientEndpointPort: z.coerce.number().int().min(1).max(65535).parse(text(form, "endpointPort")),
    clientDns: text(form, "dns") || null,
    updatedAt: new Date(),
  }).where(eq(wireguardInterfaces.id, interfaceId));
  await db.delete(internalSubnets).where(eq(internalSubnets.interfaceId, interfaceId));
  if (rawSubnets.length) await db.insert(internalSubnets).values(rawSubnets.map((cidr) => ({ interfaceId, cidr: parseCidr(cidr).normalized })));
  revalidatePath(`/interfaces/${interfaceId}`);
}

export async function createPeer(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const interfaceId = idSchema.parse(text(form, "interfaceId"));
  const [wg] = await db.select().from(wireguardInterfaces).where(eq(wireguardInterfaces.id, interfaceId)).limit(1);
  if (!wg?.allocationCidr) throw new Error("WireGuard Interface chưa có allocation CIDR");
  const assignedAddress = text(form, "assignedAddress");
  if (!isUsableHostInCidr(assignedAddress, wg.allocationCidr)) throw new Error("IP peer không hợp lệ hoặc nằm ngoài allocation subnet");
  const duplicate = await db.select({ id: peers.id }).from(peers).where(and(eq(peers.interfaceId, interfaceId), eq(peers.assignedAddress, assignedAddress), isNull(peers.deletedAt))).limit(1);
  if (duplicate.length) throw new Error("IP peer đã được sử dụng");

  const suppliedPrivateKey = text(form, "privateKey");
  const generated = suppliedPrivateKey
    ? { privateKey: suppliedPrivateKey, publicKey: deriveWireGuardPublicKey(suppliedPrivateKey), presharedKey: generateWireGuardKeys().presharedKey }
    : generateWireGuardKeys();
  const suppliedPublicKey = text(form, "publicKey");
  if (suppliedPublicKey && suppliedPublicKey !== generated.publicKey) throw new Error("Public key không khớp private key");
  const mode = z.enum(["internet", "internal", "site_to_site"]).parse(text(form, "mode"));
  const selectedSubnetIds = form.getAll("internalSubnetIds").filter((value): value is string => typeof value === "string").filter((value) => z.string().uuid().safeParse(value).success);
  const remoteSubnets = text(form, "remoteSubnets").split(",").map((item) => item.trim()).filter(Boolean);
  if (mode === "internal" && !selectedSubnetIds.length) throw new Error("Peer Internal phải chọn ít nhất một internal subnet");
  if (mode === "site_to_site" && !remoteSubnets.length) throw new Error("Peer Site-to-site phải có ít nhất một remote subnet");
  for (const cidr of remoteSubnets) parseCidr(cidr);
  const [peer] = await db.insert(peers).values({
    interfaceId,
    name: requiredText.parse(text(form, "name")),
    comment: requiredText.parse(text(form, "comment")),
    mode,
    publicKey: generated.publicKey,
    privateKey: encryptSecret(generated.privateKey),
    presharedKey: encryptSecret(generated.presharedKey),
    assignedAddress,
    persistentKeepalive: z.coerce.number().int().min(0).max(65535).parse(text(form, "keepalive") || 25),
    remoteEndpointHost: text(form, "remoteEndpointHost") || null,
    remoteEndpointPort: text(form, "remoteEndpointPort") ? z.coerce.number().int().min(1).max(65535).parse(text(form, "remoteEndpointPort")) : null,
    desiredAction: "create",
    syncStatus: "pending",
  }).returning();

  if (mode === "internal" && selectedSubnetIds.length) await db.insert(peerInternalSubnets).values(selectedSubnetIds.map((subnetId) => ({ peerId: peer.id, subnetId })));
  if (mode === "site_to_site" && remoteSubnets.length) {
    await db.insert(peerRemoteSubnets).values(remoteSubnets.map((cidr) => ({ peerId: peer.id, cidr: parseCidr(cidr).normalized })));
  }
  revalidatePath(`/interfaces/${interfaceId}`);
}

export async function updatePeer(form: FormData) {
  await requireAdmin();
  const db = getDb();
  const peerId = idSchema.parse(text(form, "peerId"));
  const [current] = await db.select().from(peers).where(eq(peers.id, peerId)).limit(1);
  if (!current) throw new Error("Không tìm thấy peer");
  const [wg] = await db.select().from(wireguardInterfaces).where(eq(wireguardInterfaces.id, current.interfaceId)).limit(1);
  if (!wg?.allocationCidr) throw new Error("Interface chưa có allocation CIDR");
  const assignedAddress = text(form, "assignedAddress");
  if (!isUsableHostInCidr(assignedAddress, wg.allocationCidr)) throw new Error("IP peer không hợp lệ hoặc ngoài allocation subnet");
  const duplicate = await db.select({ id: peers.id }).from(peers).where(and(eq(peers.interfaceId, current.interfaceId), eq(peers.assignedAddress, assignedAddress), isNull(peers.deletedAt))).limit(2);
  if (duplicate.some((item) => item.id !== peerId)) throw new Error("IP peer đã được sử dụng");

  const rotateKeys = text(form, "rotateKeys") === "yes";
  const suppliedPrivateKey = text(form, "privateKey");
  let keyUpdate: Partial<typeof peers.$inferInsert> = {};
  if (rotateKeys) {
    const generated = generateWireGuardKeys();
    keyUpdate = { publicKey: generated.publicKey, privateKey: encryptSecret(generated.privateKey), presharedKey: encryptSecret(generated.presharedKey) };
  } else if (suppliedPrivateKey) {
    const publicKey = deriveWireGuardPublicKey(suppliedPrivateKey);
    if (publicKey !== current.publicKey) throw new Error("Private key không khớp public key hiện tại. Chọn xoay key nếu muốn tạo cặp mới.");
    keyUpdate = { privateKey: encryptSecret(suppliedPrivateKey) };
  }
  const mode = z.enum(["internet", "internal", "site_to_site"]).parse(text(form, "mode"));
  const selectedSubnetIds = form.getAll("internalSubnetIds").filter((value): value is string => typeof value === "string").filter((value) => z.string().uuid().safeParse(value).success);
  const remoteSubnets = text(form, "remoteSubnets").split(",").map((item) => item.trim()).filter(Boolean);
  if (mode === "internal" && !selectedSubnetIds.length) throw new Error("Peer Internal phải chọn ít nhất một internal subnet");
  if (mode === "site_to_site" && !remoteSubnets.length) throw new Error("Peer Site-to-site phải có ít nhất một remote subnet");
  for (const cidr of remoteSubnets) parseCidr(cidr);
  await db.update(peers).set({
    name: requiredText.parse(text(form, "name")),
    comment: requiredText.parse(text(form, "comment")),
    assignedAddress,
    mode,
    persistentKeepalive: z.coerce.number().int().min(0).max(65535).parse(text(form, "keepalive") || 25),
    remoteEndpointHost: text(form, "remoteEndpointHost") || null,
    remoteEndpointPort: text(form, "remoteEndpointPort") ? z.coerce.number().int().min(1).max(65535).parse(text(form, "remoteEndpointPort")) : null,
    desiredAction: current.deletedAt ? "restore" : current.appliedPublicKey ? "update" : "create",
    syncStatus: "pending",
    lastApplyError: null,
    ...keyUpdate,
    updatedAt: new Date(),
  }).where(eq(peers.id, peerId));

  await db.delete(peerInternalSubnets).where(eq(peerInternalSubnets.peerId, peerId));
  await db.delete(peerRemoteSubnets).where(eq(peerRemoteSubnets.peerId, peerId));
  if (mode === "internal" && selectedSubnetIds.length) await db.insert(peerInternalSubnets).values(selectedSubnetIds.map((subnetId) => ({ peerId, subnetId })));
  if (mode === "site_to_site" && remoteSubnets.length) {
    await db.insert(peerRemoteSubnets).values(remoteSubnets.map((cidr) => ({ peerId, cidr: parseCidr(cidr).normalized })));
  }
  revalidatePath(`/interfaces/${current.interfaceId}`);
  redirect(`/interfaces/${current.interfaceId}`);
}

export async function stagePeerDelete(form: FormData) {
  await requireAdmin();
  const peerId = idSchema.parse(text(form, "peerId"));
  const interfaceId = idSchema.parse(text(form, "interfaceId"));
  await getDb().update(peers).set({ desiredAction: "delete", syncStatus: "pending", updatedAt: new Date() }).where(eq(peers.id, peerId));
  revalidatePath(`/interfaces/${interfaceId}`);
}

export async function restorePeer(form: FormData) {
  await requireAdmin();
  const peerId = idSchema.parse(text(form, "peerId"));
  const interfaceId = idSchema.parse(text(form, "interfaceId"));
  await getDb().update(peers).set({ desiredAction: "restore", syncStatus: "pending", updatedAt: new Date() }).where(eq(peers.id, peerId));
  revalidatePath(`/interfaces/${interfaceId}`);
}

export async function togglePeer(form: FormData) {
  await requireAdmin();
  const peerId = idSchema.parse(text(form, "peerId"));
  const interfaceId = idSchema.parse(text(form, "interfaceId"));
  const disabled = text(form, "disabled") === "true";
  await getDb().update(peers).set({ isDisabled: disabled, desiredAction: "update", syncStatus: "pending", updatedAt: new Date() }).where(eq(peers.id, peerId));
  revalidatePath(`/interfaces/${interfaceId}`);
}
