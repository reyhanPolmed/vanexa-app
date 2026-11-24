"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-width py-8 text-center">
      <div className="panel border-dashed px-6 py-14">
        <h2 className="text-xl font-semibold text-slate-900">Room belum berhasil dimuat. Coba lagi.</h2>
        <div className="mt-6 flex justify-center gap-4">
          <button onClick={() => reset()} className="primary inline-flex">
            Coba lagi
          </button>
          <Link href="/" className="text-link inline-flex items-center">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
