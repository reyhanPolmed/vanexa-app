import Link from "next/link";
import { requireHost } from "@/lib/auth";
import { listBanks } from "@/lib/banks";
import { CreateRoomForm } from "./create-room-form";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export default async function NewRoomPage() {
  const host = await requireHost("/rooms/new");
  const banks = await listBanks(host.id);

  return (
    <><SiteHeader host={host} active="rooms" />
    <main className="page-width flex-1 py-8">

      <section className="py-8 sm:py-10">
        <Link href="/banks" className="text-link inline-flex items-center text-sm">
          ← Kembali ke bank soal
        </Link>

        <p className="eyebrow mt-6">BUAT SESI BARU</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Buat Room Publik
        </h1>
        <p className="mt-2 max-w-xl text-slate-500">
          Pilih bank soal milik Anda, tentukan durasi latihan, dan buka lobby untuk peserta kelompok belajar Anda.
        </p>

        <CreateRoomForm banks={banks} />
      </section>
    </main><SiteFooter /></>
  );
}
