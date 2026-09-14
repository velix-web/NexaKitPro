// ponytail: in-memory per-instance limiter, not distributed — each Vercel
// Edge region/instance has its own Map, so a determined attacker hitting
// multiple regions gets multiple buckets. Upgrade path: swap this file's
// body for an Upstash Redis-backed check if real abuse shows up in logs;
// every caller already goes through rateLimit(req, opts), so nothing else
// changes.
const buckets = new Map();

export function rateLimit(req, { limit = 20, windowMs = 60_000 } = {}) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
