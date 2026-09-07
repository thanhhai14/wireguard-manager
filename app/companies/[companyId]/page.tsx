import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { createNetwork, updateCompany } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies, networks } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  await requireAdmin();
  const { companyId } = await params;
  const db = getDb();
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) notFound();
  const rows = await db.select().from(networks).where(eq(networks.companyId, companyId)).orderBy(networks.name);
  return <div className="mx-auto max-w-7xl"><Link href="/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]"><ArrowLeft size={15} />Công ty</Link><PageHeader title={company.name} description={[company.code, company.address].filter(Boolean).join(" · ") || "Quản lý các địa điểm của công ty"} />
    <details className="card mb-6 p-5"><summary className="cursor-pointer font-semibold">Chỉnh sửa thông tin công ty</summary><form action={updateCompany} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="companyId" value={company.id} /><div><label className="label">Tên *</label><input className="input" name="name" defaultValue={company.name} required /></div><div><label className="label">Mã</label><input className="input" name="code" defaultValue={company.code ?? ""} /></div><div><label className="label">Địa chỉ</label><input className="input" name="address" defaultValue={company.address ?? ""} /></div><div><label className="label">Mô tả</label><input className="input" name="description" defaultValue={company.description ?? ""} /></div><button className="btn-primary sm:col-span-2">Lưu thay đổi</button></form></details>
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><section>{rows.length ? <div className="grid gap-3 sm:grid-cols-2">{rows.map((network) => <Link href={`/networks/${network.id}`} className="card group flex items-center gap-4 p-5" key={network.id}><div className="grid size-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500"><MapPin size={21} /></div><div className="min-w-0 flex-1"><div className="font-semibold">{network.name}</div><div className="truncate text-xs text-[var(--muted)]">{network.address || "Chưa có địa chỉ"}</div></div><ChevronRight size={18} className="text-[var(--muted)] group-hover:translate-x-1" /></Link>)}</div> : <EmptyState title="Chưa có Network" description="Tạo địa điểm đầu tiên cho công ty này." />}</section>
      <form action={createNetwork} className="card h-fit space-y-4 p-5"><input type="hidden" name="companyId" value={companyId} /><div className="flex items-center gap-2 font-semibold"><Plus size={18} />Thêm Network</div><div><label className="label">Tên địa điểm *</label><input className="input" name="name" required placeholder="Văn phòng Q12" /></div><div><label className="label">Địa chỉ</label><input className="input" name="address" /></div><div><label className="label">Mô tả</label><textarea className="input min-h-20" name="description" /></div><button className="btn-primary w-full">Tạo Network</button></form>
    </div>
  </div>;
}
