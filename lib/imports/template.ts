import { ImportFailure, importLimits, letters, type ImportIssue, type ImportPreview, type PreviewQuestion } from "./limits";

const issue = (field: string, code: string, message: string): ImportIssue => ({ field, code, message });
const fieldOrder = ["TYPE", "PROMPT", ...letters, "KEY", "WEIGHTS", "EXPLANATION"];

function parseQuestion(lines: string[], terminated: boolean): PreviewQuestion {
  const errors: ImportIssue[] = [];
  const fields = new Map<string, string>();
  let active = "";
  let lastOrder = -1;
  const sourceNumber = lines[0].slice("QUESTION:".length).trim();
  if (!/^[1-9]\d*$/.test(sourceNumber)) errors.push(issue("sourceNumber", "INVALID_NUMBER", "Nomor soal harus bilangan bulat positif."));
  if (!terminated) errors.push(issue("structure", "MISSING_END", "Pemisah ---END--- tidak ditemukan."));
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      if (active && ["PROMPT", "EXPLANATION", ...letters].includes(active)) fields.set(active, `${fields.get(active) ?? ""}\n`);
      continue;
    }
    const marker = /^([A-Z_]+):\s*(.*)$/.exec(line);
    if (!marker && /^(?:QUESTION|TYPE|PROMPT|[A-E]|KEY|WEIGHTS|EXPLANATION|CATEGORY|BANK)\s*:/i.test(line)) {
      errors.push(issue("structure", "MALFORMED_MARKER", "Marker harus memakai huruf kapital dan titik dua tanpa spasi sebelumnya; periksa teks sumber."));
      active = "";
      continue;
    }
    if (marker) {
      const [, field, value] = marker;
      const order = fieldOrder.indexOf(field);
      if (order === -1) { errors.push(issue("structure", "UNKNOWN_MARKER", `Marker ${field} tidak dikenali di dalam soal.`)); active = ""; continue; }
      if (fields.has(field)) errors.push(issue(field, "DUPLICATE_MARKER", `Marker ${field} berulang; periksa teks sumber.`));
      else fields.set(field, value);
      if (order < lastOrder) errors.push(issue(field, "MARKER_ORDER", `Urutan marker ${field} tidak sesuai template.`));
      lastOrder = Math.max(order, lastOrder);
      active = field;
    } else if (active && ["PROMPT", "EXPLANATION", ...letters].includes(active)) {
      fields.set(active, `${fields.get(active) || ""}\n${line}`);
    } else errors.push(issue("structure", "UNEXPECTED_TEXT", "Teks di luar bagian pertanyaan, opsi, atau pembahasan perlu diperiksa."));
  }
  const type = fields.get("TYPE")?.trim() ?? "";
  const prompt = fields.get("PROMPT")?.trim() ?? "";
  const options: PreviewQuestion["options"] = {};
  for (const letter of letters) {
    const value = fields.get(letter)?.trim();
    if (!value) errors.push(issue(`options.${letter}`, "MISSING_OPTION", `Pilihan ${letter} belum diisi.`));
    else options[letter] = value;
  }
  if (!prompt) errors.push(issue("prompt", "MISSING_PROMPT", "Teks pertanyaan belum diisi."));
  if (!["SINGLE_CORRECT", "WEIGHTED"].includes(type)) errors.push(issue("type", "INVALID_TYPE", "TYPE harus SINGLE_CORRECT atau WEIGHTED."));
  const key = fields.get("KEY")?.trim() ?? null;
  const weights: PreviewQuestion["weights"] = {};
  if (type === "SINGLE_CORRECT") {
    if (!key || !/^[A-E]$/.test(key)) errors.push(issue("key", "INVALID_KEY", "Kunci harus satu huruf A sampai E."));
    if (fields.has("WEIGHTS")) errors.push(issue("weights", "CONFLICTING_SCORE", "Soal SINGLE_CORRECT tidak boleh memiliki WEIGHTS."));
  }
  if (type === "WEIGHTED") {
    if (fields.has("KEY")) errors.push(issue("key", "CONFLICTING_SCORE", "Soal WEIGHTED tidak boleh memiliki KEY."));
    const seen = new Set<string>();
    for (const entry of (fields.get("WEIGHTS") ?? "").split(";")) {
      const match = /^([A-E])\s*=\s*([0-5])$/.exec(entry.trim());
      if (!match || seen.has(match[1])) { errors.push(issue("weights", "INVALID_WEIGHT", "Bobot harus lengkap A–E, masing-masing bilangan bulat 0–5, tanpa pengulangan.")); continue; }
      seen.add(match[1]);
      weights[match[1] as keyof typeof weights] = Number(match[2]);
    }
    for (const letter of letters) if (!seen.has(letter)) errors.push(issue(`weights.${letter}`, "MISSING_WEIGHT", `Bobot ${letter} belum diisi dengan benar.`));
  }
  return { sourceNumber, type, prompt, options, key, weights, explanation: fields.get("EXPLANATION")?.trim() ?? "", rawText: lines.join("\n") + (terminated ? "\n---END---" : ""), errors };
}

