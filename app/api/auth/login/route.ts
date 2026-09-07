import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionTtlSeconds } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { authRateLimits } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!body?.username || !body.password || !expectedUsername || !expectedHash) {
    return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
  }

  const db = getDb();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = createHash("sha256").update(`${ip}:${body.username.toLowerCase()}`).digest("hex");
  const [limit] = await db.select().from(authRateLimits).where(eq(authRateLimits.key, rateKey)).limit(1);
  const now = new Date();
  if (limit?.blockedUntil && limit.blockedUntil > now) {
    return NextResponse.json({ error: "Đăng nhập tạm khóa. Vui lòng thử lại sau." }, { status: 429 });
  }

  const usernameMatches = body.username === expectedUsername;
  const passwordMatches = await compare(body.password, expectedHash).catch(() => false);
  if (!usernameMatches || !passwordMatches) {
    const resetWindow = !limit || now.getTime() - limit.windowStartedAt.getTime() > 15 * 60_000;
    const attempts = resetWindow ? 1 : limit.attempts + 1;
    await db.insert(authRateLimits).values({
      key: rateKey,
      attempts,
      windowStartedAt: resetWindow ? now : limit.windowStartedAt,
      blockedUntil: attempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
    }).onConflictDoUpdate({ target: authRateLimits.key, set: {
      attempts,
      windowStartedAt: resetWindow ? now : limit!.windowStartedAt,
      blockedUntil: attempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
    } });
    return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
  }

  await db.delete(authRateLimits).where(eq(authRateLimits.key, rateKey));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(body.username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
  return response;
}
