import Link from "next/link";
import { redirect } from "next/navigation";
import { currentHost, safeDestination } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destination = safeDestination((await searchParams).next);
  if (await currentHost()) redirect(destination);
  return <main className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
    <Link href="/" className="brand">vanexa<span className="text-indigo-600">.</span></Link>
    <section className="panel mt-8 p-6 sm:p-8" aria-labelledby="auth-title">
      <p className="eyebrow">AREA HOST</p>
      <h1 id="auth-title" className="mt-3 text-3xl font-semibold tracking-tight">Selamat datang kembali</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">Masuk untuk mengelola bank soal pribadi Anda.</p>
      <LoginForm destination={destination} />
    </section>
    <p className="mt-6 text-center text-sm text-slate-500">Akun Host disiapkan oleh pengelola Vanexa.</p>
    <p className="mt-5 text-center"><Link className="text-link" href="/">Kembali ke beranda</Link></p>
  </main>;
}
