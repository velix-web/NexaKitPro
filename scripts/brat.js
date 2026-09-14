/**
 * brat.js — Reference/lib generator gaya "brat", gabungan 2 varian:
 *
 *   - generateBratVideo ("bratvid"): render video/GIF, kata muncul satu-satu
 *     dengan animasi bounce + efek sweep highlight. Font Impact.
 *   - generateBrat3 ("brat3"): render PNG statis 3 baris stacked
 *     (outer abu-abu / tengah hitam besar / outer abu-abu). Font Arial Narrow.
 *
 * Kedua fungsi dulunya 2 file terpisah (bratvid v2 + brat3), digabung di
 * sini karena satu keluarga fitur (menu "Brat") dan banyak helper (emoji
 * rendering, text measuring) yang identik — supaya gak duplikat kode.
 *
 * STATUS: reference/lib — BELUM di-wire ke endpoint /api manapun.
 * Brat Generator yang aktif sekarang di index.html/api/proxy.js masih
 * pakai proxy ke API siputzx, bukan modul ini.
 *
 * KENAPA BELUM DI-WIRE KE /api (Vercel):
 *   - butuh binary `ffmpeg` di PATH (khusus generateBratVideo)
 *   - butuh native addon @napi-rs/canvas ter-build cocok sama runtime
 *   - filesystem cuma /tmp yang writable & sementara di serverless
 * Opsi kalau mau dipakai live: jalankan sebagai service terpisah
 * (VPS/Docker/worker) yang api/proxy.js tinggal fetch ke situ, atau
 * pastikan Vercel function pakai Node.js runtime + bundling ffmpeg-static.
 *
 * DEPENDENCIES (belum ada di package.json project ini):
 *   - @napi-rs/canvas
 *   - ffmpeg tersedia di PATH (hanya untuk generateBratVideo, format mp4/gif)
 *
 * Font & emoji map di-download runtime dari CDN eksternal (jsdelivr /
 * githubusercontent pribadi orang lain) — pertimbangkan self-host kalau
 * mau production-grade.
 * ------------------------------------------------------------------
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const { writeFileSync, existsSync, readFileSync, mkdtempSync, rmSync } = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)

// =====================================================================
// Shared: download helper + emoji rendering (dipakai kedua generator)
// =====================================================================

const EMOJI_JSON_URL = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json'
const EMOJI_JSON_PATH = path.join(__dirname, 'emoji-apple.json')

async function downloadFile(url, dest) {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  return buf
}

let emojiMap = null
const emojiImageCache = new Map()

function emojiToUnicode(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4, '0')).join('-')
}

async function loadEmojiMap() {
  if (emojiMap) return emojiMap
  if (!existsSync(EMOJI_JSON_PATH)) await downloadFile(EMOJI_JSON_URL, EMOJI_JSON_PATH)
  emojiMap = JSON.parse(readFileSync(EMOJI_JSON_PATH, 'utf-8'))
  return emojiMap
}

async function getEmojiImage(emoji) {
  if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji)
  const map = await loadEmojiMap()
  const base = emojiToUnicode(emoji)
  const variants = [
    base,
    base.replace(/-fe0f/gi, ''),
    `${base.replace(/-fe0f/gi, '')}-fe0f`,
    base.toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase(),
    base.replace(/-fe0f/gi, '').toUpperCase() + '-FE0F'
  ]
  let b64 = null
  for (const v of variants) {
    if (map[v]) { b64 = map[v]; break }
  }
  if (!b64) return null
  const img = await loadImage(Buffer.from(b64, 'base64'))
  emojiImageCache.set(emoji, img)
  return img
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
  const img = await getEmojiImage(emoji)
  if (!img) { ctx.fillText(emoji, x, y); return }
  ctx.drawImage(img, x, y, size, size)
}

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX)
  let w = 0
  for (const part of parts) {
    if (!part) continue
    EMOJI_REGEX.lastIndex = 0
    if (EMOJI_REGEX.test(part)) w += fontSize
    else w += ctx.measureText(part).width
    EMOJI_REGEX.lastIndex = 0
  }
  return w
}

function wrapText(ctx, text, maxWidth, fontSize, fontFamily) {
  ctx.font = `${fontSize}px ${fontFamily}`
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word
    if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// =====================================================================
// Fonts (masing-masing generator pakai font beda)
// =====================================================================

const FONT_IMPACT_URL = 'https://cdn.jsdelivr.net/gh/Napoleon-Fibonacci/assets@main/font/impact.ttf'
const FONT_IMPACT_PATH = path.join(__dirname, 'impact.ttf')
const FONT_IMPACT_FAMILY = 'Impact'

const FONT_ARIALN_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/ARIALN.ttf'
const FONT_ARIALN_PATH = path.join(__dirname, 'ARIALN.ttf')
const FONT_ARIALN_FAMILY = 'ArialNarrow'

async function ensureFontImpact() {
  if (!existsSync(FONT_IMPACT_PATH)) await downloadFile(FONT_IMPACT_URL, FONT_IMPACT_PATH)
  GlobalFonts.registerFromPath(FONT_IMPACT_PATH, FONT_IMPACT_FAMILY)
}

async function ensureFontArialNarrow() {
  if (!existsSync(FONT_ARIALN_PATH)) await downloadFile(FONT_ARIALN_URL, FONT_ARIALN_PATH)
  GlobalFonts.registerFromPath(FONT_ARIALN_PATH, FONT_ARIALN_FAMILY)
}

// =====================================================================
// 1) generateBratVideo ("bratvid") — animasi bounce-in per kata, video/gif
// =====================================================================

const THEMES = {
  black: { bg: '#000000', text: '#ffffff' },
  white: { bg: '#ffffff', text: '#000000' },
  green: { bg: '#8ace00', text: '#000000' }
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX)
  let curX = x
  for (const part of parts) {
    if (!part) continue
    EMOJI_REGEX.lastIndex = 0
    if (EMOJI_REGEX.test(part)) {
      await drawAppleEmoji(ctx, part, curX, y, fontSize)
      curX += fontSize
    } else {
      ctx.fillText(part, curX, y)
      curX += ctx.measureText(part).width
    }
    EMOJI_REGEX.lastIndex = 0
  }
}

function fitsAt(ctx, text, fontSize, maxWidth, maxHeight, lineGap) {
  const lines = wrapText(ctx, text, maxWidth, fontSize, FONT_IMPACT_FAMILY)
  const longestWord = Math.max(...text.split(' ').map(w => measureTextCustom(ctx, w, fontSize)))
  const totalHeight = lines.length * (fontSize + lineGap) - lineGap
  return longestWord <= maxWidth && totalHeight <= maxHeight
}

function findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap) {
  let lo = 10
  let hi = 700
  let best = lo
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fitsAt(ctx, text, mid, maxWidth, maxHeight, lineGap)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

function easeOutBack(x) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function calculateWordLayout(ctx, fullText, maxWidth, maxHeight, lineGap, margin, padding, boxSize) {
  const fontSize = findBestFontSize(ctx, fullText, maxWidth, maxHeight, lineGap)
  ctx.font = `${fontSize}px ${FONT_IMPACT_FAMILY}`
  const defaultSpaceWidth = ctx.measureText(' ').width

  const fullLines = wrapText(ctx, fullText, maxWidth, fontSize, FONT_IMPACT_FAMILY)
  const totalTextHeight = fullLines.length * (fontSize + lineGap) - lineGap
  const startY = margin + (boxSize - totalTextHeight) / 2

  const wordLayouts = []
  let currentY = startY

  for (let l = 0; l < fullLines.length; l++) {
    const line = fullLines[l]
    const lineWords = line.split(' ').filter(Boolean)
    const isLastLine = (l === fullLines.length - 1)

    const totalWordsW = lineWords.reduce((acc, w) => acc + measureTextCustom(ctx, w, fontSize), 0)

    let spaceBetween = defaultSpaceWidth
    if (!isLastLine && lineWords.length > 1) {
      spaceBetween = (maxWidth - totalWordsW) / (lineWords.length - 1)
    }

    let currentX = margin + padding

    for (const word of lineWords) {
      const wordW = measureTextCustom(ctx, word, fontSize)
      wordLayouts.push({ text: word, x: currentX, y: currentY, w: wordW, h: fontSize })
      currentX += wordW + spaceBetween
    }
    currentY += fontSize + lineGap
  }

  return { fontSize, wordLayouts }
}

async function renderBratVideoCanvas({ wordLayouts, fontSize, wordStates, theme, blurAmount, highlightProgress = 0, format = 'mp4', margin = 70 }) {
  const selectedTheme = THEMES[theme] || THEMES.white
  const size = 1000
  const boxSize = size - margin * 2
  const x = margin
  const y = margin
  const w = boxSize
  const h = boxSize

  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  if (format !== 'gif') {
    ctx.fillStyle = selectedTheme.bg
    ctx.fillRect(0, 0, size, size)
  } else {
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = selectedTheme.bg
    ctx.fillRect(x, y, w, h)
  }

  if (!wordLayouts || wordLayouts.length === 0) return canvas

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  ctx.fillStyle = selectedTheme.text
  ctx.font = `${fontSize}px ${FONT_IMPACT_FAMILY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`

  for (let idx = 0; idx < wordLayouts.length; idx++) {
    const item = wordLayouts[idx]
    const state = wordStates[idx] || { scale: 0, alpha: 0, visible: false }
    if (!state.visible) continue

    const centerX = item.x + item.w / 2
    const centerY = item.y + fontSize / 2

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, state.alpha))

    if (state.scale !== 1.0) {
      ctx.translate(centerX, centerY)
      ctx.scale(state.scale, state.scale)
      ctx.translate(-centerX, -centerY)
    }

    await drawTextWithEmojis(ctx, item.text, item.x, item.y, fontSize)
    ctx.restore()
  }

  if (highlightProgress > 0 && highlightProgress <= 1) {
    const totalDist = boxSize * 2.8
    const curr = margin - boxSize * 1.0 + highlightProgress * totalDist
    const sweepW = boxSize * 0.95

    const grad = ctx.createLinearGradient(curr, curr, curr + sweepW, curr + sweepW)
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0)')
    grad.addColorStop(0.10, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(0.38, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)')
    grad.addColorStop(0.52, 'rgba(255, 255, 255, 0.05)')
    grad.addColorStop(0.60, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = grad
    ctx.fillRect(margin, margin, boxSize, boxSize)
  }

  ctx.restore()
  return canvas
}

/**
 * Generate video/GIF "brat" style dari teks (varian "bratvid").
 * @param {Object} opts
 * @param {string} opts.text
 * @param {'black'|'white'|'green'} opts.theme
 * @param {0|1|2|3} opts.blur
 * @param {'mp4'|'gif'} opts.format
 * @param {number} opts.holdDuration - Durasi frame terakhir "diam" (detik)
 * @param {boolean} opts.fastProgress - Render semua frame paralel
 * @returns {Promise<string>} path file output
 */
