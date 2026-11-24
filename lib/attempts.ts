import "server-only";
import { randomUUID } from "node:crypto";
import { database, transaction } from "./db";
import { isUuid } from "./mutations";
import { finalizeRoomLocked, lockRoom, reconcileRoom, serverDeadlinePassed } from "./room-lifecycle";
import { scoreAttempt } from "./scoring";
import { publishRoomEvent } from "./events";

export class AttemptError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type AttemptStatus = "ACTIVE" | "SUBMITTED" | "EXPIRED";

export type SavedAnswer = {
  questionId: string;
  position: number;
  selectedOption: string | null;
  revision: number;
  acceptedAt: string;
  lastMutationId: string;
};

export type AttemptData = {
  id: string;
  roomId: string;
  participantId: string;
  status: AttemptStatus;
  createdAt: string;
  submittedAt: string | null;
  finalScore: number | null;
  answers: Record<string, SavedAnswer>; // Keyed by questionId
};

export async function getOrCreateAttempt(
  roomId: string,
  participantId: string,
): Promise<AttemptData> {
  if (!isUuid(roomId) || !isUuid(participantId)) {
    throw new AttemptError("VALIDATION_ERROR", "ID room atau participant tidak valid.", 400);
  }

  return transaction(async (client) => {
    // Check room existence and status
    const room = (await client.query<{ id: string; status: string; deadline_at: string | null; current_session_id: string | null }>(
      "SELECT id, status, deadline_at, current_session_id FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId],
    )).rows[0];

    if (!room) {
      throw new AttemptError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
    }

    // Verify participant belongs to this room
    const participant = (await client.query<{ id: string }>(
      "SELECT id FROM participants WHERE id = $1 AND room_id = $2",
      [participantId, roomId],
    )).rows[0];

    if (!participant) {
      throw new AttemptError("FORBIDDEN", "Peserta tidak terdaftar di room ini.", 403);
    }

    if (room.status === "LOBBY" || room.status === "CLOSED") throw new AttemptError("ROOM_NOT_RUNNING", "Room belum berjalan atau sudah ditutup.", 400);
    await finalizeRoomLocked(client, room);

    // Check if attempt already exists
    let attempt = (await client.query<{
      id: string;
      room_id: string;
      participant_id: string;
      status: AttemptStatus;
      created_at: string;
      submitted_at: string | null;
      final_score: number | null;
    }>(
      "SELECT id, room_id, participant_id, status, created_at, submitted_at, final_score FROM attempts WHERE room_id = $1 AND participant_id = $2 AND session_id=$3 FOR UPDATE",
      [roomId, participantId, room.current_session_id],
    )).rows[0];

    if (!attempt) {
      if (room.status === "FINISHED") throw new AttemptError("ATTEMPT_NOT_FOUND", "Pengerjaan tidak ditemukan.", 404);
      const attemptId = randomUUID();
      attempt = (await client.query<{
        id: string;
        room_id: string;
        participant_id: string;
        status: AttemptStatus;
        created_at: string;
        submitted_at: string | null;
        final_score: number | null;
      }>(
        `INSERT INTO attempts (id, room_id, participant_id, status, session_id)
         VALUES ($1, $2, $3, 'ACTIVE', $4)
         ON CONFLICT (session_id, participant_id) DO UPDATE SET room_id = EXCLUDED.room_id
         RETURNING id, room_id, participant_id, status, created_at, submitted_at, final_score`,
        [attemptId, roomId, participantId, room.current_session_id],
      )).rows[0];
    }

    // Fetch existing answers joined with room_questions for position
    const answersRows = (await client.query<{
      question_id: string;
      position: number;
      selected_option: string | null;
      revision: number;
      accepted_at: string;
      last_mutation_id: string;
    }>(
      `SELECT a.question_id, rq.position, a.selected_option, a.revision, a.accepted_at, a.last_mutation_id
       FROM answers a
       JOIN room_questions rq ON rq.id = a.question_id
       WHERE a.attempt_id = $1
       ORDER BY rq.position`,
      [attempt.id],
    )).rows;

    const answers: Record<string, SavedAnswer> = {};
    for (const row of answersRows) {
      answers[row.question_id] = {
        questionId: row.question_id,
        position: row.position,
        selectedOption: row.selected_option,
        revision: row.revision,
        acceptedAt: row.accepted_at,
        lastMutationId: row.last_mutation_id,
      };
    }

    return {
      id: attempt.id,
      roomId: attempt.room_id,
      participantId: attempt.participant_id,
      status: attempt.status,
      createdAt: attempt.created_at,
      submittedAt: attempt.submitted_at,
      finalScore: attempt.final_score !== null ? Number(attempt.final_score) : null,
      answers,
    };
  });
}

