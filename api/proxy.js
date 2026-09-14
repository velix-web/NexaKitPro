export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';

// Fixed upstream per provider — the host is NEVER derived from user input,
// only these hardcoded URLs are ever fetched. User-supplied values only ever
// travel as query param VALUES to one of these trusted hosts.
const PROVIDERS = {
  tiktok:     'https://www.tikwm.com/api/',
  ig:         'https://api.nexray.eu.cc/downloader/instagram',
  spotify:    'https://api.nexray.eu.cc/downloader/spotify',
  terabox:    'https://api.nexray.eu.cc/downloader/terabox',
  enhancer:   'https://api.nexray.eu.cc/tools/v1/enhancer',
  fakedana:   'https://api.nexray.eu.cc/maker/fakedana',
  lobbyml:    'https://api.nexray.eu.cc/maker/fakelobyml',
  lobbyff:    'https://api.nexray.eu.cc/maker/fakelobyff',
  fb:         'https://api.siputzx.my.id/api/d/facebook',
  tw:         'https://api.siputzx.my.id/api/d/twitter',
  capcut:     'https://api.siputzx.my.id/api/d/capcut',
  savefrom:   'https://api.siputzx.my.id/api/d/savefrom',
  lahelu:     'https://api.siputzx.my.id/api/d/lahelu',
  brat:       'https://api.siputzx.my.id/api/m/brat',
  sertifikat: 'https://api.siputzx.my.id/api/canvas/sertifikat-tolol',
  fakedev:    'https://api.ikyyxd.my.id/canvas/fakedev',
  ytmp4:      'https://api.nexray.eu.cc/downloader/ytmp4',
  ytmp3:      'https://api.nexray.eu.cc/downloader/ytmp3',
};

// Params whose value is itself a URL (a link the user pasted, or an ImgBB
// URL we generated) — block dangerous schemes even though our server never
// treats these as a fetch target itself.
const URL_VALUE_PARAMS = new Set(['url', 'avatar', 'image']);
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript):/i;

export default async function handler(req) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  if (!rateLimit(req, { limit: 30, windowMs: 60_000 })) return err('Terlalu banyak permintaan, coba lagi nanti.', 429);

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');
  const base = PROVIDERS[provider];
  if (!base) return err('Unknown provider', 400);

  const upstream = new URL(base);
  for (const [k, v] of searchParams) {
    if (k === 'provider') continue;
    if (URL_VALUE_PARAMS.has(k) && BLOCKED_SCHEME.test(v)) return err('Invalid parameter', 400);
    upstream.searchParams.set(k, v);
  }

  let res;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(20000) });
  } catch {
    return err('Unable to process request', 502);
  }
  if (!res.ok) return err('Unable to process request', 502);

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return new Response(res.body, { status: 200, headers: { 'content-type': 'application/json' } });
  }
  // Anything else (image/gif/etc) — stream straight through.
  return new Response(res.body, { status: 200, headers: { 'content-type': ct || 'application/octet-stream' } });
}

function err(msg, status) {
  return new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { 'content-type': 'application/json' } });
}
