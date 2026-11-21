"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return <form onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), next: destination }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      router.replace(data.destination);
      router.refresh();
    } catch { setError("Koneksi bermasalah. Coba lagi."); }
    finally { setPending(false); }
  }} className="space-y-5" aria-busy={pending}>
    <div>
      <label htmlFor="username" className="field-label">Username</label>
      <input className="field" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" aria-describedby="username-help" />
      <p id="username-help" className="mt-2 text-xs text-slate-500">3–32 huruf, angka, atau garis bawah. Tidak membedakan huruf besar/kecil.</p>
    </div>
    <div>
      <label htmlFor="password" className="field-label">Password</label>
      <input className="field" id="password" type="password" name="password" autoComplete="current-password" required maxLength={128} />
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" className="primary w-full" disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</button>
    <p role="status" className="sr-only">{pending ? "Memeriksa username dan password" : ""}</p>
  </form>;
}