export type SaveAnswerInput = {
  choice: unknown;
  mutationId: unknown;
  expectedRevision: unknown;
};

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  input: SaveAnswerInput,
  caller: {
    hostId?: string;
    guestTokenHash?: string;
  },
) {
  if (!isUuid(attemptId) || !isUuid(questionId)) {
    throw new AttemptError("VALIDATION_ERROR", "ID pengerjaan atau soal tidak valid.", 400);
  }

  // Validate choice: must be null, undefined, "", or 'A'..'E'
  let choice: string | null = null;
  if (input.choice !== null && input.choice !== undefined && input.choice !== "") {
    if (typeof input.choice !== "string" || !["A", "B", "C", "D", "E"].includes(input.choice)) {
      throw new AttemptError("VALIDATION_ERROR", "Pilihan jawaban harus A, B, C, D, E, atau kosong.", 400);
    }
    choice = input.choice;
  }

  // Validate mutationId
  if (!isUuid(input.mutationId)) {
    throw new AttemptError("VALIDATION_ERROR", "Mutation ID harus berupa UUID valid.", 400);
  }
  const mutationId = input.mutationId as string;

  // Validate expectedRevision
  if (
    typeof input.expectedRevision !== "number" ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    throw new AttemptError("VALIDATION_ERROR", "expectedRevision harus bilangan bulat non-negatif.", 400);
  }
  const expectedRevision = input.expectedRevision;

  const result = await transaction(async (client) => {
    const location = (await client.query<{ room_id: string }>("SELECT room_id FROM attempts WHERE id=$1", [attemptId])).rows[0];
    if (!location) throw new AttemptError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
    await lockRoom(client, location.room_id);
    // 1. Lock attempt to serialize mutations for this attempt
    const attempt = (await client.query<{
      id: string;
      room_id: string;
      participant_id: string;
      status: AttemptStatus;
      session_id: string;
    }>(
      "SELECT id, room_id, participant_id, status, session_id FROM attempts WHERE id = $1 FOR UPDATE",
      [attemptId],
    )).rows[0];

    if (!attempt) {
      throw new AttemptError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
    }

    // 2. Verify authorization
    const participant = (await client.query<{
      id: string;
      token_hash: string;
      is_host: boolean; account_id: string | null;
    }>(
      "SELECT id, token_hash, is_host, account_id FROM participants WHERE id = $1",
      [attempt.participant_id],
    )).rows[0];

    if (!participant) {
      throw new AttemptError("FORBIDDEN", "Peserta pengerjaan ini tidak ditemukan.", 403);
    }

    const room = (await client.query<{
      id: string;
      host_id: string;
      status: string;
      deadline_at: string | null;
      now: string;
      current_session_id: string | null;
    }>(
      "SELECT id, host_id, status, deadline_at, current_session_id, clock_timestamp() AS now FROM rooms WHERE id = $1",
      [attempt.room_id],
    )).rows[0];

    if (!room) {
      throw new AttemptError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
    }

    const isAuthorized =
      (caller.guestTokenHash && caller.guestTokenHash === participant.token_hash) ||
      (caller.hostId && (caller.hostId === participant.account_id || (caller.hostId === room.host_id && participant.is_host)));

    if (!isAuthorized) {
      throw new AttemptError("FORBIDDEN", "Anda tidak memiliki akses ke pengerjaan ini.", 403);
    }
    if (attempt.session_id !== room.current_session_id) throw new AttemptError("ATTEMPT_FINALIZED", "Pengerjaan berasal dari sesi sebelumnya.", 400);

    if (await serverDeadlinePassed(client, room.id)) {
      await finalizeRoomLocked(client, room);
      return new AttemptError("DEADLINE_PASSED", "Waktu pengerjaan kuis telah habis.", 400);
    }

    // 3. Verify attempt status and room status
    if (attempt.status !== "ACTIVE") {
      throw new AttemptError("ATTEMPT_FINALIZED", "Pengerjaan sudah difinalisasi atau kedaluwarsa.", 400);
    }

    if (room.status !== "RUNNING") {
      throw new AttemptError("ROOM_NOT_RUNNING", "Room tidak sedang berjalan.", 400);
    }

    // 4. Verify server deadline strictly
    if (room.deadline_at && new Date(room.now).getTime() >= new Date(room.deadline_at).getTime()) {
      throw new AttemptError("DEADLINE_PASSED", "Waktu pengerjaan kuis telah habis.", 400);
    }

    // 5. Verify questionId belongs to this room
    const question = (await client.query<{ id: string; position: number }>(
      "SELECT id, position FROM room_questions WHERE id = $1 AND room_id = $2",
      [questionId, attempt.room_id],
    )).rows[0];

    if (!question) {
      throw new AttemptError("QUESTION_NOT_FOUND", "Soal tidak ditemukan dalam room ini.", 404);
    }

    // 6. Check existing answer for this question in this attempt
    const existing = (await client.query<{
      id: string;
      selected_option: string | null;
      revision: number;
      last_mutation_id: string;
      accepted_at: string;
    }>(
      "SELECT id, selected_option, revision, last_mutation_id, accepted_at FROM answers WHERE attempt_id = $1 AND question_id = $2 FOR UPDATE",
      [attempt.id, questionId],
    )).rows[0];

    // Case A: Existing answer exists
    if (existing) {
      // Subcase A1: Exact same mutationId => idempotent return
      if (existing.last_mutation_id === mutationId) {
        return {
          questionId,
          position: question.position,
          choice: existing.selected_option,
          revision: existing.revision,
          acceptedAt: existing.accepted_at,
          mutationId: existing.last_mutation_id,
          idempotent: true,
        };
      }

      // Subcase A2: Conflict if expectedRevision does not match current revision
      if (expectedRevision !== existing.revision) {
        throw new AttemptError("REVISION_CONFLICT", "Jawaban telah diperbarui oleh mutasi lain.", 409, {
          currentRevision: existing.revision,
          currentChoice: existing.selected_option,
        });
      }

      // Subcase A3: Valid update with incremented revision
      const newRevision = existing.revision + 1;
      const updated = (await client.query<{
        selected_option: string | null;
        revision: number;
        last_mutation_id: string;
        accepted_at: string;
      }>(
        `UPDATE answers
         SET selected_option = $1,
             revision = $2,
             last_mutation_id = $3,
             accepted_at = clock_timestamp()
         WHERE id = $4 AND EXISTS(SELECT 1 FROM rooms WHERE id=$5 AND status='RUNNING' AND clock_timestamp()<deadline_at)
         RETURNING selected_option, revision, last_mutation_id, accepted_at`,
        [choice, newRevision, mutationId, existing.id, room.id],
      )).rows[0];

      if (!updated) {
        await finalizeRoomLocked(client, room);
        return new AttemptError("DEADLINE_PASSED", "Waktu pengerjaan kuis telah habis.", 400);
      }

      return {
        questionId,
        position: question.position,
        choice: updated.selected_option,
        revision: updated.revision,
        acceptedAt: updated.accepted_at,
        mutationId: updated.last_mutation_id,
        idempotent: false,
      };
    }

    // Case B: No existing answer
    // If expectedRevision is not 0, conflict!
    if (expectedRevision !== 0) {
      throw new AttemptError("REVISION_CONFLICT", "Jawaban belum ada di server tetapi revisi diharapkan > 0.", 409, {
        currentRevision: 0,
        currentChoice: null,
      });
    }

    const answerId = randomUUID();
    const inserted = (await client.query<{
      selected_option: string | null;
      revision: number;
      last_mutation_id: string;
      accepted_at: string;
    }>(
      `INSERT INTO answers (id, attempt_id, question_id, selected_option, revision, last_mutation_id, accepted_at)
       SELECT $1, $2, $3, $4, 1, $5, clock_timestamp()
       WHERE EXISTS(SELECT 1 FROM rooms WHERE id=$6 AND status='RUNNING' AND clock_timestamp()<deadline_at)
       RETURNING selected_option, revision, last_mutation_id, accepted_at`,
      [answerId, attempt.id, questionId, choice, mutationId, room.id],
    )).rows[0];

    if (!inserted) {
      await finalizeRoomLocked(client, room);
      return new AttemptError("DEADLINE_PASSED", "Waktu pengerjaan kuis telah habis.", 400);
    }

    return {
      questionId,
      position: question.position,
      choice: inserted.selected_option,
      revision: inserted.revision,
      acceptedAt: inserted.accepted_at,
      mutationId: inserted.last_mutation_id,
      idempotent: false,
    };
  });
  if (result instanceof AttemptError) throw result;
  return result;
}

