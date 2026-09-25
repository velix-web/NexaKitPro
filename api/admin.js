export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';

// Small duplicate of app.js's TOOLS catalog (slug + title only) — admin.js
// runs on a separate page from the main app and can't import a browser
// script full of DOM calls, so this is the pragmatic minimal copy rather
// than a shared module neither runtime can cleanly use.
const TOOL_CATALOG = [
  ['tiktok', 'TikTok Downloader'], ['instagram', 'Instagram Downloader'], ['spotify', 'Spotify Downloader'],
  ['terabox', 'Terabox Downloader'], ['youtube', 'YouTube Downloader'], ['facebook', 'Facebook Downloader'],
  ['twitter', 'Twitter/X Downloader'], ['capcut', 'CapCut Downloader'], ['savefrom', 'SaveFrom Downloader'],
  ['lahelu', 'Lahelu Downloader'], ['brat', 'Brat Generator'], ['bypass-link', 'Bypass Link'],
  ['react-wa', 'React Channel WA'], ['iqc', 'iPhone Quote Create'], ['sertifikat-tolol', 'Sertifikat Tolol'],
  ['lobby-ml', 'Fake Lobby ML'], ['lobby-ff', 'Fake Lobby FF'], ['fakedana', 'Fake Saldo DANA'],
  ['fakedev', 'FakeDev Profile'], ['img2link', 'Foto To Link'], ['remove-background', 'Remove Background'],
  ['image-enhancer', 'Image Enhancer'], ['ff-stalk', 'FF Stalk'], ['ml-stalk', 'ML Stalk'],
  ['tiktok-stalk', 'TikTok Stalk'], ['instagram-stalk', 'Instagram Stalk'], ['github-stalk', 'GitHub Stalk'],
  ['shortlink', 'Shortlink'], ['website-screenshot', 'Website Screenshot'], ['nexadrama', 'NexaDrama'],
];

// Mirrors api/proxy.js's PROVIDERS keys exactly — an admin-created tool can only
// point at one of these already-vetted upstreams, never an arbitrary URL.
const ALLOWED_PROVIDERS = [
  'tiktok', 'ig', 'spotify', 'terabox', 'enhancer', 'fakedana', 'lobbyml', 'lobbyff',
  'fb', 'tw', 'capcut', 'savefrom', 'lahelu', 'brat', 'sertifikat', 'fakedev',
  'ytmp4', 'ytmp3', 'bypass', 'react',
];
const ALLOWED_CATEGORIES = ['downloader', 'maker', 'tools', 'vault', 'external'];

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return r;
}
async function sbJson(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function sbCount(path) {
  const r = await sb(path, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
  const range = r.headers.get('content-range');
  return range ? Number(range.split('/')[1] || 0) : 0;
}
async function getCaller(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } });
  if (!r.ok) return null;
  return r.json();
}
async function logActivity(actor, action, target, meta) {
  try {
    await sb('activity_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ actor_id: actor.id, actor_username: actor.username, action, target: target || null, meta: meta || null }]),
    });
  } catch { /* audit trail is best-effort — never block the actual admin action on it */ }
}

