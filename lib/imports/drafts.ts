import "server-only";
import { randomUUID } from "node:crypto";
import { database } from "../db";
import type { ImportPreview } from "./limits";

export type ImportDraft = { id: string; fileName: string; pageCount: number; preview: ImportPreview; expiresAt: string };

// Physical retention is enforced by import:cleanup on a scheduled 15-minute interval.
export async function createDraft(ownerId: string, fileName: string, pageCount: number, preview: ImportPreview) {
  const id = randomUUID();
  await database().query("DELETE FROM import_drafts WHERE expires_at <= now()");
  await database().query("INSERT INTO import_drafts (id, owner_id, file_name, page_count, preview) VALUES ($1, $2, $3, $4, $5)", [id, ownerId, fileName, pageCount, JSON.stringify(preview)]);
  return id;
}

export async function findDraft(ownerId: string, id: string): Promise<ImportDraft | null> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  const result = await database().query<{ id: string; file_name: string; page_count: number; preview: ImportPreview; expires_at: Date }>(
    "SELECT id, file_name, page_count, preview, expires_at FROM import_drafts WHERE id = $1 AND owner_id = $2 AND expires_at > now()", [id, ownerId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, fileName: row.file_name, pageCount: row.page_count, preview: row.preview, expiresAt: row.expires_at.toISOString() } : null;
}
