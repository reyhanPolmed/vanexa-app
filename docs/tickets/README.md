# Development tickets Vanexa

Tiket kanonis tetap berada pada backlog lokal yang dibuat melalui skill to-tickets. Indeks ini menjadi pintu masuk workflow implementasi tanpa menggandakan isi tiket.

- [Indeks lengkap dan dependensi](../../.scratch/vanexa-mvp/README.md)
- [01: Akun Host dan Question Bank pribadi](../../.scratch/vanexa-mvp/issues/01-host-account.md) — **DONE**: username/password, session PostgreSQL, bank owner, migrasi dan CLI akun; 8 E2E, lint, typecheck, dan production build PASS.
- [02: Upload PDF teks dan preview hasil ekstraksi](../../.scratch/vanexa-mvp/issues/02-pdf-preview.md) — **DONE**: draft privat, template v1, validasi, resource limits, dan preview tanpa konfirmasi bank; 13 tes parser, 15 E2E keseluruhan, lint, typecheck, dan production build PASS.

Tiket berikutnya: [03: Perbaiki preview dan simpan Question Bank yang dapat dipakai ulang](../../.scratch/vanexa-mvp/issues/03-confirm-bank.md). Dependensi tiket 02 terpenuhi; perilaku duplikat dan kebijakan edit bank perlu ditetapkan sesuai prasyarat tiket 03. Tiket 03–10 belum dikerjakan.
