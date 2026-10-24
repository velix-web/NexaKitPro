#!/usr/bin/env node
// Cross-checks every place a tool's identity has to agree:
//   - app.js TOOLS array (frontend card + the provider/slug it calls)
//   - api/proxy.js PROVIDERS (upstream URL) and BUILT_IN_SLUG_PROVIDERS
//     (which slug may call which provider — proxy.js's authorization source)
//   - api/admin.js TOOL_CATALOG (what the admin panel can toggle) and
//     ALLOWED_PROVIDERS (what an admin-created custom tool may reuse)
//   - admin.html's custom-tool provider dropdown
//
// These can't share one literal object (different runtimes/files, no shared
// build step), so instead of hoping they stay in sync by hand this makes a
// mismatch a loud, specific failure. Run: npm test  (or node scripts/check-tools.js)
const STANDALONE_TYPES = new Set(['tiktok', 'youtube']); // call proxy with hardcoded providers in app.js

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

function extract(src, name, open, close) {
  const m = src.match(new RegExp(`const ${name} = (\\${open}[\\s\\S]*?\\n\\${close};)`));
  if (!m) throw new Error(`Could not find ${name}`);
  // eslint-disable-next-line no-eval
  return eval('(' + m[1].slice(0, -1) + ')');
}

const appSrc = read('app.js'), proxySrc = read('api/proxy.js'), adminSrc = read('api/admin.js');
const PROVIDERS = extract(proxySrc, 'PROVIDERS', '{', '}');
const BUILT_IN_SLUG_PROVIDERS = extract(proxySrc, 'BUILT_IN_SLUG_PROVIDERS', '{', '}');
const TOOL_CATALOG = extract(adminSrc, 'TOOL_CATALOG', '[', ']');
const ALLOWED_PROVIDERS = extract(adminSrc, 'ALLOWED_PROVIDERS', '[', ']');
const catalogSlugs = new Set(TOOL_CATALOG.map(([s]) => s));

const cut = appSrc.indexOf('];', appSrc.indexOf('const TOOLS=')) + 2;
const TOOLS = new Function('window', appSrc.slice(0, cut) + '\nreturn TOOLS;')({});

const errors = [];
const seen = new Set();
for (const t of TOOLS) {
  if (seen.has(t.slug)) errors.push(`Duplicate slug in app.js TOOLS: "${t.slug}"`);
  seen.add(t.slug);
  if (!catalogSlugs.has(t.slug)) errors.push(`"${t.slug}" is in app.js TOOLS but missing from admin.js TOOL_CATALOG (admin can't toggle it)`);
  if (STANDALONE_TYPES.has(t.type) || !t.provider) continue;
  const allowed = BUILT_IN_SLUG_PROVIDERS[t.slug];
  if (!allowed) { errors.push(`"${t.slug}" has provider "${t.provider}" but no BUILT_IN_SLUG_PROVIDERS entry — proxy.js would reject every call`); continue; }
  if (!allowed.includes(t.provider)) errors.push(`"${t.slug}" uses provider "${t.provider}" but BUILT_IN_SLUG_PROVIDERS only allows [${allowed.join(', ')}]`);
  if (!(t.provider in PROVIDERS)) errors.push(`Provider "${t.provider}" (slug "${t.slug}") has no upstream URL in proxy.js PROVIDERS`);
}
for (const [slug, provs] of Object.entries(BUILT_IN_SLUG_PROVIDERS)) {
  if (!seen.has(slug)) errors.push(`BUILT_IN_SLUG_PROVIDERS has "${slug}" but no tool in app.js uses it (dead config)`);
  for (const p of provs) if (!(p in PROVIDERS)) errors.push(`BUILT_IN_SLUG_PROVIDERS["${slug}"] lists "${p}" which has no upstream URL`);
}
for (const [slug] of TOOL_CATALOG) if (!seen.has(slug)) errors.push(`admin TOOL_CATALOG has "${slug}" but app.js has no such tool`);

// custom-tool provider allowlist: server list == admin dropdown, both ⊆ PROVIDERS
const dropdown = [...read('admin.html').match(/<select id="tool-provider">([\s\S]*?)<\/select>/)[1].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
for (const p of ALLOWED_PROVIDERS) {
  if (!(p in PROVIDERS)) errors.push(`ALLOWED_PROVIDERS has "${p}" but PROVIDERS does not`);
  if (!dropdown.includes(p)) errors.push(`ALLOWED_PROVIDERS has "${p}" but the admin.html provider dropdown does not offer it`);
}
for (const p of dropdown) if (!ALLOWED_PROVIDERS.includes(p)) errors.push(`admin.html dropdown offers "${p}" but the server would reject it`);

// CSP guard: vercel.json has no style-src 'unsafe-inline', so style="" attributes are silently dropped.
for (const f of ['index.html', 'admin.html', 'app.js', 'auth.js', 'admin.js', 'ui.js']) {
  read(f).split('\n').forEach((l, i) => {
    if (/\sstyle=\\?"/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/ATTRIBUTE/.test(l)) errors.push(`${f}:${i + 1} uses an inline style="" attribute — blocked by CSP, use a class`);
  });
}

if (errors.length) {
  console.error(`FAILED — ${errors.length} inconsistency(ies):\n`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log(`OK: ${TOOLS.length} tools, ${Object.keys(PROVIDERS).length} providers, ${Object.keys(BUILT_IN_SLUG_PROVIDERS).length} slug-provider mappings — all consistent`);
