import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tg_token";
const PROTECTED_PREFIXES = ["/dashboard", "/booking"];

// Runs on the Edge before any page is rendered, so an unauthenticated
// visitor is redirected to /login immediately instead of downloading the
// full Dashboard shell first and only then bouncing on the client.
// NOTE: this only checks that a token cookie is *present* (Edge runtime
// cannot easily verify the JWT signature with `jose` + Node crypto in all
// configs). Every API route and Server Component still calls
// requireAuth()/requireAdmin(), which do full verification — this is a
// UX improvement, not a replacement for those checks.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/booking/:path*"],
};
