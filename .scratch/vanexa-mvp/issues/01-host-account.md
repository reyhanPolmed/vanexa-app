# 01: Akun Host dan Question Bank pribadi

**What to build:** Host dapat masuk ke Vanexa, membuka daftar Question Bank pribadinya, dan keluar. Data akun serta kepemilikan bank tersimpan di PostgreSQL; pengguna lain tidak dapat membaca bank tersebut.

**Blocked by:** None (can start immediately — discovery; lihat prasyarat keputusan sebelum implementasi).

**Status:** DONE

## Catatan eksekusi

Selesai 2026-11-21. Pengguna memilih username/password saja. Implementasi memakai pg dan query berparameter; akun Host diprovisi melalui perintah pengelola. Migrasi PostgreSQL menyediakan akun, session, metadata bank/ownership, dan pembatasan percobaan login. Session opaque disimpan sebagai hash, password memakai scrypt, logout mencabut session database. Tidak ada email, OAuth, atau pendaftaran publik.

Verifikasi akhir: PASS build production, PASS lint, PASS typecheck, PASS 8/8 E2E Chromium dengan PostgreSQL nyata. Cakupan: redirect guest, login/logout, isolasi owner UI/API, tujuan login termasuk UUID huruf besar, error kredensial generik/terstruktur, penolakan cross-origin, batas percobaan login, mobile/keyboard, dan session/data bertahan setelah restart aplikasi production. Setup E2E menerapkan migrasi pada schema kosong dan mengulangnya; akun empty_host dibuat melalui perintah host:create. Audit dependency production: 0 vulnerabilities.

Review Standards: 0 temuan. Review Spec: 3 temuan (format error, UUID uppercase, keterangan spesifikasi lama), semuanya diperbaiki dan diverifikasi ulang. Repository Git diinisiasi; commit implementasi awal f2b1281, perbaikan/repor akhir berada pada commit lanjutan. Bukti tampilan mobile disimpan lokal dalam direktori setup yang diabaikan Git. Tiket 02 belum dikerjakan.

## Prasyarat keputusan

Metode autentikasi diputuskan pengguna: username/password. Detail implementasi tiket: driver pg langsung tanpa ORM, session PostgreSQL berumur 7 hari, dan pembuatan akun melalui CLI pengelola. PostgreSQL lokal Vanexa dan database test terpisah sudah dikonfigurasi tanpa mengubah service/database lain.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] Host berhasil masuk dan keluar dengan metode auth yang disetujui; pesan gagal masuk tidak membocorkan kredensial.
- [x] Halaman bank menampilkan daftar milik Host atau empty state dengan aksi impor; data tetap tersedia setelah restart aplikasi.
- [x] Guest diarahkan ke login jika mencoba mengelola bank; pengguna berakun lain tidak dapat membaca atau memutasi bank lewat UI maupun request langsung.
- [x] Navigasi menuju pengelolaan soal mempertahankan tujuan setelah login; form mendukung keyboard, mobile, loading, dan error.
- [x] Migrasi database dapat diterapkan pada database kosong; konfigurasi contoh tidak berisi secret nyata.

## Pengujian dan demo

E2E Host A masuk, membuka bank kosong, keluar; Host B tidak dapat mengakses resource milik A. Verifikasi migrasi database kosong dan auth server-side.

**Cakupan spesifikasi:** AC02 (akses Host).

## Batas cakupan

Tidak mencakup LMS, peran admin platform, metode auth ganda, atau provider berbayar tanpa persetujuan.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

