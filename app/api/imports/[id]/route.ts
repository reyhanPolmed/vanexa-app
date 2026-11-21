import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { findDraft } from "@/lib/imports/drafts";
import { saveDraft } from "@/lib/imports/confirm";
import { ImportFailure } from "@/lib/imports/limits";
import { readEditorRequest } from "@/lib/mutations";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const draft = await findDraft(host.id, (await params).id);
    if (!draft) return apiError("IMPORT_NOT_FOUND", "Draft tidak ditemukan atau sudah kedaluwarsa.", 404);
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Preview belum berhasil dimuat.", 503, true); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const { id } = await params;
    const input = await readEditorRequest(request);
    const draft = await saveDraft(host.id, id, input.revision, input.state);
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ImportFailure) return apiError(error.code, error.message, error.status);
    return apiError("SERVICE_UNAVAILABLE", "Perbaikan draft belum tersimpan. Coba lagi.", 503, true);
  }
}
