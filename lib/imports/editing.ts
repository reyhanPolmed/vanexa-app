import { ImportFailure, importLimits, type ImportPreview, type PreviewQuestion } from "./limits";
import { parseTemplate } from "./template";

export type EditItem = { source: string; discarded: boolean };
export type EditState = { bankName: string; category: string; reviewedDocument: boolean; items: EditItem[] };

export function initialEditState(preview: ImportPreview): EditState {
  return { bankName: preview.bankName, category: preview.category, reviewedDocument: false, items: preview.questions.map((q) => ({ source: q.rawText, discarded: false })) };
}

export function parseQuestionSource(source: string): PreviewQuestion {
  try {
    const result = parseTemplate(`VANEXA-PDF-V1\nCATEGORY: TIU\nBANK: Validation\n${source}`);
    if (result.questions.length !== 1) throw new Error("multiple question blocks");
    const question = result.questions[0];
    question.errors.push(...result.errors);
    return question;
  } catch {
    return { sourceNumber: "", type: "", prompt: "", options: {}, key: null, weights: {}, explanation: "", rawText: source, errors: [{ field: "structure", code: "INVALID_QUESTION_BLOCK", message: "Teks sumber harus memuat tepat satu blok QUESTION sesuai template, termasuk ---END---." }] };
  }
}

export function validateEditState(value: unknown, original: ImportPreview, allowDiscard = true) {
  if (!value || typeof value !== "object") throw new ImportFailure("VALIDATION_ERROR", "Data editor tidak valid.", 400);
  const input = value as Record<string, unknown>;
  if (typeof input.bankName !== "string" || typeof input.category !== "string" || typeof input.reviewedDocument !== "boolean" || /[\r\n\u0000]/.test(input.bankName + input.category) || !Array.isArray(input.items) || input.items.length !== original.questions.length || input.items.length > importLimits.questions) {
    throw new ImportFailure("VALIDATION_ERROR", "Struktur editor atau jumlah soal tidak sesuai sumber impor.", 400);
  }
  let characters = input.bankName.length + input.category.length;
  const items: EditItem[] = input.items.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new ImportFailure("VALIDATION_ERROR", "Soal editor tidak valid.", 400);
    const item = value as Record<string, unknown>;
    if (typeof item.source !== "string" || item.source.includes("\u0000") || typeof item.discarded !== "boolean" || (!allowDiscard && item.discarded)) throw new ImportFailure("VALIDATION_ERROR", "Isi soal atau status penghapusan tidak valid.", 400);
    characters += item.source.length;
    return { source: item.source, discarded: item.discarded };
  });
  if (characters > importLimits.textCharacters) throw new ImportFailure("IMPORT_LIMIT", "Total teks editor maksimal 500.000 karakter.", 413);
  const state: EditState = { bankName: input.bankName.trim(), category: input.category.trim(), reviewedDocument: input.reviewedDocument, items };
  const itemPreviews = items.map((item) => parseQuestionSource(item.source));
  const questions = itemPreviews.filter((_, index) => !items[index].discarded);
  const errors: ImportPreview["errors"] = [];
  if (!state.bankName || state.bankName.length > 120) errors.push({ field: "bankName", code: "INVALID_BANK_NAME", message: "Nama bank wajib diisi, maksimal 120 karakter." });
  if (!["TIU", "TWK", "TKP"].includes(state.category)) errors.push({ field: "category", code: "INVALID_CATEGORY", message: "Kategori harus TIU, TWK, atau TKP." });
  if (!state.reviewedDocument) errors.push(...original.errors.filter((error) => !["bankName", "category"].includes(error.field)));
  if (!questions.length) errors.push({ field: "questions", code: "NO_QUESTIONS", message: "Minimal satu soal valid harus dipertahankan." });
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.sourceNumber, (counts.get(q.sourceNumber) ?? 0) + 1);
  for (const q of questions) if (counts.get(q.sourceNumber)! > 1) q.errors.push({ field: "sourceNumber", code: "DUPLICATE_NUMBER", message: `Nomor soal ${q.sourceNumber} berulang.` });
  const preview: ImportPreview = { templateVersion: "VANEXA-PDF-V1", bankName: state.bankName, category: state.category, questions, errors };
  return { state, preview, itemPreviews };
}
