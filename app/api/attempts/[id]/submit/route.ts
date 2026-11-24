import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { participantTokenHash } from "@/lib/rooms";
import { submitAttempt, AttemptError } from "@/lib/attempts";
import { database } from "@/lib/db";
import { isUuid } from "@/lib/mutations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: attemptId } = await params;
    if (!isUuid(attemptId)) {
      return apiError("VALIDATION_ERROR", "ID pengerjaan tidak valid.", 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Body request tidak valid.", 400);
    }

    const idempotencyKey = body.idempotencyKey;
    if (!isUuid(idempotencyKey)) {
      return apiError("VALIDATION_ERROR", "idempotencyKey harus berupa UUID valid.", 400);
    }

    // Lookup room_id of the attempt to locate the guest cookie
    const attemptRoom = (await database().query<{ room_id: string }>(
      "SELECT room_id FROM attempts WHERE id = $1",
      [attemptId],
    )).rows[0];

    if (!attemptRoom) {
      return apiError("ATTEMPT_NOT_FOUND", "Pengerjaan kuis tidak ditemukan.", 404);
    }

    const host = await currentHost();
    const cookieStore = await cookies();
    const guestToken = cookieStore.get(`vanexa_guest_${attemptRoom.room_id}`)?.value;
    const guestTokenHash = guestToken ? participantTokenHash(guestToken) : undefined;

    const result = await submitAttempt(attemptId, idempotencyKey, {
      hostId: host?.id,
      guestTokenHash,
    });

    return NextResponse.json(
      {
        ...result,
        redirectUrl: `/rooms/${result.roomId}/result`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AttemptError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("SERVICE_UNAVAILABLE", "Gagal mengumpulkan jawaban kuis.", 503, true);
  }
}
