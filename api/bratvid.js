// ponytail: this is a real Node + ffmpeg workload (fs, child_process, a
// native canvas addon) — none of that runs on Vercel's Edge runtime, which
// is why every other file in /api can be edge-only and this one can't.
// No `export const config = { runtime: 'edge' }` here on purpose: leaving
// it unset makes Vercel treat this as a Node serverless function.

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const ffmpegPath = require('ffmpeg-static');

const FONT_URL = 'https://cdn.jsdelivr.net/gh/Napoleon-Fibonacci/assets@main/font/impact.ttf';
const EMOJI_JSON_URL = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json';
// ponytail: serverless functions only get a writable /tmp — the original
// script wrote these next to itself (__dirname), which is read-only here.
const FONT_PATH = path.join(os.tmpdir(), 'brat-impact.ttf');
const EMOJI_JSON_PATH = path.join(os.tmpdir(), 'brat-emoji-apple.json');

const THEMES = {
  black: { bg: '#000000', text: '#ffffff' },
  white: { bg: '#ffffff', text: '#000000' },
  green: { bg: '#8ace00', text: '#000000' }
};

const MAX_TEXT_LEN = 80;

// Trust-boundary validation lives here, not just in the form on the client
// — this endpoint is public, so every field must be re-checked server-side
// no matter what the UI already restricts.

// In-memory per-instance rate limit. Heavier cost than the other /api
// endpoints (canvas render + ffmpeg encode per request), so a tighter
// bucket than _ratelimit.js's default. Kept local to this file rather than
// extending _ratelimit.js: that helper reads req.headers.get(...) (Fetch
// API, Edge-only) and this function gets a plain Node req object, so the
// two aren't drop-in compatible — duplicating three lines beats forking a
// shared helper into two runtimes for one caller.
const buckets = new Map();
function allow(ip) {
  const now = Date.now();
  const windowMs = 5 * 60_000;
  const limit = 3;
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) { buckets.set(ip, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

let fontReady = false;
async function ensureFont() {
  if (fontReady) return;
  if (!existsSync(FONT_PATH)) {
    const res = await fetch(FONT_URL);
    writeFileSync(FONT_PATH, Buffer.from(await res.arrayBuffer()));
  }
  GlobalFonts.registerFromPath(FONT_PATH, 'Impact');
  fontReady = true;
}

let emojiMap = null;
const emojiImageCache = new Map();

function emojiToUnicode(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4, '0')).join('-');
}

