import Link from "next/link";
import { requireHost } from "@/lib/auth";
import { listBanks } from "@/lib/banks";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { CategoryArt } from "../components/category-art";
import { Icon } from "../components/icons";

export default async function BanksPage() {
  const host = await requireHost();
  const banks = await listBanks(host.id);
  return <>
    <SiteHeader host={host} active="banks" />
    <main className="page-width flex-1 pb-16 pt-10 sm:pt-14">
      <section aria-labelledby="bank-title">
        <p className="eyebrow">RUANG BELAJAR ANDA</p>
        <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 id="bank-title" className="text-3xl font-extrabold tracking-[-1px] sm:text-4xl">Bank soal pribadi</h1><p className="mt-3 max-w-xl text-sm leading-7 text-stone-500">Kumpulan soal pilihanmu, siap dipakai untuk latihan berikutnya.</p></div>{banks.length > 0 && <div className="flex flex-wrap gap-3"><Link href="/imports/new" className="secondary">Impor PDF</Link><Link href="/rooms/new" className="primary">Buat room</Link></div>}</div>
        <div className="mt-8 flex items-center justify-between border-b border-stone-200 pb-4"><span className="text-sm font-bold">Koleksi soalmu</span><span className="text-xs text-stone-500">{banks.length} bank soal · Hanya untuk akunmu</span></div>
        <div className="mt-6">{banks.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{banks.map(bank => <li className="min-w-0" key={bank.id}>
          <Link href={`/banks/${bank.id}`} aria-label={bank.name} className="panel category-card flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-4"><CategoryArt code={bank.category} /><span className="badge">{bank.category}</span></div>
            <h2 className="mt-5 break-words text-lg font-extrabold tracking-[-0.4px]">{bank.name}</h2><p className="mt-2 text-xs leading-6 text-stone-500">Bank pribadi untuk latihan kelompokmu.</p>
            <span className="text-link mt-5 inline-flex items-center justify-between border-t border-stone-100 pt-4 text-xs">Kelola bank soal</span>
          </Link>
        </li>)}</ul> : <div className="panel flex flex-col items-center border-dashed px-6 py-16 text-center"><span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Icon name="book" className="size-7" /></span><h2 className="text-xl font-extrabold">Bank soal Anda masih kosong</h2><p className="mt-3 max-w-sm text-sm leading-7 text-stone-500">Impor PDF untuk membuat bank soal pertama. Periksa hasilnya, lalu mulai latihan bersama.</p><Link className="primary mt-6" href="/imports/new">Impor PDF</Link></div>}</div>
        <aside className="mt-9 flex items-start gap-3 rounded-xl bg-[#f6efe6] p-5 text-xs leading-6 text-stone-600"><Icon name="file" className="mt-1 size-4 shrink-0 text-red-700" /><p>Mulai dari PDF berbasis teks dengan template Vanexa. Soal dapat diperiksa dan diperbaiki sebelum disimpan ke bank.</p></aside>
      </section>
    </main>
    <SiteFooter />
  </>;
}
