export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';

export default async function handler(req) {
  if (!rateLimit(req, { limit: 20, windowMs: 60_000 })) {
    return new Response('Terlalu banyak permintaan, coba lagi nanti.', { status: 429 });
  }

  const key = process.env.FAZZCODE_API_KEY;
  if (!key) return new Response('Server misconfigured', { status: 500 });

  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const time = searchParams.get('time') || Date.now().toString();
  if (!text) return new Response('Missing text', { status: 400 });

  const upstream = `https://api.fazzcode.eu.cc/iqctext?text=${encodeURIComponent(text)}&api_key=${key}&time=${encodeURIComponent(time)}`;

  let res;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(15000) });
  } catch {
    return new Response('Unable to process request', { status: 502 });
  }
  if (!res.ok) return new Response('Unable to process request', { status: 502 });

  return new Response(res.body, { status: 200, headers: { 'content-type': res.headers.get('content-type') || 'image/png' } });
}