export async function getAttemptById(attemptId: string) {
  if (isUuid(attemptId)) {
    const location = (await database().query<{ room_id: string }>("SELECT room_id FROM attempts WHERE id=$1", [attemptId])).rows[0];
    if (location) await reconcileRoom(location.room_id);
  }
  if (!isUuid(attemptId)) return null;

  const attempt = (await database().query<{
    id: string;
    room_id: string;
    participant_id: string;
    status: AttemptStatus;
    created_at: string;
    submitted_at: string | null;
    final_score: number | null;
  }>(
    "SELECT id, room_id, participant_id, status, created_at, submitted_at, final_score FROM attempts WHERE id = $1",
    [attemptId],
  )).rows[0];

  if (!attempt) return null;

  const answersRows = (await database().query<{
    question_id: string;
    position: number;
    selected_option: string | null;
    revision: number;
    accepted_at: string;
    last_mutation_id: string;
  }>(
    `SELECT a.question_id, rq.position, a.selected_option, a.revision, a.accepted_at, a.last_mutation_id
     FROM answers a
     JOIN room_questions rq ON rq.id = a.question_id
     WHERE a.attempt_id = $1
     ORDER BY rq.position`,
    [attempt.id],
  )).rows;

  const answers: Record<string, SavedAnswer> = {};
  for (const row of answersRows) {
    answers[row.question_id] = {
      questionId: row.question_id,
      position: row.position,
      selectedOption: row.selected_option,
      revision: row.revision,
      acceptedAt: row.accepted_at,
      lastMutationId: row.last_mutation_id,
    };
  }

  return {
    id: attempt.id,
    roomId: attempt.room_id,
    participantId: attempt.participant_id,
    status: attempt.status,
    createdAt: attempt.created_at,
    submittedAt: attempt.submitted_at,
    finalScore: attempt.final_score !== null ? Number(attempt.final_score) : null,
    answers,
  };
}

