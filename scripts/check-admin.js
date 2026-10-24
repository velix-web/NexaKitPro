#!/usr/bin/env node
// Tests the REAL api/admin.js handler against a mock that mimics PostgREST's
// quirks that bit us in production:
//   - `Prefer: return=minimal` POST  -> 201 with an EMPTY body (r.json() throws)
//   - PATCH/DELETE that match ZERO rows still answer success
// Run: npm test
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.removeAllListeners('warning');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.join(__dirname, '..');

const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ID = { owner: U(1), admin1: U(2), admin2: U(3), user1: U(4), user2: U(5), bannedAdmin: U(6), normal: U(7), ghost: U(999) };
const TOKENS = { 'tok-owner': ID.owner, 'tok-admin': ID.admin1, 'tok-banned-admin': ID.bannedAdmin, 'tok-normal': ID.normal };

let db;
const reset = () => {
  const mk = (id, username, role = 'user', extra = {}) => ({ id, username, display_name: username, role, is_vip: false, banned: false, created_at: new Date(2024, 0, 1, 0, 0, Number(id.slice(-3))).toISOString(), ...extra });
  db = {
    profiles: [mk(ID.owner, 'boss', 'owner'), mk(ID.admin1, 'adm1', 'admin'), mk(ID.admin2, 'adm2', 'admin'), mk(ID.user1, 'alice'), mk(ID.user2, 'bob', 'user', { is_vip: true }),
      mk(ID.bannedAdmin, 'oldadmin', 'admin', { banned: true }), mk(ID.normal, 'carol'),
      ...Array.from({ length: 120 }, (_, i) => mk(U(1000 + i), `filler${String(i).padStart(3, '0')}`))],
    announcements: [{ id: 1, title: 't', body: 'b', active: true }], feedback: [{ id: 1, status: 'pending' }],
    custom_tools: [], tool_status: [], activity_logs: [],
  };
};

function rest(u, opts) {
  const table = u.pathname.split('/').pop(), method = opts.method || 'GET', prefer = (opts.headers || {}).Prefer || '';
  const rows = db[table]; if (!rows) return new Response('[]', { status: 200 });
  const params = [...u.searchParams];
  const match = r => params.every(([k, v]) => {
    if (['select', 'order', 'limit', 'offset'].includes(k)) return true;
    if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
    if (v.startsWith('ilike.')) return String(r[k]).toLowerCase().includes(v.slice(6).replace(/\*/g, '').toLowerCase());
    return true;
  });
  const body = opts.body ? JSON.parse(opts.body) : null;
  const rep = prefer.includes('return=representation');
  if (method === 'GET') {
    let out = rows.filter(match).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || String(a.id).localeCompare(String(b.id)));
    const off = Number(u.searchParams.get('offset') || 0), lim = Number(u.searchParams.get('limit') || 1000);
    return new Response(JSON.stringify(out.slice(off, off + lim)), { status: 200 });
  }
  if (method === 'PATCH') { const hit = rows.filter(match); hit.forEach(r => Object.assign(r, body)); return rep ? new Response(JSON.stringify(hit), { status: 200 }) : new Response(null, { status: 204 }); }
  if (method === 'DELETE') { const hit = rows.filter(match); hit.forEach(r => rows.splice(rows.indexOf(r), 1)); return rep ? new Response(JSON.stringify(hit), { status: 200 }) : new Response(null, { status: 204 }); }
  if (method === 'POST') {
    for (const item of [].concat(body)) {
      const ex = table === 'tool_status' && rows.find(r => r.slug === item.slug);
      if (ex) Object.assign(ex, item); else rows.push({ id: rows.length + 100, ...item });
    }
    return rep ? new Response(JSON.stringify([].concat(body)), { status: 201 }) : new Response(null, { status: 201 }); // EMPTY body, like PostgREST
  }
  return new Response('{}', { status: 200 });
}
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.pathname === '/auth/v1/user') {
    const tok = ((opts.headers || {}).Authorization || '').replace(/^Bearer\s+/i, '');
    return TOKENS[tok] ? new Response(JSON.stringify({ id: TOKENS[tok] }), { status: 200 }) : new Response('{}', { status: 401 });
  }
  if (u.pathname.startsWith('/rest/v1/')) return rest(u, opts);
  return new Response('{}', { status: 404 });
};

