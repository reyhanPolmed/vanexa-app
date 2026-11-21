"use client";

import { useId, useState } from "react";
import { parseQuestionSource } from "@/lib/imports/editing";
import { letters, type Letter, type PreviewQuestion } from "@/lib/imports/limits";

const structureCodes = new Set(["MALFORMED_MARKER", "MISSING_END", "DUPLICATE_MARKER", "MARKER_ORDER", "UNKNOWN_MARKER", "UNEXPECTED_TEXT", "UNEXPECTED_END", "INVALID_QUESTION_BLOCK", "CONFLICTING_SCORE"]);
const hasStructureErrors = (question: PreviewQuestion) => question.errors.some((error) => structureCodes.has(error.code));
function fieldsFrom(question: PreviewQuestion) {
  return { number: question.sourceNumber, type: question.type, prompt: question.prompt, options: Object.fromEntries(letters.map((letter) => [letter, question.options[letter] ?? ""])) as Record<Letter, string>, key: question.key ?? "", weights: Object.fromEntries(letters.map((letter) => [letter, String(question.weights[letter] ?? "")])) as Record<Letter, string>, explanation: question.explanation };
}
type Fields = ReturnType<typeof fieldsFrom>;
function sourceFrom(fields: Fields) {
  return [`QUESTION: ${fields.number}`, `TYPE: ${fields.type}`, "PROMPT:", fields.prompt, ...letters.map((letter) => `${letter}: ${fields.options[letter]}`), fields.type === "WEIGHTED" ? `WEIGHTS: ${letters.map((letter) => `${letter}=${fields.weights[letter]}`).join(";")}` : `KEY: ${fields.key}`, ...(fields.explanation ? ["EXPLANATION:", fields.explanation] : []), "---END---"].join("\n");
}

export function QuestionEditor({ source, number, onChange, disabled }: { source: string; number: number; onChange: (source: string) => void; disabled: boolean }) {
  const prefix = useId();
  const parsed = parseQuestionSource(source);
  const [raw, setRaw] = useState(hasStructureErrors(parsed));
  const [fields, setFields] = useState(() => fieldsFrom(parsed));
  function update(next: Fields) { setFields(next); onChange(sourceFrom(next)); }
  return <details className="mt-5">
    <summary className="cursor-pointer text-sm font-medium text-indigo-700">Perbaiki soal {number}</summary>
    <fieldset disabled={disabled} aria-label={`Editor soal ${number}`} className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4">
      {raw ? <>
        <label className="field-label" htmlFor={`${prefix}-raw`}>Teks sumber untuk diperbaiki</label>
        <p className="text-sm leading-6 text-slate-600">Perbaiki marker dan isi yang ambigu secara langsung. Semua teks dipertahankan sampai Anda mengubahnya.</p>
        <textarea id={`${prefix}-raw`} className="field min-h-80 py-3 font-mono text-sm" value={source} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="text-link text-sm" disabled={hasStructureErrors(parsed)} onClick={() => { setFields(fieldsFrom(parsed)); setRaw(false); }}>Gunakan editor isian</button>
      </> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor={`${prefix}-number`}>Nomor sumber</label><input id={`${prefix}-number`} className="field" value={fields.number} onChange={(event) => update({ ...fields, number: event.target.value })} /></div>
          <div><label className="field-label" htmlFor={`${prefix}-type`}>Jenis skor</label><select id={`${prefix}-type`} className="field" value={fields.type} onChange={(event) => update({ ...fields, type: event.target.value })}><option value="">Pilih jenis skor</option>{!["", "SINGLE_CORRECT", "WEIGHTED"].includes(fields.type) && <option value={fields.type}>{fields.type} (invalid)</option>}<option value="SINGLE_CORRECT">Satu kunci benar</option><option value="WEIGHTED">Bobot tiap pilihan</option></select></div>
        </div>
        <div><label className="field-label" htmlFor={`${prefix}-prompt`}>Pertanyaan</label><textarea id={`${prefix}-prompt`} className="field min-h-24 py-3" value={fields.prompt} onChange={(event) => update({ ...fields, prompt: event.target.value })} /></div>
        {letters.map((letter) => <div key={letter}><label className="field-label" htmlFor={`${prefix}-${letter}`}>Pilihan {letter}</label><textarea id={`${prefix}-${letter}`} className="field py-3" value={fields.options[letter]} onChange={(event) => update({ ...fields, options: { ...fields.options, [letter]: event.target.value } })} /></div>)}
        {fields.type === "WEIGHTED" ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{letters.map((letter) => <div key={letter}><label className="field-label" htmlFor={`${prefix}-weight-${letter}`}>Bobot {letter}</label><input id={`${prefix}-weight-${letter}`} className="field" type="number" min={0} max={5} step={1} value={fields.weights[letter]} onChange={(event) => update({ ...fields, weights: { ...fields.weights, [letter]: event.target.value } })} /></div>)}</div> : <div><label className="field-label" htmlFor={`${prefix}-key`}>Kunci jawaban</label><input id={`${prefix}-key`} className="field" value={fields.key} onChange={(event) => update({ ...fields, key: event.target.value })} /></div>}
        <div><label className="field-label" htmlFor={`${prefix}-explanation`}>Pembahasan (opsional)</label><textarea id={`${prefix}-explanation`} className="field min-h-24 py-3" value={fields.explanation} onChange={(event) => update({ ...fields, explanation: event.target.value })} /></div>
        <button type="button" className="text-link text-sm" onClick={() => setRaw(true)}>Edit teks sumber langsung</button>
      </>}
    </fieldset>
  </details>;
}
