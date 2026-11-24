# Vanexa — Dokumentasi MVP

**Versi:** 1.0 (draft)  
**Status:** Rancangan awal untuk validasi dan implementasi  
**Produk:** Website latihan soal pilihan ganda dan kuis multiplayer  
**Kategori awal:** TIU, TWK, TKP

## 1. Ringkasan produk

**Vanexa** adalah website latihan soal yang memungkinkan pengguna membuat bank soal pribadi, membuka room sesuai kategori, lalu mengerjakan kuis bersama peserta lain secara **real-time**. Host menyiapkan soal dan memulai kuis; peserta bergabung melalui room dan mengerjakan soal dalam batas waktu yang sama. Setelah sesi berakhir, peserta melihat skor, peringkat, jawaban, dan pembahasan.

**Nilai utama:** sederhana untuk digunakan, menyenangkan secara visual, dan kompetitif tanpa menambah fitur LMS yang tidak dibutuhkan.

**Alur utama:** Home → Pilih kategori (TIU/TWK/TKP) → Buat/gabung room → Lobby → Host mulai → Kerjakan kuis → Hasil bersama → Ulas jawaban.

## 2. Tujuan dan batasan

### Tujuan MVP
1. Host dapat membuat dan mengelola soal pilihan ganda.
2. Host dapat mengimpor soal PDF berbasis teks dengan format yang ditentukan dan memeriksa hasilnya sebelum disimpan.
3. Host dapat membuat room dan memulai sesi kuis untuk beberapa peserta sekaligus.
4. Peserta dapat bergabung, menjawab, dan melanjutkan pengerjaan setelah refresh/reconnect.
5. Sistem menghitung skor di server dan menampilkan hasil serta pembahasan pada waktu yang tepat.

### Bukan sasaran MVP
Pembayaran, AI pembuat soal, OCR PDF hasil scan, sertifikat, chat, avatar, voice/video call, leaderboard global, turnamen, aplikasi mobile native, dan simulasi CAT CPNS resmi.

> **Catatan:** Website ini untuk latihan, bukan layanan resmi pemerintah. Aturan penilaian dapat berubah; konfigurasi skor tidak boleh diklaim sebagai standar ujian resmi tanpa verifikasi.

## 3. Peran dan akses

| Peran | Hak akses utama |
|---|---|
| Pengunjung | Melihat home, kategori, dan room publik yang tersedia. |
| Host | Masuk ke akun, mengelola bank soal sendiri, membuat room, mengundang peserta, dan memulai kuis. |
| Peserta | Bergabung memakai nickname tanpa akun, mengerjakan kuis, melihat hasil sesi sendiri dan peringkat room. |

**Keputusan desain yang diusulkan untuk MVP:** Host memerlukan akun agar kepemilikan bank soal dan room jelas. Peserta cukup menggunakan nickname dan identitas sesi sementara. Metode login host ditentukan saat implementasi sesuai stack.

## 4. Fitur dan halaman MVP

### 4.1 Home (`/`)
- Header dengan logo **vanexa.**
- Hero berisi headline **“Latihan soal, belajar bersama.”** dan tombol **“Kelola soal”** bagi host.
- Tiga kartu kategori: **TIU, TWK, TKP** untuk menuju daftar room.
- Aksi **“Gabung room”** (melalui kode/tautan room) dapat disediakan sebagai jalur cepat.
- Tampilan desktop/mobile responsif.

### 4.2 Daftar room per kategori (`/categories/:category/rooms`)
- Menampilkan room publik dengan nama, kategori, jumlah soal, peserta, dan status.
- Tombol **Buat room** dan **Gabung**.
- Room privat tidak ditampilkan di daftar publik; diakses dengan kode/tautan undangan.

### 4.3 Bank soal (`/question-banks`)
- Host membuat bank soal berdasarkan kategori.
- Tambah/edit/hapus soal pilihan A–E dan pembahasan.
- Pilih soal dari bank untuk dipakai di room. Satu bank dapat digunakan ulang.
- TIU/TWK menggunakan satu kunci jawaban; TKP mendukung bobot untuk setiap opsi.

