import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { syncRouter } from "@/lib/routeros/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ routerId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  try {
    return NextResponse.json(await syncRouter((await params).routerId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đồng bộ router" }, { status: 422 });
  }
}
