import "server-only";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { database, transaction } from "./db";
import { isUuid } from "./mutations";
import { publishRoomEvent } from "./events";
import { reconcileRoom, roomSnapshot, runMaintenance } from "./room-lifecycle";

export type RoomStatus = "LOBBY" | "RUNNING" | "FINISHED" | "CLOSED";
export type RoomCategory = "TIU" | "TWK" | "TKP" | "RANDOM";

export type RoomSummary = {
  id: string;
  name: string;
  category: RoomCategory;
  questionCount: number;
  participantCount: number;
  durationMinutes: number;
  status: RoomStatus;
  hostUsername: string;
};

export type RoomDetail = {
  id: string;
  hostId: string;
  name: string;
  category: RoomCategory;
  sourceBankId: string;
  durationMinutes: number;
  status: RoomStatus;
  questionCount: number;
  createdAt: string;
  startedAt: string | null;
  deadlineAt: string | null;
  version: number;
};

export type Participant = {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: string;
};

export class RoomError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

const validCategories = new Set(["TIU", "TWK", "TKP", "RANDOM"]);

export function isCategory(value: unknown): value is RoomCategory {
  return typeof value === "string" && validCategories.has(value);
}

export const participantTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function listRooms(category: string): Promise<RoomSummary[]> {
  await runMaintenance();
  if (!isCategory(category)) return [];
  const result = await database().query<{
    id: string; name: string; category: RoomCategory;
    question_count: number; participant_count: string;
    duration_minutes: number; status: RoomStatus; host_username: string;
  }>(
    `SELECT r.id, r.name, r.category, r.question_count, r.duration_minutes, r.status,
       h.username AS host_username,
       (SELECT COUNT(*)::text FROM participants p WHERE p.room_id = r.id) AS participant_count
     FROM rooms r JOIN hosts h ON h.id = r.host_id
     WHERE r.category = $1
     ORDER BY r.created_at DESC, r.id`,
    [category],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    questionCount: row.question_count,
    participantCount: parseInt(row.participant_count, 10),
    durationMinutes: row.duration_minutes,
    status: row.status,
    hostUsername: row.host_username,
  }));
}

export async function createRoom(
  hostId: string,
  hostUsername: string,
  input: { name: unknown; category: unknown; bankId: unknown; durationMinutes: unknown },
) {
  // Validate inputs
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 120)
    throw new RoomError("VALIDATION_ERROR", "Nama room harus 1–120 karakter.", 400);

  if (!isCategory(input.category))
    throw new RoomError("VALIDATION_ERROR", "Kategori tidak valid. Pilih TIU, TWK, TKP, atau RANDOM.", 400);

  if (!isUuid(input.bankId))
    throw new RoomError("VALIDATION_ERROR", "Bank soal tidak valid.", 400);

  const duration = typeof input.durationMinutes === "number"
    ? input.durationMinutes
    : (typeof input.durationMinutes === "string" && /^[0-9]+$/.test(input.durationMinutes)
      ? parseInt(input.durationMinutes, 10)
      : NaN);

  if (!Number.isInteger(duration) || duration < 5 || duration > 180)
    throw new RoomError("VALIDATION_ERROR", "Durasi harus antara 5 dan 180 menit.", 400);

  const category = input.category;
  const bankId = input.bankId;

  return transaction(async (client) => {
    // Verify bank exists and check ownership
    const bank = (await client.query<{ id: string; category: string; owner_id: string }>(
      "SELECT id, category, owner_id FROM question_banks WHERE id = $1 FOR SHARE",
      [bankId],
    )).rows[0];

    if (!bank)
      throw new RoomError("BANK_NOT_FOUND", "Bank soal tidak ditemukan.", 404);

    if (bank.owner_id !== hostId)
      throw new RoomError("FORBIDDEN", "Bank soal milik pengguna lain.", 403);

    if (bank.category !== category)
      throw new RoomError("VALIDATION_ERROR", `Kategori bank (${bank.category}) tidak cocok dengan kategori room (${category}).`, 400);

    // Check bank has questions
    const questionRows = (await client.query<{
      id: string; position: number; prompt: string; options: string[];
      scoring_type: string; answer_key: string | null; weights: number[] | null;
      explanation: string;
    }>(
      "SELECT id, position, prompt, options, scoring_type, answer_key, weights, explanation FROM bank_questions WHERE bank_id = $1 ORDER BY position",
      [bankId],
    )).rows;

    if (questionRows.length === 0)
      throw new RoomError("NO_VALID_QUESTIONS", "Bank soal tidak memiliki soal. Impor soal terlebih dahulu.", 400);

    // Create room
    const roomId = randomUUID();
    await client.query(
      `INSERT INTO rooms (id, host_id, name, category, source_bank_id, duration_minutes, question_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [roomId, hostId, name, category, bankId, duration, questionRows.length],
    );

    // Snapshot questions
    for (const q of questionRows) {
      await client.query(
        `INSERT INTO room_questions (id, room_id, position, prompt, options, scoring_type, answer_key, weights, explanation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [randomUUID(), roomId, q.position, q.prompt, q.options, q.scoring_type, q.answer_key, q.weights, q.explanation],
      );
    }

    // Auto-add host as participant
    const hostToken = randomBytes(32).toString("hex");
    const hostParticipantId = randomUUID();
    await client.query(
      `INSERT INTO participants (id, room_id, nickname, token_hash, is_host, account_id)
       VALUES ($1, $2, $3, $4, true, $5)`,
      [hostParticipantId, roomId, hostUsername, participantTokenHash(hostToken), hostId],
    );

    return { roomId, hostToken };
  });
}

