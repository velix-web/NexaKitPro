export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }
  if (!rateLimit(req, { limit: 15, windowMs: 60_000 })) {
    return json({ success: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, 429);
  }

  const key = process.env.IMGBB_API_KEY;
  if (!key) return json({ success: false, error: 'Server misconfigured' }, 500);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ success: false, error: 'Invalid form data' }, 400);
  }

  const file = form.get('image');
  if (!(file instanceof File)) return json({ success: false, error: 'Missing image file' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return json({ success: false, error: 'Unsupported file type' }, 400);
  if (file.size > MAX_BYTES) return json({ success: false, error: 'File too large' }, 400);

  const upstream = new FormData();
  upstream.append('image', file);

  let res;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
      method: 'POST',
      body: upstream,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return json({ success: false, error: 'Unable to process request' }, 502);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return json({ success: false, error: 'Unable to process request' }, 502);

  return json({ success: true, data: { url: data.data.url } });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
