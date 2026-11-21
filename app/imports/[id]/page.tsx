import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth";
import { findDraft } from "@/lib/imports/drafts";
import { letters, type ImportIssue } from "@/lib/imports/limits";

function Issues({ errors }: { errors: ImportIssue[] }) {
  return errors.length ? <ul className="mt-4 space-y-2 break-words rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" aria-label="Error validasi">
    {errors.map((error, index) => <li key={index}><strong>{error.field}:</strong> {error.message}</li>)}
  </ul> : null;
}

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await requireHost(`/imports/${id}`);
  const draft = await findDraft(host.id, id);
  if (!draft) notFound();
  const { preview } = draft;
  const valid = preview.errors.length ? 0 : preview.questions.filter((question) => !question.errors.length).length;
  return <main className="mx-auto w-full max-w-4xl px-5 py-10">
    <Link className="text-link" href="/banks">← Bank soal pribadi</Link>
    <p className="eyebrow mt-10">HASIL EKSTRAKSI</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Preview impor</h1>
    <p className="mt-3 break-words text-slate-600">{preview.bankName || "Bank belum diberi nama"} · {preview.category || "Kategori belum valid"}</p>
    <p className="mt-2 break-words text-sm text-slate-500">{draft.fileName} · {draft.pageCount} halaman · Draft berlaku hingga {new Date(draft.expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
    <div className="panel mt-7 flex flex-wrap gap-6 p-5 text-sm" aria-label="Ringkasan validasi"><span><strong>{preview.questions.length}</strong> soal terbaca</span><span><strong>{valid}</strong> valid</span><span><strong>{preview.questions.length - valid}</strong> perlu diperiksa</span></div>
    <Issues errors={preview.errors} />
    <p className="mt-5 text-sm leading-6 text-slate-600">Ini adalah draft, belum disimpan sebagai bank aktif. Perbaikan, pembuangan soal, dan konfirmasi tersedia pada tahap berikutnya.</p>
    <ol className="mt-7 space-y-6">
      {preview.questions.map((question, index) => <li key={index} className="panel min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 break-all font-semibold">Soal {question.sourceNumber || `tanpa nomor (${index + 1})`}</h2><span className="badge">{question.errors.length || preview.errors.length ? "Perlu diperiksa" : "Valid"}</span></div>
        <p className="mt-2 break-words text-xs text-slate-500">{question.type || "Tipe belum valid"}</p>
        <p className="mt-5 whitespace-pre-wrap break-words leading-7">{question.prompt || "Pertanyaan belum terbaca."}</p>
        <dl className="mt-5 space-y-3">{letters.map((letter) => <div key={letter} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm"><dt className="font-semibold">{letter}</dt><dd className="min-w-0 whitespace-pre-wrap break-words leading-6">{question.options[letter] || "Pilihan belum terbaca."}</dd></div>)}</dl>
        <div className="mt-5 break-words text-sm leading-7">
          {question.type === "WEIGHTED" ? <p>Bobot: {letters.map((letter) => `${letter}=${question.weights[letter] ?? "belum valid"}`).join("; ")}</p> : <p>Kunci: {question.key || "belum valid"}</p>}
          <h3 className="mt-4 font-semibold">Pembahasan</h3><p className="whitespace-pre-wrap break-words">{question.explanation || "Pembahasan belum tersedia."}</p>
        </div>
        <Issues errors={question.errors} />
        <details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-indigo-700">Teks sumber soal</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-xs leading-6">{question.rawText}</pre></details>
      </li>)}
    </ol>
    <Link className="primary mt-8 inline-flex" href="/imports/new">Unggah PDF lain</Link>
  </main>;
}