export async function getRoomState(roomId: string) {
  if (!isUuid(roomId)) return null;
  await reconcileRoom(roomId);
  return roomSnapshot(database(), roomId);
}

export async function deleteRoom(roomId: string, ownerId: string) {
  if (!isUuid(roomId)) throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  return transaction(async client => {
    const room = (await client.query<{ host_id: string; version: number }>("SELECT host_id,version FROM rooms WHERE id=$1 FOR UPDATE", [roomId])).rows[0];
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
    if (room.host_id !== ownerId) throw new RoomError("FORBIDDEN", "Hanya pembuat room yang dapat menghapusnya.", 403);
    // Break the Room -> current Session reference, then remove dependent data atomically.
    await client.query("UPDATE rooms SET current_session_id=NULL WHERE id=$1", [roomId]);
    await client.query("DELETE FROM attempts WHERE room_id=$1", [roomId]);
    await client.query("DELETE FROM quiz_sessions WHERE room_id=$1", [roomId]);
    await client.query("DELETE FROM rooms WHERE id=$1", [roomId]);
    await publishRoomEvent(client, { type: "room.deleted", roomId, roomVersion: room.version + 1, payload: {} });
  });
}

export async function joinRoom(roomId: string, nickname: unknown, existingTokenHash?: string, account?: { id: string; username: string }) {
  const nick = account?.username ?? (typeof nickname === "string" ? nickname.trim() : "");
  if (nick.length < 1 || nick.length > 32)
    throw new RoomError("VALIDATION_ERROR", "Nickname harus 1–32 karakter.", 400);

  if (!isUuid(roomId))
    throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

  await reconcileRoom(roomId);

  return transaction(async (client) => {
    const room = (await client.query<{ id: string; status: RoomStatus }>(
      "SELECT id, status FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId],
    )).rows[0];

    if (!room)
      throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

    if (room.status === "CLOSED") throw new RoomError("ROOM_CLOSED", "Room ditutup karena Host tidak kembali.", 400);
    if (account) {
      const existing = (await client.query<{ id: string; nickname: string }>("SELECT id,nickname FROM participants WHERE room_id=$1 AND account_id=$2", [roomId, account.id])).rows[0];
      if (existing) return { participantId: existing.id, token: null, reconnected: true, nickname: existing.nickname };
    }
    // Check if reconnecting with existing token
    if (existingTokenHash && !account) {
      const existing = (await client.query<{ id: string; nickname: string }>(
        "SELECT id, nickname FROM participants WHERE room_id = $1 AND token_hash = $2",
        [roomId, existingTokenHash],
      )).rows[0];
      if (existing) {
        return { participantId: existing.id, token: null, reconnected: true, nickname: existing.nickname };
      }
    }

    if (room.status !== "LOBBY" && room.status !== "FINISHED") throw new RoomError("ROOM_STARTED", "Kuis sudah dimulai. Peserta baru dapat bergabung setelah sesi selesai.", 400);

    // Create new participant
    const token = randomBytes(32).toString("hex");
    const participantId = randomUUID();
    const joinedAt = new Date().toISOString();
    await client.query(
      `INSERT INTO participants (id, room_id, nickname, token_hash, joined_at, account_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [participantId, roomId, nick, participantTokenHash(token), joinedAt, account?.id ?? null],
    );

    const version = (await client.query<{ version: number }>("UPDATE rooms SET version=version+1 WHERE id=$1 RETURNING version", [roomId])).rows[0].version;
    // Notify room subscribers of new participant after commit.
    await publishRoomEvent(client, {
      type: "participant.joined",
      roomId,
      roomVersion: version,
      payload: {
        participant: {
          id: participantId,
          nickname: nick,
          isHost: false,
          joinedAt,
        },
      },
    });

    return { participantId, token, reconnected: false, nickname: nick };
  });
}

export async function startQuiz(hostId: string, roomId: string) {
  if (!isUuid(roomId))
    throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

  await reconcileRoom(roomId);

  return transaction(async (client) => {
    const room = (await client.query<{
      id: string; host_id: string; status: RoomStatus;
      duration_minutes: number; started_at: string | null;
      deadline_at: string | null; version: number;
    }>(
      "SELECT id, host_id, status, duration_minutes, started_at, deadline_at, version FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId],
    )).rows[0];

    if (!room)
      throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

    if (room.host_id !== hostId)
      throw new RoomError("FORBIDDEN", "Hanya host yang dapat memulai kuis.", 403);

    // Idempotent start: if already running, return existing start/deadline without altering them
    if (room.status === "RUNNING") {
      return {
        roomId: room.id,
        status: room.status,
        startedAt: room.started_at!,
        deadlineAt: room.deadline_at!,
        version: room.version,
        idempotent: true,
      };
    }

    if (room.status !== "LOBBY" && room.status !== "FINISHED") {
      throw new RoomError("ROOM_CLOSED", "Room sudah ditutup atau selesai.", 400);
    }

    const sessionId = randomUUID();
    const session = (await client.query<{ started_at: Date; deadline_at: Date }>(
      "INSERT INTO quiz_sessions(id,room_id,number,status,started_at,deadline_at) SELECT $1,$2,COALESCE(MAX(number),0)+1,'RUNNING',statement_timestamp(),statement_timestamp()+$3::integer*interval '1 minute' FROM quiz_sessions WHERE room_id=$2 RETURNING started_at,deadline_at",
      [sessionId, roomId, room.duration_minutes],
    )).rows[0];
    // Freeze this session's roster. Joining during RUNNING remains blocked.
    await client.query("INSERT INTO attempts(id,room_id,participant_id,session_id,status) SELECT gen_random_uuid(),room_id,id,$2,'ACTIVE' FROM participants WHERE room_id=$1", [roomId, sessionId]);
    // Update room status to RUNNING
    const updated = (await client.query<{
      id: string; status: RoomStatus; started_at: string;
      deadline_at: string; version: number;
    }>(
      `UPDATE rooms
       SET status = 'RUNNING',
           started_at = $2,
           deadline_at = $3,
           current_session_id = $4,
           version = version + 1
       WHERE id = $1
       RETURNING id, status, started_at, deadline_at, version`,
      [roomId, session.started_at, session.deadline_at, sessionId],
    )).rows[0];

    // Notify room subscribers that quiz has started
    await publishRoomEvent(client, {
      type: "quiz.started",
      roomId,
      roomVersion: updated.version,
      payload: {
        roomId,
        startedAt: updated.started_at,
        deadlineAt: updated.deadline_at,
        version: updated.version,
      },
    });

    return {
      roomId: updated.id,
      status: updated.status,
      startedAt: updated.started_at,
      deadlineAt: updated.deadline_at,
      version: updated.version,
      idempotent: false,
    };
  });
}

export type QuizQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
};

export async function getQuizQuestions(roomId: string) {
  if (!isUuid(roomId)) return null;

  const room = (await database().query<{
    id: string; name: string; category: RoomCategory;
    duration_minutes: number; status: RoomStatus;
    started_at: string | null; deadline_at: string | null; version: number; server_now: Date; current_session_id: string | null;
  }>(
    "SELECT id, name, category, duration_minutes, status, started_at, deadline_at, version, current_session_id, clock_timestamp() AS server_now FROM rooms WHERE id = $1",
    [roomId],
  )).rows[0];

  if (!room) return null;

  // STRICT SECURITY: Do NOT select answer_key, weights, or explanation!
  const questions = (await database().query<{
    id: string; position: number; prompt: string; options: string[];
  }>(
    "SELECT id, position, prompt, options FROM room_questions WHERE room_id = $1 ORDER BY position",
    [roomId],
  )).rows;

  return {
    room: {
      id: room.id,
      name: room.name,
      category: room.category,
      durationMinutes: room.duration_minutes,
      status: room.status,
      startedAt: room.started_at,
      deadlineAt: room.deadline_at,
      version: room.version,
      currentSessionId: room.current_session_id,
      serverNow: room.server_now.toISOString(),
    },
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: q.options,
    })),
  };
}

export async function findParticipant(roomId: string, tokenHash: string) {
  if (!isUuid(roomId)) return null;
  const row = (await database().query<{ id: string; nickname: string; is_host: boolean; room_id: string }>(
    "SELECT id, nickname, is_host, room_id FROM participants WHERE room_id = $1 AND token_hash = $2",
    [roomId, tokenHash],
  )).rows[0];
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    isHost: row.is_host,
    roomId: row.room_id,
  };
}

export async function findAccountParticipant(roomId: string, accountId: string) {
  if (!isUuid(roomId)) return null;
  const row = (await database().query<{ id: string; nickname: string; is_host: boolean; room_id: string }>("SELECT id,nickname,is_host,room_id FROM participants WHERE room_id=$1 AND account_id=$2", [roomId, accountId])).rows[0];
  return row ? { id: row.id, nickname: row.nickname, isHost: row.is_host, roomId: row.room_id } : null;
}