export function parseTemplate(text: string): ImportPreview {
  if (text.length > importLimits.textCharacters) throw new ImportFailure("IMPORT_LIMIT", "Teks PDF terlalu panjang untuk diproses.");
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd());
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines[0] !== "VANEXA-PDF-V1") throw new ImportFailure("UNSUPPORTED_TEMPLATE", "Gunakan header VANEXA-PDF-V1 dan template yang tersedia.");
  const preview: ImportPreview = { templateVersion: "VANEXA-PDF-V1", category: "", bankName: "", questions: [], errors: [] };
  const metadata = new Map<string, string>();
  let current: string[] | null = null;
  let sawQuestion = false;
  const finish = (terminated: boolean) => {
    if (!current) return;
    preview.questions.push(parseQuestion(current, terminated));
    current = null;
    if (preview.questions.length > importLimits.questions) throw new ImportFailure("IMPORT_LIMIT", "Maksimal 200 soal per PDF.");
  };
  for (const line of lines.slice(1)) {
    if (/^QUESTION:/.test(line)) {
      finish(false);
      sawQuestion = true;
      current = [line];
    } else if (line === "---END---") {
      if (!current) preview.errors.push(issue("structure", "UNEXPECTED_END", "Pemisah soal berada di luar blok QUESTION."));
      finish(true);
    } else if (current) current.push(line);
    else if (line.trim()) {
      const match = /^(CATEGORY|BANK):\s*(.*)$/.exec(line);
      if (sawQuestion || !match) preview.errors.push(issue("structure", "UNEXPECTED_TEXT", `Teks di luar soal: ${line}`));
      else if (metadata.has(match[1])) preview.errors.push(issue(match[1], "DUPLICATE_MARKER", `Marker ${match[1]} berulang.`));
      else metadata.set(match[1], match[2].trim());
    }
  }
  finish(false);
  preview.category = metadata.get("CATEGORY") ?? "";
  preview.bankName = metadata.get("BANK") ?? "";
  if (!["TIU", "TWK", "TKP"].includes(preview.category)) preview.errors.push(issue("category", "INVALID_CATEGORY", "CATEGORY harus TIU, TWK, atau TKP."));
  if (!preview.bankName || preview.bankName.length > 120) preview.errors.push(issue("bankName", "INVALID_BANK_NAME", "Nama BANK wajib diisi, maksimal 120 karakter."));
  if (!preview.questions.length) throw new ImportFailure("NO_QUESTIONS", "Tidak ditemukan blok QUESTION. Gunakan template standar.");
  const counts = new Map<string, number>();
  for (const q of preview.questions) counts.set(q.sourceNumber, (counts.get(q.sourceNumber) ?? 0) + 1);
  for (const q of preview.questions) if (counts.get(q.sourceNumber)! > 1) q.errors.push(issue("sourceNumber", "DUPLICATE_NUMBER", `Nomor soal ${q.sourceNumber} berulang.`));
  return preview;
}
