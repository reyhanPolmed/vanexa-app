"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardData } from "@/lib/leaderboard";
import { useRoomSync } from "./use-room-sync";

export function Leaderboard({ roomId, onSessionRunning, onStatusChange }: { roomId: string; onSessionRunning?: (sessionId: string | null) => void; onStatusChange?: (status: string) => void }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch(`/api/rooms/${roomId}/leaderboard`, { cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const next: LeaderboardData = await response.json();
      if (!alive.current || request !== sequence.current) return;
      setData((previous) => !previous || next.version >= previous.version ? next : previous); setError("");
    } catch { if (alive.current) setError("Leaderboard belum berhasil dimuat. Coba lagi."); }
  }, [roomId]);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { if (alive.current) void load(); });
    return () => { alive.current = false; };
  }, [load]);
  useRoomSync(roomId, true, 0, (snapshot) => { if (!data || snapshot.room.version > data.version) void load(); onStatusChange?.(snapshot.room.status); if (snapshot.room.status === "RUNNING") onSessionRunning?.(snapshot.room.currentSessionId); }, (type) => { if (["leaderboard.updated", "quiz.finished", "resync"].includes(type)) void load(); });
  return <section className="panel p-5 sm:p-7" aria-labelledby="leaderboard-heading">
    <h2 id="leaderboard-heading" className="text-xl font-semibold">Peringkat sesi terbaru</h2>
    <p className="mt-2 text-sm text-slate-500">{data?.final ? "Peringkat final" : "Peringkat sementara"} · Skor sama mendapat peringkat sama.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button onClick={() => void load()} className="text-link">Coba lagi</button></p>}
    {!data ? <p role="status" className="mt-4 text-sm text-slate-500">Memuat peringkat…</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-[320px] w-full table-fixed text-left text-sm"><caption className="sr-only">Nickname, skor dan peringkat peserta room</caption><thead><tr className="border-b border-slate-200"><th className="w-14 py-3">Rank</th><th className="py-3">Peserta</th><th className="w-16 py-3">Skor</th><th className="w-24 py-3">Status</th></tr></thead><tbody>{data.entries.map((entry) => <tr key={entry.participantId} className="border-b border-slate-100"><td className="py-3">{entry.rank === null ? "—" : `#${entry.rank}`}</td><td className="break-all py-3 pr-2">{entry.nickname}</td><td className="py-3">{entry.score ?? "—"}</td><td className="py-3 text-xs text-slate-500">{entry.status === "WAITING" ? "Menunggu" : entry.status === "ACTIVE" ? "Mengerjakan" : entry.status === "EXPIRED" ? "Waktu habis" : "Selesai"}</td></tr>)}</tbody></table></div>}
  </section>;
}
