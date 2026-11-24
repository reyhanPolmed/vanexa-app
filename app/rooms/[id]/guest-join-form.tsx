"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GuestJoinForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > 32) {
      setError("Nickname harus antara 1 dan 32 karakter.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Gagal bergabung ke room.");
        setLoading(false);
        return;
      }

      // Successfully joined, refresh server state to show participant list and membership
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-6 sm:p-8 space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Gabung sebagai Guest</h3>
      <p className="text-sm text-slate-500">
        Masukkan nickname Anda untuk bergabung ke lobby latihan ini tanpa perlu membuat akun.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="guest-nickname" className="field-label">
          Nickname Anda <span className="text-rose-500">*</span>
        </label>
        <input
          id="guest-nickname"
          name="nickname"
          type="text"
          maxLength={32}
          required
          placeholder="Contoh: Budi, Ani, PejuangCPNS"
          className="field"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-500">Maksimum 32 karakter. Terlihat oleh seluruh peserta room.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="primary w-full flex items-center justify-center py-3 text-base"
      >
        {loading ? "Bergabung..." : "Gabung ke Lobby"}
      </button>
    </form>
  );
}