async function getStats() {
  const [totalUsers, totalUsage, pendingBugs, pendingSuggestions] = await Promise.all([
    sbCount('profiles?select=id'),
    sbCount('tool_usage?select=id'),
    sbCount('feedback?select=id&kind=eq.bug&status=eq.pending'),
    sbCount('feedback?select=id&kind=eq.suggestion&status=eq.pending'),
  ]);
  return { totalUsers, totalUsage, pendingBugs, pendingSuggestions };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!rateLimit(req, { limit: 60, windowMs: 60_000 })) return json({ error: 'Terlalu banyak permintaan, coba lagi nanti.' }, 429);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: 'Server belum dikonfigurasi: SUPABASE_SERVICE_ROLE_KEY hilang di environment variables Vercel.' }, 500);
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const authUser = await getCaller(token);
  if (!authUser?.id) return json({ error: 'Sesi tidak valid, silakan login ulang.' }, 401);

  const meRows = await sbJson(`profiles?id=eq.${authUser.id}&select=id,username,role,banned`);
  const me = meRows?.[0];
  if (!me || me.banned) return json({ error: 'Forbidden' }, 403);
  if (me.role !== 'admin' && me.role !== 'owner') return json({ error: 'Forbidden' }, 403);
  const isOwner = me.role === 'owner';
  const actor = { id: me.id, username: me.username };

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Body tidak valid' }, 400); }
  const { action, payload = {} } = body || {};

  try {
    switch (action) {
      case 'stats':
        await logActivity(actor, 'admin_login');
        return json(await getStats());

      case 'users.list': {
        const rows = await sbJson('profiles?select=id,username,display_name,role,is_vip,banned,created_at&order=created_at.desc&limit=300');
        return json({ users: rows });
      }

      case 'users.detail': {
        if (!payload.id) return json({ error: 'id wajib diisi' }, 400);
        const rows = await sbJson(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=id,username,display_name,role,is_vip,banned,created_at,updated_at`);
        if (!rows?.[0]) return json({ error: 'User tidak ditemukan' }, 404);
        return json({ user: rows[0] });
      }

      case 'users.ban': {
        if (!payload.id) return json({ error: 'id wajib diisi' }, 400);
        if (payload.id === me.id) return json({ error: 'Tidak bisa ban akun sendiri.' }, 400);
        const targetRows = await sbJson(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=role,username`);
        const target = targetRows?.[0];
        if (!target) return json({ error: 'User tidak ditemukan' }, 404);
        if (target.role === 'owner' && !isOwner) return json({ error: 'Tidak bisa ban Owner.' }, 403);
        await sbJson(`profiles?id=eq.${encodeURIComponent(payload.id)}`, { method: 'PATCH', body: JSON.stringify({ banned: !!payload.banned }) });
        await logActivity(actor, payload.banned ? 'ban_user' : 'unban_user', target.username);
        return json({ ok: true });
      }

      case 'users.delete': {
        if (!isOwner) return json({ error: 'Hanya Owner yang bisa menghapus user.' }, 403);
        if (!payload.id) return json({ error: 'id wajib diisi' }, 400);
        if (payload.id === me.id) return json({ error: 'Tidak bisa hapus akun sendiri.' }, 400);
        const targetRows = await sbJson(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=role,username`);
        const target = targetRows?.[0];
        if (!target) return json({ error: 'User tidak ditemukan' }, 404);
        if (target.role === 'owner') return json({ error: 'Tidak bisa hapus Owner.' }, 403);
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(payload.id)}`, {
          method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        if (!r.ok) throw new Error(`Gagal hapus user (${r.status})`);
        await logActivity(actor, 'delete_user', target.username);
        return json({ ok: true });
      }

      case 'users.setRole': {
        if (!isOwner) return json({ error: 'Hanya Owner yang bisa mengubah role.' }, 403);
        const { id, role } = payload;
        if (!id || !['user', 'admin', 'owner'].includes(role)) return json({ error: 'Payload tidak valid' }, 400);
        if (id === me.id) return json({ error: 'Tidak bisa ubah role sendiri.' }, 400);
        await sbJson(`profiles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ role }) });
        await logActivity(actor, 'set_role', id, { role });
        return json({ ok: true });
      }

      case 'tools.list': {
        const [statusRows, customRows] = await Promise.all([
          sbJson('tool_status?select=slug,enabled,maintenance,vvip_only'),
          sbJson('custom_tools?select=id,slug,title,category,provider,type&order=sort_order.asc'),
        ]);
        const bySlug = Object.fromEntries((statusRows || []).map(r => [r.slug, r]));
        const builtIn = TOOL_CATALOG.map(([slug, title]) => ({ slug, title, custom: false }));
        const custom = (customRows || []).map(r => ({
          id: r.id, slug: r.slug, title: `${r.title} (${r.category})`, custom: true,
        }));
        const tools = [...builtIn, ...custom].map(t => ({
          ...t, enabled: bySlug[t.slug]?.enabled ?? true, maintenance: bySlug[t.slug]?.maintenance ?? false,
          vvipOnly: bySlug[t.slug]?.vvip_only ?? false,
        }));
        return json({ tools });
      }

      case 'tools.toggle': {
        const { slug } = payload;
        if (!slug) return json({ error: 'slug wajib diisi' }, 400);
        const patch = {};
        if (typeof payload.enabled === 'boolean') patch.enabled = payload.enabled;
        if (typeof payload.maintenance === 'boolean') patch.maintenance = payload.maintenance;
        if (typeof payload.vvipOnly === 'boolean') patch.vvip_only = payload.vvipOnly;
        patch.updated_at = new Date().toISOString();
        await sbJson(`tool_status?slug=eq.${encodeURIComponent(slug)}`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ slug, ...patch }]),
        });
        await logActivity(actor, 'edit_tool', slug, patch);
        return json({ ok: true });
      }

      case 'tools.create': {
        const { title, description, tag, icon, category, type, provider, paramKey } = payload;
        if (!title || !type || !provider) return json({ error: 'Judul, tipe, dan provider wajib diisi' }, 400);
        if (!['generic-downloader', 'image-generator'].includes(type)) {
          return json({ error: 'Tipe tool hanya boleh "generic-downloader" atau "image-generator" — tipe lain butuh kode khusus.' }, 400);
        }
        if (!ALLOWED_PROVIDERS.includes(provider)) {
          return json({ error: `Provider "${provider}" tidak ada di daftar yang diizinkan server.` }, 400);
        }
        if (!ALLOWED_CATEGORIES.includes(category)) return json({ error: 'Kategori tidak valid' }, 400);
        const slugBase = String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tool';
        let slug = slugBase, n = 1;
        const existingSlugs = new Set([...TOOL_CATALOG.map(([s]) => s), ...(await sbJson('custom_tools?select=slug')).map(r => r.slug)]);
        while (existingSlugs.has(slug)) { slug = `${slugBase}-${++n}`; }
        await sbJson('custom_tools', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            slug, title, description: description || '', tag: tag || '', icon: icon || 'wrench',
            category, type, provider, param_key: paramKey || 'url',
          }]),
        });
        await logActivity(actor, 'create_tool', slug);
        return json({ ok: true, slug });
      }

      case 'tools.delete': {
        const { id } = payload;
        if (!id) return json({ error: 'id wajib diisi' }, 400);
        const rows = await sbJson(`custom_tools?id=eq.${encodeURIComponent(id)}&select=slug`);
        const row = rows?.[0];
        if (!row) return json({ error: 'Tool tidak ditemukan' }, 404);
        await sbJson(`custom_tools?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await sbJson(`tool_status?slug=eq.${encodeURIComponent(row.slug)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await logActivity(actor, 'delete_tool', row.slug);
        return json({ ok: true });
      }

      case 'reports.list': {
        let q = 'feedback?select=id,username,kind,message,status,created_at&order=created_at.desc&limit=300';
        if (payload.kind) q += `&kind=eq.${encodeURIComponent(payload.kind)}`;
        if (payload.status) q += `&status=eq.${encodeURIComponent(payload.status)}`;
        return json({ reports: await sbJson(q) });
      }

      case 'reports.setStatus': {
        const { id, status } = payload;
        if (!id || !['pending', 'reviewed', 'done'].includes(status)) return json({ error: 'Payload tidak valid' }, 400);
        await sbJson(`feedback?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        await logActivity(actor, 'update_report_status', String(id), { status });
        return json({ ok: true });
      }

      case 'announcements.list':
        return json({ announcements: await sbJson('announcements?select=id,title,body,active,created_at,updated_at&order=created_at.desc') });

      case 'announcements.create': {
        const { title, body: text } = payload;
        if (!title || !text) return json({ error: 'Judul dan isi wajib diisi' }, 400);
        await sbJson('announcements', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ title, body: text }]) });
        await logActivity(actor, 'create_announcement', title);
        return json({ ok: true });
      }

      case 'announcements.update': {
        const { id, title, body: text } = payload;
        if (!id) return json({ error: 'id wajib diisi' }, 400);
        await sbJson(`announcements?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', body: JSON.stringify({ title, body: text, updated_at: new Date().toISOString() }),
        });
        await logActivity(actor, 'edit_announcement', String(id));
        return json({ ok: true });
      }

      case 'announcements.toggle': {
        const { id, active } = payload;
        if (!id) return json({ error: 'id wajib diisi' }, 400);
        await sbJson(`announcements?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: !!active, updated_at: new Date().toISOString() }) });
        await logActivity(actor, active ? 'enable_announcement' : 'disable_announcement', String(id));
        return json({ ok: true });
      }

      case 'announcements.delete': {
        const { id } = payload;
        if (!id) return json({ error: 'id wajib diisi' }, 400);
        await sbJson(`announcements?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await logActivity(actor, 'delete_announcement', String(id));
        return json({ ok: true });
      }

      case 'logs.list':
        return json({ logs: await sbJson('activity_logs?select=id,actor_username,action,target,meta,created_at&order=created_at.desc&limit=200') });

      default:
        return json({ error: 'Action tidak dikenal' }, 400);
    }
  } catch (e) {
    // Full detail stays server-side only — an upstream PostgREST error can
    // include table/column/query hints that shouldn't reach the browser,
    // even the admin's.
    console.error('[admin]', e);
    return json({ error: 'Terjadi kesalahan pada server. Coba lagi nanti.' }, 500);
  }
}
