import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthPayload, UserRole } from "@/types";
import { unauthorized, forbidden } from "@/lib/server-utils";

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  const isInsecure =
    !secret ||
    secret.trim() === "" ||
    secret === "topguild-secret-change-in-production" ||
    secret === "topguild-secure-fallback-jwt-secret-key-32-chars-2026";

  if (isInsecure) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: Insecure or missing JWT_SECRET in production environment! Please configure a secure JWT_SECRET in environment variables."
      );
    }
    console.warn("WARNING: JWT_SECRET is not configured or is using an insecure default. Using development fallback secret.");
    return new TextEncoder().encode("topguild-secure-fallback-jwt-secret-key-32-chars-2026");
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

// ── User Role Cache & Revocation Guard ─────────────────────────
interface CachedUserRole {
  role: UserRole;
  expiresAt: number;
}

const userRoleCache = new Map<string, CachedUserRole>();

export function invalidateUserRoleCache(discordId?: string) {
  if (discordId) {
    userRoleCache.delete(discordId);
  } else {
    userRoleCache.clear();
  }
}

export function setUserRoleForTesting(discordId: string, role: UserRole | null) {
  if (role === null) {
    userRoleCache.delete(discordId);
  } else {
    userRoleCache.set(discordId, { role, expiresAt: Date.now() + 60000 });
  }
}

export async function getLiveUserRole(discordId: string, fallbackRole: UserRole): Promise<UserRole | null> {
  const now = Date.now();
  const cached = userRoleCache.get(discordId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  try {
    const { getDb, COLL_USER } = await import("@/lib/firebase-admin");
    const userDoc = await getDb().collection(COLL_USER).doc(discordId).get();
    if (!userDoc.exists) {
      return null;
    }
    const liveRole = (userDoc.data()?.role as UserRole) || "member";
    userRoleCache.set(discordId, { role: liveRole, expiresAt: now + 30000 }); // Cache for 30s
    return liveRole;
  } catch {
    // Graceful fallback to avoid dropping valid sessions on transient DB errors
    return fallbackRole;
  }
}

export async function requireAdmin(): Promise<
  { user: AuthPayload; errorResponse: null } | { user: null; errorResponse: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, errorResponse: unauthorized() };
  }

  // Verify live role against database/cache to immediately revoke demoted/deleted admin sessions
  const liveRole = await getLiveUserRole(user.discordId, user.role);
  if (!liveRole) {
    return { user: null, errorResponse: unauthorized() };
  }
  if (liveRole !== "admin" && liveRole !== "owner") {
    return { user: null, errorResponse: forbidden() };
  }

  return { user: { ...user, role: liveRole }, errorResponse: null };
}

export async function requireOwner(): Promise<
  { user: AuthPayload; errorResponse: null } | { user: null; errorResponse: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, errorResponse: unauthorized() };
  }

  const liveRole = await getLiveUserRole(user.discordId, user.role);
  if (!liveRole) {
    return { user: null, errorResponse: unauthorized() };
  }
  if (liveRole !== "owner") {
    return { user: null, errorResponse: forbidden() };
  }

  return { user: { ...user, role: liveRole }, errorResponse: null };
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


