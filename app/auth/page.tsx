import Link from "next/link";
import { redirect } from "next/navigation";
import { currentHost, safeDestination } from "@/lib/auth";
import { LoginForm } from "./login-form";
import Image from "next/image";
import { Icon } from "../components/icons";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const query = await searchParams;
  const destination = safeDestination(query.next);
  const registering = query.mode === "register";
  if (await currentHost()) redirect(destination);
  return <main className="page-width flex min-h-svh flex-col py-7 sm:py-9">
    <div className="flex items-center justify-between gap-4"><Link href="/" className="brand">vanexa<span className="text-red-600">.</span></Link><Link href="/" className="text-xs font-semibold text-stone-500 hover:text-red-700">← Kembali ke beranda</Link></div>
    <div className="my-auto grid items-center gap-12 py-12 md:grid-cols-2 lg:gap-24">
      <aside className="hidden rounded-[28px] border border-[#eddfd5] bg-[#f6ede4] p-9 md:block">
        <p className="eyebrow">RUANG LATIHAN, TEMAN BERTUMBUH</p><h2 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-[-1.5px]">Persiapan besar,<br />dimulai bersama.</h2><p className="mt-4 max-w-sm text-sm leading-7 text-stone-600">Kumpulkan soal pilihanmu. Buka room. Ajak teman untuk saling mengasah kemampuan.</p><Image src="/quiz-illustration.svg" width={600} height={450} alt="" loading="eager" className="mt-3 h-auto w-full" /><p className="flex items-center gap-2 text-xs font-semibold text-stone-600"><Icon name="check" className="size-4 text-red-600" />Bank soal pribadi, siap dipakai bersama.</p>
      </aside>
      <section className="mx-auto w-full max-w-[400px]" aria-labelledby="auth-title">
        <span className="badge">AKUN VANEXA</span><h1 id="auth-title" className="mt-5 text-3xl font-extrabold leading-tight tracking-[-1px] sm:text-4xl">{registering ? "Buat akunmu" : "Selamat datang kembali"}</h1><p className="mb-8 mt-4 text-sm leading-7 text-stone-500">{registering ? "Daftar dengan username dan password. Akunmu langsung siap digunakan." : "Masuk untuk mengelola bank soal pribadi Anda."}</p>
        <LoginForm key={registering ? "register" : "login"} destination={destination} mode={registering ? "register" : "login"} />
        <p className="mt-6 text-center text-sm text-stone-600">{registering ? "Sudah punya akun? " : "Belum punya akun? "}<Link href={`/auth?mode=${registering ? "login" : "register"}&next=${encodeURIComponent(destination)}`} className="text-link">{registering ? "Masuk" : "Daftar akun"}</Link></p>
        <p className="mt-6 border-t border-stone-200 pt-5 text-center text-xs leading-6 text-stone-500">Ingin ikut latihan? Gabung melalui tautan room dari temanmu.</p>
      </section>
    </div>
  </main>;
}
