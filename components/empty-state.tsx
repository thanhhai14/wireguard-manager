import { CircleDashed } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="card grid min-h-56 place-items-center p-8 text-center"><div><CircleDashed className="mx-auto mb-3 text-[var(--muted)]" /><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-[var(--muted)]">{description}</p></div></div>;
}
