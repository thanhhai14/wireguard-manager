"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="card mx-auto mt-20 max-w-xl p-8 text-center"><h2 className="text-xl font-bold">Không thể tải dữ liệu</h2><p className="mt-2 text-sm text-[var(--muted)]">{error.message}</p><button className="btn-primary mt-5" onClick={reset}>Thử lại</button></div>;
}
