import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { applyPeer, previewPeerCommand } from "@/lib/routeros/peer-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ peerId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  try { return NextResponse.json({ command: await previewPeerCommand((await params).peerId, request.nextUrl.searchParams.get("reveal") === "1") }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể tạo CLI preview" }, { status: 422 }); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ peerId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  try { return NextResponse.json(await applyPeer((await params).peerId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể áp dụng peer" }, { status: 422 }); }
}
