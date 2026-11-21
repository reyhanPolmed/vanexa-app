# 02: Upload PDF teks dan preview hasil ekstraksi

**What to build:** Host mengunggah PDF teks melalui area bank, kemudian melihat draft soal dengan nomor sumber, pertanyaan, opsi A–E, kunci/bobot, pembahasan, dan error per field tanpa langsung menyimpan bank aktif.

**Blocked by:** 01: Akun Host dan Question Bank pribadi

**Status:** DONE

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: marker PDF v1, satu kategori/bank per PDF, teks saja, bobot integer 0–5, pembahasan opsional, batas 5 MiB/50 halaman/200 soal, PDF asli tidak disimpan, dan draft privat kedaluwarsa setelah 24 jam. PDF.js dipilih setelah probe PDF dua halaman dan pengujian fixture nyata, bukan karena popularitas.

## Hasil implementasi dan verifikasi

Host dapat mengunggah PDF dari halaman bank, melihat preview persistennya, error dokumen/field, serta teks sumber soal. Preview tidak membuat Question Bank aktif. PDF rusak/bersandi/scan/bergambar, berstruktur ambigu, atau melebihi limit ditolak secara eksplisit. Owner lain tidak dapat membaca draft dan expiry akses diperiksa server. Edit/buang/konfirmasi tetap tiket 03.

PASS: 13/13 tes parser, 15/15 E2E Chromium dengan PostgreSQL nyata, production build, lint, dan typecheck. Cakupan meliputi tanda baca Indonesia, teks lintas halaman, paragraf kosong, malformed marker, bobot 0–5, PDF gambar/besaran deklaratif ekstrem, tiga limit impor, auth/ownership/CSRF, mobile, refresh, dan upload pada server production setelah restart. Migrasi diterapkan ke database kerja dan schema test kosong. Command cleanup juga dijalankan berhasil.

Review Standards: satu temuan resource raster. Review Spec: dua temuan parser (malformed marker dan paragraf kosong). Ketiganya diperbaiki dan diperiksa ulang; tidak ada finding tersisa. PDF.js 6.5.438 dikunci dengan koreksi postinstall yang memeriksa versi/bentuk kode untuk propagasi error operator-list; rincian dan kewajiban instalasi tersedia di README. Batas heap subprocess tidak diklaim sebagai batas seluruh RSS.

Expiry akses draft berlaku otomatis setelah 24 jam. Penghapusan fisik dilakukan pada upload berikutnya atau command import:cleanup; scheduler periodik perlu dipasang oleh deployment dan belum dikonfigurasi oleh tiket ini. Tidak ada PDF asli yang dipersistenkan.

Commit fitur awal: 314c16b; perbaikan review dan status selesai dicatat dalam commit lanjutan. Tiket 03 belum dikerjakan.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] PDF template valid menghasilkan preview dengan teks, urutan, opsi, kunci/bobot, kategori, dan jumlah soal persis seperti fixture.
- [x] PDF scan/tanpa teks, rusak, terkunci, melebihi limit, atau struktur ambigu menghasilkan error yang bisa ditindaklanjuti; isi tidak ditebak.
- [x] Opsi hilang, nomor sumber duplikat, marker konflik, kunci tidak valid, dan bobot tidak lengkap ditandai per soal/field.
- [x] Draft tersimpan dan hanya dapat dibaca pemilik; upload tidak menjadi file publik atau soal aktif.
- [x] Preview mempertahankan konten terbaca agar Host dapat memperbaikinya di tiket berikutnya; tidak diam-diam membuang soal invalid.
- [x] Petunjuk format dan contoh template yang disetujui tersedia di alur upload; encoding Indonesia dan teks lintas halaman diuji.

## Pengujian dan demo

E2E upload PDF valid dan invalid hingga preview; uji parser dengan fixture deterministik untuk semua variasi struktur. Cocokkan jumlah, isi, dan nomor sumber, bukan hanya respons berhasil.

**Cakupan spesifikasi:** AC03, AC04; AC17 pada alur upload.

## Batas cakupan

Tanpa OCR, LLM, gambar, tabel kompleks, atau pembuatan manual bank dari awal.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

