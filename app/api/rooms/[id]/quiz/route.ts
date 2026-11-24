import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getQuizQuestions, findParticipant, findAccountParticipant, participantTokenHash, getRoomState } from "@/lib/rooms";
import { getOrCreateAttempt } from "@/lib/attempts";
import { database } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: roomId } = await params;
    const roomState = await getRoomState(roomId);
    if (!roomState) return apiError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

    // Verify participant or host authorization
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
      return apiError("UNAUTHORIZED", "Anda belum terdaftar di room ini.", 401);
    }

    if (roomState.room.status === "LOBBY") {
      return apiError("ROOM_NOT_STARTED", "Kuis belum dimulai oleh host.", 400);
    }
    if (roomState.room.status === "CLOSED") return apiError("ROOM_CLOSED", "Room ditutup karena Host tidak kembali.", 400);

    const quizData = await getQuizQuestions(roomId);
    if (!quizData) return apiError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);

    const attempt = await getOrCreateAttempt(roomId, activeParticipant.id);

    return NextResponse.json(
      {
        ...quizData,
        attempt: {
          id: attempt.id,
          status: attempt.status,
        },
        savedAnswers: attempt.answers,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("SERVICE_UNAVAILABLE", "Data kuis belum berhasil dimuat.", 503, true);
  }
}
