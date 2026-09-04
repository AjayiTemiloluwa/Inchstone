/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Serverless reality: each isolate keeps its own table, so limits are
 * per-instance — still raises the bar dramatically against single-origin
 * floods and runaway client loops, and costs nothing. If strict global
 * limits are ever needed, swap the body for Upstash Redis; call sites
 * won't change.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()
let lastSweep = Date.now()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now()

  // Periodic sweep so abandoned buckets can't grow the map unbounded.
  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  bucket.count++
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

/** Best-effort client IP (Vercel / proxies forward x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}