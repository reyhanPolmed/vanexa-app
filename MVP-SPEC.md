## Problem Statement

Kelompok belajar membutuhkan cara ringan untuk berlatih soal SKD CPNS bersama dalam satu room, memakai soal yang mereka siapkan sendiri, lalu membandingkan hasil dan membaca pembahasan. Vanexa belum memiliki implementasi; repository saat ini kosong.

## Solution

Bangun MVP web responsif untuk kategori TIU, TWK, dan TKP. Host berakun mengelola kumpulan soal yang dapat dipakai ulang, membuat room publik, lalu peserta bergabung sebagai guest dengan nickname. Peserta mulai bersamaan, mengerjakan soal dengan kecepatan masing-masing, dan melihat hasil serta leaderboard setelah menyelesaikan kuis. Skor berasal dari kunci atau bobot pada soal impor, tanpa klaim bahwa skor mengikuti standar resmi CPNS.

## User Stories

1. Sebagai calon peserta, saya ingin memilih TIU, TWK, atau TKP, agar dapat menemukan latihan sesuai kebutuhan.
2. Sebagai calon peserta, saya ingin melihat room publik per kategori beserta nama, jumlah soal, peserta, dan status, agar dapat memilih sesi yang tersedia.
3. Sebagai host berakun, saya ingin membuat room publik dengan nama, kategori, bank soal, dan durasi, agar kelompok dapat berlatih bersama.
4. Sebagai host, saya ingin menggunakan kembali Question Bank pada beberapa room, agar tidak perlu mengimpor ulang soal.
5. Sebagai host, saya ingin mengimpor soal dari PDF teks berformat standar, agar dapat menyiapkan banyak soal sekaligus.
6. Sebagai host, saya ingin melihat hasil ekstraksi dan mengedit atau membuang soal invalid sebelum konfirmasi, agar kesalahan impor tidak menjadi soal kuis.
7. Sebagai host, saya ingin melihat pesan jelas jika PDF berupa scan atau strukturnya tidak valid, agar tahu cara memperbaikinya.
8. Sebagai host, saya ingin room memakai snapshot soal ketika dibuat, agar perubahan bank tidak mengubah kuis yang sudah dibuat atau berjalan.
9. Sebagai peserta guest, saya ingin masuk room dengan nickname, agar dapat mulai tanpa membuat akun.
10. Sebagai peserta, saya ingin melihat peserta yang berada di lobby, agar tahu siapa yang akan ikut.
11. Sebagai peserta, saya ingin bergabung hanya sebelum kuis dimulai, agar semua peserta memiliki waktu mulai dan deadline yang sama.
12. Sebagai host, saya ingin memulai kuis dari lobby, agar semua peserta yang sudah bergabung menerima status mulai secara serentak.
13. Sebagai peserta, saya ingin menjawab pilihan A sampai E dan berpindah antarsoal sesuai kecepatan sendiri, agar dapat mengatur strategi pengerjaan.
14. Sebagai peserta, saya ingin jawaban tersimpan otomatis, agar refresh atau gangguan singkat tidak menghapus progres.
15. Sebagai peserta, saya ingin melihat soal terjawab dan belum terjawab, agar dapat meninjau progres.
16. Sebagai peserta, saya ingin timer dan deadline mengikuti waktu server, agar semua peserta tunduk pada batas waktu yang konsisten.
17. Sebagai peserta, saya ingin kuis berakhir otomatis ketika deadline tiba, agar sesi tidak bergantung pada browser atau host.
18. Sebagai peserta yang terputus, saya ingin dapat reconnect dan melanjutkan dengan identitas guest yang sama, agar progres saya tidak hilang. Mekanisme identitas sesi perlu ditentukan saat desain teknis.
19. Sebagai peserta, saya ingin melihat hasil segera setelah saya selesai, agar dapat langsung meninjau performa. Ini dapat mengungkap jawaban kepada peserta yang masih mengerjakan dan perlu diterima sebagai konsekuensi keputusan produk.
20. Sebagai peserta, saya ingin melihat skor, jumlah benar/salah/kosong jika tipe skor mendukung, jawaban saya, kunci atau bobot, dan pembahasan, agar latihan membantu pemahaman.
21. Sebagai peserta, saya ingin melihat leaderboard berisi nickname dan skor peserta room, agar dapat membandingkan hasil.
22. Sebagai host, saya ingin room menolak peserta setelah kuis dimulai, agar susunan peserta sesi tetap.
23. Sebagai peserta, saya ingin room tanpa batas maksimum peserta, agar kelompok tidak terhambat kapasitas tetap. Batas teknis operasional tetap perlu ditentukan.
24. Sebagai peserta, saya ingin kuis terus berjalan ketika host terputus setelah mulai, agar gangguan host tidak menghentikan sesi.
25. Sebagai peserta, saya ingin room menunggu host kembali jika host terputus sebelum mulai, lalu ditutup otomatis setelah batas waktu, agar room terlantar tidak terus terbuka. Durasi batas waktu masih perlu ditentukan.

## Implementation Decisions

