import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { getRoomState, findParticipant, findAccountParticipant, participantTokenHash } from "@/lib/rooms";
import { LobbyClient } from "./lobby-client";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";
import { DeleteRoom } from "../delete-room";

export default async function RoomLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const state = await getRoomState(id);

  if (!state) {
    notFound();
  }

  const { room, participants } = state;

  // If quiz is already running, redirect participants to quiz page

  const host = await currentHost();
  const isHost = host?.id === room.hostId;

  // Check guest session cookie
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`vanexa_guest_${room.id}`)?.value;
  const currentParticipant = host ? await findAccountParticipant(room.id, host.id) : guestToken ? await findParticipant(room.id, participantTokenHash(guestToken)) : null;

  if ((isHost || currentParticipant) && room.status === "RUNNING") redirect(`/rooms/${room.id}/quiz`);

  return (
    <><SiteHeader host={host} active="rooms" />
    <main className="page-width flex-1 pb-8 pt-4 sm:pt-5">

      <section className="pb-8 sm:pb-10">
        <Link href={`/categories/${room.category}`} className="back-room-button inline-flex min-h-10 items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-stone-600">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 shrink-0"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
          <span className="relative z-10">Kembali ke daftar room</span>
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge">{room.category}</span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {room.status === "LOBBY" ? "Lobby Terbuka" : room.status}
              </span>
            </div>
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
              {room.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Host: <span className="font-medium text-slate-700">{room.hostUsername}</span>
            </p>
          </div>
          {isHost && <DeleteRoom roomId={room.id} />}
        </div>

        {/* Quiz Summary Panel */}
        <div className="panel mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 sm:p-6 text-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Kategori</span>
            <p className="mt-1 text-lg font-semibold text-slate-900">{room.category}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Jumlah Soal</span>
            <p className="mt-1 text-lg font-semibold text-slate-900">{room.questionCount} Soal</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Durasi</span>
            <p className="mt-1 text-lg font-semibold text-slate-900">{room.durationMinutes} Menit</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Peserta Terdaftar</span>
            <p className="mt-1 text-lg font-semibold text-slate-900">{participants.length} Orang</p>
          </div>
        </div>

        {/* Realtime Lobby Client */}
        <LobbyClient
          roomId={room.id}
          wsUrl={process.env.NEXT_PUBLIC_WS_URL}
          initialStatus={room.status}
          initialVersion={room.version}
          initialHostOfflineSince={room.hostOfflineSince}
          initialParticipants={participants}
          isHost={isHost}
          currentParticipant={currentParticipant}
          accountUsername={host?.username}
        />
      </section>
    </main><SiteFooter /></>
  );
}
