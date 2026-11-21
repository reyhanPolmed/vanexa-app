import "server-only";
import { randomUUID } from "node:crypto";
import { database } from "../db";
import type { ImportPreview } from "./limits";
import { initialEditState, validateEditState, type EditState } from "./editing";
import { duplicateWarnings, type DuplicateWarning } from "./duplicates";

export type ImportDraft = { id: string; fileName: string; pageCount: number; preview: ImportPreview; originalPreview: ImportPreview; expiresAt: string; revision: number; state: EditState; itemPreviews: ImportPreview["questions"]; duplicates: DuplicateWarning[]; confirmedBankId: string | null };

// Physical retention is enforced by import:cleanup on a scheduled 15-minute interval.
export async function createDraft(ownerId: string, fileName: string, pageCount: number, preview: ImportPreview) {
  const id = randomUUID();
  await database().query("DELETE FROM import_drafts WHERE expires_at <= now()");
  await database().query("INSERT INTO import_drafts (id, owner_id, file_name, page_count, preview, original_preview) VALUES ($1, $2, $3, $4, $5, $5)", [id, ownerId, fileName, pageCount, JSON.stringify(preview)]);
  return id;
}

export async function findDraft(ownerId: string, id: string): Promise<ImportDraft | null> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  const result = await database().query<{ id: string; file_name: string; page_count: number; original_preview: ImportPreview; edit_state: EditState | null; expires_at: Date; revision: number; confirmed_bank_id: string | null }>(
    "SELECT id, file_name, page_count, original_preview, edit_state, expires_at, revision, confirmed_bank_id FROM import_drafts WHERE id = $1 AND owner_id = $2 AND expires_at > now()", [id, ownerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const { state, preview, itemPreviews } = validateEditState(row.edit_state ?? initialEditState(row.original_preview), row.original_preview);
  return { id: row.id, fileName: row.file_name, pageCount: row.page_count, preview, originalPreview: row.original_preview, expiresAt: row.expires_at.toISOString(), revision: row.revision, state, itemPreviews, confirmedBankId: row.confirmed_bank_id, duplicates: await duplicateWarnings(ownerId, preview.questions) };
}
