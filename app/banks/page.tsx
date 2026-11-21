import Link from "next/link";
import { requireHost } from "@/lib/auth";
import { listBanks } from "@/lib/banks";

export default async function BanksPage() {
  const host = await requireHost();
  const banks = await listBanks(host.id);
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
      <Link href="/" className="brand">vanexa<span className="text-indigo-600">.</span></Link>
      <div className="flex items-center gap-5 text-sm">
        <span className="max-w-40 truncate text-slate-600">{host.username}</span>
        <form action="/api/auth/logout" method="post"><button className="text-link" type="submit">Keluar</button></form>
      </div>
    </header>
    <section className="py-10 sm:py-14">
      <p className="eyebrow">RUANG BELAJAR ANDA</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Bank soal pribadi</h1>
      <p className="mt-3 max-w-xl leading-7 text-slate-500">Kumpulan soal Anda, siap digunakan kembali untuk latihan bersama.</p>
      <div className="mt-9">
        {banks.length ? <ul className="grid gap-4 sm:grid-cols-2">
          {banks.map((bank) => <li className="panel p-6" key={bank.id}>
            <span className="badge">{bank.category}</span>
            <h2 className="mt-4 break-words text-lg font-semibold"><Link className="text-link" href={`/banks/${bank.id}`}>{bank.name}</Link></h2>
          </li>)}
        </ul> : <div className="panel border-dashed px-6 py-14 text-center">
          <div aria-hidden="true" className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">▤</div>
          <h2 className="text-xl font-semibold">Bank soal Anda masih kosong</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Impor PDF untuk membuat bank soal pertama.</p>
          <a className="primary mt-6 inline-flex" href="#impor">Impor PDF</a>
        </div>}
      </div>
      <aside id="impor" className="mt-6 rounded-xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">
        <h2 className="font-semibold text-slate-800">Impor PDF segera tersedia</h2>
        <p>Fitur unggah dan preview soal belum tersedia pada tahap ini.</p>
      </aside>
    </section>
  </main>;
}
