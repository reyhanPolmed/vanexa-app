import Image from "next/image";
import Link from "next/link";
import { currentHost } from "@/lib/auth";
import { listRooms } from "@/lib/rooms";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { Icon } from "./components/icons";
import { CategoryArt } from "./components/category-art";
import { RoomBrowser } from "./components/room-browser";

const categories = [
  { code: "TIU", name: "Tes Intelegensia Umum", description: "Asah kemampuan numerik, verbal, dan penalaran logis.", label: "LOGIKA & PENALARAN" },
  { code: "TWK", name: "Tes Wawasan Kebangsaan", description: "Perdalam Pancasila, UUD 1945, dan wawasan kebangsaan.", label: "WAWASAN & KEBANGSAAN" },
  { code: "TKP", name: "Tes Karakteristik Pribadi", description: "Latih penilaian sikap, pelayanan publik, dan profesionalisme.", label: "SIKAP & KEPRIBADIAN" },
  { code: "RANDOM", name: "Random", description: "Latihan pengetahuan umum dan topik lain di luar TIU, TWK, dan TKP.", label: "PENGETAHUAN UMUM" },
];

export default async function Home() {
  const [host, available] = await Promise.all([
    currentHost(),
    Promise.all(categories.map(category => listRooms(category.code))).catch(() => null),
  ]);
  const rooms = available?.flat() ?? [];
  return <>
    <SiteHeader host={host} />
    <main className="page-width pb-16">
      <section className="relative isolate my-6 mb-10 grid overflow-hidden rounded-[24px] border border-[#eee4dc] bg-[#f7f1ea] px-6 py-10 sm:px-10 sm:py-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-6 lg:rounded-[32px] lg:px-14 lg:py-8" aria-labelledby="hero-title">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 size-96 rounded-full border border-[#e8d7cb]/60" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 size-96 rounded-full bg-[#f2e1d9]/50" />
        <div className="relative z-10 py-2 lg:py-8">
          <div aria-hidden="true" className="mb-6 h-1 w-10 rounded-full bg-[#c77a73]" />
          <h1 id="hero-title" className="hero-title text-[#292624]">Latihan soal,<br /><span className="text-[#ae514d]">belajar bersama.</span></h1>
          <Link href="#latihan" className="primary no-sweep mt-8 !px-7">Mulai Latihan</Link>
        </div>
        <div className="relative mx-auto hidden w-full max-w-[460px] md:block" aria-hidden="true">
          <div className="absolute inset-x-5 inset-y-10 rounded-full bg-[#fffaf5]/90" />
          <Image src="/quiz-illustration.svg" width={600} height={450} alt="" loading="eager" className="relative h-auto w-full" />
        </div>
      </section>

      <section id="latihan" aria-labelledby="categories-title">
        <div className="mb-5"><p className="eyebrow mb-2">MULAI DARI SATU LANGKAH</p><h2 id="categories-title" className="section-title">Jelajahi latihan</h2></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{categories.map(category => <Link key={category.code} href={`/categories/${category.code}`} className="category-card panel group flex min-w-0 items-center gap-4 p-5" aria-label={`Lihat room publik ${category.code} — ${category.name}`}>
          <CategoryArt code={category.code} />
          <div className="min-w-0 flex-1"><h3 className="text-[22px] font-extrabold leading-7 tracking-[-0.5px]">{category.code === "RANDOM" ? "Random" : category.code}</h3><p className="mt-0.5 text-xs font-semibold text-stone-600">{category.name}</p><p className="mt-2 text-xs leading-[1.7] text-stone-500">{category.description}</p></div>
        </Link>)}</div>
      </section>

      <section id="rooms" className="pt-11 sm:pt-12" aria-labelledby="rooms-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><h2 id="rooms-title" className="section-title">Room yang tersedia</h2><Link href="/rooms/new" className="text-link inline-flex items-center gap-2 pb-1 text-xs">Buat room sendiri</Link></div>
        <RoomBrowser rooms={rooms} unavailable={available === null} />
      </section>

      <section className="mt-12 grid gap-6 rounded-2xl border border-[#e9ded3] bg-[#f6efe6] p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center" aria-labelledby="own-bank-title">
        <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-red-700"><Icon name="book" /></span><div><h2 id="own-bank-title" className="text-lg font-extrabold tracking-[-0.4px]">Soalmu sendiri. Cara belajarmu sendiri.</h2><p className="mt-2 max-w-xl text-xs leading-6 text-stone-600">Impor PDF, periksa soal, lalu gunakan bank soal untuk latihan bersama kelompokmu.</p></div></div><Link href="/banks" className="secondary shrink-0">Kelola soal </Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
