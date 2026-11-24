import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { getQuizQuestions, findParticipant, findAccountParticipant, participantTokenHash, getRoomState } from "@/lib/rooms";
import { getOrCreateAttempt } from "@/lib/attempts";
import { database } from "@/lib/db";
import { QuizView } from "./quiz-view";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = await params;
  const roomState = await getRoomState(roomId);

  if (!roomState) {
    notFound();
  }

  // If room is still in lobby, send visitor back to lobby
  if (roomState.room.status === "LOBBY" || roomState.room.status === "CLOSED") {
    redirect(`/rooms/${roomId}`);
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

  const quizData = await getQuizQuestions(roomId);
  if (!quizData) {
    notFound();
  }

  // Retrieve or initialize participant's attempt and saved answers
  const attempt = await getOrCreateAttempt(roomId, activeParticipant.id);
  if (attempt.status !== "ACTIVE") redirect(`/rooms/${roomId}/result`);

  const nickname = activeParticipant.nickname || host?.username || "Peserta";

  return (
    <QuizView
      key={attempt.id}
      room={quizData.room}
      questions={quizData.questions}
      participantNickname={nickname}
      attemptId={attempt.id}
      attemptStatus={attempt.status}
      initialAnswers={attempt.answers}
    />
  );
}
