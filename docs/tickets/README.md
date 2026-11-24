# Development tickets Vanexa

Tiket kanonis tetap berada pada backlog lokal yang dibuat melalui skill to-tickets. Indeks ini menjadi pintu masuk workflow implementasi tanpa menggandakan isi tiket.

- [Indeks lengkap dan dependensi](../../.scratch/vanexa-mvp/README.md)
- [01: Akun Host dan Question Bank pribadi](../../.scratch/vanexa-mvp/issues/01-host-account.md) — **DONE**: username/password, session PostgreSQL, bank owner, migrasi dan CLI akun; 8 E2E, lint, typecheck, dan production build PASS.
- [02: Upload PDF teks dan preview hasil ekstraksi](../../.scratch/vanexa-mvp/issues/02-pdf-preview.md) — **DONE**: draft privat, template v1, validasi, resource limits, dan preview tanpa konfirmasi bank; 13 tes parser, 15 E2E keseluruhan, lint, typecheck, dan production build PASS.
- [03: Perbaiki preview dan simpan Question Bank](../../.scratch/vanexa-mvp/issues/03-confirm-bank.md) — **DONE**: editor, discard/restore, warning duplikat, review jumlah final, konfirmasi atomik/idempoten, dan koreksi bank owner dengan revision check; 13 tes parser, 24 E2E keseluruhan, lint, typecheck, dan build PASS.

- [04: Buat Room publik dan gabung lobby sebagai guest](../../.scratch/vanexa-mvp/issues/04-public-room-lobby.md) — **DONE**: snapshot soal, guest identity via cookie token, room list per kategori, room creation, lobby summary & participants, duplicate nickname support; 13 tes parser, 31 E2E keseluruhan, lint, typecheck, dan build PASS.
- [05: Start serentak via WebSocket dan navigasi kuis mandiri](../../.scratch/vanexa-mvp/issues/05-start-quiz.md) — **DONE**: server WS mandiri + PG LISTEN/NOTIFY, otorisasi cookie handshake, broadcast start serentak, navigasi kuis mandiri, timer server, proteksi payload kunci/bobot; 13 tes parser, 34 E2E keseluruhan, lint, typecheck, dan build PASS.

- [06: Autosave jawaban dan pulihkan progres setelah refresh](../../.scratch/vanexa-mvp/issues/06-autosave-progress.md) — **DONE**: jawaban idempoten, konflik revision, antrean mutasi, dan pemulihan progres.
- [07: Submit pengerjaan dan lihat hasil pribadi](../../.scratch/vanexa-mvp/issues/07-submit-result.md) — **DONE**: submit idempoten, scoring server, pembahasan pribadi, proteksi hasil.
- [08: Deadline server dan restart recovery](../../.scratch/vanexa-mvp/issues/08-server-deadline.md) — **DONE**: worker persisten, finalisasi peserta offline/belum membuka kuis, lock Room → Attempt, penolakan jawaban terlambat, recovery tanpa browser.
- [09: Leaderboard Room](../../.scratch/vanexa-mvp/issues/09-leaderboard.md) — **DONE**: akses anggota/Host, rank seri 1,1,3, peserta aktif tanpa skor parsial, invalidasi realtime, label sementara/final.
- [10: Reconnect dan Host presence](../../.scratch/vanexa-mvp/issues/10-reconnect-host-presence.md) — **DONE**: snapshot/version, retry/backoff, multi-tab lease, grace Host 5 menit tahan restart, penutupan lobby dan alasan.

Verifikasi gabungan 08–10: 13/13 parser PASS; regresi penuh 49/50 PASS (satu error fixture recovery), lalu koreksi dan 7/7 uji terarah PASS. Build akhir, lint dan typecheck PASS. Tidak ada klaim seluruh suite dijalankan ulang setelah koreksi.

Tiket 01–10 selesai. Langkah berikutnya: gate rilis pada indeks backlog—deployment percobaan dengan proses WS/worker persisten, kapasitas operasional dan backup/restore. Rilis publik belum diverifikasi.
