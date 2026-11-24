"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

export function SiteHeader({ host, active = "home" }: { host: { username: string } | null; active?: "home" | "rooms" | "banks" }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      for (const ref of [menu, account]) if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const ref of [menu, account]) if (ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const links = [
    { label: "Beranda", href: "/", active: active === "home" },
    { label: "Jelajahi Soal", href: "/#latihan", active: false },
    { label: "Room", href: "/#rooms", active: active === "rooms" },
    { label: "Bank Soal", href: "/banks", active: active === "banks" },
  ];
  return <header className="border-b border-stone-200/80 bg-background">
    <div className="page-width relative flex min-h-[82px] items-center justify-between gap-3 sm:gap-6">
      <Link href="/" className="brand" aria-label="Vanexa — Beranda">vanexa<span className="text-red-600">.</span></Link>
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigasi utama">{links.map(link => <Link key={link.label} href={link.href} className="nav-link" aria-current={link.active ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="flex items-center gap-2 sm:gap-3">
        {host ? <details ref={account} className="account-menu relative">
          <summary className="flex min-h-10 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-stone-700 hover:bg-red-50" aria-label={`Menu akun ${host.username}`}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold uppercase text-red-700" aria-hidden="true">{host.username.charAt(0)}</span><span className="max-w-16 truncate sm:max-w-36">{host.username}</span><span aria-hidden="true" className="ml-1 size-1.5 rotate-45 border-b border-r border-current" />
          </summary>
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
            <p className="border-b border-stone-100 px-3 py-3 text-xs text-stone-500">Masuk sebagai <strong className="mt-1 block break-all text-sm text-stone-800">{host.username}</strong></p>
            <Link href="/banks" onClick={() => { if (account.current) account.current.open = false; }} className="mt-1 block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-stone-50">Bank soal pribadi</Link>
            <form action="/api/auth/logout" method="post"><button type="submit" className="w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50">Logout</button></form>
          </div>
        </details> : <Link href="/auth" className="secondary hidden !min-h-10 !px-5 !py-2 sm:inline-flex">Masuk</Link>}
        <Link href="/#latihan" className={`primary no-sweep !min-h-10 !px-4 !py-2 text-xs sm:text-sm ${host ? "hidden sm:inline-flex" : ""}`}>Mulai Latihan </Link>
        <details ref={menu} className="mobile-menu lg:hidden">
          <summary className="rounded-lg p-2.5" aria-label="Buka navigasi"><Icon name="menu" /></summary>
          <nav onClick={event => { if ((event.target as HTMLElement).closest("a") && menu.current) menu.current.open = false; }} aria-label="Navigasi seluler" className="absolute inset-x-5 top-[72px] z-30 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/5 sm:inset-x-8">
            {links.map(link => <Link key={link.label} href={link.href} className="block rounded-lg px-4 py-3 text-sm font-semibold hover:bg-red-50" aria-current={link.active ? "page" : undefined}>{link.label}</Link>)}
            {!host && <Link href="/auth" className="mt-1 block rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Masuk sebagai host</Link>}
          </nav>
        </details>
      </div>
    </div>
  </header>;
}
