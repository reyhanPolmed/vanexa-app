import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { listRooms, createRoom, RoomError } from "@/lib/rooms";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    if (!category) return apiError("VALIDATION_ERROR", "Parameter category wajib diisi.", 400);
    return NextResponse.json({ rooms: await listRooms(category) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Daftar room belum berhasil dimuat.", 503, true); }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const contentType = request.headers.get("content-type")?.split(";")[0];
    if (contentType !== "application/json") return apiError("VALIDATION_ERROR", "Gunakan JSON.", 415);
    const body = await request.json();
    const { roomId, hostToken } = await createRoom(host.id, host.username, {
      name: body.name,
      category: body.category,
      bankId: body.bankId,
      durationMinutes: body.durationMinutes,
    });
    const response = NextResponse.json({ roomId }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(`vanexa_guest_${roomId}`, hostToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof RoomError) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Room belum berhasil dibuat. Coba lagi.", 503, true);
  }
}
