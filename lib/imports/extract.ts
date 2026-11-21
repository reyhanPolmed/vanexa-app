import "server-only";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { ImportFailure, importLimits } from "./limits";

export function extractPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--max-old-space-size=256", join(process.cwd(), "scripts/pdf-extract.mjs")], {
      cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "ignore"],
      env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP },
    });
    let settled = false;
    const output: Buffer[] = [];
    let bytes = 0;
    const finish = (error?: Error, result?: { text: string; pageCount: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { child.kill(); reject(error); }
      else resolve(result!);
    };
    const timer = setTimeout(() => finish(new ImportFailure("IMPORT_TIMEOUT", "Ekstraksi melewati batas 15 detik. Gunakan PDF yang lebih sederhana.")), importLimits.extractionMilliseconds);
    child.on("error", () => finish(new ImportFailure("EXTRACTION_UNAVAILABLE", "Layanan ekstraksi belum tersedia. Coba lagi.", 503)));
    child.stdin.on("error", () => {}); // Child may stop reading after reporting an invalid file.
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > importLimits.textCharacters * 8) finish(new ImportFailure("IMPORT_LIMIT", "Hasil ekstraksi terlalu panjang."));
      else output.push(chunk);
    });
    child.on("close", (code) => {
      if (settled) return;
      try {
        if (code !== 0) throw new Error("extraction process exited");
        const result = JSON.parse(Buffer.concat(output).toString("utf8"));
        if (result.error) return finish(new ImportFailure(result.error.code, result.error.message));
        if (typeof result.text !== "string" || !Number.isInteger(result.pageCount)) throw new Error("invalid extraction result");
        finish(undefined, result);
      } catch { finish(new ImportFailure("INVALID_PDF", "PDF tidak dapat diproses dalam batas sumber daya. Gunakan PDF yang lebih sederhana.")); }
    });
    child.stdin.end(buffer);
  });
}
