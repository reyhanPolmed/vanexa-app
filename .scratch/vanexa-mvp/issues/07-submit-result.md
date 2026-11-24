# 07: Submit pengerjaan dan lihat skor serta pembahasan pribadi

**What to build:** Peserta mengakhiri pengerjaan dan langsung mendapat hasil sendiri, termasuk skor, soal kosong, pilihan, kunci/bobot, serta pembahasan. Pengerjaan peserta lain tetap berjalan.

**Blocked by:** 06: Autosave jawaban dan pulihkan progres setelah refresh

**Status:** DONE

## Catatan eksekusi

Selesai 2026-11-21. Keputusan pengguna:
- **Formula & Perhitungan Skor:**
  - `SINGLE_CORRECT`: Benar = 1, Salah = 0, Kosong = 0. Maksimum skor per butir soal = 1 poin.
  - `WEIGHTED`: Nilai sesuai bobot opsi A–E (integer 0–5) dari snapshot `room_questions.weights`. Kosong = 0 poin. Maksimum skor per butir soal = bobot tertinggi di antara opsi A–E. Tidak memaksakan label benar/salah.
  - Total skor dan skor maksimum dijumlahkan secara server-side dari snapshot soal dan jawaban yang commit.
  - Tidak ada klaim standar passing grade atau kelulusan CPNS (tertera disclaimer transparan).
- **Alur & Otorisasi Submit Atomik:**
  - Endpoint `POST /api/attempts/:id/submit` menerima `idempotencyKey` UUID.
  - Penguncian atomik `SELECT FOR UPDATE` pada baris attempt menyerialkan pengerjaan. Pengiriman ulang dengan kunci sama bersifat idempoten (respons 200 dengan skor dan `submittedAt` yang sama).
  - Mengubah status attempt menjadi `SUBMITTED`, mengunci pengerjaan, dan menolak mutasi jawaban berikutnya dengan kode 400 `ATTEMPT_FINALIZED`.
- **Modal Konfirmasi UI (`QuizView`):**
  - Tombol *Selesai & Kumpulkan* membuka dialog konfirmasi yang menampilkan hitungan jujur jumlah soal terjawab vs belum dijawab (kosong).
  - Menahan aksi submit saat mutasi jawaban berstatus *Menyimpan...* agar jawaban tidak hilang secara diam-diam.
  - Menampilkan peringatan jika terdapat mutasi yang gagal.
- **Halaman Hasil & Review Pembahasan (`/rooms/:id/result` & API `GET /api/attempts/:id/result`):**
  - Otorisasi ketat: Peserta dengan attempt yang masih `ACTIVE` ditolak 403 / diarahkan kembali ke kuis (mencegah pembocoran kunci/pembahasan sebelum submit).
  - Peserta lain tidak dapat membaca hasil attempt berbeda (403 `FORBIDDEN`).
  - Halaman hasil menampilkan ringkasan skor/maksimum, rincian benar/salah/kosong atau perolehan bobot opsi, kunci jawaban, dan pembahasan (jika kosong, ditampilkan jujur *"Tidak ada pembahasan untuk soal ini."*).
  - Desain ramah keyboard dan mobile responsive tanpa overflow horizontal.

Verifikasi akhir:
- **PASS**: 13/13 parser tests deterministik.
- **PASS**: 5/5 Playwright E2E tests khusus tiket 07 (`tests/e2e/submit-result.spec.ts`):
  1. Modal konfirmasi submit menampilkan hitungan kosong & submit menghasilkan skor single correct yang akurat.
  2. Formula scoring soal berbobot (WEIGHTED / TKP) menghitung bobot opsi tanpa memaksakan benar/salah.
  3. Submit idempoten dan mengunci pengerjaan (mutasi jawaban setelah submit ditolak dengan `ATTEMPT_FINALIZED`).
  4. Peserta aktif tidak dapat melihat hasil/kunci sebelum submit dan peserta lain ditolak (AC13, AC21).
  5. Responsivitas mobile dan tampilan bersih di viewport kecil (AC17).
- **PASS**: Next.js production build (`next build`).
- **PASS**: TypeScript compilation check (`tsc --noEmit --incremental false`).
- **PASS**: ESLint linting (`eslint .` 0 errors, 0 warnings).

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: Formula scoring SINGLE_CORRECT (Benar 1, Salah/Kosong 0) dan WEIGHTED (sesuai bobot opsi 0–5 tanpa memaksakan benar/salah), alur submit dengan modal konfirmasi jumlah kosong, penguncian atomik idempoten, dan penyembunyian kunci/hasil bagi peserta aktif.

## Acceptance criteria

- [x] Konfirmasi selesai menyebut jumlah kosong dan status jawaban pending; pilihan tidak diam-diam dianggap tersimpan.
- [x] Submit idempoten mengunci pengerjaan serta menghitung skor di server dari soal versi sesi dan jawaban yang telah tersimpan.
- [x] Race save/submit menghasilkan hasil sesuai urutan transaksi yang jelas; tidak ada perubahan jawaban setelah final.
- [x] TIU/TWK atau tipe satu-kunci menampilkan benar/salah/kosong sesuai formula; tipe berbobot menampilkan skor opsi dan jumlah kosong tanpa memaksakan benar/salah.
- [x] Result dan pembahasan langsung tersedia kepada pemilik pengerjaan final, bukan kepada peserta aktif atau orang lain lewat tebakan ID.
- [x] Jawaban, bobot, total dan maksimum skor dapat ditelusuri ke data soal yang dikerjakan; pembahasan kosong ditampilkan jujur.
- [x] Halaman hasil tetap nyaman dibaca di mobile dan keyboard; tidak menyatakan lulus CPNS.

## Pengujian dan demo

E2E submit dengan benar/salah/kosong dan soal berbobot → review; double submit; race save/submit; uji akses Result orang lain. Tambah uji formula terisolasi untuk variasi bobot.

**Cakupan spesifikasi:** AC13, AC14, AC17; fondasi finalisasi AC12.

## Batas cakupan

Tanpa menunggu seluruh peserta selesai sebelum membuka pembahasan; risiko pembocoran jawaban tetap didokumentasikan.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.
