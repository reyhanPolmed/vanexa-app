import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { startQuiz, RoomError } from "@/lib/rooms";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk sebagai host.", 401);

    const { id: roomId } = await params;
    const result = await startQuiz(host.id, roomId);

    return NextResponse.json(
      {
        roomId: result.roomId,
        status: result.status,
        startedAt: result.startedAt,
        deadlineAt: result.deadlineAt,
        version: result.version,
        idempotent: result.idempotent,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RoomError) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Kuis belum berhasil dimulai. Coba lagi.", 503, true);
  }
}
