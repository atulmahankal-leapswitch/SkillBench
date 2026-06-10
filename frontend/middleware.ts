import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Mirrors backend security.ACCESS_COOKIE.
const ACCESS_COOKIE = "sb_access";

/**
 * Gate the admin area. Unauthenticated requests to /admin/* are sent to
 * /login?redirect=<original path> so the user returns there after signing in.
 * Also forwards the current path as x-pathname so the (server-component) admin
 * layout can build the same redirect if the cookie is present but invalid.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const target = pathname + search;

  const headers = new Headers(req.headers);
  headers.set("x-pathname", target);

  if (!req.cookies.get(ACCESS_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirect", target);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
