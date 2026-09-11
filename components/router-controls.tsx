"use client";

import { Cable, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function RouterControls({ routerId, trusted }: { routerId: string; trusted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const polling = useRef(false);

  async function request(url: string, body?: unknown) {
    const response = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Thao tác thất bại");
    return result;
  }

  async function test() {
    setBusy("test"); setMessage(null);
    try {
      let result = await request("/api/routers/test", { routerId });
      if (!trusted && result.fingerprint) {
        if (!window.confirm(`SSH host fingerprint:\n${result.fingerprint}\n\nBạn đã xác minh và muốn tin cậy fingerprint này?`)) return;
        result = await request("/api/routers/test", { routerId, trustFingerprint: true });
      }
      setMessage(`Kết nối thành công · RouterOS ${result.version}`);
      startRefresh(() => router.refresh());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kết nối thất bại"); }
    finally { setBusy(null); }
  }

  async function sync() {
    setBusy("sync"); setMessage(null);
    try {
      const result = await request(`/api/routers/${routerId}/sync`);
      setMessage(`Đã đồng bộ ${result.interfaces} interface · ${result.importedPeers} peer mới`);
      startRefresh(() => router.refresh());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Đồng bộ thất bại"); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    const refresh = async () => {
      if (document.hidden || polling.current) return;
      polling.current = true;
      try { await request(`/api/routers/${routerId}/status`); startRefresh(() => router.refresh()); } catch { /* status is shown from server */ }
      finally { polling.current = false; }
    };
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [routerId, router]);

  const disabled = Boolean(busy) || isRefreshing;
  return <div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={test} disabled={disabled} aria-busy={busy === "test"}>{busy === "test" ? <LoaderCircle className="animate-spin" size={17} /> : <Cable size={17} />}Kiểm tra kết nối</button><button className="btn-primary" onClick={sync} disabled={disabled} aria-busy={busy === "sync"}>{busy === "sync" ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCw className={isRefreshing ? "animate-spin" : ""} size={17} />}{isRefreshing && !busy ? "Đang cập nhật…" : "Đồng bộ từ Router"}</button></div>{message && <p className="mt-2 text-right text-xs text-[var(--muted)]">{message}</p>}</div>;
}
