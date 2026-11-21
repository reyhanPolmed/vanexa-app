# Vanexa

Next.js App Router, TypeScript, Tailwind CSS, dan PostgreSQL. Login Host memakai username/password; bank soal bersifat pribadi. Impor PDF mendukung preview, koreksi, pembuangan soal, serta konfirmasi menjadi bank yang dapat dibuka dan dikoreksi kembali. Multiplayer belum diimplementasikan. Gunakan Node.js 22.13 atau lebih baru untuk parser PDF.

## Menjalankan

Jalankan dari folder proyek:

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

Buka http://localhost:3000.

## Database dan akun Host

Salin `.env.example` ke `.env.local` dan isi koneksi PostgreSQL database khusus Vanexa. `APP_ORIGIN` harus persis origin browser, termasuk port. Gunakan HTTPS pada production; cookie session production memakai Secure. Jangan commit `.env.local`.

Akun awal dibuat oleh pengelola dari terminal, tanpa email atau pendaftaran publik:

```powershell
$env:HOST_USERNAME = 'nama_host'
$securePassword = Read-Host 'Password Host (12–128 karakter)' -AsSecureString
$env:HOST_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
npm.cmd run host:create
Remove-Item Env:\HOST_PASSWORD
Remove-Item Env:\HOST_USERNAME
```

Perintah tersebut mendukung Windows PowerShell 5 dan PowerShell 7 tanpa menulis password ke command history. Username memakai 3–32 huruf/angka/garis bawah dan tidak membedakan huruf besar/kecil. Akun duplikat ditolak; tidak ada reset password mandiri pada tiket ini.

Session berumur tetap 7 hari dan dapat dicabut lewat logout. Password di-hash dengan scrypt; database hanya menyimpan hash token session. Login dibatasi 10 percobaan per username per 15 menit; batas ini juga menghitung login berhasil. Operasional publik mungkin membutuhkan proteksi jaringan tambahan, di luar tiket ini.

Pada lingkungan kerja yang digunakan untuk implementasi, PostgreSQL khusus Vanexa dijalankan pada port 55441 dengan data di `.vanexa-setup/pg-data`. Koneksinya tersimpan hanya di `.env.local`; service PostgreSQL lain tidak diubah. Jika proses lokal itu berhenti, jalankan:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'D:\Vanexa\.vanexa-setup\pg-data' -l 'D:\Vanexa\.vanexa-setup\postgres.log' -o '-p 55441 -h 127.0.0.1' -w start
```

## Verifikasi

```powershell
npx.cmd playwright install chromium
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

`npm test` menjalankan uji parser template, membuat production build terisolasi dalam `.next-e2e`, kemudian menjalankan E2E browser dan uji restart production. `TEST_DATABASE_URL` harus menunjuk database disposable bernama tepat `vanexa_test`: setup tes menghapus dan membuat ulang schema public di database tersebut. Jangan arahkan ke data yang ingin dipertahankan. Port 3100 dan 3120 harus kosong; development server utama tidak perlu dihentikan karena output tes dipisahkan.

Seam: perilaku UI/API melalui database PostgreSQL nyata; fixture menyiapkan akun/bank tanpa membuat fitur impor di luar tiket. Tidak ada mock penyimpanan atau pemeriksaan hasil melalui query internal database.

Detail kebutuhan ada pada `docs/IMPLEMENTATION-SPEC.md`; backlog pada `docs/tickets/README.md`.

## Upload dan preview PDF

Setelah migrasi, masuk sebagai Host lalu pilih **Impor PDF** pada bank soal. Halaman upload menyediakan contoh template yang dapat disalin ke dokumen dan diekspor menjadi PDF teks. Satu PDF memuat satu kategori/bank; gunakan pertanyaan dan opsi A–E dengan KEY atau WEIGHTS sesuai tipe. Bobot integer 0–5; pembahasan opsional.

Batas: 5 MiB, 50 halaman, 200 soal. PDF bersandi/rusak/scan, gambar, teks diputar, dan struktur beberapa kolom ditolak. Parser tidak menebak kunci atau mengisi opsi hilang. Preview mempertahankan teks sumber dan error per field; soal invalid tetap tampil.

## Perbaikan dan konfirmasi bank

Pada preview, buka **Perbaiki soal**, isi pertanyaan, opsi A–E, jenis skor, kunci/bobot, atau pembahasan. Struktur sumber yang ambigu menggunakan editor teks langsung sampai marker diperbaiki; sumber tidak dibersihkan otomatis. Teks di luar struktur dokumen perlu ditinjau dan disetujui secara eksplisit sebelum dibuang dari hasil akhir. Sumber ekstraksi awal tetap tersedia di draft sampai expiry.

