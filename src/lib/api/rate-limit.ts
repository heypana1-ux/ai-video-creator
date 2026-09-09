/**
 * In-memory fixed-window rate limiter.
 *
 * Good enough for a single node (and for demo mode). For a multi-instance
 * deployment swap the map for Redis or Supabase - the call sites do not change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetInMs: existing.resetAt - now,
  };
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}

/** Best-effort client identity for anonymous endpoints. */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return `${prefix}:${ip}`;
}
