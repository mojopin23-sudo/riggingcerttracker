import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { safeNextPath } from "@/lib/params";

const PUBLIC_PREFIXES = ["/login", "/manifest.webmanifest"];
const PUBLIC_FILES = new Set([
  "/sw.js",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_FILES.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const expectedUser = process.env.APP_USER || "terminal";
  if (!session || session.u !== expectedUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const next = safeNextPath(pathname);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.ico$).*)"],
};
