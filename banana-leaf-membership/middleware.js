import { NextResponse } from "next/server";
import { verifySession, STAFF_COOKIE, MEMBER_COOKIE } from "@/lib/session";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/staff/dashboard")) {
    const token = request.cookies.get(STAFF_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session || session.role !== "staff") {
      return NextResponse.redirect(new URL("/staff/login", request.url));
    }
    if (pathname.startsWith("/staff/dashboard/rewards") && session.staffRole !== "owner") {
      return NextResponse.redirect(new URL("/staff/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/member/dashboard")) {
    const token = request.cookies.get(MEMBER_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session || session.role !== "member") {
      return NextResponse.redirect(new URL("/member/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/dashboard/:path*", "/member/dashboard/:path*"],
};
