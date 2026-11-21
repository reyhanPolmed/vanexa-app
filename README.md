# Vanexa

Scaffold awal Next.js App Router, TypeScript, ESLint, dan Tailwind CSS. Template berasal dari create-next-app 16.2.4 yang tersedia di cache lokal.

## Menjalankan

Jalankan dari folder proyek:

```powershell
npm.cmd install
npm.cmd run dev
```

Buka http://localhost:3000.

## Status setup

File scaffold tersedia. Instalasi dependency belum selesai: registry npm ditolak dengan EACCES dan instalasi offline gagal ENOTCACHED pada @tailwindcss/postcss. Belum ada lockfile; build dan runtime belum diverifikasi. Versi dependency mengikuti template cache dan belum diverifikasi terhadap rilis terbaru.

PostgreSQL dan WebSocket belum dikonfigurasi. Kebutuhan produk ada pada MVP-SPEC.md.
