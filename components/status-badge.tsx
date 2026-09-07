import { cn } from "@/lib/utils/cn";

const labels: Record<string, string> = {
  online: "Online", offline: "Offline", error: "Lỗi", unknown: "Chưa kiểm tra",
  pending: "Chờ áp dụng", synced: "Đã đồng bộ", apply_failed: "Lỗi áp dụng",
  drifted: "Khác Router", missing_on_router: "Không còn trên Router",
  reappeared_on_router: "Xuất hiện lại", deleted: "Đã xóa",
};

export function StatusBadge({ status }: { status: string }) {
  const good = ["online", "synced"].includes(status);
  const warning = ["pending", "unknown", "drifted", "missing_on_router", "reappeared_on_router"].includes(status);
  return <span className={cn("badge", good ? "bg-emerald-500/10 text-emerald-600" : warning ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-500")}>{labels[status] ?? status}</span>;
}
