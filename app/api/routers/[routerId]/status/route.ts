import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { refreshRouterStatus } from "@/lib/routeros/service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_: Request, { params }: { params: Promise<{ routerId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  try {
    return NextResponse.json(await refreshRouterStatus((await params).routerId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật trạng thái" }, { status: 422 });
  }
}