let n = 0, pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; if (!cond) console.error('FAIL  ' + name); };

async function loadHandler(file) { return (await import(pathToFileURL(file).href)).default; }
const asCaller = handler => async (action, payload, token = 'tok-owner') => {
  const r = await handler(new Request('https://x.test/api/admin', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'x-forwarded-for': `10.0.${Math.floor(++n / 250)}.${n % 250}` }, body: JSON.stringify({ action, payload }) }));
  let json = {}; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const row = id => db.profiles.find(p => p.id === id);

(async () => {
  const handler = await loadHandler(path.join(root, 'api/admin.js'));
  const call = asCaller(handler);

  // ---- proof the regression test is real: the OLD sbJson turned a saved write into a 500 ----
  const src = fs.readFileSync(path.join(root, 'api/admin.js'), 'utf8');
  const fixed = src.slice(src.indexOf('async function sbJson'), src.indexOf('async function', src.indexOf('async function sbJson') + 10));
  const oldSb = `async function sbJson(path, opts) {\n  const r = await sb(path, opts);\n  if (!r.ok) throw new Error(\`Supabase \${r.status}: \${await r.text()}\`);\n  return r.status === 204 ? null : r.json();\n}\n`;
  const oldFile = path.join(os.tmpdir(), `admin-old-${process.pid}.mjs`);
  fs.writeFileSync(oldFile, src.replace(fixed, oldSb).replace("from './_ratelimit.js'", `from '${pathToFileURL(path.join(root, 'api/_ratelimit.js')).href}'`));
  reset();
  const oldCall = asCaller(await loadHandler(oldFile));
  const realErr = console.error; console.error = () => {}; // the old build logs its own crash
  let r = await oldCall('tools.toggle', { slug: 'ff-stalk', vvipOnly: true });
  console.error = realErr;
  check('PROOF: old sbJson returned 500 for a write that actually saved', r.status === 500 && db.tool_status.some(t => t.slug === 'ff-stalk' && t.vvip_only === true));
  fs.unlinkSync(oldFile);

  // ---- the fix: toggling a tool answers ok ----
  reset();
  r = await call('tools.toggle', { slug: 'ff-stalk', vvipOnly: true });  check('tools.toggle with empty-body 201 -> 200', r.status === 200);
  r = await call('tools.toggle', { slug: 'made-up-slug', enabled: false }); check('tools.toggle unknown slug -> 404, no junk row', r.status === 404 && !db.tool_status.some(t => t.slug === 'made-up-slug'));
  r = await call('tools.toggle', { slug: 'ff-stalk' });                  check('tools.toggle with no change -> 400', r.status === 400);

  // ---- authentication / roles ----
  reset();
  check('no token -> 401', (await call('users.list', {}, 'nope')).status === 401);
  check('normal user -> 403', (await call('users.list', {}, 'tok-normal')).status === 403);
  check('banned admin -> 403', (await call('users.list', {}, 'tok-banned-admin')).status === 403);

  // ---- owner-only VVIP ----
  reset();
  r = await call('users.setVip', { id: ID.user1, vip: true }, 'tok-admin');   check('admin cannot set VVIP (403)', r.status === 403 && row(ID.user1).is_vip === false);
  r = await call('users.setVip', { id: ID.user1, vip: true }, 'tok-normal');  check('normal user cannot set VVIP (403)', r.status === 403);
  r = await call('users.setVip', { id: ID.user1, vip: true });                check('owner grants VVIP', r.status === 200 && row(ID.user1).is_vip === true);
  check('grant is audit-logged with the target username', db.activity_logs.some(l => l.action === 'grant_vip' && l.target === 'alice'));
  r = await call('users.setVip', { id: ID.user1, vip: false });               check('owner revokes VVIP', r.status === 200 && row(ID.user1).is_vip === false);
  r = await call('users.setVip', { id: ID.admin2, vip: true });               check('VVIP flag on an admin rejected (role already grants it)', r.status === 400 && row(ID.admin2).is_vip === false);
  r = await call('users.setVip', { id: ID.ghost, vip: true });                check('unknown user -> 404', r.status === 404);
  r = await call('users.setVip', { id: 'not-a-uuid', vip: true });            check('bad id -> 400', r.status === 400);
  r = await call('users.setVip', { id: ID.user1, vip: 'yes' });               check('non-boolean vip -> 400', r.status === 400 && row(ID.user1).is_vip === false);
  r = await call('users.setVip', { id: ID.user1 });                           check('missing vip -> 400 (never defaults to a value)', r.status === 400);

  // ---- ban logic flaws ----
  reset(); row(ID.user1).banned = true;
  r = await call('users.ban', { id: ID.user1 });                              check('ban with MISSING boolean no longer silently unbans', r.status === 400 && row(ID.user1).banned === true);
  r = await call('users.ban', { id: ID.user1, banned: 'false' });             check('ban with string "false" rejected', r.status === 400 && row(ID.user1).banned === true);
  r = await call('users.ban', { id: ID.admin2, banned: true }, 'tok-admin');  check('admin cannot ban another admin', r.status === 403 && row(ID.admin2).banned === false);
  r = await call('users.ban', { id: ID.owner, banned: true }, 'tok-admin');   check('admin cannot ban the owner', r.status === 403);
  r = await call('users.ban', { id: ID.user2, banned: true }, 'tok-admin');   check('admin can ban a regular user', r.status === 200 && row(ID.user2).banned === true);
  r = await call('users.ban', { id: ID.admin2, banned: true });               check('owner can ban an admin', r.status === 200 && row(ID.admin2).banned === true);
  r = await call('users.ban', { id: ID.admin1, banned: true }, 'tok-owner');  // owner banning someone else who is admin ok; now owner vs owner:
  db.profiles.push({ id: U(50), username: 'boss2', role: 'owner', is_vip: false, banned: false, created_at: new Date().toISOString() });
  r = await call('users.ban', { id: U(50), banned: true });                   check('nobody bans an owner (demote first)', r.status === 403);
  r = await call('users.ban', { id: ID.ghost, banned: true });                check('ban unknown user -> 404', r.status === 404);
  r = await call('users.ban', { id: ID.owner, banned: true });                check('cannot ban yourself', r.status === 400);

  // ---- role changes ----
  reset();
  r = await call('users.setRole', { id: ID.user1, role: 'admin' }, 'tok-admin'); check('admin cannot change roles', r.status === 403 && row(ID.user1).role === 'user');
  r = await call('users.setRole', { id: ID.ghost, role: 'admin' });              check('setRole unknown user -> 404 (not a fake ok)', r.status === 404 && !db.activity_logs.some(l => l.action === 'set_role'));
  r = await call('users.setRole', { id: ID.user1, role: 'superuser' });          check('setRole bad role -> 400', r.status === 400);
  r = await call('users.setRole', { id: ID.owner, role: 'user' });               check('owner cannot change own role', r.status === 400 && row(ID.owner).role === 'owner');
  r = await call('users.setRole', { id: ID.user1, role: 'admin' });              check('owner promotes user', r.status === 200 && row(ID.user1).role === 'admin');
  check('role change logged with username (not raw uuid)', db.activity_logs.some(l => l.action === 'set_role' && l.target === 'alice'));

  // ---- list / search / pagination (was a silent 300-row cap) ----
  reset();
  r = await call('users.list', {});                          check('list pages at 50 with hasMore', r.status === 200 && r.json.users.length === 50 && r.json.hasMore === true);
  const p2 = await call('users.list', { offset: 50 });      const p3 = await call('users.list', { offset: 100 });
  const all = [...r.json.users, ...p2.json.users, ...p3.json.users];
  check('pagination reaches EVERY user (127), no duplicates', all.length === 127 && new Set(all.map(u => u.id)).size === 127 && p3.json.hasMore === false);
  r = await call('users.list', { q: 'filler11' });           check('search finds a user beyond page one', r.json.users.length > 0 && r.json.users.every(u => u.username.includes('filler11')));
  r = await call('users.list', { q: 'a,b)(' });              check('search rejects filter-injection characters', r.status === 400);
  r = await call('users.list', { q: 'x'.repeat(40) });       check('search rejects overlong query', r.status === 400);

  // ---- existence checks ("ok" for things that don't exist) ----
  reset();
  check('announcements.toggle unknown id -> 404', (await call('announcements.toggle', { id: 424242, active: true })).status === 404);
  check('announcements.delete unknown id -> 404', (await call('announcements.delete', { id: 424242 })).status === 404);
  check('reports.setStatus unknown id -> 404', (await call('reports.setStatus', { id: 424242, status: 'done' })).status === 404);
  check('announcements.toggle needs a boolean', (await call('announcements.toggle', { id: 1 })).status === 400);
  check('announcements.create validates', (await call('announcements.create', { title: '', body: '' })).status === 400);
  check('announcements.create works with empty-body 201', (await call('announcements.create', { title: 'Halo', body: 'Isi' })).status === 200);

  // ---- tools.create field validation ----
  reset();
  const base = { title: 'My Tool', category: 'tools', type: 'generic-downloader', provider: 'tiktok', paramKey: 'url' };
  check('tools.create valid with empty-body 201', (await call('tools.create', base)).status === 200);
  check('tools.create paramKey cannot be a reserved name', (await call('tools.create', { ...base, paramKey: 'slug' })).status === 400);
  check('tools.create overlong title rejected', (await call('tools.create', { ...base, title: 'x'.repeat(41) })).status === 400);

  // ---- admin UI row logic (userRow in admin.js), evaluated for each viewer ----
  const adminSrc = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
  const grab = re => (adminSrc.match(re) || [''])[0];
  const code = [grab(/const esc = [^\n]*\n/), grab(/const fmtDate = [^\n]*\n/), grab(/(?:const roleLabel = [^\n]*\n|function roleLabel[\s\S]*?\n\}\n)/), grab(/function userRow\(u\) \{[\s\S]*?\n\}\n/)].join('\n');
  const render = (viewerRole, u) => new Function('myRole', 'myId', code + '\nreturn userRow(arguments[2]);')(viewerRole, ID.admin1, u);
  const plain = { id: ID.user1, username: 'alice', display_name: 'A', role: 'user', is_vip: false, banned: false, created_at: '2024-01-01T00:00:00Z' };
  check('UI: owner sees a VVIP toggle on a regular user', /data-act="vip"/.test(render('owner', plain)));
  check('UI: admin sees only a badge, no VVIP toggle', !/data-act="vip"/.test(render('admin', plain)));
  check('UI: admin/owner rows show "Otomatis", no toggle', /Otomatis/.test(render('owner', { ...plain, role: 'admin' })) && !/data-act="vip"/.test(render('owner', { ...plain, role: 'admin' })));
  check('UI: admin is not offered Ban on another admin', !/data-act="ban"/.test(render('admin', { ...plain, role: 'admin' })));
  check('UI: owner is offered Ban on an admin', /data-act="ban"/.test(render('owner', { ...plain, role: 'admin' })));
  check('UI: nobody is offered Ban on an owner', !/data-act="ban"/.test(render('owner', { ...plain, role: 'owner' })));
  check('UI: Delete only for owner viewers', !/data-act="delete"/.test(render('admin', plain)) && /data-act="delete"/.test(render('owner', plain)));
  check('UI: usernames are HTML-escaped', !/<img/.test(render('owner', { ...plain, username: '<img src=x onerror=alert(1)>' })));

  console.log(fail ? `FAILED: ${fail} of ${pass + fail} admin checks` : `OK: ${pass} admin API checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
