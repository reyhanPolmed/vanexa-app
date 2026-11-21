# 02: Upload PDF teks dan preview hasil ekstraksi

**What to build:** Host mengunggah PDF teks melalui area bank, kemudian melihat draft soal dengan nomor sumber, pertanyaan, opsi A–E, kunci/bobot, pembahasan, dan error per field tanpa langsung menyimpan bank aktif.

**Blocked by:** 01: Akun Host dan Question Bank pribadi

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui template marker PDF v1, konten teks saja, rentang bobot, status wajib/opsional pembahasan, batas ukuran/halaman/soal, dan retensi upload. Pilih parser berdasarkan uji fixture; bukan karena popularitas.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] PDF template valid menghasilkan preview dengan teks, urutan, opsi, kunci/bobot, kategori, dan jumlah soal persis seperti fixture.
- [ ] PDF scan/tanpa teks, rusak, terkunci, melebihi limit, atau struktur ambigu menghasilkan error yang bisa ditindaklanjuti; isi tidak ditebak.
- [ ] Opsi hilang, nomor sumber duplikat, marker konflik, kunci tidak valid, dan bobot tidak lengkap ditandai per soal/field.
- [ ] Draft tersimpan dan hanya dapat dibaca pemilik; upload tidak menjadi file publik atau soal aktif.
- [ ] Preview mempertahankan konten terbaca agar Host dapat memperbaikinya di tiket berikutnya; tidak diam-diam membuang soal invalid.
- [ ] Petunjuk format dan contoh template yang disetujui tersedia di alur upload; encoding Indonesia dan teks lintas halaman diuji.

## Pengujian dan demo

E2E upload PDF valid dan invalid hingga preview; uji parser dengan fixture deterministik untuk semua variasi struktur. Cocokkan jumlah, isi, dan nomor sumber, bukan hanya respons berhasil.

**Cakupan spesifikasi:** AC03, AC04; AC17 pada alur upload.

## Batas cakupan

Tanpa OCR, LLM, gambar, tabel kompleks, atau pembuatan manual bank dari awal.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

