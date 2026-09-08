"use client";

import { CheckCircle2, Copy, Download, LoaderCircle, Pencil, QrCode, RotateCcw, SquareTerminal, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PeerActions({ peerId, canExport, deleted, hasPending }: { peerId: string; canExport: boolean; deleted: boolean; hasPending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installCommands, setInstallCommands] = useState<{ linux: string; windows: string; tunnelName: string } | null>(null);

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
      router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Không thể áp dụng peer"); }
    finally { setBusy(false); }
  }

  async function copyConfig() {
    const response = await fetch(`/api/peers/${peerId}/config`);
    const value = await response.text();
    if (!response.ok) return window.alert(value);
    await navigator.clipboard.writeText(value);
    window.alert("Đã sao chép cấu hình client");
  }

  async function copyCli() {
    if (!window.confirm("CLI có thể chứa preshared key. Chỉ sao chép trên thiết bị tin cậy.")) return;
    const response = await fetch(`/api/peers/${peerId}/apply?reveal=1`);
    const result = await response.json();
    if (!response.ok) return window.alert(result.error ?? "Không thể tạo CLI");
    await navigator.clipboard.writeText(result.command);
    window.alert("Đã sao chép RouterOS CLI");
  }

  async function showInstallCommands() {
    if (!window.confirm("Lệnh cài đặt chứa client private key và preshared key. Chỉ sử dụng trên thiết bị tin cậy và nên xóa khỏi lịch sử Terminal sau khi chạy.")) return;
    setInstallBusy(true);
    try {
      const [linuxResponse, windowsResponse] = await Promise.all([
        fetch(`/api/peers/${peerId}/config?format=linux-command`),
        fetch(`/api/peers/${peerId}/config?format=windows-command`),
      ]);
      const [linux, windows] = await Promise.all([linuxResponse.json(), windowsResponse.json()]);
      if (!linuxResponse.ok) throw new Error(linux.error ?? "Không thể tạo lệnh Linux");
      if (!windowsResponse.ok) throw new Error(windows.error ?? "Không thể tạo lệnh Windows");
      setInstallCommands({ linux: linux.command, windows: windows.command, tunnelName: linux.tunnelName });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể tạo lệnh cài đặt client");
    } finally {
      setInstallBusy(false);
    }
  }

  async function copyInstallCommand(command: string, os: string) {
    await navigator.clipboard.writeText(command);
    window.alert(`Đã sao chép lệnh ${os}`);
  }

  return <div className="flex flex-wrap justify-end gap-1.5">
    <a href={`/peers/${peerId}`} className="btn-secondary !p-2" title="Sửa peer"><Pencil size={15} /></a>
    {hasPending && <button onClick={copyCli} className="btn-secondary !p-2" title="Sao chép RouterOS CLI"><Copy size={15} /></button>}
    {hasPending && <button onClick={apply} disabled={busy} className="btn-primary !px-3 !py-2">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}Áp dụng</button>}
    {canExport && !deleted && <><button onClick={showInstallCommands} disabled={installBusy} className="btn-secondary !p-2" title="Cài đặt client bằng Terminal">{installBusy ? <LoaderCircle className="animate-spin" size={15} /> : <SquareTerminal size={15} />}</button><button onClick={copyConfig} className="btn-secondary !p-2" title="Sao chép config"><Copy size={15} /></button><a href={`/api/peers/${peerId}/config?format=download`} className="btn-secondary !p-2" title="Tải file .conf"><Download size={15} /></a><a href={`/api/peers/${peerId}/config?format=qr`} target="_blank" className="btn-secondary !p-2" title="QR code"><QrCode size={15} /></a></>}
    {deleted ? <span className="btn-secondary !px-3 !py-2 text-xs"><RotateCcw size={15} />Khôi phục ở form bên dưới</span> : <span className="btn-secondary !p-2 text-red-500" title="Dùng nút Xóa bên dưới"><Trash2 size={15} /></span>}
    {installCommands && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-left" onClick={() => setInstallCommands(null)}><div className="card w-full max-w-3xl p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Cài WireGuard client bằng Terminal</h3><p className="mt-1 text-xs text-[var(--muted)]">Tunnel: <span className="font-mono">{installCommands.tunnelName}</span></p></div><button className="btn-secondary !p-2" onClick={() => setInstallCommands(null)} aria-label="Đóng"><X size={16} /></button></div><div className="mt-5 space-y-5"><InstallCommand title="Linux · Bash" note="Chạy trong Terminal có quyền sudo. Lệnh ghi file, đặt quyền 600 và bật tunnel." command={installCommands.linux} onCopy={() => copyInstallCommand(installCommands.linux, "Linux")} /><InstallCommand title="Windows · PowerShell" note="Chạy PowerShell bằng Run as Administrator. Lệnh tạo và khởi động WireGuard tunnel service." command={installCommands.windows} onCopy={() => copyInstallCommand(installCommands.windows, "Windows")} /></div><p className="mt-5 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-600">Cảnh báo: nội dung Base64 trong lệnh vẫn chứa private key. Không chia sẻ lệnh và hãy xóa lệnh khỏi lịch sử Terminal sau khi sử dụng.</p></div></div>}
  </div>;
}

function InstallCommand({ title, note, command, onCopy }: { title: string; note: string; command: string; onCopy: () => void }) {
  return <section><div className="mb-2 flex items-end justify-between gap-3"><div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs text-[var(--muted)]">{note}</p></div><button className="btn-secondary shrink-0 !px-3 !py-2 text-xs" onClick={onCopy}><Copy size={14} />Sao chép</button></div><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">{command}</pre></section>;
}