export type SubmitAttemptResult = {
  attemptId: string;
  roomId: string;
  status: AttemptStatus;
  submittedAt: string;
  finalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  questionCount: number;
  idempotent: boolean;
};

export async function submitAttempt(
  attemptId: string,
  idempotencyKey: unknown,
  caller: { hostId?: string; guestTokenHash?: string },
): Promise<SubmitAttemptResult> {
  if (!isUuid(attemptId) || !isUuid(idempotencyKey)) throw new AttemptError("VALIDATION_ERROR", "ID pengerjaan dan idempotencyKey harus UUID valid.", 400);
  return transaction(async (client) => {
    const location = (await client.query<{ room_id: string }>("SELECT room_id FROM attempts WHERE id=$1", [attemptId])).rows[0];
    if (!location) throw new AttemptError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
    const room = await lockRoom(client, location.room_id);
    if (!room) throw new AttemptError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
    let attempt = (await client.query<{ id: string; room_id: string; participant_id: string; status: AttemptStatus; submitted_at: string | null; final_score: string | null; session_id: string }>("SELECT id,room_id,participant_id,status,submitted_at,final_score,session_id FROM attempts WHERE id=$1 FOR UPDATE", [attemptId])).rows[0];
    const participant = (await client.query<{ token_hash: string; is_host: boolean; account_id: string | null }>("SELECT token_hash,is_host,account_id FROM participants WHERE id=$1", [attempt.participant_id])).rows[0];
    const host = (await client.query<{ host_id: string }>("SELECT host_id FROM rooms WHERE id=$1", [room.id])).rows[0];
    if (!participant || !((caller.guestTokenHash && caller.guestTokenHash === participant.token_hash) || (caller.hostId && (caller.hostId === participant.account_id || (caller.hostId === host.host_id && participant.is_host))))) throw new AttemptError("FORBIDDEN", "Anda tidak memiliki akses ke pengerjaan ini.", 403);
    if (attempt.status === "ACTIVE" && attempt.session_id !== room.current_session_id) throw new AttemptError("ATTEMPT_FINALIZED", "Sesi pengerjaan telah berubah.", 400);
    await finalizeRoomLocked(client, room);
    attempt = (await client.query<typeof attempt>("SELECT id,room_id,participant_id,status,submitted_at,final_score FROM attempts WHERE id=$1", [attemptId])).rows[0];
    const summary = await scoreAttempt(client, room.id, attempt.id);
    let idempotent = attempt.status !== "ACTIVE";
    if (!idempotent) {
      if (room.status !== "RUNNING") throw new AttemptError("ROOM_NOT_RUNNING", "Room tidak sedang berjalan.", 400);
      const submitted = (await client.query<typeof attempt>("UPDATE attempts SET status='SUBMITTED',submitted_at=clock_timestamp(),final_score=$1 WHERE id=$2 AND EXISTS(SELECT 1 FROM rooms WHERE id=$3 AND status='RUNNING' AND clock_timestamp()<deadline_at) RETURNING id,room_id,participant_id,status,submitted_at,final_score", [summary.totalScore, attempt.id, room.id])).rows[0];
      if (submitted) {
        attempt = submitted;
        const updated = (await client.query<{ version: number }>("UPDATE rooms SET version=version+1 WHERE id=$1 RETURNING version", [room.id])).rows[0];
        await publishRoomEvent(client, { type: "leaderboard.updated", roomId: room.id, roomVersion: updated.version, payload: {} });
        const active = await client.query("SELECT 1 FROM attempts WHERE session_id=$1 AND status='ACTIVE' LIMIT 1", [room.current_session_id]);
        if (!active.rowCount) {
          await client.query("UPDATE quiz_sessions SET status='FINISHED',finished_at=clock_timestamp() WHERE id=$1", [room.current_session_id]);
          const finished = (await client.query<{ version: number }>("UPDATE rooms SET status='FINISHED',version=version+1 WHERE id=$1 RETURNING version", [room.id])).rows[0];
          await publishRoomEvent(client, { type: "quiz.finished", roomId: room.id, roomVersion: finished.version, payload: { status: "FINISHED" } });
        }
      } else {
        await finalizeRoomLocked(client, room);
        attempt = (await client.query<typeof attempt>("SELECT id,room_id,participant_id,status,submitted_at,final_score FROM attempts WHERE id=$1", [attemptId])).rows[0];
        idempotent = true;
      }
    }
    return { attemptId: attempt.id, roomId: room.id, status: attempt.status, submittedAt: attempt.submitted_at!, finalScore: Number(attempt.final_score), maxScore: summary.maxScore, correctCount: summary.correctCount, incorrectCount: summary.incorrectCount, unansweredCount: summary.unansweredCount, questionCount: summary.questionCount, idempotent };
  });
}

