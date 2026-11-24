import Link from "next/link";
import type { RoomSummary } from "@/lib/rooms";
import { Icon } from "./icons";

export function RoomCard({ room }: { room: RoomSummary }) {
  const status = { LOBBY: "Menunggu peserta", RUNNING: "Sedang dikerjakan", FINISHED: "Pengerjaan selesai", CLOSED: "Ditutup" }[room.status];
  return <article className="panel flex gap-4 p-5 sm:p-6">
    <div className="hidden size-14 shrink-0 items-center justify-center rounded-xl bg-[#f7ece6] text-red-700 sm:flex"><Icon name="people" className="size-6" /></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words text-base font-extrabold leading-6 tracking-[-0.4px]">{room.name}</h3><span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#eff5ed] px-2.5 py-1 text-[10px] font-semibold text-[#46653e]">{status}</span></div>
      <p className="mt-1 text-xs text-stone-500">{room.category} <span className="px-1.5 text-stone-300">/</span> Host: {room.hostUsername}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-stone-600"><span className="inline-flex items-center gap-1.5"><Icon name="people" className="size-3.5" />{room.participantCount} peserta</span><span className="inline-flex items-center gap-1.5"><Icon name="file" className="size-3.5" />{room.questionCount} soal</span><span className="inline-flex items-center gap-1.5"><Icon name="clock" className="size-3.5" />{room.durationMinutes} menit</span></div>
        <Link href={`/rooms/${room.id}`} className="primary !min-h-9 !px-4 !py-2 !text-xs">{room.status === "LOBBY" ? "Gabung" : "Lihat room"}</Link>
      </div>
    </div>
  </article>;
}
