// Node-runtime counterpart to _auth.js — same authentication and per-tool
// authorization logic, adapted to a plain Node req (req.headers is a plain
// object, not a Fetch Headers instance) for brat3.js/bratvid.js, which run
// on the Node serverless runtime (ffmpeg/@napi-rs/canvas can't run on
// Edge — see the comment at the top of bratvid.js). Kept as a separate
// small file rather than shared with _auth.js because Edge (ESM `import`)
// and this Node runtime (CommonJS `require`) don't reliably interop for
// named exports — the exact same reasoning bratvid.js already uses for
// duplicating its rate limiter instead of reusing _ratelimit.js.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Returns { status: 200, user } on success, or { status, error } on
// failure — the caller writes the HTTP response either way.
async function authenticate(req) {
  if (!SUPABASE_URL || !ANON_KEY) return { status: 500, error: 'Server belum dikonfigurasi.' };

  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1].trim() : '';
  if (!token) return { status: 401, error: 'Login diperlukan untuk menggunakan tool ini.' };

  let authUser;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { status: 401, error: 'Sesi tidak valid atau sudah kedaluwarsa.' };
    authUser = await r.json();
  } catch {
    return { status: 401, error: 'Sesi tidak valid atau sudah kedaluwarsa.' };
  }
  if (!authUser?.id) return { status: 401, error: 'Sesi tidak valid atau sudah kedaluwarsa.' };

  let profile;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,role,is_vip,banned`,
      { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } },
    );
    if (!r.ok) return { status: 401, error: 'Sesi tidak valid atau sudah kedaluwarsa.' };
    profile = (await r.json())?.[0];
  } catch {
    return { status: 401, error: 'Sesi tidak valid atau sudah kedaluwarsa.' };
  }
  if (!profile) return { status: 401, error: 'Profil tidak ditemukan, silakan login ulang.' };
  if (profile.banned) return { status: 403, error: 'Akun kamu telah dinonaktifkan oleh admin.' };

  return { status: 200, user: { id: profile.id, role: profile.role || 'user', is_vip: !!profile.is_vip } };
}

function isVvipEntitled(user) {
  return !!user?.is_vip || user?.role === 'admin' || user?.role === 'owner';
}

async function getToolStatus(slug) {
  const fallback = { enabled: true, maintenance: false, vvip_only: false };
  if (!SUPABASE_URL || !ANON_KEY || !slug) return fallback;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/tool_status?slug=eq.${encodeURIComponent(slug)}&select=enabled,maintenance,vvip_only`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (!r.ok) return fallback;
    const row = (await r.json())?.[0];
    if (!row) return fallback;
    return { enabled: row.enabled ?? true, maintenance: !!row.maintenance, vvip_only: !!row.vvip_only };
  } catch {
    return fallback;
  }
}

async function enforceToolAccess(user, slug) {
  const status = await getToolStatus(slug);
  if (status.enabled === false || status.maintenance) return { status: 403, error: 'Tool ini sedang tidak tersedia.' };
  if (status.vvip_only && !isVvipEntitled(user)) return { status: 403, error: 'Tool ini khusus member VVIP.' };
  return null;
}

module.exports = { authenticate, isVvipEntitled, getToolStatus, enforceToolAccess };
