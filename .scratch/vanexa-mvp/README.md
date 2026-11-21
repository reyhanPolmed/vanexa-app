# Vanexa MVP — Development Tickets

Status: backlog lokal; tiket 01 dan 02 DONE setelah verifikasi. Tiket 03–10 belum diimplementasikan. Tidak ada tiket di tracker eksternal yang dibuat. Label ready-for-agent adalah status antrean, bukan bukti semua keputusan telah disetujui atau semua dependensi sudah selesai.

## Acuan

- [Implementation Spec](../../../docs/IMPLEMENTATION-SPEC.md)
- [Content Spec](../../../docs/CONTENT-SPEC.md)
- [Glossary](../../../GLOSSARY.md)

Jika draf MVP lama bertentangan dengan dokumen lanjutan, gunakan klasifikasi keputusan final/usulan pada Implementation Spec. Khusus snapshot soal, pertanyaan wawancara belum dijawab; jangan perlakukan rekomendasi sebagai persetujuan.

## Daftar tiket

| ID | Tiket | Diblokir oleh |
| --- | --- | --- |
| 01 | [Akun Host dan Question Bank pribadi](issues/01-host-account.md) — **DONE** | Tidak ada; username/password dan akses pg telah diimplementasikan serta diuji |
| 02 | [Upload PDF teks dan preview hasil ekstraksi](issues/02-pdf-preview.md) — **DONE** | 01 (DONE) |
| 03 | [Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang](issues/03-confirm-bank.md) | 02 |
| 04 | [Buat Room publik dan gabung lobby sebagai guest](issues/04-public-room-lobby.md) | 03 |
| 05 | [Start serentak via WebSocket dan navigasi kuis mandiri](issues/05-start-quiz.md) | 04 |
| 06 | [Autosave jawaban dan pulihkan progres setelah refresh](issues/06-autosave-progress.md) | 05 |
| 07 | [Submit pengerjaan dan lihat skor serta pembahasan pribadi](issues/07-submit-result.md) | 06 |
| 08 | [Finalisasi otomatis saat deadline dan pulihkan sesi setelah restart](issues/08-server-deadline.md) | 07 |
| 09 | [Leaderboard room dengan peringkat sementara dan final](issues/09-leaderboard.md) | 07 |
| 10 | [Reconnect realtime dan tutup lobby bila Host tidak kembali](issues/10-reconnect-host-presence.md) | 05 |

## Cara mengerjakan

1. Pilih tiket yang seluruh blocker-nya sudah selesai; nomor bukan perintah untuk mengerjakan semuanya secara linear.
2. Baca prasyarat keputusan sebelum menulis kode. Jika keputusan belum ada, ajukan rekomendasi konkret; jangan memilih arsitektur, skor, atau aturan produk penting secara diam-diam.
3. Kerjakan satu alur pengguna lengkap beserta penyimpanan, otorisasi, dan uji perilaku. Tidak perlu tiket horizontal terpisah untuk UI, API, database, atau testing.
4. Simpan pemeriksaan yang benar-benar dijalankan dan hasilnya. Jangan menandai selesai hanya karena halaman dapat dibuka.
5. Integrasikan lintas cabang: tiket 09 dengan deadline tiket 08, serta tiket 10 dengan progres tiket 06 dan deadline tiket 08.

## Cakupan acceptance criteria

| AC | Tiket |
| --- | --- |
| AC01 | 04 |
| AC02 | 01, 04 |
| AC03–AC04 | 02 |
| AC05 | 03 |
| AC06 | 04, 05 |
| AC07 | 05, 10 |
| AC08 | 06; integrasi 10 |
| AC09 | 06 |
| AC10 | 05, 06, 08 |
| AC11 | 08, 10 |
| AC12 | 08 |
| AC13–AC14 | 07 |
| AC15 | 09; integrasi 08 |
| AC16 | 04, setelah keputusan snapshot |
| AC17 | Semua alur UI yang relevan |

## Gate rilis MVP

Backlog ini memuat seluruh perilaku Must Have, bukan jaminan kesiapan produksi. Sebelum rilis publik:

- Jalankan alur E2E PDF nyata → bank → Room publik → dua guest → start → jawab → submit/deadline → hasil dan leaderboard.
- Buktikan reconnect, retry, race start/join, save/submit, submit/deadline, serta restart worker tidak merusak data.
- Tetapkan dan uji kapasitas operasional; tidak ada input max peserta produk bukan berarti kapasitas infrastruktur tak terbatas.
- Tetapkan hosting WebSocket/worker, secret database/auth, migrasi, backup/restore, batas upload, retensi data, dan penanganan penyalahgunaan Room publik. Verifikasi pada lingkungan deployment percobaan; jangan menganggap build setara deployment.
- Should Have (peringatan duplikat, unduhan PDF template yang diuji round-trip, pagination) dapat dikerjakan sesudah Must Have; bukan blocker tersembunyi kecuali disepakati untuk rilis.

## Tracker

Tujuan kerja saat ini adalah file lokal, satu file per tiket. Integrasi tracker eksternal belum tersedia. Jika nantinya memakai GitHub/Linear, siapkan integrasi melalui setup-matt-pocock-skills yang kompatibel; publikasikan satu issue per tiket dan salin dependensi sebagai hubungan blocking. Jangan memublikasikan atau mengubah issue induk tanpa tujuan tracker yang jelas.

