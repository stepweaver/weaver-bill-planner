import { auth } from "@/lib/auth";

/** Session type for server-side use (auth() returns this or null when not in middleware). */
export type Session = { user?: { id?: string | null; name?: string | null }; expires?: string };

/**
 * Returns the current session for server-side use (e.g. server actions).
 * Use at the start of every data read/write to enforce authorization.
 * Returns null when unauthenticated.
 */
export async function getSessionForServer(): Promise<Session | null> {
  const result = (await auth()) as Session | null;
  return result;
}
