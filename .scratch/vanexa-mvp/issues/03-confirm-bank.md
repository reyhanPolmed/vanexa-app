# 03: Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang

**What to build:** Host memperbaiki atau membuang soal hasil ekstraksi lalu mengonfirmasi jumlah akhir. Bank tersimpan dapat dibuka lagi, ditinjau, dan dipakai ulang untuk beberapa Room.

**Blocked by:** 02: Upload PDF teks dan preview hasil ekstraksi

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui perilaku duplikat dan kebijakan edit bank. Pencegahan perubahan soal sesi berjalan dibahas di tiket 04; jangan menetapkan snapshot diam-diam.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Editor mendukung pertanyaan, lima opsi, tipe skor, kunci atau bobot, serta pembahasan sesuai skema yang disetujui.
- [ ] Konfirmasi ditolak bila masih ada soal invalid atau semua soal dibuang; server memvalidasi ulang, bukan mengandalkan UI.
- [ ] Preview menampilkan jumlah final dan daftar penghapusan sebelum konfirmasi; jumlah tersimpan tepat sesuai preview.
- [ ] Konfirmasi atomik dan idempoten: retry atau klik ganda tidak membuat bank/questions tambahan; revision draft usang menghasilkan konflik yang jelas.
- [ ] Host dapat membuka daftar/detail bank dan mengoreksi soal yang diimpor; hanya owner diizinkan.
- [ ] Jika deteksi duplikat disepakati, peringatan menunjukkan konflik tanpa menghapus atau menggabungkan kunci secara otomatis.

## Pengujian dan demo

E2E upload campuran valid/invalid → edit/buang → konfirmasi → buka bank; ulang request konfirmasi; coba modifikasi draft usang dan akses lintas owner.

**Cakupan spesifikasi:** AC05; AC17 editor.

## Batas cakupan

Tidak menambah marketplace bank, bank publik, atau kolaborasi antar-Host.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

