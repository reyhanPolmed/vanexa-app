import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { transaction } from "../db";
import { isUuid, requireRevision } from "../mutations";
import { ImportFailure, letters, type ImportPreview, type PreviewQuestion } from "./limits";
import { initialEditState, validateEditState, type EditState } from "./editing";
import { questionFingerprint } from "./duplicates";
import { draftFromRecord, type DraftRecord } from "./drafts";

type LockedDraft = { original_preview: ImportPreview; edit_state: EditState | null; revision: number; confirmed_bank_id: string | null; confirmation_key: string | null; confirmed_revision: number | null };

async function lockDraft(client: PoolClient, ownerId: string, id: string) {
  if (!isUuid(id)) throw new ImportFailure("IMPORT_NOT_FOUND", "Draft tidak ditemukan atau kedaluwarsa.", 404);
  const result = await client.query<LockedDraft>("SELECT original_preview, edit_state, revision, confirmed_bank_id, confirmation_key, confirmed_revision FROM import_drafts WHERE id = $1 AND owner_id = $2 AND expires_at > now() FOR UPDATE", [id, ownerId]);
  if (!result.rows[0]) throw new ImportFailure("IMPORT_NOT_FOUND", "Draft tidak ditemukan atau kedaluwarsa.", 404);
  return result.rows[0];
}

export async function saveDraft(ownerId: string, id: string, revision: unknown, state: unknown) {
  requireRevision(revision);
  const record = await transaction(async (client) => {
    const draft = await lockDraft(client, ownerId, id);
    if (draft.confirmed_bank_id) throw new ImportFailure("IMPORT_CONFIRMED", "Draft sudah dikonfirmasi. Buka bank soal untuk mengeditnya.", 409);
    if (revision !== draft.revision) throw new ImportFailure("REVISION_CONFLICT", "Draft berubah di tab lain. Muat ulang sebelum menyimpan; salin perubahan Anda terlebih dahulu.", 409);
    const validated = validateEditState(state, draft.original_preview);
    return (await client.query<DraftRecord>("UPDATE import_drafts SET edit_state = $1, preview = $2, revision = revision + 1 WHERE id = $3 RETURNING id, file_name, page_count, original_preview, edit_state, expires_at, revision, confirmed_bank_id", [JSON.stringify(validated.state), JSON.stringify(validated.preview), id])).rows[0];
  });
  return draftFromRecord(ownerId, record);
}

export function assertValidBank(preview: ImportPreview) {
  if (!preview.questions.length || preview.errors.length || preview.questions.some((question) => question.errors.length)) throw new ImportFailure("IMPORT_INVALID", "Perbaiki atau buang soal invalid. Minimal satu soal valid harus tersisa.");
}

export function questionValues(question: PreviewQuestion) {
  return [question.sourceNumber, question.prompt, letters.map((letter) => question.options[letter]!), question.type, question.type === "SINGLE_CORRECT" ? question.key : null, question.type === "WEIGHTED" ? letters.map((letter) => question.weights[letter]!) : null, question.explanation, question.rawText, questionFingerprint(question)];
}

export async function confirmDraft(ownerId: string, id: string, revision: unknown, idempotencyKey: unknown) {
  requireRevision(revision);
  if (!isUuid(idempotencyKey)) throw new ImportFailure("VALIDATION_ERROR", "Idempotency key harus UUID yang valid.", 400);
  return transaction(async (client) => {
    const draft = await lockDraft(client, ownerId, id);
    if (draft.confirmed_bank_id) {
      if (draft.confirmation_key === idempotencyKey.toLowerCase() && draft.confirmed_revision === revision) return { bankId: draft.confirmed_bank_id, replayed: true };
      throw new ImportFailure("IMPORT_CONFIRMED", "Draft sudah dikonfirmasi. Buka bank yang sudah dibuat.", 409);
    }
    if (draft.revision !== revision) throw new ImportFailure("REVISION_CONFLICT", "Preview berubah. Muat ulang dan periksa jumlah final sebelum konfirmasi.", 409);
    const { preview } = validateEditState(draft.edit_state ?? initialEditState(draft.original_preview), draft.original_preview);
    assertValidBank(preview);
    const bankId = randomUUID();
    await client.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", [bankId, ownerId, preview.bankName, preview.category]);
    for (let index = 0; index < preview.questions.length; index++) {
      await client.query("INSERT INTO bank_questions (id, bank_id, position, source_number, prompt, options, scoring_type, answer_key, weights, explanation, source_text, fingerprint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [randomUUID(), bankId, index + 1, ...questionValues(preview.questions[index])]);
    }
    await client.query("UPDATE import_drafts SET confirmed_bank_id = $1, confirmation_key = $2, confirmed_revision = $3 WHERE id = $4", [bankId, idempotencyKey, revision, id]);
    return { bankId, replayed: false };
  });
}
