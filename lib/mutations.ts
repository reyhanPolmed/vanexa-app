import { ImportFailure } from "./imports/limits";

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function requireRevision(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new ImportFailure("VALIDATION_ERROR", "Revision harus bilangan bulat nonnegatif.", 400);
}

export async function readEditorRequest(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new ImportFailure("VALIDATION_ERROR", "Gunakan JSON untuk perubahan editor.", 415);
  if (!request.body) throw new ImportFailure("VALIDATION_ERROR", "Data editor belum diisi.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 20_000);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024) { void reader.cancel().catch(() => {}); throw new ImportFailure("IMPORT_LIMIT", "Data editor terlalu panjang.", 413); }
      chunks.push(value);
    }
    if (timedOut) throw new ImportFailure("UPLOAD_TIMEOUT", "Pengiriman data editor melewati batas waktu.", 408);
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ImportFailure("VALIDATION_ERROR", "JSON editor tidak valid.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ImportFailure("VALIDATION_ERROR", "Data editor tidak valid.", 400);
    return input;
  } finally { clearTimeout(timer); }
}
