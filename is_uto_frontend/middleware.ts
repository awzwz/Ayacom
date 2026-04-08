import { NextRequest, NextResponse } from "next/server";

const MOBILE_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already on mobile routes or API — don't touch
  if (
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/uto-api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isMobile = MOBILE_PATTERN.test(ua);

  if (isMobile) {
    const url = request.nextUrl.clone();
    url.pathname = "/mobile";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
