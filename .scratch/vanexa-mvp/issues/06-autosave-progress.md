# 06: Autosave jawaban dan pulihkan progres setelah refresh

**What to build:** Peserta memilih jawaban dan memperoleh status penyimpanan nyata; refresh memulihkan jawaban yang sudah diakui server tanpa membuat peserta baru.

**Blocked by:** 05: Start serentak via WebSocket dan navigasi kuis mandiri

**Status:** DONE

## Catatan eksekusi

Selesai 2026-11-21. Keputusan pengguna:
- **Model Penyimpanan & Siklus Hidup:** Tabel `attempts` (`ACTIVE` | `SUBMITTED` | `EXPIRED`) dan `answers` (`A`–`E` / null, `revision`, `last_mutation_id`, `accepted_at`) dimigrasikan via `db/migrations/006_attempts_answers.sql`. Attempt dibuat/diambil otomatis (`getOrCreateAttempt`) saat pengerjaan dibuka pertama kali di room `RUNNING`.
- **Kontrak Mutasi Idempoten & Deadline Guard:** Endpoint `PUT /api/attempts/:id/answers/:questionId` menerima `{ choice, mutationId, expectedRevision }`. Serialisasi per attempt (`SELECT FOR UPDATE`) dan `SELECT rooms FOR SHARE` memeriksa `now() < deadline_at` dan status `RUNNING`. Pengubahan jam browser lokal tidak dapat memperpanjang batas waktu. Pengiriman ulang dengan `mutationId` yang sama bersifat idempoten (respons 200 dengan versi sama). Pengiriman dengan revisi usang ditolak dengan kode 409 (`REVISION_CONFLICT`) untuk mencegah mutasi lama menimpa pilihan yang lebih baru.
- **Otorisasi Ketat:** Memverifikasi kepemilikan Attempt terhadap token cookie HttpOnly (`vanexa_guest_${roomId}`) atau sesi Host. Upaya baca/tulis ke attempt milik peserta lain ditolak dengan kode 403 `FORBIDDEN`.
- **Antrean Klien & Antarmuka:** Klien mengimplementasikan antrean serial per nomor soal sehingga mutasi pilihan berikutnya membawa expectedRevision terbaru. Status UI membedakan secara visual: Menyimpan (🔄), Tersimpan (✅), dan Gagal menyimpan (⚠️ dengan tombol Coba Lagi). Indikator nomor di sidebar dan counter soal terjawab secara ketat mengikuti jawaban efektif yang telah diakui server.
- **Pemulihan Progres & Refresh:** Refresh memuat jawaban tersimpan dari database dan merestorasi nomor soal aktif via `sessionStorage` tanpa membuat peserta baru di tabel `participants`.

Verifikasi akhir:
- **PASS**: 13/13 parser tests deterministik.
- **PASS**: 39/39 Playwright E2E tests pada Chromium dengan database PostgreSQL nyata (`vanexa_test`), termasuk 5 skenario baru tiket 06 (`tests/e2e/autosave-progress.spec.ts`):
  1. Pilih jawaban -> acknowledgement server -> refresh memulihkan jawaban dan navigasi aktif tanpa membuat peserta baru.
  2. Idempotensi retry mutation dan proteksi konflik revisi (AC09).
  3. Pemeriksaan deadline server atomik & penolakan jawaban pada/setelah deadline (AC10).
  4. Isolasi data antar peserta (penolakan 403 untuk akses baca/tulis lintas peserta).
  5. Penanganan gangguan jaringan (status failed/pending) dan pemulihan sukses saat retry.
- **PASS**: Next.js production build (`next build`).
- **PASS**: TypeScript compilation check (`tsc --noEmit --incremental false`).
- **PASS**: ESLint linting (`eslint .` 0 errors, 0 warnings).

## Prasyarat keputusan

Disetujui pengguna pada 2026-11-21: Kontrak mutasi idempoten `PUT /api/attempts/:id/answers/:questionId`, antrean serial per soal, status transparan 3 tahap (menyimpan, tersimpan, gagal), penolakan deadline server atomik, dan pemulihan via identitas cookie guest tiket 04.

## Acceptance criteria

- [x] Setiap jawaban memiliki satu rekaman efektif per peserta/soal, berotorisasi terhadap membership, question versi sesi, dan waktu server.
- [x] UI membedakan menyimpan, tersimpan, dan gagal; indikator soal sesuai jawaban efektif, bukan sekadar klik terakhir yang belum diakui.
- [x] Retry mutation yang sama memberi hasil konsisten; request jawaban lama tidak menimpa pilihan yang lebih baru.
- [x] Refresh memuat jawaban tersimpan dan nomor/progres yang relevan; peserta tidak dibuat ulang.
- [x] Jawaban pada/setelah deadline ditolak meski jam browser diubah; deadline diperiksa saat transaksi commit/serialisasi yang menentukan penerimaan.
- [x] Gangguan jaringan mempertahankan penanda pending; retry tidak menjanjikan penyimpanan jika waktu sudah lewat.
- [x] Satu peserta tidak dapat membaca atau menulis jawaban peserta lain; validasi pilihan dan status sesi berlaku di server.

## Pengujian dan demo

E2E pilih → acknowledgement → refresh; simulasi retry, request terbalik, offline/online, perubahan jam browser, dan request lintas peserta.

**Cakupan spesifikasi:** AC08, AC09, AC10 (jawaban), AC17.

## Batas cakupan

Tidak menjamin jawaban offline yang tiba setelah deadline diterima; tidak menambahkan sinkronisasi lintas perangkat tanpa kebutuhan.

## Penyelesaian

- [x] Implementasi mencakup perilaku pengguna, API/otorisasi, penyimpanan/migrasi yang diperlukan, dan pengujian perilaku relevan.
- [x] Lint, typecheck, build, dan pengujian yang relevan dilaporkan dengan hasil nyata; pemeriksaan yang tidak dijalankan disebutkan.
- [x] Keputusan yang disepakati dan kontrak terkait diperbarui; tidak ada secret dalam source/log. Tidak membuat ADR kecuali memenuhi kriteria domain-modeling.
