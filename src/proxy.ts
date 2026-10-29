import { auth } from "@/lib/auth";
import { unauthenticatedRedirect } from "@/lib/callback-path";

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
    const target = unauthenticatedRedirect(req.nextUrl.pathname, req.nextUrl.search);
    return Response.redirect(new URL(target, req.url));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|apple-touch-icon.png).*)",
  ],
};