**Buang soal** mengecualikan soal dari hasil akhir dan dapat dipulihkan sebelum konfirmasi. Tekan **Simpan perbaikan**, lalu **Tinjau impor** untuk memeriksa jumlah akhir dan daftar nomor sumber yang dibuang. Konfirmasi hanya berhasil bila minimal satu soal valid tersisa dan seluruh soal yang dipertahankan valid. Bank baru dibuat bersama seluruh soalnya dalam satu transaksi; ulang request atau klik ganda tidak membuat bank kedua.

Duplikat dideteksi berdasarkan pertanyaan dan opsi A–E setelah normalisasi Unicode NFKC, huruf kecil, serta whitespace untuk fingerprint saja; teks tersimpan tidak dinormalisasi menjadi huruf kecil. Peringatan mencakup draft dan bank milik Host, tanpa mengekspos bank pengguna lain. Kunci/bobot/pembahasan tidak digunakan untuk menyamakan soal dan tidak digabung. Duplikat boleh dipertahankan; nomor sumber yang sama tetap perlu diperbaiki agar tidak ambigu.

Hanya owner boleh mengedit bank hasil impor. Revision draft/bank menolak perubahan usang dengan HTTP 409; data lokal tidak ditimpa otomatis. Respons save berisi snapshot dari transaksi yang menyimpan perubahan tersebut, sehingga tidak digantikan oleh isi revision tab lain. Editing bank mengoreksi soal yang sudah ada, menjaga ID dan urutannya; tidak menyediakan penambahan soal manual atau penghapusan soal bank pada tiket ini. Cara perubahan bank berpengaruh pada Room tetap keputusan tiket 04.

API: PATCH draft/bank memakai JSON `{ revision, state }`; state berisi nama bank, kategori, reviewedDocument, dan daftar item `{ source, discarded }`. Item tetap satu per soal sumber. POST confirm memakai `{ revision, idempotencyKey }` (UUID), lalu mengembalikan bankId dan destination. Replay dengan key/revision sama memberi bank yang sama; key atau revision lain setelah konfirmasi memberi 409. Receipt disimpan dalam draft selama sisa masa hidup 24 jam, sementara bank hasil konfirmasi tetap tersimpan.

PDF.js dipakai langsung untuk akses jumlah halaman, posisi teks, dan pemeriksaan operator gambar. Probe PDF dua halaman mempertahankan urutan marker; pengujian PDF nyata mencakup teks lintas halaman, tanda baca Indonesia, PDF bersandi, scan/gambar, dan dua kolom. Ekstraksi berjalan dalam subprocess Node terpisah dengan heap 256 MiB dan timeout 15 detik; teks maksimal 500.000 karakter, upload maksimal 20 detik, dan maksimal dua upload aktif per proses aplikasi. Batas ini melindungi resource proses, bukan klaim kapasitas deployment.

PDF.js dikunci pada 6.5.438. Pengujian menemukan `getOperatorList()` menelan error stream operator sehingga gambar yang ditolak evaluator bisa hilang tanpa error kepada caller. `postinstall` menjalankan koreksi lokal kecil pada urutan reject/resolve di dua build PDF.js, dengan pemeriksaan versi dan bentuk kode; jika tidak cocok, instalasi gagal agar koreksi ditinjau kembali. Jangan memakai `--ignore-scripts` pada instalasi deployment. `maxImageSize: 0` dan `stopAtErrors: true` menolak raster sebelum dekode, termasuk fixture dimensi 100.000 × 100.000 dengan data terkompresi sangat kecil. Batas heap bukan batas RSS seluruh proses. Uji PDF teks, gambar kecil, dan gambar berukuran deklaratif besar harus tetap lulus sebelum upgrade parser.

PDF asli hanya berada di memori selama proses dan tidak ditulis ke disk/database. Draft PostgreSQL hanya dapat dibaca owner dan tidak dapat diakses setelah 24 jam. Penghapusan fisik draft kedaluwarsa dilakukan pada upload berikutnya atau dengan:

```powershell
npm.cmd run import:cleanup
```

Untuk deployment, jadwalkan perintah cleanup tiap 15 menit melalui scheduler platform. Scheduler belum dipasang pada mesin/deployment oleh tiket ini; expiry akses 24 jam tetap berlaku tanpa scheduler. Jika memakai output standalone, pastikan `scripts/pdf-extract.mjs`, paket PDF.js dan dependency opsional Node-nya ikut dikemas; konfigurasi tracing sudah mencantumkannya. Endpoint upload memakai runtime Node dan membutuhkan kemampuan spawn child process; bukan Edge runtime.
