# 09: Leaderboard room dengan peringkat sementara dan final

**What to build:** Peserta membandingkan nickname dan skor melalui Leaderboard Room yang berubah ketika peserta selesai, dengan penanda sementara selama sesi masih berjalan.

**Blocked by:** 07: Submit pengerjaan dan lihat skor serta pembahasan pribadi

**Status:** DONE

**Keputusan disetujui:** rank seri 1,1,3; hanya Host/peserta Room; peserta aktif tanpa skor parsial. Urutan tampilan seri stabil joinedAt lalu ID, bukan kecepatan.

## Prasyarat keputusan

Setujui aturan seri dan siapa boleh membaca leaderboard. Usulan: skor sama mendapat peringkat sama; peserta aktif ditampilkan tanpa skor parsial.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] Leaderboard memakai Result otoritatif; tidak menerima skor/rank dari klien dan tidak mengirim kunci atau jawaban peserta lain.
- [x] Peserta yang belum selesai ditandai sesuai kebijakan yang disetujui; skor/peringkat final peserta yang selesai ditampilkan dengan benar.
- [x] Skor seri mengikuti aturan yang disetujui dan urutan tampilan stabil; tidak diam-diam memakai kecepatan sebagai penentu.
- [x] Realtime memicu pembaruan leaderboard setelah commit; refresh dan event duplikat menghasilkan daftar yang sama.
- [x] Label sementara/final mengikuti status Room, bukan peserta yang pertama kali selesai; perubahan status Room dapat diuji menggunakan fixture sebelum tiket 08 selesai.
- [x] Daftar nickname yang panjang tetap bisa digunakan di mobile dan tidak menimbulkan klaim capacity tanpa batas.

## Pengujian dan demo

E2E dua peserta submit berurutan, skor seri, event ulang dan refresh. Setelah tiket 08 selesai, integrasikan uji peringkat final yang dipicu deadline nyata.

**Cakupan spesifikasi:** AC15, AC17.

## Batas cakupan

Tidak menambah peringkat global, riwayat lintas-room, hadiah, atau gamifikasi.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.


## Hasil verifikasi gabungan 08–10

- Migrasi 007 pada database aplikasi: PASS.
- Parser: 13/13 PASS; production build akhir, lint dan typecheck: PASS.
- Satu regresi penuh: 49/50 PASS. Satu gagal pada parameter SQL fixture recovery, sebelum worker dijalankan; fixture diperbaiki.
- Verifikasi ulang terbatas setelah koreksi fixture, hydration refresh, dan lint: 7/7 PASS (enam skenario baru + regresi refresh tiket 06). Tidak mengulang seluruh suite.
- Recovery benar-benar menghentikan/start ulang proses worker dalam schema database test terisolasi, tanpa browser/API yang memicu finalisasi; memeriksa Result tersimpan, peserta belum membuka kuis, grace crash, serta idempotensi restart berikutnya.
- Layanan lokal Next.js HTTP 200 dan health worker OK. Deployment publik, supervisor production, load test, serta failover infrastruktur belum diverifikasi.
