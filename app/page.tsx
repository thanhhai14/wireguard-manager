import Link from "next/link";
import { count, desc, isNull, ne } from "drizzle-orm";
import { AlertTriangle, Building2, Network, RadioTower, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies, networks, peers, routers } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdmin();
  const db = getDb();
  const [[companyCount], [networkCount], [routerCount], [peerCount], attention, recentRouters] = await Promise.all([
    db.select({ value: count() }).from(companies),
    db.select({ value: count() }).from(networks),
    db.select({ value: count() }).from(routers),
    db.select({ value: count() }).from(peers).where(isNull(peers.deletedAt)),
    db.select({ value: count() }).from(peers).where(ne(peers.syncStatus, "synced")),
    db.select().from(routers).orderBy(desc(routers.updatedAt)).limit(6),
  ]);
  const cards = [
    { label: "Công ty", value: companyCount.value, icon: Building2, color: "bg-violet-500/10 text-violet-500" },
    { label: "Networks", value: networkCount.value, icon: Network, color: "bg-cyan-500/10 text-cyan-500" },
    { label: "Routers", value: routerCount.value, icon: RadioTower, color: "bg-blue-500/10 text-blue-500" },
    { label: "Peers", value: peerCount.value, icon: Users, color: "bg-emerald-500/10 text-emerald-500" },
  ];
  return <div className="mx-auto max-w-7xl"><PageHeader title="Tổng quan" description="Theo dõi hệ thống WireGuard trên tất cả MikroTik router" />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <div className="card p-5" key={label}><div className={`mb-5 grid size-10 place-items-center rounded-xl ${color}`}><Icon size={20} /></div><div className="text-3xl font-bold">{value}</div><div className="mt-1 text-sm text-[var(--muted)]">{label}</div></div>)}</section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]"><div className="card overflow-hidden"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">Router gần đây</h2><Link href="/networks" className="text-sm font-medium text-blue-500">Xem tất cả</Link></div>{recentRouters.length ? <div className="divide-y">{recentRouters.map((router) => <Link href={`/routers/${router.id}`} key={router.id} className="flex items-center gap-4 p-4 hover:bg-[var(--surface-soft)]"><div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><RadioTower size={19} /></div><div className="min-w-0 flex-1"><div className="truncate font-medium">{router.name}</div><div className="truncate text-xs text-[var(--muted)]">{router.host}:{router.sshPort}</div></div><div className="text-right"><StatusBadge status={router.status} /><div className="mt-1 text-[11px] text-[var(--muted)]">{formatDate(router.lastSuccessfulConnectionAt)}</div></div></Link>)}</div> : <p className="p-8 text-center text-sm text-[var(--muted)]">Chưa có router</p>}</div>
      <div className="card p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle size={20} /></div><div><div className="text-2xl font-bold">{attention[0].value}</div><div className="text-sm text-[var(--muted)]">Peer cần chú ý</div></div></div><p className="mt-5 text-sm leading-6 text-[var(--muted)]">Bao gồm peer chờ áp dụng, lỗi, khác biệt hoặc không còn tồn tại trên RouterOS.</p></div>
    </section>
  </div>;
}
