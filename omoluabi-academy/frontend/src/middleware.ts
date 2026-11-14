import { NextResponse, type NextRequest } from "next/server";

// Fast gate: no session cookie -> login page. The backend still validates every token,
// so an expired or forged cookie is caught on the first API call.
export function middleware(request: NextRequest) {
  if (!request.cookies.get("omoluabi_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
