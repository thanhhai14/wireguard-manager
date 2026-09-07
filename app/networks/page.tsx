import Link from "next/link";
import { eq } from "drizzle-orm";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { companies, networks } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  await requireAdmin();
  const rows = await getDb().select({ network: networks, company: companies }).from(networks).innerJoin(companies, eq(networks.companyId, companies.id)).orderBy(companies.name, networks.name);
  return <div className="mx-auto max-w-7xl"><PageHeader title="Networks" description="Tất cả địa điểm đang được quản lý" actions={<Link href="/companies" className="btn-primary">Thêm Network</Link>} />{rows.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(({ network, company }) => <Link href={`/networks/${network.id}`} className="card group p-5" key={network.id}><div className="flex items-start"><div className="grid size-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500"><MapPin size={21} /></div><ChevronRight className="ml-auto text-[var(--muted)] group-hover:translate-x-1" size={18} /></div><h2 className="mt-5 font-semibold">{network.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]"><Building2 size={13} />{company.name}</p><p className="mt-2 truncate text-xs text-[var(--muted)]">{network.address || "Chưa có địa chỉ"}</p></Link>)}</div> : <EmptyState title="Chưa có Network" description="Tạo Network từ trang chi tiết của một công ty." />}</div>;
}
