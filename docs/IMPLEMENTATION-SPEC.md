# Vanexa — Implementation Spec MVP

Status: draf untuk review, belum persetujuan implementasi fitur. Dokumen ini memperinci MVP-SPEC dan berpasangan dengan CONTENT-SPEC. Pilihan teknis yang belum dijawab dalam wawancara diberi label **Usulan**. Tidak ada API, database, autentikasi, atau realtime produk yang sudah diimplementasikan.

## 1. Keputusan final

1. Latihan informal kelompok belajar, tiga kategori TIU/TWK/TKP, soal berasal dari impor host.
2. Room publik; host berakun; peserta boleh guest dengan nickname. Hanya host memulai. Tidak ada join baru setelah mulai; reconnect peserta lama tetap perlu didukung.
3. Mulai bersamaan, navigasi mandiri, urutan soal/opsi sama. Waktu dan deadline ditentukan server.
4. Host terputus sebelum mulai: tunggu lalu tutup otomatis; durasi belum ditetapkan. Setelah mulai: kuis tetap berjalan.
5. Tidak ada batas peserta yang diatur host. Ini bukan jaminan kapasitas infrastruktur tanpa batas.
6. Question Bank milik host dapat dipakai ulang. Guest tidak mengelola soal.
7. PDF teks, template tetap, preview/edit sebelum konfirmasi, invalid harus diperbaiki/dibuang, tidak menebak isi. OCR di luar MVP.
8. Skor berdasarkan kunci atau bobot dalam soal, tanpa klaim standar resmi CPNS.
9. Hasil/pembahasan langsung setelah peserta selesai; leaderboard nickname dan skor. Kebocoran jawaban ke peserta lain adalah risiko yang sudah dijelaskan.
10. Next.js, PostgreSQL, dan WebSocket dipilih. Seam utama pengujian adalah E2E bank soal → room → multiplayer → hasil.

## 2. Kondisi repository

Tersedia scaffold Next.js 16.2.4, React 19.2.4, TypeScript, Tailwind CSS, dan ESLint; package-lock tersedia setelah pengguna melaporkan download dependency. Kehadiran lockfile tidak membuktikan build/runtime berhasil. Belum ada kode produk, skema database, atau suite pengujian. Sebelum implementasi, ikuti panduan Next.js lokal yang sesuai versi terpasang. PostgreSQL, penyedia auth, dan hosting belum dikonfigurasi.

## 3. Scope dan prioritas

| Prioritas | Cakupan |
| --- | --- |
| Must Have | Kategori/room publik, login host, guest, bank milik host, impor/preview/edit/konfirmasi PDF, lobby, start host, jawaban autosave, timer server, reconnect, submit/deadline, skor dan hasil, leaderboard, otorisasi serta validasi |
| Should Have | Peringatan duplikat, unduhan template PDF yang sudah diuji round-trip, pagination room/bank, observabilitas dasar dan mekanisme penanganan room publik bermasalah |
| Future | OCR, room privat, multi-instance realtime bila kapasitas menuntut, konten kaya/gambar sesuai kebutuhan |
| Di luar produk awal | Pembayaran, LMS, AI generation, gamifikasi besar, sertifikasi hasil/anti-cheat kuat |

## 4. Arsitektur yang diusulkan

**Usulan, belum final:** satu repository TypeScript, Next.js App Router untuk UI dan HTTP API; layanan Node persisten untuk WebSocket dan pemrosesan deadline; PostgreSQL sebagai sumber kebenaran. Keduanya memakai domain service dan kontrak yang sama. Tidak perlu microservices atau Redis untuk tahap satu instance realtime.

WebSocket menyebarkan perubahan lobby/start/status; mutasi penting dapat memakai HTTP idempoten. Ini menjaga retry jawaban tetap sederhana. Satu pemilik proses bertugas menyiarkan perubahan setelah commit. Jika proses HTTP berbeda dari realtime, gunakan outbox PostgreSQL yang dibaca layanan realtime; bila satu proses, publikasi setelah commit plus resync dari database cukup untuk MVP. Pilih salah satu topologi sebelum menulis kode; jangan membangun keduanya.

