# 10: Reconnect realtime dan tutup lobby bila Host tidak kembali

**What to build:** Guest dan Host yang reconnect memperoleh status Room terbaru. Lobby menunggu Host dalam masa tenggang, lalu ditutup bila Host tidak kembali; Room berjalan tidak dibatalkan.

**Blocked by:** 05: Start serentak via WebSocket dan navigasi kuis mandiri

**Status:** DONE

**Keputusan disetujui:** Host online selama minimal satu tab terotorisasi terhubung; lobby ditutup setelah Host terdeteksi offline 5 menit. Grace disimpan di PostgreSQL dan bertahan setelah restart. Heartbeat 15 detik/lease 60 detik menentukan deteksi putus tanpa close event.

## Prasyarat keputusan

Setujui grace period Host dan aturan presence ketika ada banyak tab. Koneksi terputus tidak boleh langsung disamakan dengan Host meninggalkan Room permanen.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] Reconnect memakai identitas stabil dan snapshot server; tidak membuat peserta baru atau memulai sesi kedua.
- [x] Event version lama/duplikat dibuang dan gap memicu resync; event yang terlewat tidak membuat layar tertahan pada lobby.
- [x] Host disconnect sebelum start memulai grace yang tahan restart; reconnect sebelum batas membatalkan penutupan secara konsisten.
- [x] Setelah grace habis, Room tertutup, peserta melihat alasan, join/start ditolak, dan daftar kategori mencerminkan status terbaru.
- [x] Host disconnect setelah start tidak menjeda atau membatalkan kuis.
- [x] Putus jaringan singkat/multi-tab mengikuti definisi presence yang disetujui; retry memakai backoff dan tidak membanjiri server.

## Pengujian dan demo

E2E putus/reconnect WebSocket saat lobby/start, Host kembali sebelum grace, grace habis, restart proses, dan Host offline saat running. Setelah tiket 06 tersedia verifikasi jawaban tetap pulih; setelah 08 tersedia verifikasi deadline tetap berjalan.

**Cakupan spesifikasi:** AC07 (reconnect), AC11; integrasi AC08 dan AC12.

## Batas cakupan

Tanpa pindah Host otomatis, co-host, atau pemulihan guest melalui nickname.

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
