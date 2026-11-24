# 04: Buat Room publik dan gabung lobby sebagai guest

**What to build:** Host membuat Room dari bank miliknya; pengunjung memilih TIU/TWK/TKP, menemukan Room publik, lalu masuk lobby memakai nickname. Room menyimpan daftar peserta dan konfigurasi yang konsisten.

**Blocked by:** 03: Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang

**Status:** DONE

## Catatan eksekusi

Selesai 2026-11-21. Keputusan pengguna:
- **Snapshot soal:** Aktif (`room_questions` disalin dari `bank_questions` saat Room dibuat, mengisolasi kuis dari perubahan bank berikutnya).
- **Identitas Guest:** Token acak 32-byte pada cookie HttpOnly `vanexa_guest_${roomId}`, hash disimpan di server (`participants.token_hash`). Kehilangan cookie = kehilangan sesi.
- **Nickname sama:** Diizinkan dalam satu Room; identitas ditentukan oleh token peserta, bukan string nickname.
- **Partisipasi Host:** Host otomatis menjadi participant (nickname sesuai username host). Tombol Mulai kuis tetap eksklusif untuk Host (fungsionalitas start diserahkan ke tiket 05).
- **Durasi Room:** Integer 5–180 menit.
- **Konten Publik:** Batasan panjang (Room 1–120 karakter, nickname 1–32 karakter), dirender sebagai teks biasa tanpa interpretasi HTML.

Verifikasi akhir:
- **PASS**: 13/13 parser tests deterministik.
- **PASS**: 31/31 Playwright E2E tests pada Chromium dengan database PostgreSQL nyata (`vanexa_test`). Tujuh skenario baru mencakup: navigasi kategori Home, Host create room & auto-participant, penolakan server (ownership, bank kosong, mismatch kategori, durasi invalid, nama invalid), Guest join tanpa akun & reload persistence, duplicate nickname diizinkan, snapshot isolation (edit bank tidak mengubah room yang sudah dibuat), XSS safe rendering, dan mobile/keyboard accessibility.
- **PASS**: Next.js optimized production build (`next build`).
- **PASS**: TypeScript compilation check (`tsc --noEmit`).
- **PASS**: ESLint linting (`eslint .` 0 errors, 0 warnings).

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: Snapshot soal aktif saat Room dibuat, durasi 5–180 menit, identitas guest via cookie token per room, nickname duplikat diizinkan, Host otomatis menjadi peserta kuis dengan kontrol start khusus Host, batasan panjang teks tanpa HTML interpretation.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [x] Home menampilkan tiga kategori dengan nama lengkap; daftar Room menampilkan nama, kategori, jumlah soal, peserta, durasi, dan status sesuai data PostgreSQL.
- [x] Host dapat memilih bank miliknya dan membuat Room; kategori tidak cocok, bank kosong/invalid, durasi invalid, dan bank milik orang lain ditolak di server.
- [x] Guest dapat bergabung tanpa akun; identitas peserta stabil sesuai mekanisme yang disetujui dan tidak disimpulkan dari nickname saja.
- [x] Lobby menampilkan ringkasan kuis dan peserta; update realtime otomatis ditambahkan oleh tiket 05, bukan disamarkan dengan data mock.
- [x] Tidak ada pengaturan maksimum peserta produk; tidak ada klaim kapasitas tanpa batas atau limit tersembunyi yang dianggap aturan produk.
- [x] Jika snapshot disetujui, edit bank tidak mengubah Room yang sudah dibuat; kebijakan versi diverifikasi lewat perubahan bank nyata.
- [x] Input publik dirender sebagai teks; keadaan loading/kosong/error dan navigasi mobile/keyboard berfungsi.

## Pengujian dan demo

E2E Host membuat Room dari bank impor → guest menemukan lewat kategori → guest join; uji penolakan invalid dan ownership; uji versi soal sesuai keputusan.

**Cakupan spesifikasi:** AC01, AC02 (guest), AC06 (create), AC16 bersyarat, AC17.

## Batas cakupan

Tanpa Room privat, kode undangan, multi-session ulang dalam Room, atau kontrol max peserta oleh Host.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.
