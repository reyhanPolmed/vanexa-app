"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQuestionSource, validateEditState, type EditState } from "@/lib/imports/editing";
import { letters, type ImportPreview } from "@/lib/imports/limits";
import type { DuplicateWarning } from "@/lib/imports/duplicates";
import { QuestionEditor } from "./question-editor";

type Props = { mode: "draft" | "bank"; id: string; revision: number; state: EditState; original: ImportPreview; duplicates: DuplicateWarning[]; confirmedBankId?: string | null };

export function BankEditor(props: Props) {
  const router = useRouter();
  const [state, setState] = useState(props.state);
  const [revision, setRevision] = useState(props.revision);
  const [duplicates, setDuplicates] = useState(props.duplicates);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  const evaluated = useMemo(() => {
    try { return validateEditState(state, props.original, props.mode === "draft"); }
    catch { return { preview: { ...props.original, questions: [], errors: [{ field: "editor", code: "VALIDATION_ERROR", message: "Data editor melebihi batas atau memiliki struktur tidak valid. Periksa perubahan Anda." }] }, itemPreviews: state.items.map((item) => parseQuestionSource(item.source)) }; }
  }, [state, props.original, props.mode]);
  const { preview, itemPreviews } = evaluated;
  const valid = preview.errors.length ? 0 : preview.questions.filter((question) => !question.errors.length).length;
  const invalid = preview.questions.length - valid;
  const removed = state.items.flatMap((item, index) => item.discarded ? [props.original.questions[index].sourceNumber || String(index + 1)] : []);
  const documentErrors = props.original.errors.filter((issue) => !["bankName", "category"].includes(issue.field));
  function change(next: EditState) { setState(next); setDirty(true); setReview(false); setMessage(""); }
  const path = props.mode === "draft" ? `/api/imports/${props.id}` : `/api/banks/${props.id}`;

  async function save() {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, state }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message); return; }
      const saved = result[props.mode === "draft" ? "draft" : "bank"];
      if (!saved) { setError("Draft sudah kedaluwarsa. Unggah PDF kembali."); return; }
      setState(saved.state); setRevision(saved.revision); setDuplicates(saved.duplicates); setDirty(false); setReview(false); setMessage("Perbaikan tersimpan."); key.current = null;
      if (props.mode === "bank") router.refresh();
    } catch { setError("Koneksi bermasalah. Perubahan belum diakui server. Coba simpan lagi."); }
    finally { setPending(false); }
  }
  async function confirm() {
    if (pending) return;
    setPending(true); setError("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`${path}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, idempotencyKey: key.current }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message); return; }
      router.push(result.destination); router.refresh();
    } catch { setError("Koneksi terputus. Ulangi konfirmasi; bank tidak akan digandakan."); }
    finally { setPending(false); }
  }
  if (props.confirmedBankId) return <section className="panel mt-7 p-6"><h2 className="font-semibold">Impor sudah dikonfirmasi</h2><p className="mt-3 text-sm text-slate-500">Bank sudah dibuat. Draft ini tidak dapat dikonfirmasi ulang sebagai bank baru.</p><Link className="primary mt-5 inline-flex" href={`/banks/${props.confirmedBankId}`}>Buka bank soal</Link></section>;

  return <div aria-busy={pending}>
    <fieldset disabled={pending} className="panel mt-7 grid gap-4 p-5 sm:grid-cols-2">
      <div><label className="field-label" htmlFor="bank-name">Nama bank</label><input className="field" id="bank-name" value={state.bankName} maxLength={120} onChange={(event) => change({ ...state, bankName: event.target.value })} /></div>
      <div><label className="field-label" htmlFor="category">Kategori</label><select className="field" id="category" value={state.category} onChange={(event) => change({ ...state, category: event.target.value })}><option value="">Pilih kategori</option>{!["", "TIU", "TWK", "TKP", "RANDOM"].includes(state.category) && <option value={state.category}>{state.category} (invalid)</option>}<option>TIU</option><option>TWK</option><option>TKP</option><option value="RANDOM">Random</option></select></div>
    </fieldset>
    {documentErrors.length > 0 && <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6"><h2 className="font-semibold">Periksa masalah dokumen sumber</h2><ul className="mt-2 break-words">{documentErrors.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul><label className="mt-4 flex items-start gap-3"><input type="checkbox" className="mt-1" disabled={pending} checked={state.reviewedDocument} onChange={(event) => change({ ...state, reviewedDocument: event.target.checked })} /><span>Saya telah memeriksa teks di luar struktur soal dan memindahkan isi penting ke soal. Sisa teks di luar struktur boleh dibuang; nama bank dan kategori di atas adalah pilihan saya.</span></label></section>}
    <div className="panel mt-6 flex flex-wrap gap-6 p-5 text-sm" aria-label="Ringkasan validasi"><span><strong>{preview.questions.length}</strong> soal terbaca</span><span><strong>{valid}</strong> valid</span><span><strong>{invalid}</strong> perlu diperiksa</span>{removed.length > 0 && <span><strong>{removed.length}</strong> dibuang</span>}</div>
    {preview.errors.length > 0 && <ul aria-label="Error dokumen" className="mt-4 break-words rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{preview.errors.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}
    {dirty ? <p className="mt-4 text-sm text-amber-800">Perubahan belum tersimpan. Simpan untuk memperbarui peringatan duplikat dan melanjutkan.</p> : duplicates.length > 0 && <aside className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6"><h2 className="font-semibold">Peringatan duplikat</h2><ul>{duplicates.map((warning) => <li key={warning.index}>Soal {preview.questions[warning.index]?.sourceNumber}: pertanyaan dan opsi sama {warning.inDraft ? "di kumpulan ini" : ""}{warning.inDraft && warning.inExistingBank ? " dan " : ""}{warning.inExistingBank ? "dengan bank milik Anda" : ""}. Kunci, bobot, atau pembahasan bisa berbeda.</li>)}</ul><p className="mt-2">Tidak ada soal yang dihapus atau digabung otomatis. Anda boleh mempertahankannya.</p></aside>}
    <ol className="mt-7 space-y-6">
      {state.items.map((item, index) => {
        const question = itemPreviews[index];
        return <li key={`${revision}-${index}`} className={`panel min-w-0 p-5 sm:p-7 ${item.discarded ? "bg-slate-100" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 break-all font-semibold">Soal {question.sourceNumber || `tanpa nomor (${index + 1})`}</h2><span className="badge">{item.discarded ? "Dibuang" : question.errors.length || preview.errors.length ? "Perlu diperiksa" : "Valid"}</span></div>
          <p className="mt-2 break-words text-xs text-slate-500">{question.type || "Tipe belum valid"}</p>
          <p className="mt-5 whitespace-pre-wrap break-words leading-7">{question.prompt || "Pertanyaan belum terbaca."}</p>
          <dl className="mt-5 space-y-3">{letters.map((letter) => <div key={letter} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm"><dt className="font-semibold">{letter}</dt><dd className="min-w-0 whitespace-pre-wrap break-words leading-6">{question.options[letter] || "Pilihan belum terbaca."}</dd></div>)}</dl>
          <div className="mt-5 break-words text-sm leading-7">{question.type === "WEIGHTED" ? <p>Bobot: {letters.map((letter) => `${letter}=${question.weights[letter] ?? "belum valid"}`).join("; ")}</p> : <p>Kunci: {question.key || "belum valid"}</p>}<h3 className="mt-4 font-semibold">Pembahasan</h3><p className="whitespace-pre-wrap">{question.explanation || "Pembahasan belum tersedia."}</p></div>
          {question.errors.length > 0 && <ul aria-label="Error validasi" className="mt-4 space-y-2 break-words rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{question.errors.map((issue, issueIndex) => <li key={issueIndex}><strong>{issue.field}:</strong> {issue.message}</li>)}</ul>}
          <details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-red-700">Teks sumber soal</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-xs leading-6">{item.source}</pre></details>
          {!item.discarded && <QuestionEditor source={item.source} number={index + 1} disabled={pending} onChange={(source) => change({ ...state, items: state.items.map((old, i) => i === index ? { ...old, source } : old) })} />}
          {props.mode === "draft" && <button className="text-link mt-5 text-sm" type="button" disabled={pending} onClick={() => change({ ...state, items: state.items.map((old, i) => i === index ? { ...old, discarded: !old.discarded } : old) })}>{item.discarded ? "Pulihkan" : "Buang"} soal {index + 1}</button>}
        </li>;
      })}
    </ol>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <p role="status" className="mt-5 text-sm text-slate-600">{pending ? "Memproses perubahan…" : message}</p>
    <div className="mt-5 flex flex-wrap gap-4"><button type="button" className="primary" disabled={pending || !dirty} onClick={save}>Simpan perbaikan</button>{props.mode === "draft" && <button type="button" className="primary" disabled={pending || dirty || invalid > 0 || preview.errors.length > 0 || !preview.questions.length} onClick={() => setReview(true)}>Tinjau impor</button>}</div>
    {review && <section aria-label="Konfirmasi final" className="panel mt-6 p-6"><h2 className="text-xl font-semibold">Periksa jumlah final</h2><p className="mt-3">{preview.questions.length} soal akan disimpan ke bank “{preview.bankName}”.</p><p className="mt-2 break-words text-sm">Dibuang: {removed.length ? `soal sumber ${removed.join(", ")}` : "tidak ada"}.</p>{duplicates.length > 0 && <p className="mt-2 text-sm text-amber-900">Peringatan duplikat tetap ada. Semua soal yang dipertahankan akan disimpan.</p>}<button type="button" className="primary mt-5" disabled={pending || dirty} onClick={confirm}>Konfirmasi impor</button></section>}
    {props.mode === "bank" && <p className="mt-6 text-sm text-slate-500">Bank ini dapat digunakan kembali saat membuat Room. Pengaturan Room tersedia pada tiket berikutnya.</p>}
  </div>;
}
