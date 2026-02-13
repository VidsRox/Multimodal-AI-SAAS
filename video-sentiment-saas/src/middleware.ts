import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtectedPage = pathname === "/";

  // If not logged in and trying to access protected page → redirect to login
  if (!token && isProtectedPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If logged in and trying to access login/signup → redirect to home
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup"],
};