- Produk awal berfokus pada kelompok belajar dengan kompetisi informal sebagai evaluasi diri.
- Kategori awal: TIU, TWK, TKP.
- Room bersifat publik dan terdaftar di halaman kategori. Peserta tidak dapat bergabung setelah kuis dimulai.
- Host harus memiliki akun. Peserta dapat menjadi guest dan memakai nickname.
- Hanya host yang dapat memulai kuis.
- Jika host disconnect sebelum mulai, room menunggu host kembali dan akan ditutup otomatis setelah suatu batas waktu. Nilai batas waktu belum diputuskan.
- Jika host disconnect saat kuis berjalan, kuis tetap berjalan.
- Semua peserta memulai pada waktu server yang sama, tetapi menavigasi soal dengan kecepatan masing-masing. Deadline bersama dikendalikan server.
- Urutan soal dan opsi jawaban sama untuk seluruh peserta.
- Room tidak memiliki batas maksimum peserta produk. Kapasitas teknis dan perlindungan beban masih harus ditetapkan.
- Question Bank dimiliki host berakun dan dapat dipakai ulang. Peserta guest hanya mengerjakan kuis.
- Room menggunakan snapshot bank/soal saat dibuat; perubahan bank setelahnya tidak mengubah room tersebut.
- MVP menerima PDF berbasis teks dengan template tetap. Scanned PDF/OCR tidak termasuk MVP. Soal yang gagal diekstrak atau tidak valid harus diedit atau dibuang; sistem tidak boleh menebak pertanyaan, opsi, kunci, atau bobot.
- Alur impor: upload → ekstrak → validasi → preview/edit → konfirmasi → simpan ke Question Bank. Pencegahan duplikasi diinginkan, algoritme dan perilaku duplikat belum diputuskan.
- Skor ditentukan data soal impor: tipe benar/salah memakai kunci jawaban; tipe berbobot dapat memberi nilai per opsi, termasuk TKP. Tidak ada klaim mengikuti standar resmi CPNS.
- Hasil dan pembahasan terlihat segera setelah peserta selesai. Leaderboard menampilkan nickname dan skor room. Konsekuensi: peserta yang selesai lebih dulu dapat membocorkan jawaban sebelum deadline.
- Deadline kuis mengakhiri sesi otomatis; browser peserta bukan otoritas status, waktu mulai, atau waktu akhir.
- Stack, framework, model deployment, penyedia autentikasi, database, protokol realtime, format template PDF, rincian kontrak event/API, aturan tie-break, moderasi room publik, perlindungan nickname, durasi room host-terputus, dan kebijakan retensi hasil belum diputuskan. Spesifikasi teknis berikutnya harus memilih opsi sederhana tanpa mengasumsikan keputusan tersebut.
- Alur E2E yang disepakati sebagai seam utama: host membuat Question Bank (termasuk jalur impor PDF), membuat room, peserta guest bergabung, host memulai, peserta menjawab, deadline/penyelesaian terjadi, dan hasil/leaderboard tampil. Uji alur ini pada tingkat perilaku pengguna; gunakan pengujian lebih sempit hanya untuk validasi parsing dan aturan skor yang sulit dibuktikan melalui satu skenario.

## Testing Decisions

- Seam utama: end-to-end dari pembuatan bank/room sampai hasil multiplayer.
- Uji perilaku eksternal, bukan detail implementasi: room muncul pada kategori, guest masuk dengan nickname, event start diterima peserta, jawaban bertahan setelah reconnect, server menolak jawaban setelah deadline, dan hasil/leaderboard sesuai data soal.
- Jalur PDF perlu contoh PDF valid, struktur invalid, teks yang gagal diekstrak, serta duplikasi. Pastikan preview tidak mengarang isi dan soal invalid tidak dapat dikonfirmasi tanpa perbaikan atau penghapusan.
- Aturan skor perlu skenario kunci benar/salah/kosong serta bobot TKP per opsi.
- Uji kondisi host disconnect sebelum dan sesudah kuis dimulai, peserta refresh/reconnect, soal kosong, dan beberapa skor sama.
- Repository belum memiliki kode atau test suite; belum ada prior art pengujian yang dapat dirujuk. Prioritas adalah satu alur E2E; seam tambahan hanya jika nanti implementasi memerlukannya.

## Out of Scope

- AI generation soal, pembayaran, LMS, gamifikasi besar.
- OCR/scanned PDF.
- Klaim pengawasan ujian, anti-cheat kuat, atau kelayakan hasil untuk hadiah/seleksi.
- Klaim bahwa aturan skor meniru standar resmi CPNS.
- Peserta guest mengelola atau mengunggah Question Bank.
- Bergabung ke kuis yang sudah dimulai.
- Variasi urutan soal/opsi per peserta.

## Further Notes

- Repository saat ini kosong; glossary, ADR, arsitektur berjalan, dan pola test belum tersedia.
- Sebelum implementasi, spesifikasi lanjutan perlu menetapkan format PDF template, validasi tipe soal dan bobot, aturan peringkat saat seri, batas waktu room menunggu host, identitas guest untuk reconnect, kapasitas operasional room publik, moderasi, retensi data, dan pilihan stack serta realtime.
- Issue tracker dan label `ready-for-agent` tidak tersedia dalam konteks/tool yang tersambung. Skill `to-spec` meminta setup melalui `/setup-matt-pocock-skills` sebelum publikasi tracker.
