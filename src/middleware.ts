// ---------------------------------------------------------------------------
// Next.js Middleware — auth / tenant gate with real session validation.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

const SESSION_COOKIE_NAME = "fsp-session";

/** Routes that do not require authentication. */
const PUBLIC_PATTERNS = [
  /^\/api\/public(\/|$)/,
  /^\/api\/inngest(\/|$)/,
  /^\/api\/health$/,
  /^\/api\/auth(\/|$)/,
  /^\/login(\/|$)/,
  /^\/unsubscribe(\/|$)/,
  /^\/_next(\/|$)/,
  /^\/favicon\.ico$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes through unconditionally
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const isMock = process.env.FSP_ENVIRONMENT === "mock" || !process.env.FSP_ENVIRONMENT;

  // Try to resolve session from the cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const session = sessionCookie?.value
    ? await verifySessionToken(sessionCookie.value)
    : null;

  // --- API routes -----------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    const operatorIdHeader = request.headers.get("x-operator-id");

    // If there's already an explicit header, let it through
    if (operatorIdHeader) {
      return NextResponse.next();
    }

    // If we have a valid session, inject headers from it
    if (session) {
      const headers = new Headers(request.headers);
      headers.set("x-operator-id", String(session.operatorId));
      headers.set("x-user-id", session.userId);
      return NextResponse.next({ request: { headers } });
    }

    // Mock mode fallback: inject default headers only if no session cookie was
    // ever set (first visit). Once the user logs in and gets a cookie, mock
    // mode still requires the cookie so that logout works properly.
    if (isMock && !sessionCookie) {
      const headers = new Headers(request.headers);
      headers.set("x-operator-id", "1");
      headers.set("x-user-id", "dev-user-000");
      return NextResponse.next({ request: { headers } });
    }

    // No session → 401
    return NextResponse.json(
      { error: "Missing authentication" },
      { status: 401 }
    );
  }

  // --- Dashboard / page routes ----------------------------------------------
  // If there's a valid session, allow through
  if (session) {
    return NextResponse.next();
  }

  // Mock mode: allow page access only if user has never logged in (no cookie
  // was ever set). Once they've logged in/out, require the cookie.
  if (isMock && !sessionCookie) {
    return NextResponse.next();
  }

  // No session → redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
