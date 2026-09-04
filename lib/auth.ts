import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AuthPayload } from "@/types";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "topguild-secret-change-in-production"
);

const COOKIE_NAME = "tg_token";
const EXPIRES_IN  = "7d";

// ── Sign JWT ─────────────────────────────────────────────────
export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET);
}

// ── Verify JWT ───────────────────────────────────────────────
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

// ── Get current user from cookie (Server Component / API Route) ──
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ── Set auth cookie ──────────────────────────────────────────
export function authCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

// ── Clear auth cookie ─────────────────────────────────────────
export function clearAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  };
}