Deployment harus mendukung koneksi persisten dan worker deadline. Hosting Next.js saja tidak otomatis menyediakan layanan WebSocket. Multi-instance membutuhkan fanout lintas instance; itu bukan persyaratan awal. ORM, library WebSocket, parser PDF, metode autentikasi, dan hosting belum dipilih. Proposal ini tidak menetapkan vendor atau biaya.

## 5. Model domain dan data yang diusulkan

| Entitas | Data/relasi utama dan invariant |
| --- | --- |
| Host account | ID stabil dan identitas auth; kredensial mengikuti metode auth yang dipilih |
| Category | Kode TIU/TWK/TKP, nama; referensi kategori konsisten |
| Question Bank | ID, owner, kategori, nama, versi, waktu perubahan; hanya owner membaca kunci/mengedit |
| Question | Bank, urutan sumber, prompt, lima opsi, jenis skor, kunci atau bobot, pembahasan, fingerprint; aturan tipe skor konsisten |
| Import Draft | Owner, metadata file, status ekstraksi, baris soal/validasi, revision; belum menjadi bank aktif sampai konfirmasi |
| Room | Host, nama, kategori, bank asal, snapshot versi soal, durasi, status, version, startedAt/deadlineAt, hostLastSeen |
| Quiz Session | Satu periode pengerjaan per Room untuk MVP; dapat diwujudkan sebagai kolom Room tanpa tabel baru |
| Participant | Room, identitas sesi, nickname, presence; nickname bukan bukti identitas atau otorisasi |
| Attempt | Participant dan Session, status, submittedAt, finalScore; unik per participant/session |
| Answer | Attempt, snapshot Question, pilihan A–E atau kosong, revision, acceptedAt; unik per attempt/question |
| Result | Ringkasan Attempt yang difinalisasi; tidak menerima skor dari klien |
| Leaderboard | Proyeksi Result; tidak perlu tabel tersendiri |

**Usulan snapshot:** bekukan soal dan skornya saat Room dibuat. Ini pernah direkomendasikan dalam wawancara tetapi belum dijawab pengguna; pernyataan final di draf lama perlu dianggap usulan. Jangan mengubah soal sesi berjalan lewat edit bank. Perubahan bank tidak memengaruhi hasil lama. DDL final mengikuti persetujuan ini.

Guest: **usulan** token acak tak dapat ditebak dalam cookie HttpOnly/Secure sesuai lingkungan, hash token di server. Identitas tidak bergantung socket ID atau nickname. Refresh/reconnect memulihkan Attempt; kehilangan cookie tidak otomatis dipulihkan lewat nickname. Tolak akses hasil Attempt orang lain. Kebijakan nickname sama dan host ikut mengerjakan belum diputuskan.

## 6. Lifecycle dan konsistensi

**Usulan state:** Room LOBBY → RUNNING → FINISHED; LOBBY → CLOSED karena host tidak kembali. Attempt ACTIVE → SUBMITTED atau EXPIRED. Status Room tidak mengikuti peserta yang selesai paling awal.

