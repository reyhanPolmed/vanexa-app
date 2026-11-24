"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteRoom({ roomId }: { roomId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Room belum berhasil dihapus."); setPending(false); return; }
      dialog.current?.close();
      router.replace("/"); router.refresh();
    } catch { setError("Koneksi terputus. Coba lagi."); setPending(false); }
  }
  return <>
    <button type="button" className="secondary" onClick={() => { setError(""); dialog.current?.showModal(); }}>Hapus room</button>
    <dialog ref={dialog} aria-labelledby="delete-room-title" onCancel={event => { if (pending) event.preventDefault(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-stone-800 shadow-xl backdrop:bg-black/40">
      <h2 id="delete-room-title" className="text-xl font-bold">Hapus room ini?</h2>
      <p className="mt-4 text-sm leading-7 text-stone-600">Room, seluruh sesi, jawaban, dan hasil peserta akan dihapus permanen. Pengerjaan yang masih berjalan akan dihentikan. Bank soal asli tetap tersimpan.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} className="secondary" onClick={() => dialog.current?.close()}>Batal</button><button type="button" disabled={pending} className="primary" onClick={remove}>{pending ? "Menghapus…" : "Ya, hapus room"}</button></div>
    </dialog>
  </>;
}
