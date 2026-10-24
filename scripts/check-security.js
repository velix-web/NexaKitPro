#!/usr/bin/env node
// Security regression tests. Runs the REAL handlers/helpers in api/ against a
// mocked Supabase + upstream (no network needed), so it proves behaviour of
// the actual code, not a copy of it. Run: npm test
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'fake-anon-key';
process.env.IMGBB_API_KEY = 'fake-imgbb';
process.removeAllListeners('warning');

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.join(__dirname, '..');
const load = f => import(pathToFileURL(path.join(root, f)).href);

// ---- mock backend ----
const state = { profiles: {}, tokens: {}, toolStatus: {}, mode: 'ok' };
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === 'fake.supabase.co') {
    if (state.mode === 'throw') throw new Error('network down');
    if (state.mode === 'http500') return { ok: false, status: 500, json: async () => ({}) };
    const token = ((opts.headers || {}).Authorization || '').replace(/^Bearer\s+/i, '');
    if (u.pathname === '/auth/v1/user') {
      const id = state.tokens[token];
      return id ? { ok: true, json: async () => ({ id }) } : { ok: false, status: 401, json: async () => ({}) };
    }
    if (u.pathname === '/rest/v1/profiles') { const id = u.searchParams.get('id').replace('eq.', ''); return { ok: true, json: async () => (state.profiles[id] ? [state.profiles[id]] : []) }; }
    if (u.pathname === '/rest/v1/tool_status') {
      if (state.mode === 'malformed') return { ok: true, json: async () => ({ not: 'array' }) };
      if (state.mode === 'badrow') return { ok: true, json: async () => [{ enabled: 'yes', maintenance: false, vvip_only: false }] };
      const slug = u.searchParams.get('slug').replace('eq.', '');
      return { ok: true, json: async () => (state.toolStatus[slug] ? [state.toolStatus[slug]] : []) };
    }
    if (u.pathname === '/rest/v1/custom_tools') return { ok: true, json: async () => [] };
  }
  return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ success: true, data: { url: 'https://i.ibb.co/x.png' } }), body: null };
};
const reset = () => {
  state.mode = 'ok';
  state.tokens = { 'tok-normal': 'u1', 'tok-vip': 'u2', 'tok-banned': 'u3', 'tok-admin': 'u4' };
  state.profiles = {
    u1: { id: 'u1', role: 'user', is_vip: false, banned: false }, u2: { id: 'u2', role: 'user', is_vip: true, banned: false },
    u3: { id: 'u3', role: 'user', is_vip: false, banned: true }, u4: { id: 'u4', role: 'admin', is_vip: false, banned: false },
  };
  state.toolStatus = {
    'ff-stalk': { enabled: true, maintenance: false, vvip_only: true },
    'komikindo': { enabled: true, maintenance: false, vvip_only: true },
    'img2link': { enabled: true, maintenance: false, vvip_only: true },
    'brat': { enabled: false, maintenance: false, vvip_only: false },
  };
};

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; if (!cond) console.error('FAIL  ' + name); };
const req = (qs, bearer, init = {}) => new Request('https://x.test/api/proxy?' + qs, { headers: bearer ? { authorization: 'Bearer ' + bearer } : {}, ...init });

