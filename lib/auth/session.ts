import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "wg_admin_session";

function sessionKey() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự");
  return new TextEncoder().encode(value);
}

export function sessionTtlSeconds() {
  return Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 8)) * 60 * 60;
}

export async function createSessionToken(username: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ username, role: "system_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + sessionTtlSeconds())
    .setIssuer("wireguard-web-manager")
    .setAudience("admin")
    .sign(sessionKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      issuer: "wireguard-web-manager",
      audience: "admin",
    });
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function getAdminSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}
