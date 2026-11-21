# 10: Reconnect realtime dan tutup lobby bila Host tidak kembali

**What to build:** Guest dan Host yang reconnect memperoleh status Room terbaru. Lobby menunggu Host dalam masa tenggang, lalu ditutup bila Host tidak kembali; Room berjalan tidak dibatalkan.

**Blocked by:** 05: Start serentak via WebSocket dan navigasi kuis mandiri

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui grace period Host dan aturan presence ketika ada banyak tab. Koneksi terputus tidak boleh langsung disamakan dengan Host meninggalkan Room permanen.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Reconnect memakai identitas stabil dan snapshot server; tidak membuat peserta baru atau memulai sesi kedua.
- [ ] Event version lama/duplikat dibuang dan gap memicu resync; event yang terlewat tidak membuat layar tertahan pada lobby.
- [ ] Host disconnect sebelum start memulai grace yang tahan restart; reconnect sebelum batas membatalkan penutupan secara konsisten.
- [ ] Setelah grace habis, Room tertutup, peserta melihat alasan, join/start ditolak, dan daftar kategori mencerminkan status terbaru.
- [ ] Host disconnect setelah start tidak menjeda atau membatalkan kuis.
- [ ] Putus jaringan singkat/multi-tab mengikuti definisi presence yang disetujui; retry memakai backoff dan tidak membanjiri server.

## Pengujian dan demo

E2E putus/reconnect WebSocket saat lobby/start, Host kembali sebelum grace, grace habis, restart proses, dan Host offline saat running. Setelah tiket 06 tersedia verifikasi jawaban tetap pulih; setelah 08 tersedia verifikasi deadline tetap berjalan.

**Cakupan spesifikasi:** AC07 (reconnect), AC11; integrasi AC08 dan AC12.

## Batas cakupan

Tanpa pindah Host otomatis, co-host, atau pemulihan guest melalui nickname.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

