export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate, isVvipEntitled, getToolStatus, getCustomToolProvider } from './_auth.js';

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
  bypass:     'https://api.fazzcode.eu.cc/api/bypass',
  react:      'https://api.fazzcode.eu.cc/api/react',
  // Stalk / lookup tools (VVIP) — enforced server-side below via tool_status,
  // not by this list. This comment just documents intent; the actual gate
  // is whatever an admin has set for the tool's slug in the database.
  ffstalk:      'https://api.fazzcode.eu.cc/api/ff/stalk',
  mlstalk:      'https://api.fazzcode.eu.cc/api/ml/stalk',
  tiktokstalk:  'https://api.fazzcode.eu.cc/api/tiktokstalk',
  igstalk:      'https://api.fazzcode.eu.cc/api/instagram',
  githubstalk:  'https://api.fazzcode.eu.cc/api/githubstalk',
  // FreeDrama — registered so the backend is ready, but no tool card uses
  // these yet. See reply: this needs its own multi-screen UI, not a card.
  dramahome:    'https://api.fazzcode.eu.cc/api/freedrama/homepage',
  dramasearch:  'https://api.fazzcode.eu.cc/api/freedrama/search',
  dramadetail:  'https://api.fazzcode.eu.cc/api/freedrama/detail',
  dramastream:  'https://api.fazzcode.eu.cc/api/freedrama/stream',
};

// Authorization source of truth for which slug may call which provider(s).
// The client also sends `slug` (so the server knows which tool_status row
// governs this call), but that slug is always cross-checked against THIS
// map (or, for admin-created tools, against custom_tools in the database)
// before the requested provider is trusted — never taken on the client's
// word alone. This is what stops a client from pairing a VVIP-only
// provider with an unrelated free-tool slug to dodge the VVIP check.
const BUILT_IN_SLUG_PROVIDERS = {
  tiktok: ['tiktok'], instagram: ['ig'], spotify: ['spotify'], terabox: ['terabox'],
  youtube: ['ytmp4', 'ytmp3'], facebook: ['fb'], twitter: ['tw'], capcut: ['capcut'],
  savefrom: ['savefrom'], lahelu: ['lahelu'], brat: ['brat'], 'bypass-link': ['bypass'],
  'react-wa': ['react'], 'sertifikat-tolol': ['sertifikat'], 'lobby-ml': ['lobbyml'],
  'lobby-ff': ['lobbyff'], fakedana: ['fakedana'], fakedev: ['fakedev'],
  'image-enhancer': ['enhancer'], 'ff-stalk': ['ffstalk'], 'ml-stalk': ['mlstalk'],
  'tiktok-stalk': ['tiktokstalk'], 'instagram-stalk': ['igstalk'], 'github-stalk': ['githubstalk'],
  nexadrama: ['dramahome', 'dramasearch', 'dramadetail', 'dramastream'],
};

async function resolveAllowedProviders(slug) {
  if (BUILT_IN_SLUG_PROVIDERS[slug]) return BUILT_IN_SLUG_PROVIDERS[slug];
  const provider = await getCustomToolProvider(slug);
  return provider ? [provider] : null;
}

// Params whose value is itself a URL (a link the user pasted, or an ImgBB
// URL we generated) — block dangerous schemes even though our server never
// treats these as a fetch target itself.
const URL_VALUE_PARAMS = new Set(['url', 'avatar', 'image']);
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript):/i;

export default async function handler(req) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  if (!rateLimit(req, { limit: 30, windowMs: 60_000 })) return err('Terlalu banyak permintaan, coba lagi nanti.', 429);

  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');
  const slug = searchParams.get('slug');
  const base = PROVIDERS[provider];
  if (!base) return err('Unknown provider', 400);
  if (!slug) return err('Missing tool reference', 400);

  const allowedProviders = await resolveAllowedProviders(slug);
  if (!allowedProviders || !allowedProviders.includes(provider)) {
    return err('Invalid tool reference', 400);
  }

  const status = await getToolStatus(slug);
  if (status.enabled === false || status.maintenance) return err('Tool ini sedang tidak tersedia.', 403);
  if (status.vvip_only && !isVvipEntitled(authResult)) return err('Tool ini khusus member VVIP.', 403);

  const upstream = new URL(base);
  for (const [k, v] of searchParams) {
    if (k === 'provider' || k === 'slug') continue;
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
