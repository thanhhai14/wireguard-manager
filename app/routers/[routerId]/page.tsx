import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, ChevronRight, Clock3, KeyRound, RadioTower, Server } from "lucide-react";
import { notFound } from "next/navigation";
import { updateRouter } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { RouterControls } from "@/components/router-controls";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { networks, routers, wireguardInterfaces } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function RouterPage({ params }: { params: Promise<{ routerId: string }> }) {
  await requireAdmin();
  const { routerId } = await params;
  const db = getDb();
  const [context] = await db.select({ router: routers, network: networks }).from(routers).innerJoin(networks, eq(routers.networkId, networks.id)).where(eq(routers.id, routerId)).limit(1);
  if (!context) notFound();
  const interfaces = await db.select().from(wireguardInterfaces).where(eq(wireguardInterfaces.routerId, routerId)).orderBy(wireguardInterfaces.name);
  const router = context.router;
  return <div className="mx-auto max-w-7xl"><Link href={`/networks/${context.network.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]"><ArrowLeft size={15} />{context.network.name}</Link><PageHeader title={router.name} description={`${router.host}:${router.sshPort}`} actions={<RouterControls routerId={routerId} trusted={Boolean(router.hostKeyFingerprint)} />} />
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><InfoCard icon={<RadioTower size={19} />} label="Trạng thái" value={<StatusBadge status={router.status} />} /><InfoCard icon={<Server size={19} />} label="RouterOS" value={router.routerOsVersion || "Chưa kiểm tra"} /><InfoCard icon={<Clock3 size={19} />} label="Lần kết nối gần nhất" value={formatDate(router.lastSuccessfulConnectionAt)} /><InfoCard icon={<KeyRound size={19} />} label="SSH fingerprint" value={router.hostKeyFingerprint ? `${router.hostKeyFingerprint.slice(0, 20)}…` : "Chưa tin cậy"} /></section>
    <details className="card mb-6 p-5"><summary className="cursor-pointer font-semibold">Chỉnh sửa kết nối Router</summary><form action={updateRouter} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="routerId" value={router.id} /><div><label className="label">Tên *</label><input className="input" name="name" defaultValue={router.name} required /></div><div><label className="label">Hostname / DDNS / IP *</label><input className="input" name="host" defaultValue={router.host} required /></div><div><label className="label">SSH username *</label><input className="input" name="username" defaultValue={router.sshUsername} required /></div><div><label className="label">SSH port *</label><input className="input" name="sshPort" type="number" defaultValue={router.sshPort} required /></div><div><label className="label">Xác thực</label><select className="input" name="authType" defaultValue={router.sshAuthType}><option value="private_key">SSH private key</option><option value="password">Password</option></select></div><div><label className="label">Credential mới</label><textarea className="input min-h-28 font-mono text-xs" name="secret" placeholder="Để trống để giữ nguyên" autoComplete="off" /></div><div className="sm:col-span-2"><label className="label">Mô tả</label><input className="input" name="description" defaultValue={router.description ?? ""} /></div><SubmitButton className="btn-primary sm:col-span-2" pendingText="Đang lưu…">Lưu thay đổi</SubmitButton></form></details>
    {router.lastError && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">{router.lastError}</div>}
    <section className="card overflow-hidden"><div className="border-b p-5"><h2 className="font-semibold">WireGuard Interfaces</h2><p className="mt-1 text-xs text-[var(--muted)]">Bấm Đồng bộ từ Router để tải interface và peer hiện có.</p></div>{interfaces.length ? <div className="divide-y">{interfaces.map((item) => <Link key={item.id} href={`/interfaces/${item.id}`} className="group flex items-center gap-4 p-5 hover:bg-[var(--surface-soft)]"><div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><Server size={20} /></div><div className="min-w-0 flex-1"><div className="font-semibold">{item.name}</div><div className="mt-1 text-xs text-[var(--muted)]">Listen {item.listenPort} · MTU {item.mtu ?? "—"} · {item.allocationCidr ?? "Chưa chọn allocation subnet"}</div></div><StatusBadge status={item.isDisabled ? "offline" : item.isRunning ? "online" : "unknown"} /><ChevronRight className="text-[var(--muted)] group-hover:translate-x-1" size={18} /></Link>)}</div> : <div className="p-10 text-center text-sm text-[var(--muted)]">Chưa có interface. Hãy kiểm tra kết nối và đồng bộ.</div>}</section>
  </div>;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="card p-4"><div className="mb-3 text-blue-500">{icon}</div><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-1 truncate text-sm font-semibold">{value}</div></div>;
}