async function generateBratVideo({ text = 'Halo Guys Nama Saya', theme = 'white', blur = 0, format = 'mp4', holdDuration = 1.5, fastProgress = false } = {}) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : 0

  await ensureFontImpact()
  await loadEmojiMap()

  if (!text.trim()) throw new Error('Teks kosong')

  const formattedText = text
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brat-'))

  const FPS = 60
  const frameStepTime = 1 / FPS
  const tasks = []

  const size = 1000
  const margin = 70
  const padding = 40
  const boxSize = size - margin * 2
  const lineGap = 15
  const maxWidth = boxSize - padding * 2
  const maxHeight = boxSize - padding * 2

  const dummyCanvas = createCanvas(size, size)
  const dummyCtx = dummyCanvas.getContext('2d')

  const { fontSize, wordLayouts } = calculateWordLayout(dummyCtx, formattedText, maxWidth, maxHeight, lineGap, margin, padding, boxSize)

  const totalWords = wordLayouts.length

  tasks.push({ wordStates: wordLayouts.map(() => ({ scale: 0, alpha: 0, visible: false })), highlightProgress: 0, duration: 0.15 })

  const staggerFrames = 5
  const bounceFramesCount = 28
  const totalBounceFrames = (totalWords - 1) * staggerFrames + bounceFramesCount

  for (let f = 0; f < totalBounceFrames; f++) {
    const wordStates = wordLayouts.map((_, i) => {
      const startFrame = i * staggerFrames
      const currentFrame = f - startFrame
      if (currentFrame < 0) {
        return { scale: 0, alpha: 0, visible: false }
      } else if (currentFrame >= bounceFramesCount) {
        return { scale: 1.0, alpha: 1.0, visible: true }
      } else {
        const prog = currentFrame / (bounceFramesCount - 1)
        const bounceFactor = easeOutBack(prog)
        const scale = 0.2 + (1.0 - 0.2) * bounceFactor
        const alpha = Math.min(1.0, prog * 1.8)
        return { scale, alpha, visible: true }
      }
    })

    const highlightProgress = (f + 1) / totalBounceFrames
    tasks.push({ wordStates, highlightProgress, duration: frameStepTime })
  }

  const secondHighlightFrames = 38
  const allVisibleStates = wordLayouts.map(() => ({ scale: 1.0, alpha: 1.0, visible: true }))

  for (let hf = 0; hf < secondHighlightFrames; hf++) {
    const highlightProgress = (hf + 1) / secondHighlightFrames
    tasks.push({ wordStates: allVisibleStates, highlightProgress, duration: frameStepTime })
  }

  tasks.push({ wordStates: allVisibleStates, highlightProgress: 0, duration: holdDuration })

  const renderFrame = async (task, index) => {
    const canvas = await renderBratVideoCanvas({ wordLayouts, fontSize, wordStates: task.wordStates, theme, blurAmount, highlightProgress: task.highlightProgress, format, margin })
    const buffer = await canvas.encode('png')
    const framePath = path.join(tmpDir, `frame-${String(index + 1).padStart(5, '0')}.png`)
    writeFileSync(framePath, buffer)
    return { path: framePath, duration: task.duration }
  }

  let framePaths
  if (fastProgress) {
    framePaths = await Promise.all(tasks.map((task, i) => renderFrame(task, i)))
  } else {
    framePaths = []
    for (let i = 0; i < tasks.length; i++) {
      framePaths.push(await renderFrame(tasks[i], i))
    }
  }

  const manifestLines = []
  for (let i = 0; i < framePaths.length; i++) {
    manifestLines.push(`file '${framePaths[i].path.replace(/'/g, "'\\''")}'`)
    manifestLines.push(`duration ${framePaths[i].duration}`)
  }
  manifestLines.push(`file '${framePaths[framePaths.length - 1].path.replace(/'/g, "'\\''")}'`)

  const concatPath = path.join(tmpDir, 'concat.txt')
  writeFileSync(concatPath, manifestLines.join('\n'))

  const ext = format === 'gif' ? 'gif' : 'mp4'
  const outPath = path.join(process.cwd(), `brat-${Date.now()}.${ext}`)

  if (format === 'gif') {
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-vf', 'fps=60,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer',
      '-loop', '0', outPath
    ])
  } else {
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-vf', 'fps=60,scale=1000:1000',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      outPath
    ])
  }

  rmSync(tmpDir, { recursive: true, force: true })
  return outPath
}

