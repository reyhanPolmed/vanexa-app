import { NextResponse } from "next/server";
import { allowedOrigin, currentHost } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createDraft } from "@/lib/imports/drafts";
import { extractPdf } from "@/lib/imports/extract";
import { ImportFailure, importLimits } from "@/lib/imports/limits";
import { parseTemplate } from "@/lib/imports/template";

export const runtime = "nodejs";
let activeUploads = 0;

async function readPdf(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/pdf") throw new ImportFailure("UNSUPPORTED_PDF", "Pilih file PDF berbasis teks.", 415);
  if (Number(request.headers.get("content-length")) > importLimits.bytes) throw new ImportFailure("IMPORT_LIMIT", "Ukuran PDF maksimal 5 MiB.", 413);
  if (!request.body) throw new ImportFailure("INVALID_PDF", "File PDF belum diisi.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    void reader.cancel();
    reject(new ImportFailure("UPLOAD_TIMEOUT", "Upload melewati batas waktu. Coba lagi.", 408));
  }, 20_000); });
  try {
    await Promise.race([timeout, (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > importLimits.bytes) { void reader.cancel(); throw new ImportFailure("IMPORT_LIMIT", "Ukuran PDF maksimal 5 MiB.", 413); }
        chunks.push(value);
      }
    })()]);
  } finally { clearTimeout(timer!); }
  const buffer = Buffer.concat(chunks);
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new ImportFailure("INVALID_PDF", "File tidak memiliki signature PDF yang valid.");
  return buffer;
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  let acquired = false;
  try {
    const host = await currentHost();
    if (!host) return apiError("UNAUTHORIZED", "Silakan masuk.", 401);
    if (activeUploads >= 2) return apiError("IMPORT_BUSY", "Layanan impor sedang sibuk. Coba lagi.", 503, true);
    activeUploads++;
    acquired = true;
    let fileName = "upload.pdf";
    try { fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "upload.pdf").split(/[\\/]/).pop()!.slice(0, 255); }
    catch { throw new ImportFailure("VALIDATION_ERROR", "Nama file tidak valid.", 400); }
    const buffer = await readPdf(request);
    const { text, pageCount } = await extractPdf(buffer);
    const preview = parseTemplate(text);
    const id = await createDraft(host.id, fileName.replaceAll("\u0000", ""), pageCount, preview);
    return NextResponse.json({ id, destination: `/imports/${id}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImportFailure) return apiError(error.code, error.message, error.status, error.status >= 500);
    return apiError("SERVICE_UNAVAILABLE", "Impor belum berhasil. Coba lagi.", 503, true);
  } finally { if (acquired) activeUploads--; }
}
