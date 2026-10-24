export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate } from './_auth.js';
import { validateAndUploadImage, jsonResponse } from './_imgbb-core.js';

// Shared upload infrastructure for tools that upload a photo as an
// intermediate STEP before calling another provider (Fake Lobby ML,
// FakeDev Profile, Image Enhancer, photo-based makers). None of these are
// authorized here — uploading a photo to ImgBB grants no privileged
// capability by itself; the actual VVIP/enabled/maintenance gate for each of
// those tools is enforced independently, server-side, at their real
// /api/proxy call afterwards, using that tool's real slug.
//
// This endpoint intentionally does NOT accept or trust a client-supplied
// `slug` for authorization (it used to, as a soft best-effort check — that
// was removed because a client could claim any slug it liked and there was
// no way to verify which tool an upload was really for). "Foto To Link"
// (img2link), where the upload IS the entire feature with no further gated
// call, has its own dedicated endpoint — see img2link.js — specifically so
// its authorization can't be dodged by calling this endpoint instead.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  if (!rateLimit(req, { limit: 15, windowMs: 60_000 })) {
    return jsonResponse({ success: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, 429);
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const key = process.env.IMGBB_API_KEY;
  if (!key) return jsonResponse({ success: false, error: 'Server misconfigured' }, 500);

  let form;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid form data' }, 400);
  }

  return validateAndUploadImage(form, key);
}
