/**
 * Simple in-memory rate limiter for server-side use.
 * For production at scale, use a store (e.g. Redis) or Vercel's @vercel/firewall.
 */

const windowMs = 60 * 1000; // 1 minute
const maxAttempts = 10;

const attempts = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string): string {
  return identifier;
}

function cleanup() {
  const now = Date.now();
  for (const [key, value] of attempts.entries()) {
    if (value.resetAt < now) attempts.delete(key);
  }
}

/**
 * Returns true if the request is within limits, false if rate limited.
 * Call before performing the action (e.g. login).
 */
export function checkRateLimit(identifier: string): boolean {
  cleanup();
  const now = Date.now();
  const key = getKey(identifier);
  const entry = attempts.get(key);
  if (!entry) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxAttempts;
}

/**
 * Call after a failed login to record the attempt (optional; checkRateLimit is enough for attempt counting).
 * Exposed for clarity; currently we count all authorize calls.
 */