### 4.4 Impor soal PDF (`/question-banks/:id/import`)
1. Host mengunggah **PDF berbasis teks** yang mengikuti template standar.
2. Server memvalidasi tipe/ukuran file dan mengekstrak teks.
3. Parser membaca blok soal dan melaporkan baris/soal yang tidak valid.
4. Host melihat preview, memperbaiki soal jika perlu, lalu menekan **Konfirmasi impor**.
5. Hanya soal valid yang disimpan secara atomik sesuai pilihan konfirmasi.

**Di luar MVP:** OCR, PDF scan, soal dengan gambar/diagram kompleks, dan impor PDF bebas format.

### 4.5 Buat room (`/rooms/new`)
- Host menetapkan nama, kategori, bank/kumpulan soal, durasi, serta visibilitas publik/privat.
- Sistem menghasilkan ID room dan tautan undangan.
- Room tidak bisa dimulai jika tidak mempunyai soal valid.

### 4.6 Lobby (`/rooms/:id`)
- Menampilkan nama room, kategori, jumlah soal, durasi, status, dan daftar peserta.
- Peserta bergabung memakai nickname, lalu menunggu.
- Hanya host dapat menekan **Mulai kuis**.
- Saat host memulai, server menetapkan `started_at` dan `ends_at`, lalu menyiarkan event; semua peserta aktif berpindah otomatis ke kuis.
- Peserta baru tidak boleh bergabung setelah kuis dimulai (**usulan MVP**).

### 4.7 Pengerjaan kuis (`/rooms/:id/quiz`)
- Pilihan ganda A–E, navigasi nomor soal, penanda sudah/belum terjawab, dan timer.
- Semua peserta memiliki **waktu mulai dan deadline yang sama**, tetapi mengerjakan urutan soal dengan **kecepatan masing-masing**.
- Jawaban tersimpan otomatis melalui server; jawaban terakhir yang valid sebelum submit/deadline menjadi jawaban final.
- Refresh/reconnect memuat jawaban tersimpan dan deadline dari server.
- Peserta dapat menekan **Selesai** sebelum deadline; jawaban dikunci setelah submit.
- Kunci jawaban dan bobot skor tidak dikirim ke peserta selama pengerjaan.

### 4.8 Hasil (`/rooms/:id/results`)
- Ketika semua peserta telah submit **atau** deadline terlewati, sesi difinalisasi di server.
- Menampilkan skor, status penyelesaian, peringkat di room, serta ringkasan jawaban.
- Review soal menampilkan jawaban peserta, jawaban benar (TIU/TWK) atau bobot tiap opsi (TKP), dan pembahasan.
- Peserta yang submit lebih awal melihat layar **“Menunggu peserta lain”** hingga hasil dibuka bersama.
- Untuk skor seri, urutan menggunakan waktu submit lebih awal sebagai **usulan**; dapat disesuaikan dalam spesifikasi final.

## 5. Aturan kuis dan penilaian

| Kategori | Bentuk soal | Penilaian awal untuk MVP |
|---|---|---|
| TIU | Satu jawaban benar dari A–E | Benar = 1, lainnya = 0. |
| TWK | Satu jawaban benar dari A–E | Benar = 1, lainnya = 0. |
| TKP | Setiap opsi A–E memiliki bobot | Skor mengikuti bobot masing-masing opsi, misalnya 1–5. |

Skor merupakan **konfigurasi internal latihan**, bukan otomatis nilai SKD resmi. Skor total dihitung di server setelah submit/finalisasi. Pertanyaan tanpa jawaban bernilai 0, kecuali spesifikasi yang disepakati menyatakan lain. Leaderboard menggunakan skor total, sehingga perbandingan hanya berlaku di dalam sesi yang sama.

## 6. Status dan siklus room

```text
WAITING ──(host mulai)──> PLAYING ──(semua submit / deadline)──> FINISHED
```

- **WAITING:** Host dapat menyiapkan room; peserta bisa bergabung.
- **PLAYING:** Soal dibekukan untuk sesi, peserta yang sudah terdaftar mengerjakan, waktu berjalan di server.
- **FINISHED:** Skor dihitung, leaderboard dan pembahasan dibuka; jawaban tidak bisa diubah.
- Untuk MVP, **satu room = satu sesi kuis**. Penggunaan ulang room dapat ditambahkan nanti; bank soal tetap reusable.
- Jika host terputus setelah kuis dimulai, sesi tetap berjalan hingga selesai.

