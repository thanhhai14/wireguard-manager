"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Không thể đăng nhập");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <form onSubmit={submit} className="space-y-4">
    <div><label className="label" htmlFor="username">Username</label><input className="input" id="username" name="username" autoComplete="username" required autoFocus /></div>
    <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
    {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">{error}</p>}
    <button className="btn-primary w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogIn size={18} />}{loading ? "Đang đăng nhập" : "Đăng nhập"}</button>
  </form>;
}
