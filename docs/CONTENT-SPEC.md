# Vanexa — Content Spec MVP

Status: draf untuk review. Keputusan produk berasal dari wawancara; struktur halaman, microcopy, dan template impor di bawah adalah usulan. Dokumen ini menetapkan konten produk, bukan menyediakan bank soal CPNS bawaan.

## 1. Suara dan batas konten

- Bahasa utama: Indonesia, ringkas, langsung, ramah.
- Pesan utama: “Latihan soal, belajar bersama.” Subteks: “Pilih kategori, masuk room, dan kerjakan soal bersama kelompokmu.”
- Sebut hasil sebagai skor latihan. Hindari klaim kelulusan CPNS, standar resmi, prediksi kelulusan, atau pengawasan ujian.
- Soal berasal dari PDF milik host. Tidak ada bank bawaan atau AI generation pada MVP.
- TIU: Tes Intelegensia Umum; TWK: Tes Wawasan Kebangsaan; TKP: Tes Karakteristik Pribadi.
- Nama room, nickname, pertanyaan, opsi, dan pembahasan dirender sebagai teks; HTML unggahan tidak dieksekusi.

## 2. Peta halaman dan konten

Rute berikut merupakan usulan; perubahan rute tidak mengubah kebutuhan produk.

| Halaman | Konten utama | Aksi dan keadaan |
| --- | --- | --- |
| Home `/` | Identitas Vanexa, pesan utama, tiga card kategori dengan nama lengkap dan deskripsi singkat | “Lihat room”, “Kelola soal”, “Masuk sebagai host” |
| Kategori `/categories/{category}` | Judul kategori; room publik: nama, jumlah soal, peserta, durasi, status | “Gabung room”, “Buat room”; kosong: “Belum ada room yang menunggu peserta.”; error: “Room belum berhasil dimuat. Coba lagi.” |
| Akses host `/auth` | Form masuk dan pendaftaran sesuai metode autentikasi yang nanti dipilih | Pertahankan tujuan pengguna setelah login; guest tidak harus lewat halaman ini |
| Bank soal `/banks` | Daftar bank milik host, kategori, jumlah soal, status kelengkapan | “Impor PDF”, “Lihat soal”, “Gunakan untuk room”; kosong: “Impor PDF untuk membuat bank soal pertama.” |
| Detail bank `/banks/{id}` | Pertanyaan, opsi, jenis skor, kunci/bobot, pembahasan; hanya pemilik | Editor soal hasil impor digabung di sini atau di preview; jangan buat dashboard LMS |
| Preview impor `/imports/{id}` | Nama file, ringkasan valid/invalid/duplikat, daftar soal dan error per field, editor | “Perbaiki”, “Buang soal”, “Konfirmasi impor”; jumlah akhir ditampilkan sebelum simpan |
| Buat room `/rooms/new` | Nama room, kategori, pilihan bank, durasi; keterangan “Room dapat ditemukan semua pengunjung.” | “Buat room”; bank kosong: tautan impor; bank tidak valid menonaktifkan pembuatan |
| Lobby `/rooms/{id}` | Nama room, kategori, jumlah soal, durasi, daftar nickname, status koneksi, formulir nickname untuk guest | “Gabung”, “Mulai kuis” khusus host; “Menunggu host memulai kuis”; peserta baru ditolak setelah mulai |
| Kuis `/rooms/{id}/quiz` | Nomor/total soal, teks, opsi A–E, timer, navigasi nomor, legenda terjawab/belum, status simpan | “Sebelumnya”, “Berikutnya”, “Selesaikan”; konfirmasi selesai menyebut jumlah soal kosong dan jawaban akan dikunci |
| Hasil `/rooms/{id}/result` | Skor sendiri, jumlah kosong, rincian per soal, leaderboard nickname/skor | “Lihat pembahasan”, “Kembali ke kategori”; jelaskan “Peringkat sementara” selama masih ada pengerjaan |

Home dan daftar room tetap sederhana; pengelolaan bank dan impor diletakkan di area host. Lobby, kuis, dan hasil adalah keadaan berbeda dari Room. Tidak perlu halaman terpisah untuk unggah: gunakan entry action dari bank soal.

## 3. Konten interaksi kritis

| Keadaan | Teks yang diusulkan |
| --- | --- |
| Simpan berjalan | “Menyimpan…” |
| Simpan diakui server | “Jawaban tersimpan” |
| Koneksi hilang | “Koneksi terputus. Jawaban yang belum tersimpan ditandai. Menghubungkan kembali…” |
| Kembali terhubung | “Terhubung kembali. Progres telah disinkronkan.” |
| Deadline tiba | “Waktu habis. Hasil dihitung dari jawaban yang tersimpan.” |
| Kiriman terlambat | “Jawaban tidak tersimpan karena waktu sudah habis.” |
| Kuis sudah mulai | “Kuis sudah dimulai. Peserta baru tidak dapat bergabung.” |
| Host offline di lobby | “Host sedang terputus. Menunggu host kembali.” |
| Lobby ditutup | “Room ditutup karena host tidak kembali.” |
| PDF tanpa teks | “PDF ini tidak memiliki teks yang dapat dibaca. Gunakan PDF berbasis teks sesuai template.” |
| PDF rusak/terkunci | “PDF tidak dapat dibaca. Gunakan berkas yang tidak rusak dan tidak dilindungi sandi.” |
| Soal invalid | “Soal {nomor}: {field} belum valid. Perbaiki atau buang soal sebelum impor.” |
| Pembahasan kosong | “Pembahasan belum tersedia.” |

