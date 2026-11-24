"use client";

export default function ImportError({ reset }: { reset: () => void }) {
  return <main className="page-width py-16"><h1 className="text-2xl font-semibold">Impor belum berhasil dimuat</h1><p className="mt-3 text-slate-500">Coba lagi saat layanan tersedia.</p><button className="primary mt-6" onClick={reset}>Coba lagi</button></main>;
}
