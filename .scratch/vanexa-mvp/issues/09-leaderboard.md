# 09: Leaderboard room dengan peringkat sementara dan final

**What to build:** Peserta membandingkan nickname dan skor melalui Leaderboard Room yang berubah ketika peserta selesai, dengan penanda sementara selama sesi masih berjalan.

**Blocked by:** 07: Submit pengerjaan dan lihat skor serta pembahasan pribadi

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui aturan seri dan siapa boleh membaca leaderboard. Usulan: skor sama mendapat peringkat sama; peserta aktif ditampilkan tanpa skor parsial.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Leaderboard memakai Result otoritatif; tidak menerima skor/rank dari klien dan tidak mengirim kunci atau jawaban peserta lain.
- [ ] Peserta yang belum selesai ditandai sesuai kebijakan yang disetujui; skor/peringkat final peserta yang selesai ditampilkan dengan benar.
- [ ] Skor seri mengikuti aturan yang disetujui dan urutan tampilan stabil; tidak diam-diam memakai kecepatan sebagai penentu.
- [ ] Realtime memicu pembaruan leaderboard setelah commit; refresh dan event duplikat menghasilkan daftar yang sama.
- [ ] Label sementara/final mengikuti status Room, bukan peserta yang pertama kali selesai; perubahan status Room dapat diuji menggunakan fixture sebelum tiket 08 selesai.
- [ ] Daftar nickname yang panjang tetap bisa digunakan di mobile dan tidak menimbulkan klaim capacity tanpa batas.

## Pengujian dan demo

E2E dua peserta submit berurutan, skor seri, event ulang dan refresh. Setelah tiket 08 selesai, integrasikan uji peringkat final yang dipicu deadline nyata.

**Cakupan spesifikasi:** AC15, AC17.

## Batas cakupan

Tidak menambah peringkat global, riwayat lintas-room, hadiah, atau gamifikasi.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

