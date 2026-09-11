"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Building2, Check, Copy, Download, LayoutDashboard, LogOut, Menu, Moon, Network, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { buildCompressedPowerShellCommand } from "@/lib/wireguard/browser-powershell";

const navigation = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/companies", label: "Công ty", icon: Building2 },
  { href: "/networks", label: "Networks", icon: Network },
];

const installCommands = {
  linux: "if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y wireguard; elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y wireguard-tools; elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed wireguard-tools; elif command -v zypper >/dev/null 2>&1; then sudo zypper install -y wireguard-tools; elif command -v apk >/dev/null 2>&1; then sudo apk add wireguard-tools; else echo 'Không tìm thấy package manager được hỗ trợ'; exit 1; fi",
  windows: "winget install --id WireGuard.WireGuard --exact --source winget --accept-source-agreements --accept-package-agreements",
};

const windowsWatchdogScriptUrl = "/guides/wireguard-auto-start.ps1";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  if (pathname === "/login") return children;

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.theme = next ? "dark" : "light";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <button className="fixed left-4 top-4 z-40 rounded-xl border bg-[var(--surface)] p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={20} /></button>
      {open && <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r bg-[var(--surface)] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="mb-8 flex items-center gap-3 px-2 py-2">
          <Image src="/app-logo.webp" alt="WireGuard Manager" width={40} height={40} priority className="size-10 rounded-xl object-cover shadow-sm" />
          <div><div className="font-bold">WireGuard</div><div className="text-xs text-[var(--muted)]">Network Manager</div></div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={20} /></button>
        </div>
        <nav className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-blue-600 text-white" : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]")}><Icon size={18} />{label}</Link>;
          })}
        </nav>
        <div className="mt-auto space-y-1 border-t pt-4">
          <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]">{dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? "Chế độ sáng" : "Chế độ tối"}</button>
          <button onClick={() => { setGuideOpen(true); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"><BookOpen size={18} />Guide cài WireGuard</button>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500"><LogOut size={18} />Đăng xuất</button>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-10 pt-20 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
      {guideOpen && <InstallGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<"linux" | "windows" | "windows-watchdog" | null>(null);
  const [windowsWatchdogScript, setWindowsWatchdogScript] = useState("");
  const [windowsWatchdogCommand, setWindowsWatchdogCommand] = useState("");
  const [watchdogLoadError, setWatchdogLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(windowsWatchdogScriptUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Không thể tải script");
        return response.text();
      })
      .then(async (script) => {
        const command = await buildCompressedPowerShellCommand(script);
        if (controller.signal.aborted) return;
        setWindowsWatchdogScript(script);
        setWindowsWatchdogCommand(command);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWatchdogLoadError(true);
      });

    return () => controller.abort();
  }, []);

  async function copy(command: string, os: "linux" | "windows" | "windows-watchdog") {
    await navigator.clipboard.writeText(command);
    setCopied(os);
    window.setTimeout(() => setCopied((current) => current === os ? null : current), 2_000);
  }

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-labelledby="install-guide-title" className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 id="install-guide-title" className="text-lg font-bold">Cài đặt WireGuard client</h2><p className="mt-1 text-sm text-[var(--muted)]">Chọn đúng hệ điều hành, sao chép lệnh và chạy trong Terminal.</p></div><button className="btn-secondary !p-2" onClick={onClose} aria-label="Đóng guide"><X size={17} /></button></div><div className="mt-6 space-y-6"><GuideCommand title="Linux · Bash" note="Hỗ trợ Ubuntu/Debian, Fedora, Arch, openSUSE và Alpine. Tài khoản cần quyền sudo." command={installCommands.linux} copied={copied === "linux"} onCopy={() => copy(installCommands.linux, "linux")} /><GuideCommand title="Windows · PowerShell" note="Mở PowerShell bằng Run as Administrator. Yêu cầu winget có sẵn trên Windows." command={installCommands.windows} copied={copied === "windows"} onCopy={() => copy(installCommands.windows, "windows")} /><GuideCommand title="Windows · Scheduled Task tự khởi động tunnel" note="Mở PowerShell bằng Run as Administrator rồi paste lệnh một dòng. Script dùng handshake, không phụ thuộc IP kiểm tra và không restart tunnel có handshake trong 180 giây gần nhất." command={windowsWatchdogCommand || (watchdogLoadError ? "Không thể tạo lệnh cài đặt. Hãy đóng Guide và thử lại." : "Đang tạo lệnh cài đặt...")} copied={copied === "windows-watchdog"} disabled={!windowsWatchdogCommand} onCopy={() => copy(windowsWatchdogCommand, "windows-watchdog")} />{windowsWatchdogScript && <WatchdogSource script={windowsWatchdogScript} />}</div><p className="mt-6 rounded-xl bg-blue-500/10 p-3 text-xs leading-5 text-blue-600 dark:text-blue-400">Sau khi cài xong, quay lại peer và bấm biểu tượng Terminal để lấy lệnh cấu hình và kích hoạt tunnel.</p></div></div>;
}

function WatchdogSource({ script }: { script: string }) {
  return <section><div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">Mã nguồn Scheduled Task</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Dùng để kiểm tra nội dung hoặc tải file PowerShell thay vì chạy lệnh một dòng.</p></div><a className="btn-secondary shrink-0 !px-3 !py-2 text-xs" href={windowsWatchdogScriptUrl} download="wireguard-auto-start.ps1"><Download size={15} />Tải .ps1</a></div><pre className="max-h-80 overflow-auto whitespace-pre rounded-xl bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">{script}</pre></section>;
}

function GuideCommand({ title, note, command, copied, disabled = false, onCopy }: { title: string; note: string; command: string; copied: boolean; disabled?: boolean; onCopy: () => void }) {
  return <section><div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{note}</p></div><button className="btn-secondary shrink-0 !px-3 !py-2 text-xs" onClick={onCopy} disabled={disabled}>{copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}{copied ? "Đã copy" : "Copy"}</button></div><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">{command}</pre></section>;
}
