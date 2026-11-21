import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth";
import { findDraft } from "@/lib/imports/drafts";
import { BankEditor } from "@/app/components/bank-editor";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await requireHost(`/imports/${id}`);
  const draft = await findDraft(host.id, id);
  if (!draft) notFound();
  return <main className="mx-auto w-full max-w-4xl px-5 py-10">
    <Link className="text-link" href="/banks">← Bank soal pribadi</Link>
    <p className="eyebrow mt-10">HASIL EKSTRAKSI</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Preview impor</h1>
    <p className="mt-3 break-words text-slate-600">{draft.preview.bankName || "Bank belum diberi nama"} · {draft.preview.category || "Kategori belum valid"}</p>
    <p className="mt-2 break-words text-sm text-slate-500">{draft.fileName} · {draft.pageCount} halaman · Draft berlaku hingga {new Date(draft.expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
    <p className="mt-5 text-sm leading-6 text-slate-600">Periksa soal sebelum konfirmasi. Buang soal yang tidak ingin disimpan; penghapusan selalu atas pilihan Anda.</p>
    <BankEditor mode="draft" id={id} revision={draft.revision} state={draft.state} original={draft.originalPreview} duplicates={draft.duplicates} confirmedBankId={draft.confirmedBankId} />
    <Link className="text-link mt-8 inline-block" href="/imports/new">Unggah PDF lain</Link>
  </main>;
}
