"use client";

export default function BanksError({ reset }: { reset: () => void }) {
  return <main className="mx-auto w-full max-w-xl px-5 py-16">
    <h1 className="text-2xl font-semibold">Bank soal belum berhasil dimuat</h1>
    <p className="mt-3 text-slate-500">Layanan sedang bermasalah. Data Anda tidak berubah.</p>
    <button className="primary mt-6" onClick={reset}>Coba lagi</button>
  </main>;
}
