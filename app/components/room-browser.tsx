"use client";

import { useState } from "react";
import Link from "next/link";
import type { RoomSummary } from "@/lib/rooms";
import { Icon } from "./icons";
import { RoomCard } from "./room-card";

export function RoomBrowser({ rooms, unavailable }: { rooms: RoomSummary[]; unavailable: boolean }) {
  const [category, setCategory] = useState("Semua");
  const filtered = category === "Semua" ? rooms : rooms.filter(room => room.category === category);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex max-w-full flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1" role="group" aria-label="Filter kategori room">{["Semua", "TIU", "TWK", "TKP", "RANDOM"].map(code => <button key={code} type="button" aria-pressed={category === code} onClick={() => setCategory(code)} className={`no-sweep min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${category === code ? "bg-red-50 text-red-700" : "text-stone-500 hover:bg-stone-50"}`}>{code === "RANDOM" ? "Random" : code}</button>)}</div>
      <span className="text-xs text-stone-500" role="status">{unavailable ? "Data room belum tersedia" : `${filtered.length} room`}</span>
    </div>
    {unavailable ? <div className="panel flex flex-wrap items-center justify-between gap-4 p-6"><p className="text-sm text-stone-600">Room belum berhasil dimuat. Silakan coba lagi.</p><Link href="/" className="text-link text-sm">Muat ulang</Link></div> : filtered.length ? <div className="grid gap-4 md:grid-cols-2">{filtered.slice(0, 6).map(room => <RoomCard key={room.id} room={room} />)}</div> : <div className="panel flex flex-col items-center gap-5 px-6 py-9 text-center sm:flex-row sm:text-left">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#f7ece6] text-red-700"><Icon name="people" className="size-7" /></div>
      <div className="flex-1"><h3 className="text-base font-bold">Ruang belajar berikutnya bisa dimulai darimu.</h3><p className="mt-1.5 text-sm leading-6 text-stone-500">Belum ada room {category === "Semua" ? "yang terbuka" : category}. Siapkan soalmu, buka room, lalu ajak teman belajar.</p></div>
      <Link href="/rooms/new" className="secondary shrink-0">Buat room</Link>
    </div>}
    {filtered.length > 6 && <p className="mt-4 text-xs text-stone-500">Menampilkan 6 room. Pilih kartu kategori untuk melihat seluruh room kategori tersebut.</p>}
  </>;
}
