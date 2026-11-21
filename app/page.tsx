import Link from "next/link";

export default function Home() {
  return <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
    <header><span className="brand">vanexa<span className="text-indigo-600">.</span></span></header>
    <section className="my-auto max-w-2xl py-24">
      <p className="eyebrow">LATIHAN PENGETAHUAN BERSAMA</p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Latihan soal,<br />belajar bersama.</h1>
      <p className="mt-6 max-w-lg text-lg leading-8 text-slate-500">Mulai dari kumpulan soal Anda sendiri. Kelola bank soal pribadi sebagai persiapan latihan kelompok.</p>
      <Link href="/banks" className="primary mt-9 inline-flex">Kelola soal <span className="ml-5" aria-hidden="true">→</span></Link>
    </section>
    <footer className="text-sm text-slate-500">Vanexa · Ruang latihan Anda.</footer>
  </main>;
}
