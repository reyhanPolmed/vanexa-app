import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { bankDetail, editBank } from "@/lib/banks";
import { apiError } from "@/lib/http";
import { ImportFailure } from "@/lib/imports/limits";
import { readEditorRequest } from "@/lib/mutations";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const bank = await bankDetail(host.id, (await params).id);
    if (!bank) return apiError("BANK_NOT_FOUND", "Bank soal tidak ditemukan.", 404);
    return NextResponse.json({ bank }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Bank soal belum berhasil dimuat.", 503, true); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const { id } = await params;
    const input = await readEditorRequest(request);
    await editBank(host.id, id, input.revision, input.state);
    return NextResponse.json({ bank: await bankDetail(host.id, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ImportFailure) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Perubahan bank belum tersimpan. Coba lagi.", 503, true);
  }
}
