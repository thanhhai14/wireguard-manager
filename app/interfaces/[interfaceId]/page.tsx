import Link from "next/link";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { ArrowLeft, KeyRound, Network, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { notFound } from "next/navigation";
import { configureInterface, createPeer, restorePeer, stagePeerDelete, togglePeer } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PeerActions } from "@/components/peer-actions";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { interfaceAddresses, internalSubnets, peers, routers, wireguardInterfaces } from "@/lib/db/schema";
import { nextAvailableIp } from "@/lib/validation/ip";
import { formatBytes, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InterfacePage({ params }: { params: Promise<{ interfaceId: string }> }) {
  await requireAdmin();
  const { interfaceId } = await params;
  const db = getDb();
  const [context] = await db.select({ wg: wireguardInterfaces, router: routers }).from(wireguardInterfaces).innerJoin(routers, eq(wireguardInterfaces.routerId, routers.id)).where(eq(wireguardInterfaces.id, interfaceId)).limit(1);
  if (!context) notFound();
  const [addresses, subnets, activePeers, deletedPeers] = await Promise.all([
    db.select().from(interfaceAddresses).where(eq(interfaceAddresses.interfaceId, interfaceId)),
    db.select().from(internalSubnets).where(eq(internalSubnets.interfaceId, interfaceId)),
    db.select().from(peers).where(and(eq(peers.interfaceId, interfaceId), isNull(peers.deletedAt))).orderBy(peers.name),
    db.select().from(peers).where(and(eq(peers.interfaceId, interfaceId), isNotNull(peers.deletedAt))).orderBy(peers.name),
  ]);
  const wg = context.wg;
  let suggestedIp = "";
  if (wg.allocationCidr) {
    try { suggestedIp = nextAvailableIp(wg.allocationCidr, activePeers.map((peer) => peer.assignedAddress), wg.allocationStart, wg.allocationEnd); } catch { suggestedIp = ""; }
  }
  return <div className="mx-auto max-w-7xl"><Link href={`/routers/${context.router.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]"><ArrowLeft size={15} />{context.router.name}</Link><PageHeader title={wg.name} description={`WireGuard Interface · ${context.router.host}:${wg.listenPort}`} />
    <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_400px]"><section className="card p-5"><div className="mb-5 flex items-center gap-2 font-semibold"><Network size={18} />Cấu hình quản lý</div><form action={configureInterface} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="interfaceId" value={interfaceId} /><div><label className="label">Allocation CIDR *</label><input className="input" name="allocationCidr" defaultValue={wg.allocationCidr ?? addresses[0]?.cidr ?? ""} placeholder="10.20.0.0/24" /></div><div><label className="label">Router addresses</label><div className="input min-h-[42px] text-[var(--muted)]">{addresses.map((item) => item.cidr).join(", ") || "Không tìm thấy"}</div></div><div><label className="label">Allocation start</label><input className="input" name="allocationStart" defaultValue={wg.allocationStart ?? ""} placeholder="10.20.0.2" /></div><div><label className="label">Allocation end</label><input className="input" name="allocationEnd" defaultValue={wg.allocationEnd ?? ""} placeholder="10.20.0.254" /></div><div><label className="label">Client endpoint host *</label><input className="input" name="endpointHost" defaultValue={wg.clientEndpointHost ?? context.router.host} required /></div><div><label className="label">Endpoint port *</label><input className="input" name="endpointPort" type="number" defaultValue={wg.clientEndpointPort ?? wg.listenPort} required /></div><div><label className="label">DNS</label><input className="input" name="dns" defaultValue={wg.clientDns ?? ""} placeholder="192.168.1.1" /></div><div><label className="label">Internal subnets</label><input className="input" name="internalSubnets" defaultValue={subnets.map((item) => item.cidr).join(", ")} placeholder="192.168.10.0/24, 10.10.0.0/16" /></div><SubmitButton className="btn-primary sm:col-span-2" pendingText="Đang lưu…"><Save size={17} />Lưu cấu hình interface</SubmitButton></form></section>
      <section className="card p-5"><div className="mb-5 flex items-center gap-2 font-semibold"><KeyRound size={18} />Thêm Peer</div>{wg.allocationCidr ? <form action={createPeer} className="space-y-3"><input type="hidden" name="interfaceId" value={interfaceId} /><div className="grid grid-cols-2 gap-3"><div><label className="label">Tên *</label><input className="input" name="name" required /></div><div><label className="label">IP /32 *</label><input className="input" name="assignedAddress" defaultValue={suggestedIp} required /></div></div><div><label className="label">Comment *</label><input className="input" name="comment" required /></div><div><label className="label">Mode</label><select className="input" name="mode" defaultValue="internal"><option value="internet">Internet</option><option value="internal">Internal</option><option value="site_to_site">Site-to-site</option></select></div>{subnets.length > 0 && <fieldset><legend className="label">Internal subnets</legend><div className="flex flex-wrap gap-2">{subnets.map((subnet) => <label key={subnet.id} className="rounded-lg border px-2.5 py-1.5 text-xs"><input className="mr-2" type="checkbox" name="internalSubnetIds" value={subnet.id} />{subnet.cidr}</label>)}</div></fieldset>}<div><label className="label">Remote subnets (site-to-site)</label><input className="input" name="remoteSubnets" placeholder="192.168.50.0/24" /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Remote endpoint</label><input className="input" name="remoteEndpointHost" /></div><div><label className="label">Port</label><input className="input" name="remoteEndpointPort" type="number" /></div></div><div><label className="label">Private key có sẵn</label><textarea className="input min-h-16 font-mono text-xs" name="privateKey" placeholder="Để trống để tự sinh" /></div><input type="hidden" name="keepalive" value="25" /><SubmitButton className="btn-primary w-full" pendingText="Đang tạo…"><Plus size={17} />Tạo Peer nháp</SubmitButton></form> : <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-600">Hãy lưu Allocation CIDR trước khi tạo peer.</p>}</section></div>
    <PeerTable title="Peers" rows={activePeers} interfaceId={interfaceId} />
    {deletedPeers.length > 0 && <div className="mt-6"><PeerTable title="Đã xóa" rows={deletedPeers} interfaceId={interfaceId} deleted /></div>}
  </div>;
}

function PeerTable({ title, rows, interfaceId, deleted = false }: { title: string; rows: Array<typeof peers.$inferSelect>; interfaceId: string; deleted?: boolean }) {
  const threshold = Number(process.env.PEER_ONLINE_THRESHOLD_SECONDS ?? 180) * 1000;
  return (
    <section className="card overflow-hidden">
      <div className="border-b p-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{rows.length} peer</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs text-[var(--muted)]">
              <tr><th className="px-5 py-3">Peer</th><th className="px-4 py-3">IP / Mode</th><th className="px-4 py-3">Sync</th><th className="px-4 py-3">Handshake</th><th className="px-4 py-3">Traffic</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((peer) => {
                const online = peer.lastHandshakeAt && peer.lastStatusRefreshAt && peer.lastStatusRefreshAt.getTime() - peer.lastHandshakeAt.getTime() <= threshold;
                return (
                  <tr key={peer.id} className="hover:bg-[var(--surface-soft)]">
                    <td className="px-5 py-4"><div className="font-semibold">{peer.name}</div><div className="mt-0.5 max-w-48 truncate text-xs text-[var(--muted)]">{peer.comment}</div>{!peer.privateKey && <div className="mt-1 text-[11px] text-amber-600">Thiếu client private key</div>}</td>
                    <td className="px-4 py-4"><div className="font-mono text-xs">{peer.assignedAddress}</div><div className="mt-1 text-xs capitalize text-[var(--muted)]">{peer.mode.replaceAll("_", "-")}</div></td>
                    <td className="px-4 py-4"><StatusBadge status={peer.syncStatus} />{peer.isDisabled && <div className="mt-1 text-xs text-[var(--muted)]">Disabled</div>}</td>
                    <td className="px-4 py-4"><div className={online ? "text-emerald-500" : "text-[var(--muted)]"}>{online ? "Online" : "Offline"}</div><div className="mt-1 text-[11px] text-[var(--muted)]">{formatDate(peer.lastHandshakeAt)}</div></td>
                    <td className="px-4 py-4 text-xs"><div>↓ {formatBytes(peer.rxBytes)}</div><div className="mt-1">↑ {formatBytes(peer.txBytes)}</div></td>
                    <td className="px-5 py-4">
                      <PeerActions peerId={peer.id} canExport={Boolean(peer.privateKey)} deleted={deleted} hasPending={peer.desiredAction !== "none"} />
                      <div className="mt-2 flex justify-end gap-2">
                        {deleted ? (
                          <form action={restorePeer}><input type="hidden" name="peerId" value={peer.id} /><input type="hidden" name="interfaceId" value={interfaceId} /><SubmitButton className="text-xs text-blue-500" pendingText="Đang khôi phục…"><Undo2 className="mr-1 inline" size={13} />Khôi phục</SubmitButton></form>
                        ) : (
                          <>
                            <form action={togglePeer}><input type="hidden" name="peerId" value={peer.id} /><input type="hidden" name="interfaceId" value={interfaceId} /><input type="hidden" name="disabled" value={String(!peer.isDisabled)} /><SubmitButton className="text-xs text-blue-500" pendingText="Đang lưu…">{peer.isDisabled ? "Mở khóa" : "Tạm khóa"}</SubmitButton></form>
                            <form action={stagePeerDelete}><input type="hidden" name="peerId" value={peer.id} /><input type="hidden" name="interfaceId" value={interfaceId} /><SubmitButton className="text-xs text-red-500" pendingText="Đang xóa…"><Trash2 className="mr-1 inline" size={13} />Xóa</SubmitButton></form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="p-10 text-center text-sm text-[var(--muted)]">Chưa có peer</div>}
    </section>
  );
}
