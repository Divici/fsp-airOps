// ---------------------------------------------------------------------------
// Next.js Middleware — lightweight auth / tenant gate.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

/** Routes that do not require authentication. */
const PUBLIC_PATTERNS = [
  /^\/api\/public(\/|$)/,
  /^\/api\/inngest(\/|$)/,
  /^\/api\/health$/,
  /^\/_next(\/|$)/,
  /^\/favicon\.ico$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes through unconditionally
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const isMock = process.env.FSP_ENVIRONMENT === "mock" || !process.env.FSP_ENVIRONMENT;

  // --- API routes: require x-operator-id header (unless mock mode) ---------
  if (pathname.startsWith("/api/")) {
    const operatorIdHeader = request.headers.get("x-operator-id");

    if (!operatorIdHeader && !isMock) {
      return NextResponse.json(
        { error: "Missing x-operator-id header" },
        { status: 401 }
      );
    }

    // In mock mode, inject default headers when not provided
    if (isMock && !operatorIdHeader) {
      const headers = new Headers(request.headers);
      headers.set("x-operator-id", "1");
      headers.set("x-user-id", "dev-user-000");
      return NextResponse.next({ request: { headers } });
    }

    return NextResponse.next();
  }

  // --- Dashboard routes: check for session cookie (placeholder) ------------
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/(dashboard)")) {
    // In mock mode, allow all dashboard access
    if (isMock) {
      return NextResponse.next();
    }

    // TODO: validate session cookie here once real auth is implemented
    // For now, allow through (server components will enforce via getTenantFromSession)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
