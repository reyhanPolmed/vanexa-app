# Vanexa

Next.js App Router, TypeScript, Tailwind CSS, dan PostgreSQL. Tiket 01 menyediakan login Host dengan username/password, session database, serta bank soal pribadi. Impor PDF dan multiplayer belum diimplementasikan.

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
$env:HOST_PASSWORD = Read-Host 'Password Host (12–128 karakter)' -MaskInput
npm.cmd run host:create
Remove-Item Env:\HOST_PASSWORD
Remove-Item Env:\HOST_USERNAME
```

`-MaskInput` tersedia pada PowerShell 7. Pada Windows PowerShell 5, isi variabel password melalui mekanisme secret terminal yang sesuai; jangan menuliskannya ke source atau command history. Username memakai 3–32 huruf/angka/garis bawah dan tidak membedakan huruf besar/kecil. Akun duplikat ditolak; tidak ada reset password mandiri pada tiket ini.

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

`npm test` membuat production build, kemudian menjalankan E2E browser dan uji restart production. `TEST_DATABASE_URL` harus menunjuk database disposable bernama tepat `vanexa_test`: setup tes menghapus dan membuat ulang schema public di database tersebut. Jangan arahkan ke data yang ingin dipertahankan. Port 3100 dan 3120 harus kosong; development server pada port lain sebaiknya dihentikan saat build/test memakai folder output yang sama.

Seam: perilaku UI/API melalui database PostgreSQL nyata; fixture menyiapkan akun/bank tanpa membuat fitur impor di luar tiket. Tidak ada mock penyimpanan atau pemeriksaan hasil melalui query internal database.

Detail kebutuhan ada pada `docs/IMPLEMENTATION-SPEC.md`; backlog pada `docs/tickets/README.md`.
