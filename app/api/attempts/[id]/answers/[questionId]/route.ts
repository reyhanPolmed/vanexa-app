import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { participantTokenHash } from "@/lib/rooms";
import { saveAnswer, AttemptError } from "@/lib/attempts";
import { database } from "@/lib/db";
import { isUuid } from "@/lib/mutations";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { id: attemptId, questionId } = await params;
    if (!isUuid(attemptId) || !isUuid(questionId)) {
      return apiError("VALIDATION_ERROR", "ID pengerjaan atau soal tidak valid.", 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Body request tidak valid.", 400);
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

    const result = await saveAnswer(
      attemptId,
      questionId,
      {
        choice: body.choice,
        mutationId: body.mutationId,
        expectedRevision: body.expectedRevision,
      },
      {
        hostId: host?.id,
        guestTokenHash,
      },
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AttemptError) {
      if (error.status === 409) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              currentRevision: error.extra?.currentRevision,
              currentChoice: error.extra?.currentChoice,
            },
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      return apiError(error.code, error.message, error.status);
    }
    return apiError("SERVICE_UNAVAILABLE", "Gagal menyimpan jawaban.", 503, true);
  }
}
