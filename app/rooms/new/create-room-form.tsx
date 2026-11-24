"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BankOption = {
  id: string;
  name: string;
  category: "TIU" | "TWK" | "TKP" | "RANDOM";
};

export function CreateRoomForm({ banks }: { banks: BankOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"TIU" | "TWK" | "TKP" | "RANDOM">("TIU");
  const [bankId, setBankId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter banks by selected category
  const filteredBanks = banks.filter((b) => b.category === category);

  // Auto-select first bank when category changes or when filteredBanks changes
  const effectiveBankId = filteredBanks.some((b) => b.id === bankId)
    ? bankId
    : (filteredBanks[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) {
      setError("Nama room harus antara 1 dan 120 karakter.");
      return;
    }

    if (!effectiveBankId) {
      setError("Pilih bank soal yang valid untuk kategori ini.");
      return;
    }

    if (durationMinutes < 5 || durationMinutes > 180) {
      setError("Durasi kuis harus antara 5 dan 180 menit.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          category,
          bankId: effectiveBankId,
          durationMinutes,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Gagal membuat room. Periksa kembali data Anda.");
        setLoading(false);
        return;
      }

      router.push(`/rooms/${data.roomId}`);
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel mt-6 grid gap-6 p-6 sm:p-8 md:grid-cols-2">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 md:col-span-2"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="room-name" className="field-label">
          Nama Room <span className="text-rose-500">*</span>
        </label>
        <input
          id="room-name"
          name="name"
          type="text"
          maxLength={120}
          required
          placeholder="Contoh: Latihan TIU Sore Kelompok A"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-500">Maksimum 120 karakter. Terlihat oleh semua pengunjung.</p>
      </div>

      <div>
        <label htmlFor="room-category" className="field-label">
          Kategori Latihan <span className="text-rose-500">*</span>
        </label>
        <select
          id="room-category"
          name="category"
          className="field"
          value={category}
          onChange={(e) => {
            const nextCat = e.target.value as "TIU" | "TWK" | "TKP" | "RANDOM";
            setCategory(nextCat);
            const nextFiltered = banks.filter((b) => b.category === nextCat);
            setBankId(nextFiltered[0]?.id ?? "");
          }}
          disabled={loading}
        >
          <option value="TIU">Tes Intelegensia Umum (TIU)</option>
          <option value="TWK">Tes Wawasan Kebangsaan (TWK)</option>
          <option value="TKP">Tes Karakteristik Pribadi (TKP)</option>
          <option value="RANDOM">Random — Topik lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor="room-bank" className="field-label">
          Pilih Bank Soal <span className="text-rose-500">*</span>
        </label>
        {filteredBanks.length > 0 ? (
          <>
            <select
              id="room-bank"
              name="bankId"
              className="field"
              value={effectiveBankId}
              onChange={(e) => setBankId(e.target.value)}
              disabled={loading}
              required
            >
              {filteredBanks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.category})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Soal akan disalin (snapshot) ke room saat dibuat. Perubahan bank setelahnya tidak mengubah room.
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Belum ada bank soal untuk kategori {category}.</p>
            <p className="mt-1 text-xs text-amber-700">
              Impor PDF terlebih dahulu untuk membuat bank soal {category}.
            </p>
            <Link href="/imports/new" className="text-link mt-2 inline-block text-xs font-semibold">
              Impor PDF baru
            </Link>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="room-duration" className="field-label">
          Durasi Kuis (menit) <span className="text-rose-500">*</span>
        </label>
        <input
          id="room-duration"
          name="durationMinutes"
          type="number"
          min={5}
          max={180}
          required
          className="field"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-500">Antara 5 sampai 180 menit.</p>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 md:col-span-2">
        💡 <strong>Catatan:</strong> Room bersifat publik dan dapat ditemukan oleh semua pengunjung di daftar kategori. Anda sebagai Host akan otomatis bergabung sebagai peserta kuis.
      </div>

      <div className="pt-2 md:col-span-2">
        <button
          type="submit"
          disabled={loading || filteredBanks.length === 0}
          className="primary w-full flex items-center justify-center py-3 text-base"
        >
          {loading ? "Membuat room..." : "Buat room & Buka Lobby"}
        </button>
      </div>
    </form>
  );
}
