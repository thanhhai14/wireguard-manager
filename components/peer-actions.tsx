"use client";

import { CheckCircle2, Copy, Download, LoaderCircle, Pencil, QrCode, RotateCcw, SquareTerminal, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildCompressedPowerShellCommand } from "@/lib/wireguard/browser-powershell";

const windowsWatchdogScriptUrl = "/guides/wireguard-auto-start.ps1";

export function PeerActions({ peerId, canExport, deleted, hasPending }: { peerId: string; canExport: boolean; deleted: boolean; hasPending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [cliBusy, setCliBusy] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [installCommands, setInstallCommands] = useState<{ linux: string; windows: string; windowsAutoStart: string; tunnelName: string } | null>(null);

  async function apply() {
    setBusy(true);
    try {
      const previewResponse = await fetch(`/api/peers/${peerId}/apply`);
      const preview = await previewResponse.json();
      if (!previewResponse.ok) throw new Error(preview.error);
      if (!window.confirm(`Command sẽ chạy trên RouterOS:\n\n${preview.command}\n\nTiếp tục áp dụng?`)) return;
      const response = await fetch(`/api/peers/${peerId}/apply`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      startRefresh(() => router.refresh());
    } catch (error) { window.alert(error instanceof Error ? error.message : "Không thể áp dụng peer"); }
    finally { setBusy(false); }
  }

  async function copyConfig() {
    setConfigBusy(true);
    try {
      const response = await fetch(`/api/peers/${peerId}/config`);
      const value = await response.text();
      if (!response.ok) throw new Error(value);
      await navigator.clipboard.writeText(value);
      window.alert("Đã sao chép cấu hình client");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể sao chép cấu hình client");
    } finally {
      setConfigBusy(false);
    }
  }

  async function copyCli() {
    if (!window.confirm("CLI có thể chứa preshared key. Chỉ sao chép trên thiết bị tin cậy.")) return;
    setCliBusy(true);
    try {
      const response = await fetch(`/api/peers/${peerId}/apply?reveal=1`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tạo CLI");
      await navigator.clipboard.writeText(result.command);
      window.alert("Đã sao chép RouterOS CLI");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể tạo CLI");
    } finally {
      setCliBusy(false);
    }
  }

  async function showInstallCommands() {
    if (!window.confirm("Lệnh cài đặt chứa client private key và preshared key. Chỉ sử dụng trên thiết bị tin cậy và nên xóa khỏi lịch sử Terminal sau khi chạy.")) return;
    setInstallBusy(true);
    try {
      const [linuxResponse, windowsResponse, watchdogResponse] = await Promise.all([
        fetch(`/api/peers/${peerId}/config?format=linux-command`),
        fetch(`/api/peers/${peerId}/config?format=windows-command`),
        fetch(windowsWatchdogScriptUrl),
      ]);
      const [linux, windows, watchdogScript] = await Promise.all([linuxResponse.json(), windowsResponse.json(), watchdogResponse.text()]);
      if (!linuxResponse.ok) throw new Error(linux.error ?? "Không thể tạo lệnh Linux");
      if (!windowsResponse.ok) throw new Error(windows.error ?? "Không thể tạo lệnh Windows");
      if (!watchdogResponse.ok || !watchdogScript.startsWith("# ============================================================")) throw new Error("Không thể tải script Auto Start");
      const windowsAutoStart = await buildCompressedPowerShellCommand(`${windows.command}\n${watchdogScript}`);
      setInstallCommands({ linux: linux.command, windows: windows.command, windowsAutoStart, tunnelName: linux.tunnelName });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể tạo lệnh cài đặt client");
    } finally {
      setInstallBusy(false);
    }
  }

  async function copyInstallCommand(command: string, os: string) {
    if (os.startsWith("Windows") && !window.confirm("Lệnh Windows sẽ gỡ TOÀN BỘ WireGuard tunnel service hiện có trên máy, sau đó chỉ cài tunnel đang chọn. Tiếp tục sao chép?")) return;
    await navigator.clipboard.writeText(command);
    window.alert(`Đã sao chép lệnh ${os}`);
  }

  const actionBusy = busy || installBusy || configBusy || cliBusy || isRefreshing;

  return <div className="flex flex-wrap justify-end gap-1.5">
    <a href={`/peers/${peerId}`} className="btn-secondary !p-2" title="Sửa peer"><Pencil size={15} /></a>
    {hasPending && <button onClick={copyCli} disabled={actionBusy} className="btn-secondary !p-2" title="Sao chép RouterOS CLI" aria-busy={cliBusy}>{cliBusy ? <LoaderCircle className="animate-spin" size={15} /> : <Copy size={15} />}</button>}
    {hasPending && <button onClick={apply} disabled={actionBusy} className="btn-primary !px-3 !py-2" aria-busy={busy || isRefreshing}>{busy || isRefreshing ? <LoaderCircle className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}{busy ? "Đang áp dụng…" : isRefreshing ? "Đang cập nhật…" : "Áp dụng"}</button>}
    {canExport && !deleted && <><button onClick={showInstallCommands} disabled={actionBusy} className="btn-secondary !p-2" title="Cài đặt client bằng Terminal" aria-busy={installBusy}>{installBusy ? <LoaderCircle className="animate-spin" size={15} /> : <SquareTerminal size={15} />}</button><button onClick={copyConfig} disabled={actionBusy} className="btn-secondary !p-2" title="Sao chép config" aria-busy={configBusy}>{configBusy ? <LoaderCircle className="animate-spin" size={15} /> : <Copy size={15} />}</button><a href={`/api/peers/${peerId}/config?format=download`} className="btn-secondary !p-2" title="Tải file .conf"><Download size={15} /></a><a href={`/api/peers/${peerId}/config?format=qr`} target="_blank" className="btn-secondary !p-2" title="QR code"><QrCode size={15} /></a></>}
    {deleted ? <span className="btn-secondary !px-3 !py-2 text-xs"><RotateCcw size={15} />Khôi phục ở form bên dưới</span> : <span className="btn-secondary !p-2 text-red-500" title="Dùng nút Xóa bên dưới"><Trash2 size={15} /></span>}
    {installCommands && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-left" onClick={() => setInstallCommands(null)}><div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Cài WireGuard client bằng Terminal</h3><p className="mt-1 text-xs text-[var(--muted)]">Tunnel: <span className="font-mono">{installCommands.tunnelName}</span></p></div><button className="btn-secondary !p-2" onClick={() => setInstallCommands(null)} aria-label="Đóng"><X size={16} /></button></div><div className="mt-5 space-y-5"><InstallCommand title="Linux · Bash" note="Chạy trong Terminal có quyền sudo. Lệnh ghi file, đặt quyền 600 và bật tunnel." command={installCommands.linux} onCopy={() => copyInstallCommand(installCommands.linux, "Linux")} /><InstallCommand title="Windows · PowerShell" note="Run as Administrator. Gỡ toàn bộ tunnel service hiện có, sau đó chỉ cài và khởi động tunnel này." command={installCommands.windows} onCopy={() => copyInstallCommand(installCommands.windows, "Windows")} /><InstallCommand title="Windows · PowerShell + Auto Start" note="Một lệnh duy nhất: thay thế toàn bộ tunnel bằng tunnel này, rồi cài Scheduled Task kiểm tra handshake và tự khôi phục kết nối." command={installCommands.windowsAutoStart} onCopy={() => copyInstallCommand(installCommands.windowsAutoStart, "Windows + Auto Start")} /></div><p className="mt-5 rounded-lg bg-red-500/10 p-3 text-xs font-medium leading-5 text-red-600 dark:text-red-400">Cảnh báo Windows: hai lệnh Windows sẽ gỡ toàn bộ WireGuard tunnel service khác trên máy. Chỉ tunnel đang chọn được giữ lại.</p><p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-600">Nội dung Base64 chứa client private key và preshared key. Không chia sẻ lệnh và hãy xóa khỏi lịch sử Terminal sau khi sử dụng.</p></div></div>}
  </div>;
}

function InstallCommand({ title, note, command, onCopy }: { title: string; note: string; command: string; onCopy: () => void }) {
  return <section><div className="mb-2 flex items-end justify-between gap-3"><div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs text-[var(--muted)]">{note}</p></div><button className="btn-secondary shrink-0 !px-3 !py-2 text-xs" onClick={onCopy}><Copy size={14} />Sao chép</button></div><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">{command}</pre></section>;
}
