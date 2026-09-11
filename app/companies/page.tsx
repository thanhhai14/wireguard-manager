import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { createCompany } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  await requireAdmin();
  const rows = await getDb().select().from(companies).orderBy(companies.name);
  return <div className="mx-auto max-w-7xl"><PageHeader title="Công ty" description="Nhóm các Network theo đơn vị sở hữu" />
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><section>{rows.length ? <div className="grid gap-3 sm:grid-cols-2">{rows.map((company) => <Link className="card group flex items-center gap-4 p-5 hover:-translate-y-0.5 hover:border-blue-500/40" href={`/companies/${company.id}`} key={company.id}><div className="grid size-11 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Building2 size={21} /></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{company.name}</div><div className="mt-0.5 truncate text-xs text-[var(--muted)]">{company.code || company.address || "Chưa có thông tin bổ sung"}</div></div><ChevronRight className="text-[var(--muted)] group-hover:translate-x-1" size={18} /></Link>)}</div> : <EmptyState title="Chưa có công ty" description="Tạo công ty đầu tiên để bắt đầu tổ chức Network và Router." />}</section>
      <form action={createCompany} className="card h-fit space-y-4 p-5"><div className="flex items-center gap-2 font-semibold"><Plus size={18} />Thêm công ty</div><div><label className="label">Tên công ty *</label><input className="input" name="name" required /></div><div><label className="label">Mã</label><input className="input" name="code" /></div><div><label className="label">Địa chỉ</label><input className="input" name="address" /></div><div><label className="label">Mô tả</label><textarea className="input min-h-20" name="description" /></div><SubmitButton className="btn-primary w-full" pendingText="Đang tạo…">Tạo công ty</SubmitButton></form>
    </div>
  </div>;
}
