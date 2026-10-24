// Shared upload-to-ImgBB logic for the two Edge endpoints that need it
// (imgbb-upload.js and img2link.js). Pure mechanics only — authentication
// and tool-status authorization are each caller's own responsibility, since
// the two callers have different, non-interchangeable authorization needs
// (see the comments in imgbb-upload.js and img2link.js for why they aren't
// merged into one endpoint).

import { verifyImageMagicBytes } from './_file-validate.js';

export const MAX_IMGBB_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_IMGBB_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Validates the 'image' field from an already-parsed FormData and uploads
// it to ImgBB. Returns a Response either way (success or a specific
// failure) — callers just return whatever this returns.
export async function validateAndUploadImage(form, apiKey) {
  const file = form.get('image');
  if (!(file instanceof File)) return jsonResponse({ success: false, error: 'Missing image file' }, 400);
  if (!ALLOWED_IMGBB_TYPES.includes(file.type)) return jsonResponse({ success: false, error: 'Unsupported file type' }, 400);
  if (file.size > MAX_IMGBB_BYTES) return jsonResponse({ success: false, error: 'File too large' }, 400);
  if (!(await verifyImageMagicBytes(file, file.type))) {
    return jsonResponse({ success: false, error: 'File tidak valid (isi file tidak sesuai tipe yang diklaim).' }, 400);
  }

  const upstream = new FormData();
  upstream.append('image', file);

  let res;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: upstream,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return jsonResponse({ success: false, error: 'Unable to process request' }, 502);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return jsonResponse({ success: false, error: 'Unable to process request' }, 502);

  return jsonResponse({ success: true, data: { url: data.data.url } });
}
