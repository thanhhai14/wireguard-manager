import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { testRouter } from "@/lib/routeros/service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  const body = await request.json().catch(() => null) as { routerId?: string; trustFingerprint?: boolean } | null;
  if (!body?.routerId) return NextResponse.json({ error: "Thiếu routerId" }, { status: 400 });
  try {
    return NextResponse.json(await testRouter(body.routerId, body.trustFingerprint));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể kết nối router" }, { status: 422 });
  }
}
