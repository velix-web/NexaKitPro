export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate, enforceToolAccess } from './_auth.js';

// Fixed upstream, same SSRF-guard reasoning as proxy.js: only this host is
// ever fetched, the user-supplied link only ever travels as the form value.
const UPSTREAM = 'https://kua.lat/shorten';
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript):/i;
const SLUG = 'shortlink';

function err(msg, status) {
  return new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(req) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  if (!rateLimit(req, { limit: 20, windowMs: 60_000 })) return err('Terlalu banyak permintaan, coba lagi nanti.', 429);

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const blocked = await enforceToolAccess(auth, SLUG);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return err('Parameter url wajib diisi', 400);
  if (BLOCKED_SCHEME.test(target)) return err('Invalid parameter', 400);
  if (!/^https?:\/\//i.test(target)) return err('Link harus diawali http:// atau https://', 400);

  const boundary = '----nexakit' + crypto.randomUUID().replace(/-/g, '');
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${target}\r\n--${boundary}--\r\n`;

  let res;
  try {
    res = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
        origin: 'https://kua.lat',
        referer: 'https://kua.lat/',
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return err('Unable to process request', 502);
  }
  if (!res.ok) return err('Unable to process request', 502);

  let data;
  try { data = await res.json(); } catch { return err('Unable to process request', 502); }
  const shortUrl = data?.data?.shorturl;
  if (!shortUrl) return err('Layanan shortlink tidak merespons dengan benar', 502);

  return new Response(JSON.stringify({ success: true, result: shortUrl }), { status: 200, headers: { 'content-type': 'application/json' } });
}
