import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/http";
import { joinRoom, participantTokenHash, RoomError } from "@/lib/rooms";
import { currentHost } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: roomId } = await params;
    const origin = request.headers.get("origin");
    if (process.env.APP_ORIGIN && origin !== process.env.APP_ORIGIN)
      return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);

    const contentType = request.headers.get("content-type")?.split(";")[0];
    if (contentType !== "application/json") return apiError("VALIDATION_ERROR", "Gunakan JSON.", 415);

    const body = await request.json();

    // Check for existing guest token (reconnect)
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(`vanexa_guest_${roomId}`)?.value;
    const existingHash = existingToken ? participantTokenHash(existingToken) : undefined;

    const account = await currentHost();
    const result = await joinRoom(roomId, body?.nickname, existingHash, account ?? undefined);

    const response = NextResponse.json(
      { participantId: result.participantId, reconnected: result.reconnected, nickname: result.nickname },
      { status: result.reconnected ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );

    // Set guest cookie only for new joins
    if (result.token && !account) {
      response.cookies.set(`vanexa_guest_${roomId}`, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: `/`,
        maxAge: 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof RoomError) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Belum berhasil bergabung. Coba lagi.", 503, true);
  }
}
