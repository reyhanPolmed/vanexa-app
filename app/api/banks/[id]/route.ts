import { NextResponse } from "next/server";
import { currentHost } from "@/lib/auth";
import { findBank } from "@/lib/banks";
import { apiError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const bank = await findBank(host.id, (await params).id);
    if (!bank) return apiError("BANK_NOT_FOUND", "Bank soal tidak ditemukan.", 404);
    return NextResponse.json({ bank }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Bank soal belum berhasil dimuat.", 503, true); }
}
