import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  if (isLoginPage) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/months", req.url));
    }
    return;
  }
  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
