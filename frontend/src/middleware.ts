import { NextResponse, type NextRequest } from "next/server";

/**
 * Adds the shared proxy secret to every /api/* request before Next rewrites it to
 * the FastAPI backend. The API rejects calls without it, so its public URL can't
 * be used to bypass the web app (or spoof client IPs to dodge rate limits).
 * PROXY_SECRET is server-only: it never reaches the browser.
 */
export function middleware(request: NextRequest) {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set("x-careeros-proxy", secret);
  // set() overwrites any value a browser sent, so it cannot be forged.
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