// =====================================================================
// 2) generateBrat3 ("brat3") — PNG statis 3 baris stacked
// =====================================================================

async function drawCenteredLineWithEmojis(ctx, text, centerX, y, fontSize) {
  const totalW = measureTextCustom(ctx, text, fontSize)
  let curX = centerX - totalW / 2
  const parts = text.split(EMOJI_REGEX)
  for (const part of parts) {
    if (!part) continue
    EMOJI_REGEX.lastIndex = 0
    if (EMOJI_REGEX.test(part)) {
      await drawAppleEmoji(ctx, part, curX, y, fontSize)
      curX += fontSize
    } else {
      ctx.fillText(part, curX, y)
      curX += ctx.measureText(part).width
    }
    EMOJI_REGEX.lastIndex = 0
  }
}

/**
 * Generate PNG statis "brat" 3 baris stacked (varian "brat3").
 * @param {Object} opts
 * @param {string} opts.topText - Baris atas (warna outer)
 * @param {string} opts.midText - Baris tengah, lebih besar (warna mid)
 * @param {string} opts.bottomText - Baris bawah (warna outer)
 * @param {0|1|2|3} opts.blur
 * @param {string} opts.colorOuter - Warna teks atas & bawah (default '#dadada')
 * @param {string} opts.colorMid - Warna teks tengah (default '#000000')
 * @param {string} opts.bgColor - Warna background (default '#ffffff')
 * @returns {Promise<string>} path file PNG output
 */
