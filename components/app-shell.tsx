"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LayoutDashboard, LogOut, Menu, Moon, Network, ShieldCheck, Sun, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/companies", label: "Công ty", icon: Building2 },
  { href: "/networks", label: "Networks", icon: Network },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
          <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={22} /></div>
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
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500"><LogOut size={18} />Đăng xuất</button>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-10 pt-20 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
    </div>
  );
}
