# NexaKit Pro — Kerangka Fitur (Skeleton Build)

Versi ini adalah `index.html` yang sama fungsinya dengan versi asli, tapi
**semua UI/UX dibuang**: tidak ada CSS custom, animasi, tema warna per-tool,
ikon Font Awesome, boot screen, hero video, audio player, drawer menu,
maupun badge VIP. Yang tersisa cuma HTML polos (form, tombol, list) dan
JavaScript yang menjalankan fitur aslinya secara utuh:

- Login/Register/Logout via Supabase Auth (username dipetakan ke email internal)
- Semua 20 tools (TikTok, Instagram, Spotify, Terabox, YouTube, Facebook,
  Twitter/X, CapCut, SaveFrom, Lahelu, Brat Generator, iPhone Quote Create,
  Sertifikat Tolol, Fake Lobby ML/FF, Fake Saldo DANA, FakeDev Profile,
  Foto To Link, Remove Background, Image Enhancer) — endpoint & parameter API
  persis sama seperti sebelumnya
- Pencarian & filter kategori tools
- Riwayat download TikTok (localStorage)
- Cek status endpoint (health check) per tool
- Pengaturan user: ganti nama tampilan, foto profil, ganti password
- Link "About Dev" dan "Report Bug" (WhatsApp)

Backend (`/api/*`, `supabase/schema.sql`, `.env.example`, `vercel.json`,
`manifest.json`, `sw.js`) **tidak diubah sama sekali**.

## Yang sengaja dibuang (bukan bug)
Boot animation, hero video, audio player/playlist, drawer slide animation,
badge & tombol upgrade VVIP, panel info device/browser/baterai/negara,
tema warna per-tool, ikon, drag-and-drop styling, tombol paste/clear
pada input, dan efek scroll-reveal. Semuanya murni dekorasi/UX, bukan
fitur — jadi dibuang sesuai permintaan "kerangka doang".

## Catatan
Ada satu bug kecil di versi asli yang otomatis terperbaiki di sini:
`isHttpUrl()` sebelumnya didefinisikan di dalam `<script type="module">`
tapi dipanggil dari script classic lain (TikTok/YouTube/generic downloader),
yang seharusnya `ReferenceError` di runtime karena scope module tidak
global. Di versi ini `isHttpUrl()` dipindah ke script bersama yang global,
supaya validasi link benar-benar jalan.
