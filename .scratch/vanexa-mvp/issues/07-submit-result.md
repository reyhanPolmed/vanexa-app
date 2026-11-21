# 07: Submit pengerjaan dan lihat skor serta pembahasan pribadi

**What to build:** Peserta mengakhiri pengerjaan dan langsung mendapat hasil sendiri, termasuk skor, soal kosong, pilihan, kunci/bobot, serta pembahasan. Pengerjaan peserta lain tetap berjalan.

**Blocked by:** 06: Autosave jawaban dan pulihkan progres setelah refresh

**Status:** ready-for-agent

## Prasyarat keputusan

Setujui angka skor benar/salah/kosong dan rentang bobot. Tidak menerapkan aturan resmi CPNS atau passing grade secara tersirat.

Label ready-for-agent menunjukkan antrean kerja. Keputusan terbuka bukan persetujuan: agent boleh memeriksa fakta dan menyiapkan proposal, tetapi harus memperoleh keputusan pengguna sebelum mengimplementasikan pilihan penting yang belum disetujui. Semua blocker tiket harus selesai dahulu.

## Acceptance criteria

- [ ] Konfirmasi selesai menyebut jumlah kosong dan status jawaban pending; pilihan tidak diam-diam dianggap tersimpan.
- [ ] Submit idempoten mengunci pengerjaan serta menghitung skor di server dari soal versi sesi dan jawaban yang telah tersimpan.
- [ ] Race save/submit menghasilkan hasil sesuai urutan transaksi yang jelas; tidak ada perubahan jawaban setelah final.
- [ ] TIU/TWK atau tipe satu-kunci menampilkan benar/salah/kosong sesuai formula; tipe berbobot menampilkan skor opsi dan jumlah kosong tanpa memaksakan benar/salah.
- [ ] Result dan pembahasan langsung tersedia kepada pemilik pengerjaan final, bukan kepada peserta aktif atau orang lain lewat tebakan ID.
- [ ] Jawaban, bobot, total dan maksimum skor dapat ditelusuri ke data soal yang dikerjakan; pembahasan kosong ditampilkan jujur.
- [ ] Halaman hasil tetap nyaman dibaca di mobile dan keyboard; tidak menyatakan lulus CPNS.

## Pengujian dan demo

E2E submit dengan benar/salah/kosong dan soal berbobot → review; double submit; race save/submit; uji akses Result orang lain. Tambah uji formula terisolasi untuk variasi bobot.

**Cakupan spesifikasi:** AC13, AC14, AC17; fondasi finalisasi AC12.

## Batas cakupan

Tanpa menunggu seluruh peserta selesai sebelum membuka pembahasan; risiko pembocoran jawaban tetap didokumentasikan.

## Penyelesaian

- [ ] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [ ] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [ ] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.

