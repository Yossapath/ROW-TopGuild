import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthPayload } from "@/types";
import { unauthorized, forbidden } from "@/lib/server-utils";

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or empty! Please define JWT_SECRET in your environment."
    );
  }
  if (secret === "topguild-secret-change-in-production") {
    throw new Error(
      "FATAL: Insecure default JWT_SECRET detected! Please change JWT_SECRET to a strong, random secret key."
    );
  }
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME = "tg_token";
const EXPIRES_IN  = "7d";

// ── Sign JWT ─────────────────────────────────────────────────
export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(getJwtSecret());
}

// ── Verify JWT ───────────────────────────────────────────────
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
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

// ── Guard helpers for API routes ─────────────────────────────
export async function requireAuth(): Promise<
  { user: AuthPayload; errorResponse: null } | { user: null; errorResponse: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, errorResponse: unauthorized() };
  }
  return { user, errorResponse: null };
}

export async function requireAdmin(): Promise<
  { user: AuthPayload; errorResponse: null } | { user: null; errorResponse: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, errorResponse: unauthorized() };
  }
  if (user.role !== "admin" && user.role !== "owner") {
    return { user: null, errorResponse: forbidden() };
  }
  return { user, errorResponse: null };
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


