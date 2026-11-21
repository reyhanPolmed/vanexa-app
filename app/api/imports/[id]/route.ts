import { NextResponse } from "next/server";
import { currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { findDraft } from "@/lib/imports/drafts";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    const draft = await findDraft(host.id, (await params).id);
    if (!draft) return apiError("IMPORT_NOT_FOUND", "Draft tidak ditemukan atau sudah kedaluwarsa.", 404);
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("SERVICE_UNAVAILABLE", "Preview belum berhasil dimuat.", 503, true); }
}
