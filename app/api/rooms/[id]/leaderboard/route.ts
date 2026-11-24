import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { RoomError } from "@/lib/rooms";
import { apiError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await getLeaderboard((await params).id), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    if (error instanceof RoomError) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Leaderboard belum berhasil dimuat.", 503, true);
  }
}