export type AttemptResultItem = {
  position: number;
  prompt: string;
  options: string[];
  scoringType: "SINGLE_CORRECT" | "WEIGHTED";
  selectedOption: string | null;
  answerKey: string | null;
  weights: number[] | null;
  scoreEarned: number;
  maxScore: number;
  isCorrect: boolean | null; // null for WEIGHTED
  explanation: string;
};

export type FullAttemptResult = {
  attempt: {
    id: string;
    sessionId: string;
    roomId: string;
    participantId: string;
    participantNickname: string;
    status: AttemptStatus;
    submittedAt: string | null;
    finalScore: number;
    maxScore: number;
  };
  room: {
    id: string;
    name: string;
    category: string;
  };
  summary: {
    totalScore: number;
    maxScore: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    questionCount: number;
  };
  items: AttemptResultItem[];
};

export async function getAttemptResult(
  attemptId: string,
  caller: { hostId?: string; guestTokenHash?: string },
): Promise<FullAttemptResult> {
  if (!isUuid(attemptId)) {
    throw new AttemptError("VALIDATION_ERROR", "ID pengerjaan tidak valid.", 400);
  }

  const location = (await database().query<{ room_id: string }>("SELECT room_id FROM attempts WHERE id=$1", [attemptId])).rows[0];
  if (location) await reconcileRoom(location.room_id);

  const attempt = (await database().query<{
    id: string;
    room_id: string;
    participant_id: string;
    status: AttemptStatus;
    submitted_at: string | null;
    final_score: string | null;
    session_id: string;
  }>(
    "SELECT id, room_id, participant_id, status, submitted_at, final_score, session_id FROM attempts WHERE id = $1",
    [attemptId],
  )).rows[0];

  if (!attempt) {
    throw new AttemptError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
  }

  const participant = (await database().query<{
    id: string;
    nickname: string;
    token_hash: string;
    is_host: boolean; account_id: string | null;
  }>(
    "SELECT id, nickname, token_hash, is_host, account_id FROM participants WHERE id = $1",
    [attempt.participant_id],
  )).rows[0];

  if (!participant) {
    throw new AttemptError("FORBIDDEN", "Peserta pengerjaan ini tidak ditemukan.", 403);
  }

  const room = (await database().query<{
    id: string;
    name: string;
    category: string;
    host_id: string;
    status: string;
  }>(
    "SELECT id, name, category, host_id, status FROM rooms WHERE id = $1",
    [attempt.room_id],
  )).rows[0];

  if (!room) {
    throw new AttemptError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  }

  const isAuthorized =
    (caller.guestTokenHash && caller.guestTokenHash === participant.token_hash) ||
    (caller.hostId && (caller.hostId === participant.account_id || (caller.hostId === room.host_id && participant.is_host)));

  if (!isAuthorized) {
    throw new AttemptError("FORBIDDEN", "Anda tidak memiliki akses ke hasil pengerjaan ini.", 403);
  }

  // Prevent active participant from inspecting keys and explanations before finalization
  if (attempt.status === "ACTIVE") {
    throw new AttemptError(
      "FORBIDDEN",
      "Pengerjaan kuis belum diselesaikan. Hasil dan pembahasan hanya dapat dilihat setelah pengerjaan diselesaikan.",
      403,
    );
  }

  // Fetch all questions for this room including answer_key, weights, explanation
  const questions = (await database().query<{
    id: string;
    position: number;
    prompt: string;
    options: string[];
    scoring_type: "SINGLE_CORRECT" | "WEIGHTED";
    answer_key: string | null;
    weights: number[] | null;
    explanation: string;
  }>(
    "SELECT id, position, prompt, options, scoring_type, answer_key, weights, explanation FROM room_questions WHERE room_id = $1 ORDER BY position",
    [attempt.room_id],
  )).rows;

  const answersRows = (await database().query<{
    question_id: string;
    selected_option: string | null;
  }>(
    "SELECT question_id, selected_option FROM answers WHERE attempt_id = $1",
    [attempt.id],
  )).rows;

  const answerMap = new Map<string, string | null>();
  for (const a of answersRows) {
    answerMap.set(a.question_id, a.selected_option);
  }

  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const items: AttemptResultItem[] = [];

  for (const q of questions) {
    const selected = answerMap.get(q.id) ?? null;
    let scoreEarned = 0;
    let qMax = 0;
    let isCorrect: boolean | null = null;

    if (q.scoring_type === "SINGLE_CORRECT") {
      qMax = 1;
      maxScore += 1;
      if (!selected) {
        unansweredCount += 1;
        isCorrect = false;
        scoreEarned = 0;
      } else if (selected === q.answer_key) {
        correctCount += 1;
        isCorrect = true;
        scoreEarned = 1;
        totalScore += 1;
      } else {
        incorrectCount += 1;
        isCorrect = false;
        scoreEarned = 0;
      }
    } else if (q.scoring_type === "WEIGHTED") {
      const weights = q.weights || [0, 0, 0, 0, 0];
      qMax = Math.max(...weights);
      maxScore += qMax;
      if (!selected) {
        unansweredCount += 1;
        scoreEarned = 0;
      } else {
        const idx = ["A", "B", "C", "D", "E"].indexOf(selected);
        scoreEarned = idx >= 0 && weights[idx] !== undefined ? weights[idx] : 0;
        totalScore += scoreEarned;
      }
    }

    items.push({
      position: q.position,
      prompt: q.prompt,
      options: q.options,
      scoringType: q.scoring_type,
      selectedOption: selected,
      answerKey: q.answer_key,
      weights: q.weights,
      scoreEarned,
      maxScore: qMax,
      isCorrect,
      explanation: q.explanation.trim() !== "" ? q.explanation : "Tidak ada pembahasan untuk soal ini.",
    });
  }

  const finalScoreNumber = attempt.final_score !== null ? Number(attempt.final_score) : totalScore;

  return {
    attempt: {
      id: attempt.id,
      roomId: attempt.room_id,
      participantId: attempt.participant_id,
      participantNickname: participant.nickname,
      sessionId: attempt.session_id,
      status: attempt.status,
      submittedAt: attempt.submitted_at,
      finalScore: finalScoreNumber,
      maxScore,
    },
    room: {
      id: room.id,
      name: room.name,
      category: room.category,
    },
    summary: {
      totalScore: finalScoreNumber,
      maxScore,
      correctCount,
      incorrectCount,
      unansweredCount,
      questionCount: questions.length,
    },
    items,
  };
}
