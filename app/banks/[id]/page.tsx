import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth";
import { findBank } from "@/lib/banks";

export default async function BankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await requireHost(`/banks/${id}`);
  const bank = await findBank(host.id, id);
  if (!bank) notFound();
  return <main className="mx-auto w-full max-w-3xl px-5 py-12">
    <Link href="/banks" className="text-link">← Bank soal pribadi</Link>
    <section className="panel mt-8 p-8">
      <span className="badge">{bank.category}</span>
      <h1 className="mt-4 break-words text-3xl font-semibold">{bank.name}</h1>
      <p className="mt-4 text-slate-500">Bank ini hanya dapat diakses oleh pemiliknya. Pengelolaan isi soal tersedia pada tahap impor.</p>
    </section>
  </main>;
}
