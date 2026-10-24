// Shared server-side authentication + per-tool authorization for
// tool-execution endpoints running on the Edge runtime (Fetch API req).
//
// Every tool-execution endpoint MUST call authenticate(req) before doing
// any paid/third-party work, and MUST re-check enforceToolAccess() (or an
// equivalent inline vvip/enabled check) against a fresh database read.
// Nothing here uses the service-role key: verifying a user's own identity
// and reading their own profile row only needs the anon/publishable key +
// the existing profiles_select_own RLS policy (see supabase/schema.sql) —
// these endpoints never need service-role credentials, unlike api/admin.js
// which legitimately does for cross-user operations.
//
// A client's role/is_vip/banned/tool_status values are NEVER trusted —
// every value used for an authorization decision here is re-fetched from
// Supabase on every request.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
function unauthorized(msg = 'Login diperlukan untuk menggunakan tool ini.') {
  return json({ success: false, error: msg }, 401);
}
function forbidden(msg = 'Forbidden') {
  return json({ success: false, error: msg }, 403);
}
function serverError(msg = 'Tidak bisa memverifikasi status tool ini, coba lagi sebentar.') {
  return json({ success: false, error: msg }, 503);
}

// Returns a user object { id, role, is_vip } on success, or a Response to
// return immediately (unauthenticated / invalid / expired / banned).
export async function authenticate(req) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ success: false, error: 'Server belum dikonfigurasi.' }, 500);

  const header = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1].trim() : '';
  if (!token) return unauthorized();

  // Only Supabase saying "this token is not valid" (401/403) is an invalid
  // session. A timeout / network error / 5xx is OUR dependency being down: still
  // denied (fail closed), but as 503 — the browser treats 401 as "session
  // expired" and logs the user out, so a short Supabase blip used to sign out
  // everyone who happened to be using a tool.
  let authUser;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401 || r.status === 403) return unauthorized('Sesi tidak valid atau sudah kedaluwarsa.');
    if (!r.ok) return serverError('Layanan autentikasi sedang bermasalah, coba lagi sebentar.');
    authUser = await r.json();
  } catch {
    return serverError('Layanan autentikasi sedang bermasalah, coba lagi sebentar.');
  }
  if (!authUser?.id) return unauthorized('Sesi tidak valid atau sudah kedaluwarsa.');

  // Re-read the caller's OWN profile row, scoped by RLS (profiles_select_own:
  // auth.uid() = id) via their own token — never the service-role key, and
  // never any role/is_vip/banned value the client sent us.
  let profile;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,role,is_vip,banned`,
      { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }, signal: AbortSignal.timeout(8000) },
    );
    if (r.status === 401 || r.status === 403) return unauthorized('Sesi tidak valid atau sudah kedaluwarsa.');
    if (!r.ok) return serverError('Layanan autentikasi sedang bermasalah, coba lagi sebentar.');
    profile = (await r.json())?.[0];
  } catch {
    return serverError('Layanan autentikasi sedang bermasalah, coba lagi sebentar.');
  }
  if (!profile) return unauthorized('Profil tidak ditemukan, silakan login ulang.');
  if (profile.banned) return forbidden('Akun kamu telah dinonaktifkan oleh admin.');

  return { id: profile.id, role: profile.role || 'user', is_vip: !!profile.is_vip };
}

export function isVvipEntitled(user) {
  return !!user?.is_vip || user?.role === 'admin' || user?.role === 'owner';
}

// Public read (tool_status has an anon+authenticated select policy) — no
// user token needed, but the result still only ever comes from the
// database, never from anything the client asserts.
//
// Returns { ok:true, enabled, maintenance, vvip_only } when we have a real
// answer — EITHER a real row, OR a confirmed absence of one (an empty
// result array IS a definite answer: "no override exists, schema defaults
// apply" — enabled=true/maintenance=false/vvip_only=false are the actual
// column defaults in supabase/schema.sql, not a guess).
//
// Returns { ok:false } when we could NOT get a real answer: missing config,
// network failure, a non-2xx response, or a response that doesn't look
// like the shape we expect. Callers MUST treat ok:false as "deny" — never
// as "tool is available". This used to collapse both cases into the same
// permissive default, which meant a transient Supabase blip or timeout
// silently unlocked every tool, including VVIP-only ones.
export async function getToolStatus(slug) {
  if (!SUPABASE_URL || !ANON_KEY || !slug) return { ok: false };
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/tool_status?slug=eq.${encodeURIComponent(slug)}&select=enabled,maintenance,vvip_only`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return { ok: false };
    const rows = await r.json();
    if (!Array.isArray(rows)) return { ok: false };
    const row = rows[0];
    if (!row) return { ok: true, enabled: true, maintenance: false, vvip_only: false };
    if (typeof row.enabled !== 'boolean' || typeof row.maintenance !== 'boolean' || typeof row.vvip_only !== 'boolean') {
      return { ok: false };
    }
    return { ok: true, enabled: row.enabled, maintenance: row.maintenance, vvip_only: row.vvip_only };
  } catch {
    return { ok: false };
  }
}

// custom_tools has an anon+authenticated select policy too — used by
// proxy.js to resolve which provider a non-built-in (admin-created) slug
// is allowed to call.
export async function getCustomToolProvider(slug) {
  if (!SUPABASE_URL || !ANON_KEY || !slug) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/custom_tools?slug=eq.${encodeURIComponent(slug)}&select=provider`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (!r.ok) return null;
    return (await r.json())?.[0]?.provider || null;
  } catch {
    return null;
  }
}

// Convenience for endpoints that own a single fixed slug (everything
// except proxy.js / imgbb-upload.js, which serve several tools each).
// Returns null when access is fine, or a Response to return immediately.
export async function enforceToolAccess(user, slug) {
  const status = await getToolStatus(slug);
  if (!status.ok) return serverError();
  if (status.enabled === false || status.maintenance) return forbidden('Tool ini sedang tidak tersedia.');
  if (status.vvip_only && !isVvipEntitled(user)) return forbidden('Tool ini khusus member VVIP.');
  return null;
}