- Create Room hanya jika bank dimiliki host, kategori cocok, soal valid tidak kosong, dan durasi valid.
- Join dan start diserialisasi pada Room yang sama. Join hanya menghasilkan Attempt jika transaksi melihat LOBBY. Start ulang mengembalikan sesi yang sama, tidak mengganti waktu.
- Start menyimpan startedAt/deadlineAt sekali dalam transaksi; hanya kemudian broadcast. Klien yang melewatkan event memperoleh state dari snapshot.
- Jawaban diterima hanya saat Attempt aktif dan waktu server lebih kecil dari deadlineAt. Saat sama dengan deadline, tolak. Periksa di transaksi yang menyimpan jawaban, bukan hanya middleware.
- Autosave mengirim mutationId dan expectedRevision. Retry mutation yang sama memberi hasil sama; konflik revision mengembalikan versi server. Klien menserialisasi antrean per soal sehingga retry jawaban lama tidak menimpa pilihan lebih baru.
- Submit mengunci Attempt dan menghitung skor dari Answer yang telah commit. Request save yang masih berjalan harus selesai atau dibatalkan sebelum konfirmasi submit; UI menjelaskan jawaban belum tersimpan.
- Worker menyelesaikan Attempt aktif saat deadline, idempoten. Pada restart, cari deadline yang terlewat. Setiap read/write juga mengoreksi state kedaluwarsa; timer worker bukan satu-satunya penjaga batas waktu.
- Internet putus tidak menjeda waktu. Jawaban lokal belum diakui bukan jawaban tersimpan. Kiriman setelah deadline ditolak meski klien mengaku memilih sebelum deadline.
- Host presence memakai heartbeat dan grace period, bukan langsung menutup saat socket putus. Deadline grace disimpan; restart tidak menghapusnya. Nilai durasinya belum ditetapkan.

## 7. Scoring dan leaderboard

Server menghitung dari snapshot, tidak menerima score/key dari klien. Soal kosong dicatat terpisah. Skor SINGLE_CORRECT dan batas bobot masih menunggu keputusan sebagaimana Content Spec. Maximum score adalah penjumlahan skor maksimum tiap soal.

**Usulan seri:** total sama memperoleh peringkat sama, misalnya 1, 1, 3. Urutan tampilan stabil memakai ID, bukan kecepatan. Penggunaan kecepatan sebagai tie-break belum disetujui.

**Usulan leaderboard:** hanya Attempt final yang mendapat skor/peringkat; Attempt aktif ditandai “Mengerjakan”, tanpa membocorkan jawaban atau skor parsial. Selama sesi berlangsung peringkat bersifat sementara. Setelah deadline seluruh Attempt difinalisasi dan peringkat final. Review jawaban milik peserta baru tersedia ketika Attempt-nya final, meskipun peserta lain sudah selesai. Jawaban/kunci tidak dikirim dalam payload pengerjaan.

## 8. Kontrak HTTP usulan

Semua mutasi memeriksa identitas, ownership/membership, validasi input, serta perlindungan CSRF sesuai metode auth. Respons error stabil: code, message, fieldErrors bila perlu, retryable; detail internal tidak dikirim.

| Operasi | Input/hasil utama |
| --- | --- |
| GET /api/categories | Metadata tiga kategori |
| GET /api/rooms?category= | Daftar room publik dengan summary/status, tanpa soal/kunci |
| GET/POST /api/banks | Daftar bank owner / create sesuai alur impor |
| POST /api/imports | PDF dan nama bank; hasil draft atau error terstruktur |
| GET/PATCH /api/imports/:id | Preview/perbaikan soal hanya owner; memakai revision |
| POST /api/imports/:id/confirm | Revision final dan idempotency key; transaksi bank/questions; ulang tidak menggandakan bank |
| GET/PATCH /api/banks/:id | Detail dan edit milik owner, validasi ulang |
| POST /api/rooms | Nama, category, bankId, duration; hasil room LOBBY |
| POST /api/rooms/:id/join | Nickname; buat/pulihkan membership guest; race start harus ditangani |
| GET /api/rooms/:id/state | State sesuai hak akses, serverNow, version; tanpa key/weights untuk peserta aktif |
| POST /api/rooms/:id/start | Host saja, idempoten |
| PUT /api/attempts/:id/answers/:questionId | Choice, mutationId, expectedRevision; hasil revision dan acceptedAt |
| POST /api/attempts/:id/submit | Idempotency key; hasil sendiri bila finalisasi selesai |
| GET /api/attempts/:id/result | Pemilik Attempt; skor/rincian setelah final |
| GET /api/rooms/:id/leaderboard | Nickname, status, skor/rank jika final; aturan akses masih perlu ditetapkan |

