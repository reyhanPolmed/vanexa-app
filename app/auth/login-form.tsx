"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ destination, mode = "login" }: { destination: string; mode?: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return <form onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (registering && form.get("password") !== form.get("confirmPassword")) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), confirmPassword: form.get("confirmPassword"), next: destination }),
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
      <input className="field" id="password" type="password" name="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 12 : undefined} maxLength={128} aria-describedby={registering ? "password-help" : undefined} />
      {registering && <p id="password-help" className="mt-2 text-xs text-slate-500">Gunakan 12–128 karakter.</p>}
    </div>
    {registering && <div><label htmlFor="confirm-password" className="field-label">Konfirmasi password</label><input className="field" id="confirm-password" type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} /></div>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" className="primary w-full" disabled={pending}>{pending ? (registering ? "Membuat akun…" : "Memeriksa…") : (registering ? "Daftar akun" : "Masuk")}</button>
    <p role="status" className="sr-only">{pending ? (registering ? "Menyimpan akun baru" : "Memeriksa username dan password") : ""}</p>
  </form>;
}
