// In-memory, PER-INSTANCE limiter — NOT distributed. Each Vercel Edge
// region/instance has its own Map, so a determined attacker spread across
// regions/IPs gets multiple buckets; treat this as abuse dampening, not a
// hard guarantee. Upgrade path (documented in README): swap this body for an
// Upstash Redis check — every caller already goes through rateLimit(req, opts),
// so nothing else changes.
//
// Notes:
// - Keyed by endpoint path + client IP, so one busy endpoint can't burn another
//   endpoint's budget.
// - The IP is the first x-forwarded-for entry. That is only trustworthy because
//   Vercel's edge sets this header itself (it does not pass through a
//   client-supplied value). If this is ever deployed behind a different proxy,
//   re-check that assumption before relying on it.
// - Expired buckets are swept so the Map can't grow without bound.
const buckets = new Map();
const MAX_BUCKETS = 5000;

export function rateLimit(req, { limit = 20, windowMs = 60_000 } = {}) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  let path = '';
  try { path = new URL(req.url).pathname; } catch { /* keep empty */ }
  const key = `${path}|${ip}`;
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    if (buckets.size > MAX_BUCKETS) buckets.clear(); // still flooded: fail to a clean slate rather than leak memory
  }

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
