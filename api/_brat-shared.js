// ponytail: bratvid.js and brat3.js both render Apple-style emoji onto
// @napi-rs/canvas using the same sprite-map JSON and the same font-caching
// trick (download once into /tmp, register with GlobalFonts). That's the
// literal duplicate part — pulled out here so a fix to emoji lookup only
// has to happen once. Layout/wrapping logic stays in each file: bratvid
// draws left-aligned word-by-word, brat3 draws centered stacked lines —
// different enough not to be worth forcing into one shared function.

const { loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { writeFileSync, existsSync, readFileSync } = require('fs');
const path = require('path');
const os = require('os');

const EMOJI_JSON_URL = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json';
// ponytail: serverless functions only get a writable /tmp — the original
// scripts wrote these next to themselves (__dirname), which is read-only here.
const EMOJI_JSON_PATH = path.join(os.tmpdir(), 'brat-emoji-apple.json');

// Hardening for these two cold-start fetches: a timeout (don't hang a
// request forever if the host stalls), a response-size ceiling (don't let
// a compromised/misbehaving host hand us something enormous and exhaust
// memory), and a basic content-shape check after download. This is NOT
// cryptographic integrity (we don't have a known-good hash of these
// third-party-hosted files to pin against — see the security report), but
// it does mean a corrupted or unexpected response fails closed instead of
// being written to /tmp and trusted.
const MAX_FONT_BYTES = 5 * 1024 * 1024;        // real TTF/OTF web fonts run well under this
const MAX_EMOJI_JSON_BYTES = 30 * 1024 * 1024; // sprite map with hundreds of base64 PNGs
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithLimit(url, maxBytes) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) throw new Error(`Response too large: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error(`Response too large: ${url}`);
  return buf;
}

function looksLikeFont(buf) {
  if (buf.length < 4) return false;
  const tag = buf.toString('ascii', 0, 4);
  return buf.readUInt32BE(0) === 0x00010000 || tag === 'true' || tag === 'ttcf' || tag === 'OTTO';
}

const fontsRegistered = new Set();
async function ensureFont(url, destPath, family) {
  if (fontsRegistered.has(family)) return;
  if (!existsSync(destPath)) {
    const buf = await fetchWithLimit(url, MAX_FONT_BYTES);
    if (!looksLikeFont(buf)) throw new Error(`Downloaded font failed validation: ${url}`);
    writeFileSync(destPath, buf);
  }
  GlobalFonts.registerFromPath(destPath, family);
  fontsRegistered.add(family);
}

let emojiMap = null;
const emojiImageCache = new Map();

function emojiToUnicode(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4, '0')).join('-');
}

async function loadEmojiMap() {
  if (emojiMap) return emojiMap;
  if (!existsSync(EMOJI_JSON_PATH)) {
    const buf = await fetchWithLimit(EMOJI_JSON_URL, MAX_EMOJI_JSON_BYTES);
    let parsed;
    try { parsed = JSON.parse(buf.toString('utf-8')); } catch { throw new Error('Emoji map failed validation (invalid JSON)'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Emoji map failed validation (unexpected shape)');
    }
    writeFileSync(EMOJI_JSON_PATH, buf);
  }
  emojiMap = JSON.parse(readFileSync(EMOJI_JSON_PATH, 'utf-8'));
  return emojiMap;
}

async function getEmojiImage(emoji) {
  if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji);
  const map = await loadEmojiMap();
  const base = emojiToUnicode(emoji);
  const variants = [
    base,
    base.replace(/-fe0f/gi, ''),
    `${base.replace(/-fe0f/gi, '')}-fe0f`,
    base.toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase() + '-FE0F'
  ];
  let b64 = null;
  for (const v of variants) { if (map[v]) { b64 = map[v]; break; } }
  if (!b64) return null;
  const img = await loadImage(Buffer.from(b64, 'base64'));
  emojiImageCache.set(emoji, img);
  return img;
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
  const img = await getEmojiImage(emoji);
  if (!img) { ctx.fillText(emoji, x, y); return; }
  ctx.drawImage(img, x, y, size, size);
}

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let w = 0;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) w += fontSize; else w += ctx.measureText(part).width;
    EMOJI_REGEX.lastIndex = 0;
  }
  return w;
}

module.exports = { EMOJI_REGEX, ensureFont, measureTextCustom, drawAppleEmoji };
