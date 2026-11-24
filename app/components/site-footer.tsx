import Link from "next/link";

export function SiteFooter() {
  return <footer className="mt-auto border-t border-stone-200 bg-[#f6f3ef]">
    <div className="page-width flex flex-col justify-between gap-7 py-8 sm:flex-row sm:items-center">
      <div><Link href="/" className="brand !text-2xl">vanexa<span className="text-red-600">.</span></Link><p className="mt-2 text-xs leading-6 text-stone-500">Ruang latihan. Teman bertumbuh.</p></div>
      <p className="max-w-sm text-xs leading-6 text-stone-500 sm:text-right">Dibuat untuk belajar bersama.<br />Latihan mandiri, bukan layanan resmi seleksi CPNS.</p>
    </div>
  </footer>;
}
