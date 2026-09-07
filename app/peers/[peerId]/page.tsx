import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { updatePeer } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { internalSubnets, peerInternalSubnets, peerRemoteSubnets, peers, wireguardInterfaces } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function PeerEditPage({ params }: { params: Promise<{ peerId: string }> }) {
  await requireAdmin();
  const { peerId } = await params;
  const db = getDb();
  const [context] = await db.select({ peer: peers, wg: wireguardInterfaces }).from(peers).innerJoin(wireguardInterfaces, eq(peers.interfaceId, wireguardInterfaces.id)).where(eq(peers.id, peerId)).limit(1);
  if (!context) notFound();
  const [subnets, selected, remote] = await Promise.all([
    db.select().from(internalSubnets).where(eq(internalSubnets.interfaceId, context.wg.id)),
    db.select().from(peerInternalSubnets).where(eq(peerInternalSubnets.peerId, peerId)),
    db.select().from(peerRemoteSubnets).where(eq(peerRemoteSubnets.peerId, peerId)),
  ]);
  const selectedIds = new Set(selected.map((item) => item.subnetId));
  return <div className="mx-auto max-w-3xl"><Link href={`/interfaces/${context.wg.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]"><ArrowLeft size={15} />{context.wg.name}</Link><PageHeader title={`Sửa ${context.peer.name}`} description="Thay đổi được lưu ở trạng thái chờ áp dụng trước khi gửi xuống RouterOS" />
    <form action={updatePeer} className="card space-y-5 p-6"><input type="hidden" name="peerId" value={peerId} /><div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Tên *</label><input className="input" name="name" defaultValue={context.peer.name} required /></div><div><label className="label">Assigned IP *</label><input className="input font-mono" name="assignedAddress" defaultValue={context.peer.assignedAddress} required /></div></div><div><label className="label">Comment *</label><input className="input" name="comment" defaultValue={context.peer.comment} required /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Mode</label><select className="input" name="mode" defaultValue={context.peer.mode}><option value="internet">Internet</option><option value="internal">Internal</option><option value="site_to_site">Site-to-site</option></select></div><div><label className="label">Persistent keepalive</label><input className="input" name="keepalive" type="number" min="0" max="65535" defaultValue={context.peer.persistentKeepalive} /></div></div>{subnets.length > 0 && <fieldset><legend className="label">Internal subnets</legend><div className="flex flex-wrap gap-2">{subnets.map((subnet) => <label key={subnet.id} className="rounded-lg border px-3 py-2 text-xs"><input className="mr-2" type="checkbox" name="internalSubnetIds" value={subnet.id} defaultChecked={selectedIds.has(subnet.id)} />{subnet.cidr}</label>)}</div></fieldset>}<div><label className="label">Remote subnets (site-to-site)</label><input className="input" name="remoteSubnets" defaultValue={remote.map((item) => item.cidr).join(", ")} /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Remote endpoint</label><input className="input" name="remoteEndpointHost" defaultValue={context.peer.remoteEndpointHost ?? ""} /></div><div><label className="label">Remote endpoint port</label><input className="input" name="remoteEndpointPort" type="number" defaultValue={context.peer.remoteEndpointPort ?? ""} /></div></div><div className="rounded-xl border bg-[var(--surface-soft)] p-4"><div className="flex items-center gap-2 font-medium"><KeyRound size={17} />Client key</div><p className="mt-1 text-xs text-[var(--muted)]">Public key: <span className="break-all font-mono">{context.peer.publicKey}</span></p>{!context.peer.privateKey && <div className="mt-3"><label className="label">Bổ sung private key</label><textarea className="input min-h-20 font-mono text-xs" name="privateKey" placeholder="Private key phải khớp public key hiện tại" /></div>}<label className="mt-4 flex items-center gap-2 text-sm text-red-500"><input type="checkbox" name="rotateKeys" value="yes" />Xoay mới client key pair và preshared key</label></div><button className="btn-primary w-full"><Save size={17} />Lưu thay đổi</button></form>
  </div>;
}
