import { NextResponse } from "next/server";
import { currentHost } from "@/lib/auth";
import { listBanks } from "@/lib/banks";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    return NextResponse.json({ banks: await listBanks(host.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Bank soal belum berhasil dimuat.", 503, true); }
}