## 7. Kontrak format PDF awal

Gunakan file PDF **berbasis teks** hasil ekspor dokumen yang berisi blok dengan penanda eksplisit. Parser membaca setiap blok `[QUESTION] ... [/QUESTION]`. Contoh isi dokumen sebelum diekspor ke PDF:

```text
[QUESTION]
CATEGORY: TWK
TYPE: SINGLE_CHOICE
TEXT: Apa dasar negara Indonesia?
A: UUD 1945
B: Pancasila
C: Bhinneka Tunggal Ika
D: NKRI
E: Sumpah Pemuda
ANSWER: B
EXPLANATION: Pancasila merupakan dasar negara Indonesia.
[/QUESTION]

[QUESTION]
CATEGORY: TKP
TYPE: WEIGHTED_CHOICE
TEXT: Apa yang Anda lakukan saat rekan kerja membutuhkan bantuan?
A: Membantu setelah tugas selesai | SCORE: 4
B: Mengabaikannya | SCORE: 1
C: Mengajak mengatur prioritas bersama | SCORE: 5
D: Menyerahkan ke orang lain | SCORE: 2
E: Menunggu instruksi | SCORE: 3
EXPLANATION: Penilaian mempertimbangkan kerja sama dan prioritas tugas.
[/QUESTION]
```

**Validasi minimum:** kategori sesuai bank/room; `TYPE` valid; opsi A–E lengkap dan unik secara label; `ANSWER` menunjuk opsi yang ada untuk `SINGLE_CHOICE`; setiap opsi memiliki `SCORE` valid untuk `WEIGHTED_CHOICE`; pertanyaan tidak kosong; pembahasan diisi; blok tidak duplikat; jumlah soal terbaca. Parsing harus memiliki preview dan pesan error per soal. Nilai dan rentang bobot dikonfigurasi; contoh di atas bukan standar resmi.

> Contoh konten di atas dibuat hanya untuk menunjukkan format teknis. Template final perlu diuji terhadap PDF ekspor Word/Google Docs karena pemotongan baris dan karakter dapat memengaruhi parsing.

## 8. Model data minimal (konseptual)

| Entitas | Informasi kunci |
|---|---|
| `User` | ID host, identitas login. |
| `QuestionBank` | ID, pemilik, kategori, nama. |
| `Question` | ID, bank, tipe, teks, pembahasan, urutan. |
| `QuestionOption` | ID, question, label A–E, teks, `is_correct` atau `score`. |
| `Room` | ID/kode, host, kategori, nama, visibilitas, durasi, status. |
| `RoomQuestion` | Room, question, nomor/urutan snapshot. |
| `Participant` | ID, room, nickname, token sesi. |
| `QuizSession` | ID, room, `started_at`, `ends_at`, status finalisasi. |
| `Answer` | Session, participant, question, option, waktu simpan. |
| `Result` | Session, participant, skor, waktu submit, peringkat. |

**Integritas:** satu jawaban aktif per peserta per soal per sesi; satu hasil final per peserta; indeks unik pada kode room; izin pengelolaan bank/room hanya untuk pemilik. Kumpulan soal yang dipakai sesi harus **dibekukan/snapshot** sehingga perubahan bank soal tidak mengubah kuis aktif atau hasil historis.

## 9. Realtime dan keamanan

- **Server sebagai sumber kebenaran** untuk status room, hak host, waktu, penguncian jawaban, finalisasi, dan skor.
- Realtime digunakan untuk **peserta bergabung/keluar, host mulai, perubahan status room, dan hasil tersedia**. Penyimpanan jawaban tetap melalui API/server yang dapat dipanggil ulang secara aman.
- Start dan finalize harus idempoten: dua request bersamaan tidak membuat dua sesi atau dua hasil.
- Token peserta tidak boleh dipakai untuk mengubah jawaban orang lain.
- Soal boleh diterima client selama PLAYING, tetapi kunci/bobot dan penilaian tidak dikirim hingga FINISHED.
- Validasi input, ukuran PDF, dan pembatasan request dilakukan di server. Upload tidak dieksekusi sebagai kode.
- Jika realtime terputus, client melakukan reconnect dan sinkronisasi ulang dari server.

