import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { findParticipant, findAccountParticipant, participantTokenHash, getRoomState } from "@/lib/rooms";
import { getAttemptResult } from "@/lib/attempts";
import { database } from "@/lib/db";
import { ResultView } from "./result-view";
import { isUuid } from "@/lib/mutations";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id: roomId } = await params;
  const roomState = await getRoomState(roomId);

  if (!roomState) {
    notFound();
  }

  // Check visitor authorization
  const host = await currentHost();
  const isHost = host?.id === roomState.room.hostId;

  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`vanexa_guest_${roomId}`)?.value;
  let activeParticipant = host ? await findAccountParticipant(roomId, host.id) : guestToken ? await findParticipant(roomId, participantTokenHash(guestToken)) : null;

  if (!activeParticipant && isHost) {
    const hostPart = (await database().query<{ id: string; nickname: string; is_host: boolean; room_id: string }>(
      "SELECT id, nickname, is_host, room_id FROM participants WHERE room_id = $1 AND is_host = true",
      [roomId],
    )).rows[0];
    if (hostPart) {
      activeParticipant = {
        id: hostPart.id,
        nickname: hostPart.nickname,
        isHost: hostPart.is_host,
        roomId: hostPart.room_id,
      };
    }
  }

  if (!activeParticipant) {
    redirect(`/rooms/${roomId}`);
  }

  const selected = (await searchParams).attempt;
  if (selected && !isUuid(selected)) notFound();
  // Historical Results remain private to the same participant.
  const attemptRow = (await database().query<{ id: string; status: string }>(
    "SELECT id,status FROM attempts WHERE room_id=$1 AND participant_id=$2 AND (($3::uuid IS NOT NULL AND id=$3) OR ($3::uuid IS NULL AND session_id=$4))",
    [roomId, activeParticipant.id, selected ?? null, roomState.room.currentSessionId],
  )).rows[0];

  if (!attemptRow) {
    if (selected) notFound();
    // A member who joined between sessions can still inspect their earlier results.
    const previous = (await database().query<{ id: string }>("SELECT id FROM attempts WHERE room_id=$1 AND participant_id=$2 AND status<>'ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1", [roomId, activeParticipant.id])).rows[0];
    if (previous) redirect(`/rooms/${roomId}/result?attempt=${previous.id}`);
    redirect(`/rooms/${roomId}`);
  }

  // Active participants cannot view keys and explanations before submitting
  if (attemptRow.status === "ACTIVE") {
    redirect(`/rooms/${roomId}/quiz`);
  }

  const guestTokenHash = guestToken ? participantTokenHash(guestToken) : undefined;
  const resultData = await getAttemptResult(attemptRow.id, {
    hostId: host?.id,
    guestTokenHash,
  });

  const history = (await database().query<{ id: string; number: number; score: string }>("SELECT a.id,s.number,a.final_score AS score FROM attempts a JOIN quiz_sessions s ON s.id=a.session_id WHERE a.room_id=$1 AND a.participant_id=$2 AND a.status<>'ACTIVE' ORDER BY s.number DESC", [roomId, activeParticipant.id])).rows.map(row => ({ id: row.id, number: row.number, score: Number(row.score) }));
  return <ResultView data={resultData} history={history} followNewSession={!selected} />;
}
