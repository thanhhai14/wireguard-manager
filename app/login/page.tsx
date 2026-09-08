import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center px-4"><div className="w-full max-w-md"><div className="mb-6 text-center"><Image src="/app-logo.webp" alt="WireGuard Manager" width={56} height={56} priority className="mx-auto mb-4 size-14 rounded-2xl object-cover shadow-lg shadow-red-600/20" /><h1 className="text-2xl font-bold">WireGuard Manager</h1><p className="mt-2 text-sm text-[var(--muted)]">Đăng nhập system administrator</p></div><div className="card p-6 sm:p-8"><LoginForm /></div></div></main>;
}
