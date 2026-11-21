import "server-only";
import { createHash } from "node:crypto";
import { database } from "../db";
import { letters, type PreviewQuestion } from "./limits";

export type DuplicateWarning = { index: number; inDraft: boolean; inExistingBank: boolean };
export function questionFingerprint(question: PreviewQuestion) {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(JSON.stringify([question.prompt, ...letters.map((letter) => question.options[letter] ?? "")].map(normalize))).digest("hex");
}

export async function duplicateWarnings(ownerId: string, questions: PreviewQuestion[], excludedBank?: string): Promise<DuplicateWarning[]> {
  const fingerprints = questions.map(questionFingerprint);
  if (!fingerprints.length) return [];
  const existing = await database().query<{ fingerprint: string }>(
    `SELECT DISTINCT q.fingerprint FROM bank_questions q JOIN question_banks b ON b.id = q.bank_id
     WHERE b.owner_id = $1 AND q.fingerprint = ANY($2::text[]) AND ($3::uuid IS NULL OR b.id <> $3)`, [ownerId, fingerprints, excludedBank ?? null],
  );
  const matches = new Set(existing.rows.map((row) => row.fingerprint));
  const counts = new Map<string, number>();
  for (const fingerprint of fingerprints) counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  return fingerprints.flatMap((fingerprint, index) => counts.get(fingerprint)! > 1 || matches.has(fingerprint) ? [{ index, inDraft: counts.get(fingerprint)! > 1, inExistingBank: matches.has(fingerprint) }] : []);
}
