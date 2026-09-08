import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tg_token";

// Routes that require a logged-in user. Add more prefixes here as needed.
const PROTECTED_PREFIXES = ["/dashboard"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Note: we only check that a token cookie is present here (fast, edge-safe
  // check). Full JWT signature/expiry verification still happens server-side
  // via requireAuth()/requireAdmin() in each API route and in
  // app/api/auth/me, so a tampered/expired token cannot actually be used —
  // it just won't get redirected to /login before the page shell loads.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