async function loadEmojiMap() {
  if (emojiMap) return emojiMap;
  if (!existsSync(EMOJI_JSON_PATH)) {
    const res = await fetch(EMOJI_JSON_URL);
    writeFileSync(EMOJI_JSON_PATH, Buffer.from(await res.arrayBuffer()));
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

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let curX = x;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) { await drawAppleEmoji(ctx, part, curX, y, fontSize); curX += fontSize; }
    else { ctx.fillText(part, curX, y); curX += ctx.measureText(part).width; }
    EMOJI_REGEX.lastIndex = 0;
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px Impact`;
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

function fitsAt(ctx, text, fontSize, maxWidth, maxHeight, lineGap) {
  const lines = wrapText(ctx, text, maxWidth, fontSize);
  const longestWord = Math.max(...text.split(' ').map(w => measureTextCustom(ctx, w, fontSize)));
  const totalHeight = lines.length * (fontSize + lineGap) - lineGap;
  return longestWord <= maxWidth && totalHeight <= maxHeight;
}

function findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap) {
  let lo = 10, hi = 700, best = lo;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fitsAt(ctx, text, mid, maxWidth, maxHeight, lineGap)) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

function easeOutBack(x) {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function calculateWordLayout(ctx, fullText, maxWidth, maxHeight, lineGap, margin, padding, boxSize) {
  const fontSize = findBestFontSize(ctx, fullText, maxWidth, maxHeight, lineGap);
  ctx.font = `${fontSize}px Impact`;
  const defaultSpaceWidth = ctx.measureText(' ').width;
  const fullLines = wrapText(ctx, fullText, maxWidth, fontSize);
  const totalTextHeight = fullLines.length * (fontSize + lineGap) - lineGap;
  const startY = margin + (boxSize - totalTextHeight) / 2;
  const wordLayouts = [];
  let currentY = startY;
  for (let l = 0; l < fullLines.length; l++) {
    const line = fullLines[l];
    const lineWords = line.split(' ').filter(Boolean);
    const isLastLine = (l === fullLines.length - 1);
    const totalWordsW = lineWords.reduce((acc, w) => acc + measureTextCustom(ctx, w, fontSize), 0);
    let spaceBetween = defaultSpaceWidth;
    if (!isLastLine && lineWords.length > 1) spaceBetween = (maxWidth - totalWordsW) / (lineWords.length - 1);
    let currentX = margin + padding;
    for (const word of lineWords) {
      const wordW = measureTextCustom(ctx, word, fontSize);
      wordLayouts.push({ text: word, x: currentX, y: currentY, w: wordW, h: fontSize });
      currentX += wordW + spaceBetween;
    }
    currentY += fontSize + lineGap;
  }
  return { fontSize, wordLayouts };
}

async function renderCanvas({ wordLayouts, fontSize, wordStates, theme, blurAmount, highlightProgress = 0, format = 'mp4', margin = 70 }) {
  const selectedTheme = THEMES[theme] || THEMES.white;
  const size = 1000, boxSize = size - margin * 2, x = margin, y = margin, w = boxSize, h = boxSize;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (format !== 'gif') { ctx.fillStyle = selectedTheme.bg; ctx.fillRect(0, 0, size, size); }
  else { ctx.clearRect(0, 0, size, size); ctx.fillStyle = selectedTheme.bg; ctx.fillRect(x, y, w, h); }

  if (!wordLayouts || wordLayouts.length === 0) return canvas;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = selectedTheme.text;
  ctx.font = `${fontSize}px Impact`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`;

  for (let idx = 0; idx < wordLayouts.length; idx++) {
    const item = wordLayouts[idx];
    const state = wordStates[idx] || { scale: 0, alpha: 0, visible: false };
    if (!state.visible) continue;
    const centerX = item.x + item.w / 2, centerY = item.y + fontSize / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, state.alpha));
    if (state.scale !== 1.0) { ctx.translate(centerX, centerY); ctx.scale(state.scale, state.scale); ctx.translate(-centerX, -centerY); }
    await drawTextWithEmojis(ctx, item.text, item.x, item.y, fontSize);
    ctx.restore();
  }

  if (highlightProgress > 0 && highlightProgress <= 1) {
    const totalDist = boxSize * 2.8;
    const curr = margin - boxSize * 1.0 + highlightProgress * totalDist;
    const sweepW = boxSize * 0.95;
    const grad = ctx.createLinearGradient(curr, curr, curr + sweepW, curr + sweepW);
    grad.addColorStop(0.00, 'rgba(255,255,255,0)');
    grad.addColorStop(0.10, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.38, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    grad.addColorStop(0.52, 'rgba(255,255,255,0.05)');
    grad.addColorStop(0.60, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.88, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(margin, margin, boxSize, boxSize);
  }

  ctx.restore();
  return canvas;
}

async function generateBratVideo({ text, theme, blur, format, holdDuration, fastProgress }) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : 0;
  await ensureFont();
  await loadEmojiMap();

  // ponytail: everything for this request lives under one tmpDir so a
  // single rmSync cleans it all up, including the final output file — the
  // original script wrote the output to process.cwd() (not writable here)
  // and never cleaned it up (fine for a local CLI run, not fine on a
  // serverless instance that gets reused across requests).
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brat-'));
  try {
    const FPS = 60, frameStepTime = 1 / FPS, tasks = [];
    const size = 1000, margin = 70, padding = 40, boxSize = size - margin * 2, lineGap = 15;
    const maxWidth = boxSize - padding * 2, maxHeight = boxSize - padding * 2;

    const dummyCanvas = createCanvas(size, size);
    const dummyCtx = dummyCanvas.getContext('2d');
    const { fontSize, wordLayouts } = calculateWordLayout(dummyCtx, text, maxWidth, maxHeight, lineGap, margin, padding, boxSize);
    const totalWords = wordLayouts.length;

    tasks.push({ wordStates: wordLayouts.map(() => ({ scale: 0, alpha: 0, visible: false })), highlightProgress: 0, duration: 0.15 });

    const staggerFrames = 5, bounceFramesCount = 28;
    const totalBounceFrames = (totalWords - 1) * staggerFrames + bounceFramesCount;
    for (let f = 0; f < totalBounceFrames; f++) {
      const wordStates = wordLayouts.map((_, i) => {
        const currentFrame = f - i * staggerFrames;
        if (currentFrame < 0) return { scale: 0, alpha: 0, visible: false };
        if (currentFrame >= bounceFramesCount) return { scale: 1.0, alpha: 1.0, visible: true };
        const prog = currentFrame / (bounceFramesCount - 1);
        return { scale: 0.2 + 0.8 * easeOutBack(prog), alpha: Math.min(1.0, prog * 1.8), visible: true };
      });
      tasks.push({ wordStates, highlightProgress: (f + 1) / totalBounceFrames, duration: frameStepTime });
    }

    const secondHighlightFrames = 38;
    const allVisibleStates = wordLayouts.map(() => ({ scale: 1.0, alpha: 1.0, visible: true }));
    for (let hf = 0; hf < secondHighlightFrames; hf++) {
      tasks.push({ wordStates: allVisibleStates, highlightProgress: (hf + 1) / secondHighlightFrames, duration: frameStepTime });
    }
    tasks.push({ wordStates: allVisibleStates, highlightProgress: 0, duration: holdDuration });

    const renderFrame = async (task, index) => {
      const canvas = await renderCanvas({ wordLayouts, fontSize, wordStates: task.wordStates, theme, blurAmount, highlightProgress: task.highlightProgress, format, margin });
      const buffer = await canvas.encode('png');
      const framePath = path.join(tmpDir, `frame-${String(index + 1).padStart(5, '0')}.png`);
      writeFileSync(framePath, buffer);
      return { path: framePath, duration: task.duration };
    };

    const framePaths = [];
    if (fastProgress) {
      framePaths.push(...await Promise.all(tasks.map((task, i) => renderFrame(task, i))));
    } else {
      for (let i = 0; i < tasks.length; i++) framePaths.push(await renderFrame(tasks[i], i));
    }

    const manifestLines = [];
    for (const f of framePaths) {
      manifestLines.push(`file '${f.path.replace(/'/g, "'\\''")}'`);
      manifestLines.push(`duration ${f.duration}`);
    }
    manifestLines.push(`file '${framePaths[framePaths.length - 1].path.replace(/'/g, "'\\''")}'`);
    const concatPath = path.join(tmpDir, 'concat.txt');
    writeFileSync(concatPath, manifestLines.join('\n'));

    const ext = format === 'gif' ? 'gif' : 'mp4';
    const outPath = path.join(tmpDir, `out.${ext}`);

    if (format === 'gif') {
      await execFileAsync(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-vf', 'fps=60,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer',
        '-loop', '0', outPath
      ]);
    } else {
      await execFileAsync(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-vf', 'fps=60,scale=1000:1000', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath
      ]);
    }

    return readFileSync(outPath);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!allow(ip)) return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan, coba lagi beberapa menit lagi.' });

  const body = req.body || {};
  const text = String(body.text || '').trim();
  if (!text) return res.status(400).json({ success: false, error: 'Teks tidak boleh kosong.' });
  if (text.length > MAX_TEXT_LEN) return res.status(400).json({ success: false, error: `Teks maksimal ${MAX_TEXT_LEN} karakter.` });

  const theme = ['black', 'white', 'green'].includes(body.theme) ? body.theme : 'white';
  const format = body.format === 'gif' ? 'gif' : 'mp4';

  try {
    const buffer = await generateBratVideo({ text, theme, blur: 0, format, holdDuration: 1.5, fastProgress: true });
    res.setHeader('content-type', format === 'gif' ? 'image/gif' : 'video/mp4');
    res.status(200).send(buffer);
  } catch (e) {
    console.error('[bratvid]', e);
    res.status(500).json({ success: false, error: 'Gagal membuat video, coba lagi.' });
  }
};
