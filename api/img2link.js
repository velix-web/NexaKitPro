export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';
import { authenticate, enforceToolAccess } from './_auth.js';
import { validateAndUploadImage, jsonResponse } from './_imgbb-core.js';

// "Foto To Link" (img2link) gets its own endpoint, separate from the
// shared imgbb-upload.js, specifically so its enabled/maintenance/VVIP
// status can be enforced with a slug that is hardcoded here — never
// client-supplied, never spoofable. For this tool, uploading the photo IS
// the entire feature (no further gated call happens afterwards the way
// lobby-ml/fakedev/image-enhancer have), so this is the one place its
// authorization actually has to live.
const SLUG = 'img2link';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  if (!rateLimit(req, { limit: 15, windowMs: 60_000 })) {
    return jsonResponse({ success: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, 429);
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const blocked = await enforceToolAccess(auth, SLUG);
  if (blocked) return blocked;

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