Jangan menampilkan “tersimpan” sebelum pengakuan server. Jangan menyebut semua jawaban gagal jika hanya sebagian gagal. Error tetap mempertahankan input yang aman untuk dicoba ulang.

## 4. Konten soal dan skor

Setiap Question berisi nomor sumber, kategori, teks pertanyaan, tepat lima opsi A–E, jenis skor, data skor, serta pembahasan bila tersedia. Nomor sumber hanya untuk pelacakan impor; identitas internal tidak bergantung pada nomor tersebut.

- SINGLE_CORRECT: satu kunci A–E. Usulan skor awal: benar 1, salah/kosong 0. Angka ini bukan aturan CPNS resmi dan belum disepakati.
- WEIGHTED: bobot eksplisit untuk semua A–E. Usulan: bilangan bulat nonnegatif, kosong 0; rentang maksimum masih perlu disetujui. Tidak menyimpulkan satu jawaban benar dari bobot yang sama.
- TIU/TWK lazim memakai SINGLE_CORRECT; TKP dapat memakai WEIGHTED. Kategori tidak boleh membuat sistem mengarang kunci atau bobot.
- Untuk WEIGHTED, hasil menampilkan skor per soal dan bobot setiap opsi; jangan menyebut opsi selain bobot tertinggi sebagai “salah”.
- Skor total dan maksimum berasal dari versi soal yang dikerjakan. Tidak ada passing grade atau status “lulus”.

## 5. Usulan template PDF v1

Hanya teks satu kolom; tanpa tabel, gambar, rumus kompleks, header/footer berulang, atau OCR. Format marker berada pada awal baris. Pemisah `---END---` menutup satu soal. Teks multiline boleh di dalam pertanyaan, opsi, dan pembahasan; baris marker khusus tidak boleh menjadi isi tanpa mekanisme escape versi berikutnya.

```text
VANEXA-PDF-V1
CATEGORY: TIU
BANK: Contoh latihan

QUESTION: 1
TYPE: SINGLE_CORRECT
PROMPT:
Berapakah 2 + 3?
A: 4
B: 5
C: 6
D: 7
E: 8
KEY: B
EXPLANATION:
2 + 3 = 5.
---END---
```

Contoh bobot menggunakan kategori TKP dalam berkas terpisah:

```text
VANEXA-PDF-V1
CATEGORY: TKP
BANK: Contoh latihan berbobot

QUESTION: 1
TYPE: WEIGHTED
PROMPT:
Contoh situasi latihan dan lima pilihan tindakan.
A: Tindakan A
B: Tindakan B
C: Tindakan C
D: Tindakan D
E: Tindakan E
WEIGHTS: A=1;B=2;C=3;D=4;E=5
EXPLANATION:
Contoh bobot untuk menjelaskan format, bukan kunci resmi CPNS.
---END---
```

Satu berkas diusulkan memuat satu kategori dan satu bank. KEY wajib untuk SINGLE_CORRECT; WEIGHTS wajib untuk WEIGHTED; kombinasi keduanya ditolak. Nomor duplikat, opsi hilang, marker berulang, dan nilai kategori tidak dikenal menjadi error eksplisit. Template di atas adalah rancangan teks untuk diekspor menjadi PDF, bukan artefak PDF yang telah diuji parser.

Preview mempertahankan nomor sumber dan teks hasil ekstraksi. Jika urutan baca meragukan, minta koreksi manual; jangan otomatis menebak struktur. Usulan deteksi duplikat: fingerprint teks pertanyaan dan lima opsi yang dinormalisasi, hanya dalam bank milik host; konflik kunci/bobot wajib diperiksa, tidak digabung otomatis.

## 6. UI dan aksesibilitas

Mobile-first, ruang putih cukup, teks soal mudah dibaca, kontras memadai. Opsi memakai kontrol radio berlabel dan bisa dioperasikan keyboard. Status soal memakai simbol/teks selain warna. Navigasi nomor dapat dibuka lewat panel pada ponsel. Fokus dipindahkan secara masuk akal setelah navigasi dan error. Timer tidak diumumkan screen reader setiap detik. Tidak ada animasi yang menghambat membaca atau menjawab.

## 7. Review sebelum implementasi konten

Setujui template marker PDF, dukungan konten teks saja, kewajiban pembahasan, angka skor benar/salah, rentang bobot, serta perilaku duplikat. Nama halaman dan microcopy dapat disempurnakan tanpa mengubah keputusan produk.
