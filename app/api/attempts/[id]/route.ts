import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { participantTokenHash } from "@/lib/rooms";
import { getAttemptById } from "@/lib/attempts";
import { database } from "@/lib/db";
import { isUuid } from "@/lib/mutations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: attemptId } = await params;
    if (!isUuid(attemptId)) {
      return apiError("VALIDATION_ERROR", "ID pengerjaan tidak valid.", 400);
    }

    const attempt = await getAttemptById(attemptId);
    if (!attempt) {
      return apiError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
    }

    // Verify ownership or host
    const participant = (await database().query<{ token_hash: string; is_host: boolean }>(
      "SELECT token_hash, is_host FROM participants WHERE id = $1",
      [attempt.participantId],
    )).rows[0];

    const room = (await database().query<{ host_id: string }>(
      "SELECT host_id FROM rooms WHERE id = $1",
      [attempt.roomId],
    )).rows[0];

    const host = await currentHost();
    const cookieStore = await cookies();
    const guestToken = cookieStore.get(`vanexa_guest_${attempt.roomId}`)?.value;
    const guestTokenHash = guestToken ? participantTokenHash(guestToken) : undefined;

    const isAuthorized =
      (guestTokenHash && participant && guestTokenHash === participant.token_hash) ||
      (host && room && host.id === room.host_id && participant?.is_host);

    if (!isAuthorized) {
      return apiError("FORBIDDEN", "Anda tidak memiliki akses ke pengerjaan ini.", 403);
    }

    return NextResponse.json(
      {
        attempt: {
          id: attempt.id,
          roomId: attempt.roomId,
          participantId: attempt.participantId,
          status: attempt.status,
          createdAt: attempt.createdAt,
          submittedAt: attempt.submittedAt,
          finalScore: attempt.finalScore,
        },
        answers: attempt.answers,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("SERVICE_UNAVAILABLE", "Gagal memuat data pengerjaan.", 503, true);
  }
}