(async () => {
  const auth = await load('api/_auth.js');
  const { default: proxy } = await load('api/proxy.js');
  const { default: img2link } = await load('api/img2link.js');
  const { default: imgbb } = await load('api/imgbb-upload.js');
  const { default: telegram } = await load('api/telegram-notify.js');
  const { isBlockedTarget } = await load('api/_ssrf-guard.js');
  const { verifyImageMagicBytes } = await load('api/_file-validate.js');
  const fakeReq = b => ({ headers: { get: k => (k.toLowerCase() === 'authorization' && b ? 'Bearer ' + b : null) } });

  // ---- authentication ----
  reset();
  let r = await auth.authenticate(fakeReq(null));            check('no token -> 401', r instanceof Response && r.status === 401);
  r = await auth.authenticate(fakeReq('garbage'));           check('invalid/expired token -> 401', r instanceof Response && r.status === 401);
  r = await auth.authenticate(fakeReq('tok-banned'));        check('banned user with valid token -> 403', r instanceof Response && r.status === 403);
  r = await auth.authenticate(fakeReq('tok-normal'));        check('normal user not VVIP-entitled', !(r instanceof Response) && !auth.isVvipEntitled(r));
  r = await auth.authenticate(fakeReq('tok-vip'));           check('vip entitled', auth.isVvipEntitled(r));
  r = await auth.authenticate(fakeReq('tok-admin'));         check('admin entitled', auth.isVvipEntitled(r));

  // ---- an auth-backend OUTAGE is a 503, never a 401 (401 makes the browser log the user out) ----
  const nodeAuth = require(path.join(root, 'api/_auth-node.js'));
  for (const mode of ['throw', 'http500']) {
    reset(); state.mode = mode;
    r = await auth.authenticate(fakeReq('tok-normal'));
    check(`Edge auth: Supabase ${mode} -> 503, not 401`, r instanceof Response && r.status === 503);
    const nr = await nodeAuth.authenticate({ headers: { authorization: 'Bearer tok-normal' } });
    check(`Node auth: Supabase ${mode} -> 503, not 401`, nr.status === 503);
  }
  reset();
  check('Node auth: invalid token still 401', (await nodeAuth.authenticate({ headers: { authorization: 'Bearer nope' } })).status === 401);
  check('Node auth: banned -> 403', (await nodeAuth.authenticate({ headers: { authorization: 'Bearer tok-banned' } })).status === 403);
  check('Node auth: valid user ok', (await nodeAuth.authenticate({ headers: { authorization: 'Bearer tok-normal' } })).status === 200);

  // ---- fail-closed tool status ----
  reset(); state.toolStatus = {};
  let s = await auth.getToolStatus('never-toggled');         check('no row -> ok with schema defaults', s.ok && s.enabled && !s.vvip_only && !s.maintenance);
  for (const mode of ['throw', 'http500', 'malformed', 'badrow']) {
    reset(); state.mode = mode;
    // mode only affects tool_status below; auth calls would also fail in throw/http500, so test status helper directly
    const st = await auth.getToolStatus('ff-stalk');
    check(`lookup failure (${mode}) -> ok:false`, st.ok === false);
    const blocked = await auth.enforceToolAccess({ id: 'u2', role: 'admin', is_vip: true }, 'tiktok');
    check(`lookup failure (${mode}) denies even admin/VIP (503)`, blocked instanceof Response && blocked.status === 503);
  }
  reset();
  check('real row blocks non-VIP', (await auth.enforceToolAccess({ role: 'user', is_vip: false }, 'ff-stalk')).status === 403);
  check('real row allows VIP', (await auth.enforceToolAccess({ role: 'user', is_vip: true }, 'ff-stalk')) === null);
  check('disabled tool blocks everyone incl. VIP', (await auth.enforceToolAccess({ role: 'admin', is_vip: true }, 'brat')).status === 403);

  // ---- proxy: direct-API behaviour == browser rules ----
  reset();
  check('proxy: no auth -> 401', (await proxy(req('provider=tiktok&slug=tiktok'))).status === 401);
  check('proxy: invalid token -> 401', (await proxy(req('provider=tiktok&slug=tiktok', 'nope'))).status === 401);
  check('proxy: banned -> 403', (await proxy(req('provider=tiktok&slug=tiktok', 'tok-banned'))).status === 403);
  check('proxy: normal user, public tool -> 200', (await proxy(req('provider=tiktok&slug=tiktok&url=https://t.co/x', 'tok-normal'))).status === 200);
  check('proxy: normal user, VVIP tool -> 403', (await proxy(req('provider=ffstalk&slug=ff-stalk&uid=1', 'tok-normal'))).status === 403);
  check('proxy: VIP user, VVIP tool -> 200', (await proxy(req('provider=ffstalk&slug=ff-stalk&uid=1', 'tok-vip'))).status === 200);
  check('proxy: VVIP provider under free slug rejected', (await proxy(req('provider=ffstalk&slug=tiktok&uid=1', 'tok-normal'))).status === 400);
  check('proxy: free provider under VVIP slug rejected', (await proxy(req('provider=tiktok&slug=ff-stalk', 'tok-normal'))).status === 400);
  check('proxy: missing slug -> 400', (await proxy(req('provider=tiktok&url=x', 'tok-normal'))).status === 400);
  check('proxy: unknown provider -> 400', (await proxy(req('provider=nope&slug=tiktok', 'tok-normal'))).status === 400);
  check('proxy: javascript: url param -> 400', (await proxy(req('provider=tiktok&slug=tiktok&url=javascript:alert(1)', 'tok-normal'))).status === 400);
  check('proxy: POST -> 405', (await proxy(req('provider=tiktok&slug=tiktok', 'tok-normal', { method: 'POST' }))).status === 405);
  check('proxy: new VVIP tool (komikindo) blocked for normal user', (await proxy(req('provider=komikindosearch&slug=komikindo&q=x', 'tok-normal'))).status === 403);

  // ---- img2link: dedicated endpoint, hardcoded slug ----
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
  const upload = (bytes, type, bearer, ep) => {
    const f = new FormData(); f.append('image', new File([new Uint8Array(bytes)], 'x', { type })); f.append('slug', 'img2link');
    return new Request('https://x.test/api/' + ep, { method: 'POST', headers: bearer ? { authorization: 'Bearer ' + bearer } : {}, body: f });
  };
  reset();
  check('img2link: no auth -> 401', (await img2link(upload(png, 'image/png', null, 'img2link'))).status === 401);
  check('img2link VVIP-locked: normal user -> 403', (await img2link(upload(png, 'image/png', 'tok-normal', 'img2link'))).status === 403);
  check('img2link VVIP-locked: VIP user -> 200', (await img2link(upload(png, 'image/png', 'tok-vip', 'img2link'))).status === 200);
  check('img2link: fake PNG (php bytes) rejected', (await img2link(upload([0x3c, 0x3f, 0x70, 0x68, 0x70], 'image/png', 'tok-vip', 'img2link'))).status === 400);
  check('imgbb-upload: needs auth', (await imgbb(upload(png, 'image/png', null, 'imgbb-upload'))).status === 401);
  check('imgbb-upload: ignores client slug (plain authed upload ok)', (await imgbb(upload(png, 'image/png', 'tok-normal', 'imgbb-upload'))).status === 200);
  check('imgbb-upload: banned -> 403', (await imgbb(upload(png, 'image/png', 'tok-banned', 'imgbb-upload'))).status === 403);

  // ---- telegram origin gate ----
  const tg = (origin) => new Request('https://x.test/api/telegram-notify', { method: 'POST', headers: { host: 'nexakitpro.my.id', ...(origin ? { origin } : {}) }, body: '{}' });
  check('telegram: missing Origin rejected', (await telegram(tg(null))).status === 403);
  check('telegram: foreign Origin rejected', (await telegram(tg('https://evil.com'))).status === 403);

  // ---- SSRF guard ----
  const ssrf = [['https://example.com/', false], ['http://localhost/', true], ['http://localhost.attacker.com/', false], ['http://foo.localhost/', true],
    ['http://127.0.0.1/', true], ['http://127.1/', true], ['http://0177.0.0.1/', true], ['http://0x7f.0.0.1/', true], ['http://2130706433/', true],
    ['http://169.254.169.254/latest/', true], ['http://10.0.0.5/', true], ['http://172.16.5.5/', true], ['http://172.32.5.5/', false],
    ['http://192.168.1.1/', true], ['http://[::1]/', true], ['http://[fe80::1]/', true], ['http://[fc00::1]/', true], ['http://[::ffff:127.0.0.1]/', true],
    ['http://8.8.8.8/', false], ['ftp://example.com/', true], ['javascript:alert(1)', true], ['not a url', true], ['http://metadata.google.internal/', true]];
  for (const [u, exp] of ssrf) check(`ssrf ${u} -> ${exp}`, isBlockedTarget(u) === exp);

  // ---- magic bytes ----
  const file = (b, t) => new File([new Uint8Array(b)], 'x', { type: t });
  check('magic: real png ok', await verifyImageMagicBytes(file(png, 'image/png'), 'image/png'));
  check('magic: php labelled png rejected', !(await verifyImageMagicBytes(file([0x3c, 0x3f, 0x70], 'image/png'), 'image/png')));
  check('magic: png labelled jpeg rejected', !(await verifyImageMagicBytes(file(png, 'image/jpeg'), 'image/jpeg')));
  check('magic: unlisted type rejected', !(await verifyImageMagicBytes(file(png, 'application/x-php'), 'application/x-php')));

  // ---- client URL safety (isSafeDownloadUrl lives in app.js; test its real source) ----
  const m = fs.readFileSync(path.join(root, 'app.js'), 'utf8').match(/function isSafeDownloadUrl\(u\)\{[\s\S]*?\n\}/);
  const isSafe = new Function(m[0] + '\nreturn isSafeDownloadUrl;')();
  for (const [u, exp] of [['/api/proxy?x=1', true], ['https://cdn.x.com/a.mp4', true], ['javascript:alert(1)', false], ['data:text/html,<script>', false], ['//evil.com/x', false], ['', false], [null, false], ['   ', false], ['  https://ok.com/x ', true]])
    check(`downloadUrl ${JSON.stringify(u)} -> ${exp}`, isSafe(u) === exp);

  console.log(fail ? `FAILED: ${fail} of ${pass + fail} security checks` : `OK: ${pass} security checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
