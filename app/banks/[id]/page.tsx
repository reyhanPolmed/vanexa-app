import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth";
import { bankDetail } from "@/lib/banks";
import { BankEditor } from "@/app/components/bank-editor";

export default async function BankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await requireHost(`/banks/${id}`);
  const bank = await bankDetail(host.id, id);
  if (!bank) notFound();
  return <main className="mx-auto w-full max-w-4xl px-5 py-10">
    <Link href="/banks" className="text-link">← Bank soal pribadi</Link>
    <p className="eyebrow mt-10">BANK SOAL PRIBADI</p>
    <h1 className="mt-3 break-words text-3xl font-semibold">{bank.name}</h1>
    <p className="mt-3 text-sm text-slate-500">{bank.category} · {bank.questions.length} soal tersimpan · Revision {bank.revision}</p>
    <BankEditor mode="bank" id={id} revision={bank.revision} state={bank.state} original={bank.preview} duplicates={bank.duplicates} />
  </main>;
}
