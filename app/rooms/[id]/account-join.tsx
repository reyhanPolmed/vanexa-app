"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AccountJoin({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function join() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) { if (!controller.signal.aborted) setError(data.message ?? "Belum berhasil bergabung."); return; }
        if (!controller.signal.aborted) router.refresh();
      } catch { if (!controller.signal.aborted) setError("Koneksi terputus. Coba lagi."); }
    }
    queueMicrotask(() => { if (!controller.signal.aborted) void join(); });
    return () => controller.abort();
  }, [roomId, retry, router]);
  return <div className="panel p-6" role="status">{error ? <><p className="text-sm text-red-700">{error}</p><button className="primary mt-4" onClick={() => { setError(""); setRetry(value => value + 1); }}>Coba lagi</button></> : <p className="break-words text-sm text-stone-600">Bergabung sebagai <strong>{username}</strong>…</p>}</div>;
}
