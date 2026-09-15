// ponytail: same reasoning as bratvid.js — @napi-rs/canvas is a native
// addon, doesn't run on Edge, so this needs the Node runtime too. Unlike
// bratvid it needs no ffmpeg at all (single PNG, no frames to encode), so
// it's a much lighter request — no maxDuration override needed for this
// one in vercel.json, default timeout is plenty.

const { createCanvas } = require('@napi-rs/canvas');
const path = require('path');
const os = require('os');
const { EMOJI_REGEX, ensureFont, measureTextCustom, drawAppleEmoji } = require('./_brat-shared');

const FONT_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/ARIALN.ttf';
// ponytail: /tmp is the only writable path on a serverless instance — the
// original script wrote this next to itself (__dirname).
const FONT_PATH = path.join(os.tmpdir(), 'brat3-arialn.ttf');

const COLOR_OUTER = '#dadada';
const COLOR_MID = '#000000';
const BG_COLOR = '#ffffff';
const MAX_LINE_LEN = 60;

// Trust-boundary validation lives here — this endpoint is public, so every
// field gets re-checked server-side regardless of what the form already
// restricts client-side.

// Cheap request (one canvas render, no ffmpeg), so a looser bucket than
// bratvid.js's. See bratvid.js for why this isn't just _ratelimit.js.
const buckets = new Map();
function allow(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 15;
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) { buckets.set(ip, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

async function drawCenteredLineWithEmojis(ctx, text, centerX, y, fontSize) {
  const totalW = measureTextCustom(ctx, text, fontSize);
  let curX = centerX - totalW / 2;
  const parts = text.split(EMOJI_REGEX);
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) { await drawAppleEmoji(ctx, part, curX, y, fontSize); curX += fontSize; }
    else { ctx.fillText(part, curX, y); curX += ctx.measureText(part).width; }
    EMOJI_REGEX.lastIndex = 0;
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px ArialNarrow`;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function generateBrat3({ topText, midText, bottomText, blur }) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : 0;

  const size = 1000, padding = 40, lineGap = 6, stackGapTop = 4, stackGapBottom = 40;
  const maxWidth = size - padding * 2, maxHeight = size - padding * 2;
  const OUTER_START_SIZE = 200, MID_START_SIZE = 340;

  await ensureFont(FONT_URL, FONT_PATH, 'ArialNarrow');

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const centerX = size / 2;

  function computeLayout(outerSize, midSize) {
    ctx.font = `${outerSize}px ArialNarrow`;
    const topLines = wrapText(ctx, topText, maxWidth, outerSize);
    const bottomLines = wrapText(ctx, bottomText, maxWidth, outerSize);
    const topLongest = Math.max(...topText.split(' ').map(w => measureTextCustom(ctx, w, outerSize)));
    const bottomLongest = Math.max(...bottomText.split(' ').map(w => measureTextCustom(ctx, w, outerSize)));

    ctx.font = `${midSize}px ArialNarrow`;
    const midLines = wrapText(ctx, midText, maxWidth, midSize);
    const midLongest = Math.max(...midText.split(' ').map(w => measureTextCustom(ctx, w, midSize)));

    const topH = topLines.length * (outerSize + lineGap) - lineGap;
    const midH = midLines.length * (midSize + lineGap) - lineGap;
    const bottomH = bottomLines.length * (outerSize + lineGap) - lineGap;
    const totalH = topH + stackGapTop + midH + stackGapBottom + bottomH;

    const fits = topLongest <= maxWidth && bottomLongest <= maxWidth && midLongest <= maxWidth && totalH <= maxHeight;
    return { fits, topLines, midLines, bottomLines, topH, midH, bottomH, totalH };
  }

  let outerSize = OUTER_START_SIZE, midSize = MID_START_SIZE;
  let layout = computeLayout(outerSize, midSize);
  while (!layout.fits && outerSize > 6) {
    outerSize -= 2;
    midSize -= Math.round(2 * (MID_START_SIZE / OUTER_START_SIZE));
    layout = computeLayout(outerSize, midSize);
  }

  const { topLines, midLines, bottomLines, topH, midH, totalH } = layout;

  ctx.save();
  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`;
  let cursorY = (size - totalH) / 2;

  ctx.fillStyle = COLOR_OUTER;
  ctx.font = `${outerSize}px ArialNarrow`;
  {
    let y = cursorY;
    for (const line of topLines) { await drawCenteredLineWithEmojis(ctx, line, centerX, y, outerSize); y += outerSize + lineGap; }
    cursorY += topH + stackGapTop;
  }

  ctx.fillStyle = COLOR_MID;
  ctx.font = `${midSize}px ArialNarrow`;
  {
    let y = cursorY;
    for (const line of midLines) { await drawCenteredLineWithEmojis(ctx, line, centerX, y, midSize); y += midSize + lineGap; }
    cursorY += midH + stackGapBottom;
  }

  ctx.fillStyle = COLOR_OUTER;
  ctx.font = `${outerSize}px ArialNarrow`;
  {
    let y = cursorY;
    for (const line of bottomLines) { await drawCenteredLineWithEmojis(ctx, line, centerX, y, outerSize); y += outerSize + lineGap; }
  }

  ctx.restore();
  return canvas.encode('png');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!allow(ip)) return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan, coba lagi sebentar.' });

  const body = req.body || {};
  const topText = String(body.top || '').trim();
  const midText = String(body.mid || '').trim();
  const bottomText = String(body.bottom || '').trim();
  if (!topText || !midText || !bottomText) return res.status(400).json({ success: false, error: 'Baris atas, tengah, dan bawah wajib diisi.' });
  if (topText.length > MAX_LINE_LEN || midText.length > MAX_LINE_LEN || bottomText.length > MAX_LINE_LEN) {
    return res.status(400).json({ success: false, error: `Tiap baris maksimal ${MAX_LINE_LEN} karakter.` });
  }

  try {
    const buffer = await generateBrat3({ topText, midText, bottomText, blur: 0 });
    res.setHeader('content-type', 'image/png');
    res.status(200).send(buffer);
  } catch (e) {
    console.error('[brat3]', e);
    res.status(500).json({ success: false, error: 'Gagal membuat gambar, coba lagi.' });
  }
};
