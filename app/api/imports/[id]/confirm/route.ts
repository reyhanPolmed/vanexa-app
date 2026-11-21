import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { confirmDraft } from "@/lib/imports/confirm";
import { ImportFailure } from "@/lib/imports/limits";
import { readEditorRequest } from "@/lib/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const input = await readEditorRequest(request);
    const result = await confirmDraft(host.id, (await params).id, input.revision, input.idempotencyKey);
    return NextResponse.json({ bankId: result.bankId, destination: `/banks/${result.bankId}` }, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImportFailure) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Konfirmasi belum berhasil. Ulangi dengan kunci konfirmasi yang sama.", 503, true);
  }
}
