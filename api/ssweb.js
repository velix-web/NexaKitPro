export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate, enforceToolAccess } from './_auth.js';
import { isBlockedTarget } from './_ssrf-guard.js';

const WEB = 'https://pikwy.com';
const API = 'https://api.pikwy.com/';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript):/i;
const SLUG = 'website-screenshot';

function err(msg, status) {
  return new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(req) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  if (!rateLimit(req, { limit: 10, windowMs: 60_000 })) return err('Terlalu banyak permintaan, coba lagi nanti.', 429);

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const blocked = await enforceToolAccess(auth, SLUG);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return err('Parameter url wajib diisi', 400);
  if (BLOCKED_SCHEME.test(target)) return err('Invalid parameter', 400);
  if (!/^https?:\/\//i.test(target)) return err('URL harus diawali http:// atau https://', 400);
  // Defense-in-depth: this doesn't stop pikwy.com itself from being abused,
  // but it stops our endpoint from being used to point a third-party
  // screenshotter at loopback/private/link-local/metadata targets. See
  // _ssrf-guard.js for the documented DNS-rebinding limitation.
  if (isBlockedTarget(target)) return err('URL tidak diizinkan.', 400);

  try {
    // Step 1: visit the site once so it hands us a session cookie — pikwy's
    // API rejects requests with no prior session.
    const homeRes = await fetch(WEB, {
      headers: { 'user-agent': UA, referer: 'https://www.google.com/' },
      signal: AbortSignal.timeout(15000),
    });
    const cookie = (homeRes.headers.get('set-cookie') || '').split(';')[0];

    // Step 2: request the screenshot itself using that cookie.
    const params = new URLSearchParams({
      tkn: '125', d: '3000', u: target, fs: '0',
      w: '1920', h: '1080', s: '100', z: '100', f: 'png', rt: 'jweb',
    });
    const shotRes = await fetch(`${API}?${params}`, {
      headers: {
        'user-agent': UA, origin: WEB, referer: `${WEB}/`,
        ...(cookie ? { cookie } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!shotRes.ok) return err('Unable to process request', 502);
    const data = await shotRes.json().catch(() => null);
    if (!data?.iurl) return err('Layanan screenshot tidak merespons dengan benar', 502);

    return new Response(JSON.stringify({ success: true, result: data.iurl, download: data.durl || data.iurl }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return err('Unable to process request', 502);
  }
}
