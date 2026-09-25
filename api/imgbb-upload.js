export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate, getToolStatus } from './_auth.js';
import { verifyImageMagicBytes } from './_file-validate.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }
  if (!rateLimit(req, { limit: 15, windowMs: 60_000 })) {
    return json({ success: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, 429);
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const key = process.env.IMGBB_API_KEY;
  if (!key) return json({ success: false, error: 'Server misconfigured' }, 500);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ success: false, error: 'Invalid form data' }, 400);
  }

  // This endpoint is shared infrastructure for several tools (Foto To
  // Link, Fake Lobby ML, FakeDev Profile, Image Enhancer's upload step).
  // Uploading an image to ImgBB by itself grants no VVIP-gated
  // functionality, so we only soft-check enabled/maintenance here from
  // the caller-supplied `slug` (best-effort — this value is NOT
  // authoritative, since a client could send any slug it likes).
  // VVIP enforcement for the tools that use this as a step happens where
  // it actually matters: their own dedicated call into /api/proxy, which
  // independently re-validates vvip_only for that tool's real slug. The
  // one exception is "img2link" (Foto To Link), whose entire function IS
  // this upload with no further gated call afterwards — if that specific
  // tool is ever marked vvip_only, this soft check won't enforce it
  // (documented residual risk; see the security report).
  const slug = form.get('slug');
  if (typeof slug === 'string' && slug) {
    const status = await getToolStatus(slug);
    if (status.enabled === false || status.maintenance) {
      return json({ success: false, error: 'Tool ini sedang tidak tersedia.' }, 403);
    }
  }

  const file = form.get('image');
  if (!(file instanceof File)) return json({ success: false, error: 'Missing image file' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return json({ success: false, error: 'Unsupported file type' }, 400);
  if (file.size > MAX_BYTES) return json({ success: false, error: 'File too large' }, 400);
  if (!(await verifyImageMagicBytes(file, file.type))) {
    return json({ success: false, error: 'File tidak valid (isi file tidak sesuai tipe yang diklaim).' }, 400);
  }

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
