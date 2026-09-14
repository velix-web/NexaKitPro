# /scripts — Reference/lib (belum di-wire ke /api)

File di folder ini disimpan sebagai kode referensi/library, **bukan**
endpoint yang otomatis aktif. Tidak ada yang di `index.html` atau
`/api/*` yang memanggil isi folder ini.

## brat.js
Dua generator gaya "brat" (Charli XCX album cover), digabung jadi satu
modul karena satu keluarga fitur & banyak helper yang sama persis
(emoji rendering, text measuring). Ini alternatif dari implementasi
Brat Generator yang sekarang aktif di project (proxy ke API siputzx
di `api/proxy.js`).

- **`generateBratVideo`** ("bratvid") — video/GIF, kata muncul satu-satu
  dengan animasi bounce + sweep highlight. Font Impact.
- **`generateBrat3`** ("brat3") — PNG statis 3 baris stacked
  (outer abu-abu / tengah hitam besar / outer abu-abu). Font Arial Narrow.

**Cara pakai (lokal / non-Vercel):**
```js
const { generateBratVideo, generateBrat3 } = require('./scripts/brat.js')

// Varian video/gif
generateBratVideo({
  text: 'BIG MONEY NEVER COMES CLEAN 💸💸',
  theme: 'white',       // 'black' | 'white' | 'green'
  blur: 0,               // 0-3
  format: 'mp4',         // 'mp4' | 'gif'
  holdDuration: 1.5,
  fastProgress: true
}).then(outPath => console.log('Selesai:', outPath))

// Varian PNG 3 baris stacked
generateBrat3({
  topText: 'bego tolol',
  midText: 'anak hebat',
  bottomText: 'goblok banget',
  blur: 0
}).then(outPath => console.log('Selesai:', outPath))
```

**Butuh sebelum bisa jalan:**
1. `npm install @napi-rs/canvas`
2. `ffmpeg` terinstall & ada di PATH — **hanya diperlukan untuk
   `generateBratVideo`** (format mp4/gif); `generateBrat3` gak butuh ffmpeg.

**Kalau mau dipakai live di NexaKit Pro (Vercel):**
Jangan panggil langsung dari `/api` tanpa persiapan — lihat komentar
di atas `brat.js` untuk opsi (worker/VPS terpisah, atau bundling
ffmpeg-static + pastikan Node.js runtime).
