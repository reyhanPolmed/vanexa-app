"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GuestJoinForm } from "./guest-join-form";
import { useRoomSync } from "../use-room-sync";
import { AccountJoin } from "./account-join";
import Link from "next/link";

export type ParticipantItem = {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: string;
  online?: boolean;
};

export function LobbyClient({
  roomId,
  wsUrl: propWsUrl,
  initialStatus,
  initialVersion = 0,
  initialHostOfflineSince = null,
  initialParticipants,
  isHost,
  currentParticipant,
  accountUsername,
}: {
  roomId: string;
  wsUrl?: string;
  initialStatus: string;
  initialVersion?: number;
  initialHostOfflineSince?: string | null;
  initialParticipants: ParticipantItem[];
  isHost: boolean;
  currentParticipant: { id: string; nickname: string; isHost: boolean } | null;
  accountUsername?: string;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [hostOfflineSince, setHostOfflineSince] = useState(initialHostOfflineSince);
  const [status, setStatus] = useState(initialStatus);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const isJoined = Boolean(currentParticipant) || isHost;

  const connected = useRoomSync(roomId, isJoined, initialVersion, (snapshot) => {
    setParticipants(snapshot.participants);
    setStatus(snapshot.room.status);
    setHostOfflineSince(snapshot.room.hostOfflineSince);
    if (snapshot.room.status === "CLOSED" && initialStatus !== "CLOSED") router.refresh();
    if (snapshot.room.status === "RUNNING") router.replace(`/rooms/${roomId}/quiz`);
  }, undefined, propWsUrl);

  useEffect(() => {
    if (status === "RUNNING") router.replace(`/rooms/${roomId}/quiz`);
  }, [status, roomId, router]);

  async function handleStartQuiz() {
    if (!isHost || isStarting) return;
    setIsStarting(true);
    setStartError(null);

    try {
      const response = await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStartError(data.message || "Gagal memulai kuis.");
        setIsStarting(false);
        return;
      }

      setStatus("RUNNING");
      router.push(`/rooms/${roomId}/quiz`);
    } catch {
      setStartError("Terjadi kesalahan jaringan. Coba lagi.");
      setIsStarting(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-3">
      {hostOfflineSince && status === "LOBBY" && <p className="md:col-span-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">Host sedang offline. Room tetap tersedia dan kuis dapat dimulai saat Host kembali.</p>}
      {/* Join / Status Form */}
      <div className="md:col-span-1 space-y-4">
        {status === "CLOSED" ? <div className="panel p-6 text-sm text-amber-900" role="status">Room ditutup karena Host tidak kembali.</div> : isJoined ? (
          <div className="panel p-6 space-y-4 border-red-100 bg-red-50/50">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <span aria-hidden="true">✓</span>
              <span>Anda sudah di Lobby</span>
            </div>
            <p className="text-sm text-slate-700">
              Bergabung sebagai:{" "}
              <strong className="font-semibold text-slate-900">
                {currentParticipant?.nickname}
              </strong>
              {currentParticipant?.isHost && (
                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                  Host
                </span>
              )}
            </p>

            {status === "FINISHED" && <p className="text-sm text-stone-600">Sesi sebelumnya selesai. <Link href={`/rooms/${roomId}/result`} className="text-link">Lihat hasil dan riwayat</Link></p>}
            {isHost ? (
              <div className="pt-2 border-t border-red-100 space-y-3">
                <p className="text-xs text-slate-600">
                  Anda adalah Host room ini. Anda juga akan mengerjakan kuis bersama peserta.
                </p>

                {startError && (
                  <div
                    role="alert"
                    className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800"
                  >
                    {startError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartQuiz}
                  disabled={isStarting || (status !== "LOBBY" && status !== "FINISHED")}
                  className="primary w-full flex items-center justify-center py-3 text-sm font-semibold"
                >
                  {isStarting ? "Memulai Kuis..." : status === "FINISHED" ? "Mulai sesi baru" : "Mulai Kuis Sekarang"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Saat Anda menekan Mulai, seluruh peserta di lobby akan berpindah serentak ke kuis.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600 border border-red-100">
                ⏳ Menunggu host memulai kuis. Ketika host memulai, kuis akan berjalan serentak secara realtime.
              </div>
            )}
          </div>
        ) : status === "LOBBY" || status === "FINISHED" ? (
          accountUsername ? <AccountJoin roomId={roomId} username={accountUsername} /> : <GuestJoinForm roomId={roomId} />
        ) : (
          <div className="panel p-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
            <p className="font-semibold">Kuis sudah dimulai.</p>
            <p className="mt-1 text-xs">Peserta baru tidak dapat bergabung ke room ini.</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          <p className="font-medium text-slate-700">Aturan Latihan:</p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Semua peserta mulai bersamaan saat host menekan tombol mulai.</li>
            <li>Setiap peserta menjawab dengan kecepatan masing-masing.</li>
            <li>Timer dan deadline kuis dihitung dari waktu server.</li>
          </ul>
        </div>
      </div>

      {/* Participants List */}
      <div className="min-w-0 md:col-span-2">
        <div className="panel min-w-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0 flex-1 basis-48">
              <h2 className="text-xl font-semibold text-slate-900">
                Daftar Peserta ({participants.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Peserta yang saat ini sudah berada di lobby room.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
              {connected ? "Realtime aktif" : "Menghubungkan kembali?"}
            </span>
          </div>

          {participants.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100" data-testid="participant-list">
              {participants.map((p, idx) => (
                <li key={p.id} className="flex min-w-0 items-start gap-3 py-4">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {idx + 1}
                    </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{p.nickname}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                    {p.isHost && (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-100">
                        Host
                      </span>
                    )}
                    {currentParticipant?.id === p.id && (
                      <span className="text-xs font-medium text-emerald-600">(Anda)</span>
                    )}
                    <span className="text-slate-500">{p.online ? "Online" : "Offline"}</span>
                    <time dateTime={p.joinedAt} className="whitespace-nowrap text-slate-500">{new Date(p.joinedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</time>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              Belum ada peserta di lobby ini.
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Pembaruan peserta dan status mulai terhubung realtime via WebSocket.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
