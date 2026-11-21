# 01: Akun Host dan Question Bank pribadi

**What to build:** Host dapat masuk ke Vanexa, membuka daftar Question Bank pribadinya, dan keluar. Data akun serta kepemilikan bank tersimpan di PostgreSQL; pengguna lain tidak dapat membaca bank tersebut.

**Blocked by:** None (can start immediately — discovery; lihat prasyarat keputusan sebelum implementasi).

**Status:** BLOCKED

## Catatan eksekusi

Tiket 01 dipilih sebagai tiket pertama tanpa blocker antartiket. Implementasi tertahan oleh prasyarat keputusan di bawah: metode autentikasi Host dan strategi akses PostgreSQL belum disetujui. Pemeriksaan repository menemukan hanya scaffold aplikasi, tanpa dependency auth/akses PostgreSQL atau konfigurasi database proyek. Tidak ada kode produk diubah; acceptance criteria belum terpenuhi.

Tests, lint, typecheck, dan build: NOT RUN; tidak ada perubahan implementasi yang dapat diverifikasi untuk tiket ini. Commit tidak dibuat karena folder proyek belum merupakan repository Git. Tiket 02 tetap menunggu tiket 01 selesai.

## Prasyarat keputusan

Metode autentikasi Host dan strategi akses PostgreSQL perlu dipilih dan disetujui sebelum implementasi bagian tersebut.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Host berhasil masuk dan keluar dengan metode auth yang disetujui; pesan gagal masuk tidak membocorkan kredensial.
- [ ] Halaman bank menampilkan daftar milik Host atau empty state dengan aksi impor; data tetap tersedia setelah restart aplikasi.
- [ ] Guest diarahkan ke login jika mencoba mengelola bank; pengguna berakun lain tidak dapat membaca atau memutasi bank lewat UI maupun request langsung.
- [ ] Navigasi menuju pengelolaan soal mempertahankan tujuan setelah login; form mendukung keyboard, mobile, loading, dan error.
- [ ] Migrasi database dapat diterapkan pada database kosong; konfigurasi contoh tidak berisi secret nyata.

## Pengujian dan demo

E2E Host A masuk, membuka bank kosong, keluar; Host B tidak dapat mengakses resource milik A. Verifikasi migrasi database kosong dan auth server-side.

**Cakupan spesifikasi:** AC02 (akses Host).

## Batas cakupan

Tidak mencakup LMS, peran admin platform, metode auth ganda, atau provider berbayar tanpa persetujuan.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

