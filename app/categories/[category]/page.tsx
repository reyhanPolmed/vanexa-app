import Link from "next/link";
import { notFound } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { listRooms, isCategory } from "@/lib/rooms";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";
import { CategoryArt } from "@/app/components/category-art";
import { RoomCard } from "@/app/components/room-card";
import { Icon } from "@/app/components/icons";

const categoryMeta = {
  TIU: { name: "Tes Intelegensia Umum", description: "Asah penalaran logis, verbal, numerik, dan figural. Temukan room latihan sesuai kebutuhanmu." },
  TWK: { name: "Tes Wawasan Kebangsaan", description: "Perdalam nasionalisme, integritas, pilar negara, dan bahasa Indonesia lewat latihan bersama." },
  TKP: { name: "Tes Karakteristik Pribadi", description: "Latih penilaian situasi, pelayanan publik, dan profesionalisme melalui soal pilihanmu sendiri." },
  RANDOM: { name: "Random", description: "Latihan pengetahuan umum dan topik di luar TIU, TWK, serta TKP dari soal yang kamu impor sendiri." },
};

export default async function CategoryRoomsPage({ params }: { params: Promise<{ category: string }> }) {
  const category = (await params).category.toUpperCase();
  if (!isCategory(category)) notFound();
  const [host, rooms] = await Promise.all([currentHost(), listRooms(category)]);
  const meta = categoryMeta[category];
  return <>
    <SiteHeader host={host} active="rooms" />
    <main className="page-width flex-1 pb-16 pt-8 sm:pt-10">
      <Link href="/#latihan" className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-red-700"><span aria-hidden="true">←</span>Kembali ke beranda</Link>
      <section className="mt-8 flex flex-col justify-between gap-6 border-b border-stone-200 pb-9 sm:flex-row sm:items-center">
        <div className="flex items-start gap-5"><CategoryArt code={category} /><div><span className="eyebrow">RUANG LATIHAN {category}</span><h1 className="mt-2 max-w-xl text-2xl font-extrabold leading-tight tracking-[-0.9px] sm:text-3xl">{meta.name} ({category})</h1><p className="mt-3 max-w-lg text-sm leading-7 text-stone-500">{meta.description}</p></div></div>
        <Link href="/rooms/new" className="primary self-start whitespace-nowrap sm:self-auto">Buat room</Link>
      </section>
      <nav className="mt-7 flex flex-wrap gap-2" aria-label="Kategori latihan">{Object.keys(categoryMeta).map(code => <Link key={code} href={`/categories/${code}`} aria-current={category === code ? "page" : undefined} className={`action-button rounded-lg px-5 py-2.5 text-xs font-bold ${category === code ? "bg-red-600 text-white" : "border border-stone-200 bg-white text-stone-500 hover:bg-red-50"}`}>{code}</Link>)}</nav>
      <section className="mt-8" aria-labelledby="public-rooms-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="public-rooms-title" className="text-xl font-extrabold tracking-[-0.5px]">Room Publik yang Tersedia</h2><p className="mt-2 text-sm text-stone-500">Room tetap tersimpan setelah sesi pengerjaan selesai.</p></div><span className="text-xs text-stone-500">{rooms.length} room</span></div>
        {rooms.length ? <div className="grid gap-4 md:grid-cols-2">{rooms.map(room => <RoomCard key={room.id} room={room} />)}</div> : <div className="panel flex flex-col items-center px-6 py-14 text-center"><span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Icon name="people" className="size-7" /></span><h3 className="text-lg font-bold">Belum ada room yang menunggu peserta.</h3><p className="mt-3 max-w-sm text-sm leading-7 text-stone-500">Jadi yang pertama membuka ruang latihan {category}. Gunakan bank soalmu dan ajak teman bergabung.</p><Link href="/rooms/new" className="primary mt-6">Buat room {category}</Link></div>}
      </section>
    </main>
    <SiteFooter />
  </>;
}