Kode penting: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, ROOM_STARTED, ROOM_CLOSED, NO_VALID_QUESTIONS, DEADLINE_PASSED, ATTEMPT_FINALIZED, REVISION_CONFLICT, IMPORT_INVALID, UNSUPPORTED_PDF, RATE_LIMITED. Tetapkan HTTP status 4xx yang konsisten pada implementasi kontrak final.

## 9. Kontrak realtime usulan

Envelope: eventId, type, roomId, roomVersion, occurredAt, payload. Handshake mengotorisasi membership atau host; subscription room tidak dipercaya hanya dari ID klien. Subscribe lalu kirim snapshot versioned; buang event lama, gap version memicu fetch state.

| Event server | Payload minimum |
| --- | --- |
| room.snapshot | Status, serverNow, startedAt/deadlineAt, participants sesuai hak |
| participant.joined | Participant ID dan nickname |
| participant.presence_changed | Participant ID, online/offline; offline tidak menghapus Attempt |
| quiz.started | Session ID, startedAt, deadlineAt |
| room.closed | Reason; untuk lobby terbengkalai |
| leaderboard.updated | Revision/ringkasan atau instruksi refetch |
| quiz.finished | Session ID, finishedAt; hasil diambil lewat API berotorisasi |

Klien reconnect dengan backoff lalu mengambil snapshot otoritatif, tidak memutar ulang perintah start/join secara membabi buta. Heartbeat transport tidak menyimpan jawaban. Timer layar memakai selisih deadline dan estimasi waktu server; tidak membutuhkan broadcast tiap detik.

## 10. Pipeline PDF usulan

Validasi ukuran/MIME/signature → ekstrak teks dengan parser deterministik → parse marker Content Spec → validasi → draft/preview/edit → konfirmasi atomik. Parser library dipilih setelah dicoba pada fixture template nyata; tidak mengandalkan LLM. Hilangnya struktur adalah error, bukan izin mengarang data.

Batasi ukuran berkas, jumlah halaman, jumlah soal, waktu parsing, dan panjang teks; nilai numeriknya masih terbuka. PDF terkunci/rusak/scan, content stream mencurigakan, dan resource limit menghasilkan error terkontrol. Jangan menulis file upload ke direktori publik. File dihapus setelah masa retensi yang harus ditentukan; log tidak memuat seluruh isi soal atau secret.

Konfirmasi wajib revalidasi server terhadap draft revision dan ownership. Semua soal invalid harus diperbaiki atau secara eksplisit dibuang; minimal satu soal valid tersisa. Simpan tepat jumlah soal pada preview final. Duplicate warning tidak otomatis menghapus soal. Editor memperbaiki hasil impor; pembuatan soal manual penuh belum diputuskan.

## 11. Acceptance criteria dan pengujian

Uji perilaku melalui satu seam E2E utama menggunakan host dan minimal dua konteks browser guest. Uji parser/skor terisolasi hanya untuk variasi yang tidak efisien lewat UI. Belum ada pengujian dijalankan untuk dokumen ini.

