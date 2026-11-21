import "server-only";
import { database, transaction } from "./db";
import { isUuid, requireRevision } from "./mutations";
import { ImportFailure, type ImportPreview } from "./imports/limits";
import { initialEditState, parseQuestionSource, validateEditState } from "./imports/editing";
import { assertValidBank, questionValues } from "./imports/confirm";
import { duplicateWarnings } from "./imports/duplicates";

export type QuestionBank = { id: string; name: string; category: "TIU" | "TWK" | "TKP" };

export async function listBanks(ownerId: string) {
  return (await database().query<QuestionBank>(
    "SELECT id, name, category FROM question_banks WHERE owner_id = $1 ORDER BY created_at DESC, id", [ownerId],
  )).rows;
}

type StoredQuestion = { id: string; source_text: string };
export async function bankDetail(ownerId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = (await database().query<QuestionBank & { revision: number; stored: StoredQuestion[] }>(
    `SELECT b.id, b.name, b.category, b.revision,
      COALESCE(jsonb_agg(jsonb_build_object('id', q.id, 'source_text', q.source_text) ORDER BY q.position) FILTER (WHERE q.id IS NOT NULL), '[]'::jsonb) AS stored
      FROM question_banks b LEFT JOIN bank_questions q ON q.bank_id = b.id
      WHERE b.id = $1 AND b.owner_id = $2 GROUP BY b.id`, [id, ownerId],
  )).rows[0];
  if (!row) return null;
  const { stored, ...bank } = row;
  const original: ImportPreview = { templateVersion: "VANEXA-PDF-V1", bankName: bank.name, category: bank.category, errors: [], questions: stored.map((question) => parseQuestionSource(question.source_text)) };
  const evaluated = validateEditState(initialEditState(original), original, false);
  return { ...bank, questions: evaluated.preview.questions, questionIds: stored.map((question) => question.id), state: evaluated.state, preview: evaluated.preview, duplicates: await duplicateWarnings(ownerId, evaluated.preview.questions, id) };
}

export async function editBank(ownerId: string, id: string, revision: unknown, state: unknown) {
  requireRevision(revision);
  if (!isUuid(id)) throw new ImportFailure("BANK_NOT_FOUND", "Bank soal tidak ditemukan.", 404);
  const saved = await transaction(async (client) => {
    const bank = (await client.query<QuestionBank & { revision: number }>("SELECT id, name, category, revision FROM question_banks WHERE id = $1 AND owner_id = $2 FOR UPDATE", [id, ownerId])).rows[0];
    if (!bank) throw new ImportFailure("BANK_NOT_FOUND", "Bank soal tidak ditemukan.", 404);
    if (bank.revision !== revision) throw new ImportFailure("REVISION_CONFLICT", "Bank berubah di tab lain. Muat ulang sebelum menyimpan; salin perubahan Anda terlebih dahulu.", 409);
    const stored = (await client.query<StoredQuestion>("SELECT id, source_text FROM bank_questions WHERE bank_id = $1 ORDER BY position", [id])).rows;
    const original: ImportPreview = { templateVersion: "VANEXA-PDF-V1", bankName: bank.name, category: bank.category, errors: [], questions: stored.map((question) => parseQuestionSource(question.source_text)) };
    const validated = validateEditState(state, original, false);
    const { preview } = validated;
    assertValidBank(preview);
    for (let index = 0; index < stored.length; index++) {
      await client.query("UPDATE bank_questions SET source_number=$1, prompt=$2, options=$3, scoring_type=$4, answer_key=$5, weights=$6, explanation=$7, source_text=$8, fingerprint=$9 WHERE id=$10 AND bank_id=$11", [...questionValues(preview.questions[index]), stored[index].id, id]);
    }
    await client.query("UPDATE question_banks SET name=$1, category=$2, revision=revision+1, updated_at=now() WHERE id=$3", [preview.bankName, preview.category, id]);
    return { id: bank.id, name: preview.bankName, category: preview.category, revision: revision + 1, questions: preview.questions, questionIds: stored.map((question) => question.id), state: validated.state, preview };
  });
  return { ...saved, duplicates: await duplicateWarnings(ownerId, saved.questions, id) };
}

export async function findBank(ownerId: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return (await database().query<QuestionBank>(
    "SELECT id, name, category FROM question_banks WHERE id = $1 AND owner_id = $2", [id, ownerId],
  )).rows[0] ?? null;
}