async function generateBrat3({ topText = 'bego tolol', midText = 'anak hebat', bottomText = 'goblok banget', blur = 0, colorOuter = '#dadada', colorMid = '#000000', bgColor = '#ffffff' } = {}) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : 0

  const size = 1000
  const padding = 40
  const lineGap = 6
  const stackGapTop = 4
  const stackGapBottom = 40
  const maxWidth = size - padding * 2
  const maxHeight = size - padding * 2

  const OUTER_START_SIZE = 200
  const MID_START_SIZE = 340

  await ensureFontArialNarrow()
  await loadEmojiMap()

  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, size, size)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const centerX = size / 2

  function computeLayout(outerSize, midSize) {
    const topLines = wrapText(ctx, topText, maxWidth, outerSize, FONT_ARIALN_FAMILY)
    const bottomLines = wrapText(ctx, bottomText, maxWidth, outerSize, FONT_ARIALN_FAMILY)
    const topLongest = Math.max(...topText.split(' ').map(w => measureTextCustom(ctx, w, outerSize)))
    const bottomLongest = Math.max(...bottomText.split(' ').map(w => measureTextCustom(ctx, w, outerSize)))

    const midLines = wrapText(ctx, midText, maxWidth, midSize, FONT_ARIALN_FAMILY)
    const midLongest = Math.max(...midText.split(' ').map(w => measureTextCustom(ctx, w, midSize)))

    const topH = topLines.length * (outerSize + lineGap) - lineGap
    const midH = midLines.length * (midSize + lineGap) - lineGap
    const bottomH = bottomLines.length * (outerSize + lineGap) - lineGap
    const totalH = topH + stackGapTop + midH + stackGapBottom + bottomH

    const fits = topLongest <= maxWidth && bottomLongest <= maxWidth && midLongest <= maxWidth && totalH <= maxHeight
    return { fits, topLines, midLines, bottomLines, topH, midH, bottomH, totalH }
  }

  let outerSize = OUTER_START_SIZE
  let midSize = MID_START_SIZE
  let layout = computeLayout(outerSize, midSize)
  while (!layout.fits && outerSize > 6) {
    outerSize -= 2
    midSize -= Math.round(2 * (MID_START_SIZE / OUTER_START_SIZE))
    layout = computeLayout(outerSize, midSize)
  }

  const { topLines, midLines, bottomLines, topH, midH, totalH } = layout

  ctx.save()
  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`

  let cursorY = (size - totalH) / 2

  ctx.fillStyle = colorOuter
  ctx.font = `${outerSize}px ${FONT_ARIALN_FAMILY}`
  {
    let y = cursorY
    for (const line of topLines) {
      await drawCenteredLineWithEmojis(ctx, line, centerX, y, outerSize)
      y += outerSize + lineGap
    }
    cursorY += topH + stackGapTop
  }

  ctx.fillStyle = colorMid
  ctx.font = `${midSize}px ${FONT_ARIALN_FAMILY}`
  {
    let y = cursorY
    for (const line of midLines) {
      await drawCenteredLineWithEmojis(ctx, line, centerX, y, midSize)
      y += midSize + lineGap
    }
    cursorY += midH + stackGapBottom
  }

  ctx.fillStyle = colorOuter
  ctx.font = `${outerSize}px ${FONT_ARIALN_FAMILY}`
  {
    let y = cursorY
    for (const line of bottomLines) {
      await drawCenteredLineWithEmojis(ctx, line, centerX, y, outerSize)
      y += outerSize + lineGap
    }
  }

  ctx.restore()

  const buffer = await canvas.encode('png')
  const outPath = path.join(process.cwd(), `brat3-${Date.now()}.png`)
  writeFileSync(outPath, buffer)
  return outPath
}

module.exports = { generateBratVideo, generateBrat3 }
