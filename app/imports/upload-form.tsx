"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importLimits } from "@/lib/imports/limits";

export function UploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <form className="space-y-5" aria-busy={pending} onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const file = new FormData(event.currentTarget).get("pdf");
    setError("");
    if (!(file instanceof File) || !file.size) { setError("Pilih file PDF terlebih dahulu."); return; }
    if (file.size > importLimits.bytes) { setError("Ukuran PDF maksimal 5 MiB."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) }, body: file });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      router.push(data.destination);
    } catch { setError("Koneksi bermasalah. File belum berhasil diimpor. Coba lagi."); }
    finally { setPending(false); }
  }}>
    <div>
      <label className="field-label" htmlFor="pdf">File PDF</label>
      <input className="field p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-red-50 file:px-3 file:py-1 file:text-red-700" type="file" id="pdf" name="pdf" accept="application/pdf,.pdf" required disabled={pending} aria-describedby="upload-help" />
      <p id="upload-help" className="mt-3 text-sm leading-6 text-slate-500">PDF teks satu kolom, maksimal 5 MiB, 50 halaman, dan 200 soal. Scan, gambar, dan PDF bersandi tidak didukung.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <button type="submit" className="primary" disabled={pending}>{pending ? "Mengekstrak…" : "Ekstrak soal"}</button>
    <p role="status" className="text-sm text-slate-500">{pending ? "Membaca PDF dan memvalidasi struktur soal. Mohon tunggu." : "Soal belum menjadi bank aktif sebelum dikonfirmasi pada tahap berikutnya."}</p>
  </form>;
}
