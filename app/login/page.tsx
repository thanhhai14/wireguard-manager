import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center px-4"><div className="w-full max-w-md"><div className="mb-6 text-center"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><ShieldCheck size={30} /></div><h1 className="text-2xl font-bold">WireGuard Manager</h1><p className="mt-2 text-sm text-[var(--muted)]">Đăng nhập system administrator</p></div><div className="card p-6 sm:p-8"><LoginForm /></div></div></main>;
}
