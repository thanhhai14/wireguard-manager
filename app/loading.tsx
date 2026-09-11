export default function Loading() {
  return (
    <div
      className="mx-auto max-w-7xl animate-pulse"
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang"
    >
      <div className="fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-blue-500/15 lg:left-[260px]">
        <div className="h-full w-2/3 rounded-full bg-blue-500" />
      </div>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-7 w-52 rounded-lg bg-[var(--surface-soft)]" />
          <div className="h-4 w-72 max-w-[70vw] rounded bg-[var(--surface-soft)]" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-[var(--surface-soft)]" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="card space-y-4 p-5">
            <div className="h-5 w-2/3 rounded bg-[var(--surface-soft)]" />
            <div className="h-4 w-full rounded bg-[var(--surface-soft)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--surface-soft)]" />
            <div className="h-9 w-28 rounded-xl bg-[var(--surface-soft)]" />
          </div>
        ))}
      </div>

      <div className="card mt-6 space-y-3 p-5">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-12 rounded-xl bg-[var(--surface-soft)]" />
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu…</span>
    </div>
  );
}