| ID | Perilaku teramati yang harus lulus |
| --- | --- |
| AC01 | Tiga kategori tampil responsif; daftar room hanya kategori yang dipilih |
| AC02 | Guest dapat masuk dengan nickname; guest tidak bisa membuat room atau membaca bank owner |
| AC03 | PDF valid menghasilkan preview dengan tepat pertanyaan, opsi, kunci/bobot dan jumlah yang diharapkan |
| AC04 | PDF scan/rusak, opsi hilang, kunci invalid atau bobot tidak lengkap memberi error; tidak ada tebakan |
| AC05 | Soal invalid tidak bisa dikonfirmasi; perbaikan/pembuangan mengubah jumlah akhir; retry konfirmasi tidak menggandakan data |
| AC06 | Room tanpa soal valid ditolak; host lain tidak dapat memulai room tersebut |
| AC07 | Dua guest menerima start sesi yang sama; join setelah start ditolak, reconnect lama tetap diterima |
| AC08 | Navigasi mandiri dengan urutan identik; autosave mendapat acknowledgement; refresh memulihkan jawaban yang sudah tersimpan |
| AC09 | Retry request tidak menggandakan Answer; request lama tidak menimpa revision baru; konflik ditangani eksplisit |
| AC10 | Mengubah jam browser tidak memperpanjang deadline; save pada/setelah deadline ditolak oleh server |
| AC11 | Host offline saat running tidak menghentikan kuis; offline di lobby mengikuti grace yang nantinya ditetapkan |
| AC12 | Submit/deadline bersamaan menghasilkan satu Result konsisten; restart worker tetap memfinalisasi deadline terlewat |
| AC13 | Hasil sendiri langsung tersedia setelah submit; peserta aktif tidak menerima kunci melalui state/event atau hasil orang lain |
| AC14 | Skor sesuai snapshot dan formula yang disetujui; kosong dibedakan; TKP berbobot tidak dipaksa benar/salah |
| AC15 | Leaderboard menampilkan nickname/skor dan membedakan peringkat sementara/final; seri mengikuti aturan yang disetujui |
| AC16 | Bila snapshot disetujui, edit bank tidak mengubah room yang sudah dibuat maupun Result lama |
| AC17 | Pengguna keyboard/mobile dapat menjawab, menavigasi, submit, dan membaca error/status tanpa bergantung warna |

## 12. Roadmap implementasi

1. Tutup keputusan blocking di bawah, finalisasi kontrak dan template; sinkronkan glossary/ADR.
2. Konfigurasi database dan migrasi, autentikasi host serta identitas guest; kerangka halaman.
3. Bank soal, parser fixture, preview/edit/konfirmasi atomik.
4. Room publik dan lobby, WebSocket terotorisasi, start atomik, snapshot/resync.
5. Attempt/Answer autosave, deadline worker, reconnect dan finalisasi.
6. Scoring/hasil/leaderboard, uji E2E lengkap dan kegagalan, verifikasi build, deployment percobaan.

Urutan ini tidak menyiratkan fitur telah dibuat atau diuji. Tidak ada tenggat atau biaya hosting yang telah disepakati.

## 13. Keputusan terbuka dan risiko

| Perlu keputusan | Rekomendasi untuk review, bukan keputusan final |
| --- | --- |
| Topologi realtime/hosting | Satu deployment Node persisten bila platform mendukung; pisahkan proses hanya bila diperlukan |
| Auth host | Pilih satu metode sederhana; provider dan pemulihan akun perlu ditetapkan |
| Snapshot room | Bekukan soal saat create; perlu persetujuan karena pertanyaan sebelumnya belum dijawab |
| Skor/seri | Benar 1, salah/kosong 0; bobot eksplisit nonnegatif; peringkat seri bersama |
| Template/import | Teks marker v1 di Content Spec; satu kategori per bank; pembahasan opsional |
| Identitas/presence | Cookie guest; grace host usulan 5 menit; perjelas nickname sama dan host ikut kuis |
| Kapasitas | Tidak ada input max peserta produk; tetapkan hasil load test dan batas operasional yang jujur sebelum publikasi |
| Room publik | Tetapkan penanganan nama/konten bermasalah dan penyalahgunaan pembuatan/join, bukan mengasumsikan room kelompok selalu aman |
| Retensi dan limits | Tetapkan umur draft/file/hasil, limit PDF dan durasi kuis, serta recovery token guest |

Risiko utama: pembocoran jawaban dari hasil awal; koneksi tidak stabil; data parsial/duplikat pada retry; batas deployment WebSocket; parsing PDF ambigu; beban room tanpa batas produk. Mitigasi teknis dan batas operasional harus dibuktikan saat pengujian, bukan dianggap tersedia karena sudah ditulis dalam spesifikasi.
