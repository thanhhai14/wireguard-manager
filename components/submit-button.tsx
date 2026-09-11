"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "",
  pendingText = "Đang xử lý…",
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending && <LoaderCircle className="animate-spin" size={16} />}
      {pending ? pendingText : children}
    </button>
  );
}
