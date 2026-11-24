import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { deleteRoom, getRoomState, RoomError } from "@/lib/rooms";
import { allowedOrigin, currentHost } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getRoomState(id);
    if (!state) return apiError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Data room belum berhasil dimuat.", 503, true); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk terlebih dahulu.", 401);
    await deleteRoom((await params).id, host.id);
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RoomError) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Room belum berhasil dihapus. Coba lagi.", 503, true);
  }
}
