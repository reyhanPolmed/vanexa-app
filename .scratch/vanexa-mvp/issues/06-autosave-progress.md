# 06: Autosave jawaban dan pulihkan progres setelah refresh

**What to build:** Peserta memilih jawaban dan memperoleh status penyimpanan nyata; refresh memulihkan jawaban yang sudah diakui server tanpa membuat peserta baru.

**Blocked by:** 05: Start serentak via WebSocket dan navigasi kuis mandiri

**Status:** ready-for-agent

## Prasyarat keputusan

Finalisasi kontrak mutasi idempoten/revision dan strategi antrean penyimpanan; identitas guest mengikuti keputusan tiket 04.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Setiap jawaban memiliki satu rekaman efektif per peserta/soal, berotorisasi terhadap membership, question versi sesi, dan waktu server.
- [ ] UI membedakan menyimpan, tersimpan, dan gagal; indikator soal sesuai jawaban efektif, bukan sekadar klik terakhir yang belum diakui.
- [ ] Retry mutation yang sama memberi hasil konsisten; request jawaban lama tidak menimpa pilihan yang lebih baru.
- [ ] Refresh memuat jawaban tersimpan dan nomor/progres yang relevan; peserta tidak dibuat ulang.
- [ ] Jawaban pada/setelah deadline ditolak meski jam browser diubah; deadline diperiksa saat transaksi commit/serialisasi yang menentukan penerimaan.
- [ ] Gangguan jaringan mempertahankan penanda pending; retry tidak menjanjikan penyimpanan jika waktu sudah lewat.
- [ ] Satu peserta tidak dapat membaca atau menulis jawaban peserta lain; validasi pilihan dan status sesi berlaku di server.

## Pengujian dan demo

E2E pilih → acknowledgement → refresh; simulasi retry, request terbalik, offline/online, perubahan jam browser, dan request lintas peserta.

**Cakupan spesifikasi:** AC08, AC09, AC10 (jawaban), AC17.

## Batas cakupan

Tidak menjamin jawaban offline yang tiba setelah deadline diterima; tidak menambahkan sinkronisasi lintas perangkat tanpa kebutuhan.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

