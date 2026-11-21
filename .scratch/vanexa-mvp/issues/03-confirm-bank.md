# 03: Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang

**What to build:** Host memperbaiki atau membuang soal hasil ekstraksi lalu mengonfirmasi jumlah akhir. Bank tersimpan dapat dibuka lagi, ditinjau, dan dipakai ulang untuk beberapa Room.

**Blocked by:** 02: Upload PDF teks dan preview hasil ekstraksi

**Status:** DONE

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: duplikat pertanyaan+opsi diperingatkan dalam draft dan bank milik Host, tetap boleh disimpan tanpa penghapusan/penggabungan otomatis; hanya owner boleh mengoreksi bank dengan revision check. Pencegahan perubahan soal sesi berjalan tetap keputusan tiket 04; snapshot belum ditetapkan.

## Hasil implementasi

Editor isian mendukung nomor sumber, pertanyaan, pilihan A–E, tipe skor, kunci/bobot, dan pembahasan. Sumber ambigu (termasuk konflik bobot dan tipe invalid) memakai editor teks sampai diperbaiki secara eksplisit. Original preview tetap disimpan sampai expiry draft. Teks di luar struktur dokumen memerlukan pengakuan review, bukan dibuang diam-diam.

Soal dapat dibuang dan dipulihkan sebelum konfirmasi. Jumlah final dan daftar nomor sumber yang dibuang ditampilkan sebelum tombol konfirmasi. Server memvalidasi ulang seluruh soal aktif dan menolak kumpulan kosong atau invalid. Duplikat isi hanya menjadi warning; nomor sumber duplikat tetap invalid sampai diperbaiki.

Konfirmasi mengunci draft dan membuat bank, seluruh soal, dan receipt dalam satu transaksi. UUID idempotency key dan revision yang sama mengembalikan bank yang sama; key/revision berbeda setelah konfirmasi ditolak. PATCH draft/bank menolak revision usang dan mengembalikan snapshot yang benar-benar disimpan oleh transaksi, bukan versi tab lain yang dibaca setelah commit. Koreksi bank mempertahankan ID dan urutan soal, tanpa menambah fitur pembuatan/penghapusan soal manual.

## Bukti verifikasi

PASS: 13/13 tes parser, 24/24 E2E Chromium dengan PostgreSQL nyata, production build, lint, dan typecheck. Sembilan skenario khusus tiket 03 mencakup invalid/all-discarded, edit→buang→review→konfirmasi, koreksi bank, retry/konfirmasi bersamaan, stale revision, isolasi owner/CSRF, warning duplikat, metadata/sumber ambigu, konflik bobot, dan respons snapshot saat penulisan bertumpuk. Regresi tiket 01/02 tetap lulus. Migrasi 003 dan 004 berhasil pada database kerja serta schema test kosong; screenshot bank mobile diperiksa.

Review Standards menemukan satu risiko respons save yang terbaca dari revision berikutnya; Review Spec menemukan satu risiko bobot ambigu yang terhapus saat edit field lain. Keduanya diperbaiki dan diperiksa ulang, dengan tes regresi. Tidak ada finding tersisa. Commit fitur awal cb8bd34; perbaikan serta status final dicatat dalam commit lanjutan. Tidak ada blocker tiket 03. Tiket 04 belum dikerjakan.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] Editor mendukung pertanyaan, lima opsi, tipe skor, kunci atau bobot, serta pembahasan sesuai skema yang disetujui.
- [x] Konfirmasi ditolak bila masih ada soal invalid atau semua soal dibuang; server memvalidasi ulang, bukan mengandalkan UI.
- [x] Preview menampilkan jumlah final dan daftar penghapusan sebelum konfirmasi; jumlah tersimpan tepat sesuai preview.
- [x] Konfirmasi atomik dan idempoten: retry atau klik ganda tidak membuat bank/questions tambahan; revision draft usang menghasilkan konflik yang jelas.
- [x] Host dapat membuka daftar/detail bank dan mengoreksi soal yang diimpor; hanya owner diizinkan.
- [x] Jika deteksi duplikat disepakati, peringatan menunjukkan konflik tanpa menghapus atau menggabungkan kunci secara otomatis.

## Pengujian dan demo

E2E upload campuran valid/invalid → edit/buang → konfirmasi → buka bank; ulang request konfirmasi; coba modifikasi draft usang dan akses lintas owner.

**Cakupan spesifikasi:** AC05; AC17 editor.

## Batas cakupan

Tidak menambah marketplace bank, bank publik, atau kolaborasi antar-Host.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

