// Magic-byte (file-signature) validation for uploaded images. The
// browser-declared `file.type` is never trusted on its own — an attacker
// can send any Content-Type they like with any bytes. This checks the
// actual leading bytes of the file against the signature for the type the
// upload claims to be, so a renamed/relabeled non-image (or a polyglot)
// gets rejected before it ever reaches the upstream API.

function startsWith(bytes, seq, offset = 0) {
  if (bytes.length < offset + seq.length) return false;
  for (let i = 0; i < seq.length; i++) if (bytes[offset + i] !== seq[i]) return false;
  return true;
}

const SIGNATURES = {
  'image/jpeg': b => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/png': b => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': b => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  'image/gif': b => startsWith(b, [0x47, 0x49, 0x46, 0x38]) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
};

// Reads only the first `n` bytes — Blob#slice does not read/consume the
// underlying file, so the original File object is still fully intact for
// the caller to forward upstream afterwards.
async function readHeaderBytes(file, n = 16) {
  const buf = await file.slice(0, n).arrayBuffer();
  return new Uint8Array(buf);
}

// declaredType must be one of SIGNATURES's keys to pass — an unlisted type
// always fails closed rather than being waved through.
export async function verifyImageMagicBytes(file, declaredType) {
  const check = SIGNATURES[declaredType];
  if (!check) return false;
  const bytes = await readHeaderBytes(file, 16);
  return check(bytes);
}
