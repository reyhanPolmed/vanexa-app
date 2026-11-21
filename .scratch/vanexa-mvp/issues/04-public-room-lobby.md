# 04: Buat Room publik dan gabung lobby sebagai guest

**What to build:** Host membuat Room dari bank miliknya; pengunjung memilih TIU/TWK/TKP, menemukan Room publik, lalu masuk lobby memakai nickname. Room menyimpan daftar peserta dan konfigurasi yang konsisten.

**Blocked by:** 03: Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui snapshot soal saat Room dibuat, durasi min/maks, identitas guest/recovery, aturan nickname sama, dan apakah Host ikut menjawab. Kebijakan penanganan nama/konten publik juga perlu ditetapkan.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Home menampilkan tiga kategori dengan nama lengkap; daftar Room menampilkan nama, kategori, jumlah soal, peserta, durasi, dan status sesuai data PostgreSQL.
- [ ] Host dapat memilih bank miliknya dan membuat Room; kategori tidak cocok, bank kosong/invalid, durasi invalid, dan bank milik orang lain ditolak di server.
- [ ] Guest dapat bergabung tanpa akun; identitas peserta stabil sesuai mekanisme yang disetujui dan tidak disimpulkan dari nickname saja.
- [ ] Lobby menampilkan ringkasan kuis dan peserta; update realtime otomatis ditambahkan oleh tiket 05, bukan disamarkan dengan data mock.
- [ ] Tidak ada pengaturan maksimum peserta produk; tidak ada klaim kapasitas tanpa batas atau limit tersembunyi yang dianggap aturan produk.
- [ ] Jika snapshot disetujui, edit bank tidak mengubah Room yang sudah dibuat; kebijakan versi diverifikasi lewat perubahan bank nyata.
- [ ] Input publik dirender sebagai teks; keadaan loading/kosong/error dan navigasi mobile/keyboard berfungsi.

## Pengujian dan demo

E2E Host membuat Room dari bank impor → guest menemukan lewat kategori → guest join; uji penolakan invalid dan ownership; uji versi soal sesuai keputusan.

**Cakupan spesifikasi:** AC01, AC02 (guest), AC06 (create), AC16 bersyarat, AC17.

## Batas cakupan

Tanpa Room privat, kode undangan, multi-session ulang dalam Room, atau kontrol max peserta oleh Host.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

