import "server-only";
import { database } from "./db";

export type QuestionBank = { id: string; name: string; category: "TIU" | "TWK" | "TKP" };

export async function listBanks(ownerId: string) {
  return (await database().query<QuestionBank>(
    "SELECT id, name, category FROM question_banks WHERE owner_id = $1 ORDER BY created_at DESC, id", [ownerId],
  )).rows;
}

export async function findBank(ownerId: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return (await database().query<QuestionBank>(
    "SELECT id, name, category FROM question_banks WHERE id = $1 AND owner_id = $2", [id, ownerId],
  )).rows[0] ?? null;
}
