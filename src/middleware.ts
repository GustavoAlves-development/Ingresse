import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfigEdge } from "@/lib/auth/authConfig.edge";
import { isAuthorizedForPath } from "@/lib/auth/routeAccess";

const { auth } = NextAuth(authConfigEdge);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const role = request.auth?.user?.role;

  if (!request.auth) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAuthorizedForPath(role, pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portaria/:path*"],
};
