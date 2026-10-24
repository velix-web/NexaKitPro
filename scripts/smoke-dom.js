#!/usr/bin/env node
// DOM smoke test (needs `npm i` for jsdom). Loads the real index.html + ui.js +
// app.js into a DOM, renders EVERY tool, then submits its form with (a) empty
// input and (b) plausible input against a failing API. It fails on any thrown
// error, any tool that renders nothing, and any tool that leaves the UI stuck
// (spinner forever / submit button disabled forever) — i.e. the
// LOADING → ERROR → RETRY contract.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const problems = [];
const dom = new JSDOM(read('index.html'), { url: 'https://nexakitpro.my.id/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.addEventListener('error', e => problems.push('window error: ' + e.message));
window.addEventListener('unhandledrejection', e => problems.push('unhandled rejection: ' + (e.reason && e.reason.message)));

// ---- stubs for browser/service APIs jsdom lacks, and for auth.js (a module needing the Supabase CDN) ----
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
let apiMode = 'fail';
window.nextgen1AuthedFetch = async url => {
  if (apiMode === 'hang') return new Promise(() => {});
  return { ok: false, status: 500, text: async () => JSON.stringify({ success: false, error: 'Upstream gagal (stub)' }), json: async () => ({}), blob: async () => new window.Blob([]) };
};
window.fetch = async () => ({ ok: false, status: 500, text: async () => '{}', json: async () => ({}), blob: async () => new window.Blob([]) });
window.URL.createObjectURL = () => 'blob:stub'; window.URL.revokeObjectURL = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;

try {
  window.eval(read('ui.js'));
  window.eval(read('app.js') + '\n;window.__TOOLS = TOOLS;');
} catch (e) { console.error('FAILED to load scripts:', e); process.exit(1); }

const TOOLS = window.__TOOLS;
const render = window.NEXTGEN1_render;
const doc = window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (typeof render !== 'function' || !Array.isArray(TOOLS)) { console.error('app.js did not expose TOOLS/NEXTGEN1_render'); process.exit(1); }

(async () => {
  let rendered = 0, submitted = 0;
  for (const tool of TOOLS) {
    const tag = `[${tool.slug}]`;
    try {
      doc.getElementById('tool-area').innerHTML = '';
      doc.getElementById('result-container') && (doc.getElementById('result-container').hidden = true);
      render(tool);
    } catch (e) { problems.push(`${tag} render threw: ${e.message}`); continue; }

    const area = doc.getElementById('tool-area');
    if (!area.children.length) { problems.push(`${tag} rendered nothing`); continue; }
    rendered++;

    const form = area.querySelector('form');
    const interactive = form || area.querySelector('input,button');
    if (!interactive) { problems.push(`${tag} has no form or control`); continue; }
    if (!form) continue; // search-style UIs (nexadrama/komikindo) are covered by render success

    // (a) empty submit, (b) filled submit against a failing API
    for (const phase of ['empty', 'filled']) {
      if (phase === 'filled') {
        form.querySelectorAll('input').forEach(i => {
          if (i.type === 'file' || i.type === 'radio' || i.type === 'checkbox' || i.type === 'hidden') return;
          i.value = i.inputMode === 'numeric' ? '50000' : (i.type === 'url' || /url|link/i.test(i.id + i.placeholder)) ? 'https://example.com/a' : 'testuser';
        });
      }
      // Image tools hook the button's onclick; everything else uses the form's submit event.
      try { const imgBtn = form.querySelector('#tool-submit'); if (imgBtn) imgBtn.click(); else form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }
      catch (e) { problems.push(`${tag} (${phase}) submit threw: ${e.message}`); continue; }
      submitted++;
      await sleep(60);
      const stuck = doc.querySelector('#result-content .skeleton-result');
      const submitBtn = form.querySelector('button[type=submit],#tool-submit');
      if (stuck) problems.push(`${tag} (${phase}) skeleton still showing after the request finished — infinite spinner`);
      if (submitBtn && submitBtn.disabled) problems.push(`${tag} (${phase}) submit button left disabled`);
      const out = doc.getElementById('result-content');
      if (out && !out.textContent.trim() && !out.children.length) problems.push(`${tag} (${phase}) blank result — silent failure`);
    }
  }

  // modal helper: Escape closes, focus returns to opener
  const opener = doc.getElementById('brand-home') || doc.querySelector('button');
  opener.focus();
  const panel = doc.getElementById('settings-modal'), overlay = doc.getElementById('settings-overlay');
  const close = window.NG1UI.openModal(panel, overlay, {});
  if (panel.hidden) problems.push('modal did not open');
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (!panel.hidden) problems.push('Escape did not close the modal');
  if (doc.activeElement !== opener) problems.push('focus not restored to opener after modal close');
  if (doc.body.classList.contains('modal-open')) problems.push('body scroll lock not released');
  void close;

  if (problems.length) {
    console.error(`FAILED — ${problems.length} problem(s):`);
    [...new Set(problems)].forEach(p => console.error(' - ' + p));
    process.exit(1);
  }
  console.log(`OK: rendered ${rendered}/${TOOLS.length} tools, ${submitted} submit paths exercised, modal focus/Escape verified`);
  process.exit(0);
})();
