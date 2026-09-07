"use client";

import { CheckCircle2, Copy, Download, LoaderCircle, Pencil, QrCode, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PeerActions({ peerId, canExport, deleted, hasPending }: { peerId: string; canExport: boolean; deleted: boolean; hasPending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  return <div className="flex flex-wrap justify-end gap-1.5">
    <a href={`/peers/${peerId}`} className="btn-secondary !p-2" title="Sửa peer"><Pencil size={15} /></a>
    {hasPending && <button onClick={copyCli} className="btn-secondary !p-2" title="Sao chép RouterOS CLI"><Copy size={15} /></button>}
    {hasPending && <button onClick={apply} disabled={busy} className="btn-primary !px-3 !py-2">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}Áp dụng</button>}
    {canExport && !deleted && <><button onClick={copyConfig} className="btn-secondary !p-2" title="Sao chép config"><Copy size={15} /></button><a href={`/api/peers/${peerId}/config?format=download`} className="btn-secondary !p-2" title="Tải file .conf"><Download size={15} /></a><a href={`/api/peers/${peerId}/config?format=qr`} target="_blank" className="btn-secondary !p-2" title="QR code"><QrCode size={15} /></a></>}
    {deleted ? <span className="btn-secondary !px-3 !py-2 text-xs"><RotateCcw size={15} />Khôi phục ở form bên dưới</span> : <span className="btn-secondary !p-2 text-red-500" title="Dùng nút Xóa bên dưới"><Trash2 size={15} /></span>}
  </div>;
}
