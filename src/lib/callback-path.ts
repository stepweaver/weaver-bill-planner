/** Only same-origin paths. Blocks open redirects after a notification click. */
export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw) return "/months";
  if (!raw.startsWith("/")) return "/months";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/months";
  if (raw.includes("://") || raw.includes("\\")) return "/months";
  if (raw.startsWith("/login")) return "/months";
  return raw;
}

/** Where an anonymous visit to a protected page should land. */
export function unauthenticatedRedirect(pathname: string, search = ""): string {
  if (pathname === "/login") return "/login";
  const callback = safeCallbackPath(`${pathname}${search}`);
  return `/login?callbackUrl=${encodeURIComponent(callback)}`;
}
