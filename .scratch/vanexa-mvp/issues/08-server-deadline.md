# 08: Finalisasi otomatis saat deadline dan pulihkan sesi setelah restart

**What to build:** Peserta yang tidak menekan submit tetap memperoleh hasil dari jawaban tersimpan ketika waktu habis, termasuk ketika tidak ada browser terhubung atau proses server sempat restart.

**Blocked by:** 07: Submit pengerjaan dan lihat skor serta pembahasan pribadi

**Status:** ready-for-agent

## Prasyarat keputusan

Pastikan deployment mendukung proses deadline persisten, restart recovery, dan akses database yang sama. Tidak menggantungkan penyelesaian pada browser atau Host.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Deadline memfinalisasi semua pengerjaan aktif menjadi kedaluwarsa dan mengakhiri Room sesuai lifecycle; pengerjaan yang sudah submit tidak dihitung ulang berbeda.
- [ ] Worker idempoten dan pemeriksaan deadline pada operasi server memakai aturan yang sama dengan autosave.
- [ ] Restart setelah deadline memproses sesi terlewat; tidak membutuhkan peserta membuka browser agar database akhirnya mencapai state final.
- [ ] Submit bersamaan deadline menghasilkan satu Result yang konsisten; tidak ada jawaban terlambat masuk.
- [ ] Peserta melihat waktu habis lalu hasil ketika terhubung; hasil mencakup soal yang tidak dijawab.
- [ ] Kuis tetap berlangsung ketika Host terputus setelah start; deadline tidak bergeser.

## Pengujian dan demo

E2E waktu habis pada dua guest, termasuk satu offline; uji submit/deadline bersamaan dan restart proses melewati deadline; periksa Result final tersimpan.

**Cakupan spesifikasi:** AC10, AC11 (Host offline saat running), AC12.

## Batas cakupan

Tanpa pause timer ketika koneksi putus atau grace menerima jawaban terlambat.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