## 10. Arah UI/UX

Mengikuti konsep landing page yang telah disepakati: **cute, feminine, tetapi tidak norak**.

- Visual: krem/putih hangat, lilac/lavender, blush pink sebagai aksen; teks ungu gelap agar terbaca.
- Hero: logo `vanexa.`, badge “Latihan Pengetahuan Bersama”, headline besar, deskripsi ringkas, tombol **Kelola soal**, ilustrasi belajar yang lembut di sisi kanan.
- Kartu kategori TIU/TWK/TKP di bawah hero; navigasi kategori tetap mudah ditemukan.
- Komponen: radius rounded, whitespace lega, bayangan sangat tipis, sedikit elemen dekoratif.
- Quiz page lebih tenang daripada landing page: dekorasi minimal, fokus teks soal, kontras aksesibel.
- Seluruh halaman memiliki loading, empty, error, dan success state yang sesuai; dukung mobile.

## 11. Acceptance criteria tingkat produk

- [ ] Pengunjung dapat memilih TIU, TWK, atau TKP dan menemukan room publik sesuai kategori.
- [ ] Host dapat membuat bank soal dan minimal satu soal valid dengan opsi A–E.
- [ ] Host dapat mengimpor PDF template, melihat preview/error, dan mengonfirmasi soal valid.
- [ ] Host dapat membuat room berisi soal, lalu membagikan tautannya.
- [ ] Minimal dua peserta berbeda dapat masuk lobby dan melihat satu sama lain.
- [ ] Satu klik **Mulai kuis** oleh host memulai satu sesi dengan deadline sama untuk semua peserta.
- [ ] Jawaban peserta tersimpan, termasuk setelah refresh/reconnect.
- [ ] Peserta tidak dapat memperoleh kunci/bobot sebelum hasil dibuka.
- [ ] Submit ganda dan pemanggilan start berulang tidak menggandakan data.
- [ ] Kuis difinalisasi jika semua submit atau deadline tercapai.
- [ ] Skor TIU/TWK dan TKP dihitung sesuai tipe soal; hasil dapat ditinjau dan konsisten.
- [ ] Tampilan inti dapat digunakan pada desktop dan ponsel.

## 12. Tahap pengembangan yang disarankan

**Milestone 1 — Fondasi & Soal Manual**  
Setup proyek, autentikasi host, kategori, bank soal, CRUD soal, create room, lobby dasar.

**Milestone 2 — Multiplayer & Hasil**  
Sesi kuis, event realtime, timer server, answer autosave, reconnect, finalisasi, scoring, leaderboard, pembahasan.

**Milestone 3 — Impor PDF & Polishing**  
Template PDF, ekstraksi, parser, validasi, preview/repair, konfirmasi impor, pengujian end-to-end, responsivitas.

Urutan ini memungkinkan alur multiplayer diuji menggunakan soal manual sebelum fitur PDF selesai.

## 13. Keputusan yang masih perlu dikonfirmasi

1. **Login host:** email/password, magic link, atau OAuth?
2. **Visibilitas room:** publik + privat sejak MVP, atau privat saja dahulu?
3. **Peserta baru:** larangan masuk setelah START (usulan), atau boleh join terlambat?
4. **Leaderboard tie-break:** waktu submit atau peringkat bersama?
5. **Rentang skor:** konfigurasi per kategori dan apakah ada mode penilaian menyerupai CPNS resmi?
6. **Bank soal:** room memilih seluruh bank atau subset soal?
7. **PDF:** batas ukuran/jumlah soal per file serta dukungan karakter/tabel matematika?

Hal-hal di atas adalah **usulan**, bukan keputusan final pengguna. Setelah dikonfirmasi, dokumentasi ini dapat dijadikan sumber untuk `/to-spec`, `/to-tickets`, dan `/implement`.
