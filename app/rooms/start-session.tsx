"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartSession({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/start`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Sesi belum berhasil dimulai."); setPending(false); return; }
      router.push(`/rooms/${roomId}/quiz`); router.refresh();
    } catch { setError("Koneksi terputus. Coba lagi."); setPending(false); }
  }
  return <div><button type="button" className="primary" disabled={pending} onClick={start}>{pending ? "Memulai sesi…" : "Mulai sesi baru"}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
