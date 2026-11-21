# 05: Start serentak via WebSocket dan navigasi kuis mandiri

**What to build:** Peserta melihat perubahan lobby secara realtime. Ketika Host memulai, semua peserta terdaftar berpindah ke kuis dengan waktu mulai/deadline yang sama, lalu menavigasi soal sendiri.

**Blocked by:** 04: Buat Room publik dan gabung lobby sebagai guest

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui pemilik layanan WebSocket, topologi hosting Node persisten, kontrak event, dan cara menjalankan proses lokal. Auth koneksi harus memakai identitas server yang sudah ada.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] WebSocket mengotorisasi Host/membership sebelum subscription; guest tidak dapat mengaku sebagai Host atau membaca channel peserta lain.
- [ ] Hanya Host dapat start; start ulang idempoten dan tidak mengubah waktu atau membuat sesi kedua.
- [ ] Join dan start yang bersamaan diputuskan atomik: peserta mendapat membership sebelum start atau ditolak setelah start.
- [ ] startedAt dan deadlineAt tersimpan di server sebelum broadcast; klien yang kehilangan event dapat mengambil state terbaru.
- [ ] Dua guest menerima sesi/deadline sama, urutan pertanyaan dan A–E sama, tetapi dapat membuka nomor berbeda.
- [ ] Halaman kuis menyediakan timer berbasis waktu server, kontrol radio berlabel, navigasi, dan indikator soal; kunci/bobot tidak ada pada payload pengerjaan.
- [ ] Jawaban belum dianggap tersimpan sebelum autosave tiket 06 tersedia; kontrol submit hasil belum ditawarkan sebagai fitur selesai.

## Pengujian dan demo

E2E multi-browser: Host plus dua guest; uji non-Host start, double start, race join/start, subscriber tanpa otorisasi, dan event start yang terlewat.

**Cakupan spesifikasi:** AC06 (start), AC07 (start/join), AC10 (timer), AC17.

## Batas cakupan

Tidak membangun fanout multi-instance, broadcast timer per detik, atau mode satu-soal-serentak.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

