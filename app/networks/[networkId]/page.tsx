import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, ChevronRight, Plus, RadioTower } from "lucide-react";
import { notFound } from "next/navigation";
import { createRouter, updateNetwork } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies, networks, routers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function NetworkDetailPage({ params }: { params: Promise<{ networkId: string }> }) {
  await requireAdmin();
  const { networkId } = await params;
  const db = getDb();
  const [context] = await db.select({ network: networks, company: companies }).from(networks).innerJoin(companies, eq(networks.companyId, companies.id)).where(eq(networks.id, networkId)).limit(1);
  if (!context) notFound();
  const rows = await db.select().from(routers).where(eq(routers.networkId, networkId)).orderBy(routers.name);
  return <div className="mx-auto max-w-7xl"><Link href={`/companies/${context.company.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]"><ArrowLeft size={15} />{context.company.name}</Link><PageHeader title={context.network.name} description={context.network.address || "Quản lý MikroTik router tại địa điểm này"} />
    <details className="card mb-6 p-5"><summary className="cursor-pointer font-semibold">Chỉnh sửa Network</summary><form action={updateNetwork} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="networkId" value={context.network.id} /><div><label className="label">Tên *</label><input className="input" name="name" defaultValue={context.network.name} required /></div><div><label className="label">Địa chỉ</label><input className="input" name="address" defaultValue={context.network.address ?? ""} /></div><div className="sm:col-span-2"><label className="label">Mô tả</label><input className="input" name="description" defaultValue={context.network.description ?? ""} /></div><button className="btn-primary sm:col-span-2">Lưu thay đổi</button></form></details>
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]"><section>{rows.length ? <div className="space-y-3">{rows.map((router) => <Link href={`/routers/${router.id}`} className="card group flex items-center gap-4 p-5" key={router.id}><div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><RadioTower size={21} /></div><div className="min-w-0 flex-1"><div className="font-semibold">{router.name}</div><div className="truncate text-xs text-[var(--muted)]">{router.host}:{router.sshPort}</div></div><StatusBadge status={router.status} /><ChevronRight size={18} className="text-[var(--muted)] group-hover:translate-x-1" /></Link>)}</div> : <EmptyState title="Chưa có Router" description="Thêm MikroTik router và kiểm tra kết nối SSH." />}</section>
      <form action={createRouter} className="card h-fit space-y-4 p-5"><input type="hidden" name="networkId" value={networkId} /><div className="flex items-center gap-2 font-semibold"><Plus size={18} />Thêm MikroTik Router</div><div><label className="label">Tên Router *</label><input className="input" name="name" required /></div><div><label className="label">Hostname / DDNS / IP *</label><input className="input" name="host" required placeholder="abc.sn.mynetname.net" /></div><div className="grid grid-cols-[1fr_100px] gap-3"><div><label className="label">SSH username *</label><input className="input" name="username" required /></div><div><label className="label">Port *</label><input className="input" name="sshPort" type="number" defaultValue="22" required /></div></div><div><label className="label">Xác thực</label><select className="input" name="authType" defaultValue="private_key"><option value="private_key">SSH private key</option><option value="password">Password</option></select></div><div><label className="label">Private key / Password *</label><textarea className="input min-h-28 font-mono text-xs" name="secret" required autoComplete="off" /></div><div><label className="label">Mô tả</label><textarea className="input min-h-16" name="description" /></div><button className="btn-primary w-full">Lưu Router</button><p className="text-xs leading-5 text-[var(--muted)]">Credential được mã hóa trước khi lưu. Hãy kiểm tra và pin host fingerprint ở màn hình tiếp theo.</p></form>
    </div>
  </div>;
}
