# 05: Start serentak via WebSocket dan navigasi kuis mandiri

**What to build:** Peserta melihat perubahan lobby secara realtime. Ketika Host memulai, semua peserta terdaftar berpindah ke kuis dengan waktu mulai/deadline yang sama, lalu menavigasi soal sendiri.

**Blocked by:** 04: Buat Room publik dan gabung lobby sebagai guest

**Status:** DONE

## Catatan eksekusi

Selesai 2026-11-21. Keputusan pengguna:
- **Topologi WS & Realtime:** Server WebSocket mandiri (`server/ws-server.ts`) menggunakan library `ws` dan tersinkronisasi dengan mutasi Next.js melalui PostgreSQL `LISTEN/NOTIFY` pada channel `vanexa_events`.
- **Otorisasi WS:** Autentikasi koneksi langsung memverifikasi cookie server yang sudah ada (`vanexa_host_session` dan `vanexa_guest_${roomId}`) terhadap database PostgreSQL. Klien tanpa hak akses ditolak dengan kode 4403/Forbidden dan koneksi ditutup.
- **Transisi Kuis Serentak:** Broadcast event `quiz.started` memicu seluruh peserta di lobby beralih seketika ke `/rooms/:id/quiz`. State recovery otomatis mengarahkan peserta yang melewatkan event atau membuka lobby setelah kuis dimulai.
- **Start Atomik & Idempoten:** Transaksi PostgreSQL dengan `FOR UPDATE` menjamin start hanya dapat dilakukan Host, menolak join yang terlambat (`ROOM_STARTED`), dan memastikan start ulang bersifat idempoten tanpa mengubah `started_at` atau `deadline_at`.
- **Halaman Kuis & Keamanan:** Soal diambil dari snapshot `room_questions` tanpa menyertakan `answer_key`, `weights`, atau `explanation` dalam payload klien. Timer dihitung dari selisih deadline server dan waktu server. Navigasi soal mandiri mendukung kontrol radio A–E berlabel, keyboard, dan mobile. Jawaban disimpan lokal di antarmuka (autosave server akan dikerjakan pada tiket 06).

Verifikasi akhir:
- **PASS**: 13/13 parser tests deterministik.
- **PASS**: 34/34 Playwright E2E tests pada Chromium dengan database PostgreSQL nyata (`vanexa_test`). Tiga skenario baru tiket 05 mencakup: penolakan klien WS tanpa otorisasi (4403), penolakan non-host start (401/403) & start idempoten, race join/start, broadcast start serentak Host + 2 Guest berpindah bersamaan ke kuis, verifikasi payload tanpa kebocoran kunci/bobot, timer server, dan navigasi mandiri antar peserta.
- **PASS**: Next.js production build (`next build`).
- **PASS**: TypeScript compilation check (`tsc --noEmit`).
- **PASS**: ESLint linting (`eslint .` 0 errors, 0 warnings).

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: Layanan WS mandiri via `ws` + PG LISTEN/NOTIFY, otorisasi koneksi via cookie HttpOnly saat handshake, dan transisi instan lobby ke `/rooms/:id/quiz` saat start.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] WebSocket mengotorisasi Host/membership sebelum subscription; guest tidak dapat mengaku sebagai Host atau membaca channel peserta lain.
- [x] Hanya Host dapat start; start ulang idempoten dan tidak mengubah waktu atau membuat sesi kedua.
- [x] Join dan start yang bersamaan diputuskan atomik: peserta mendapat membership sebelum start atau ditolak setelah start.
- [x] startedAt dan deadlineAt tersimpan di server sebelum broadcast; klien yang kehilangan event dapat mengambil state terbaru.
- [x] Dua guest menerima sesi/deadline sama, urutan pertanyaan dan A–E sama, tetapi dapat membuka nomor berbeda.
- [x] Halaman kuis menyediakan timer berbasis waktu server, kontrol radio berlabel, navigasi, dan indikator soal; kunci/bobot tidak ada pada payload pengerjaan.
- [x] Jawaban belum dianggap tersimpan sebelum autosave tiket 06 tersedia; kontrol submit hasil belum ditawarkan sebagai fitur selesai.

## Pengujian dan demo

E2E multi-browser: Host plus dua guest; uji non-Host start, double start, race join/start, subscriber tanpa otorisasi, dan event start yang terlewat.

**Cakupan spesifikasi:** AC06 (start), AC07 (start/join), AC10 (timer), AC17.

## Batas cakupan

Tidak membangun fanout multi-instance, broadcast timer per detik, atau mode satu-soal-serentak.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.
