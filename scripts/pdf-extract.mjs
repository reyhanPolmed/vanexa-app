// Runs in a bounded child process: no database access, file persistence, or OCR.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

console.log = () => {};
console.warn = () => {};
let loading;
const fail = (code, message) => { throw Object.assign(new Error(message), { importCode: code }); };
try {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) fail("IMPORT_LIMIT", "Ukuran PDF maksimal 5 MiB.");
    chunks.push(chunk);
  }
  loading = getDocument({
    data: new Uint8Array(Buffer.concat(chunks)), isEvalSupported: false,
    useSystemFonts: true, disableFontFace: true, stopAtErrors: true,
  });
  const pdf = await loading.promise;
  if (pdf.numPages > 50) fail("IMPORT_LIMIT", "PDF maksimal 50 halaman.");
  const pages = [];
  let characters = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    let line = "";
    let y = null;
    let right = 0;
    const lines = [];
    if (content.items.length > 50_000) fail("IMPORT_LIMIT", "Isi halaman terlalu kompleks.");
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const baseline = item.transform[5];
      if (Math.abs(item.transform[1]) > 0.01 || Math.abs(item.transform[2]) > 0.01) fail("AMBIGUOUS_PDF", "Teks diputar. Gunakan template satu kolom tanpa rotasi.");
      if (y !== null && baseline > y + 2) fail("AMBIGUOUS_PDF", "Urutan baca PDF tidak konsisten. Gunakan template satu kolom.");
      if (y === null || Math.abs(baseline - y) > 2) {
        if (line) lines.push(line);
        line = item.str;
      } else {
        if (x < right - 2 || x - right > 100) fail("AMBIGUOUS_PDF", "Teks bertumpuk atau memiliki beberapa kolom. Gunakan template satu kolom.");
        line += (x - right > Math.max(1, item.height * 0.2) ? " " : "") + item.str;
      }
      y = baseline;
      right = x + item.width;
      characters += item.str.length;
      if (characters > 500_000) fail("IMPORT_LIMIT", "Teks PDF terlalu panjang untuk diproses.");
    }
    if (line) lines.push(line);
    // Images are not silently dropped from questions in the text-only MVP.
    const operators = await page.getOperatorList();
    const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat, OPS.paintImageMaskXObjectGroup, OPS.paintInlineImageXObjectGroup, OPS.paintSolidColorImageMask]);
    if (operators.fnArray.some((operation) => imageOps.has(operation))) fail("UNSUPPORTED_PDF", "PDF mengandung gambar/scan. Gunakan PDF berbasis teks tanpa gambar.");
    pages.push(lines.join("\n"));
    page.cleanup();
  }
  const text = pages.join("\n");
  if (!text.trim()) fail("UNSUPPORTED_PDF", "PDF tidak memiliki teks yang dapat dibaca. Gunakan PDF berbasis teks sesuai template.");
  process.stdout.write(JSON.stringify({ text, pageCount: pdf.numPages }));
} catch (error) {
  const encrypted = error?.name === "PasswordException";
  process.stdout.write(JSON.stringify({ error: {
    code: error?.importCode ?? (encrypted ? "ENCRYPTED_PDF" : "INVALID_PDF"),
    message: error?.importCode ? error.message : encrypted ? "PDF dilindungi sandi. Gunakan PDF tanpa sandi." : "PDF rusak atau tidak dapat dibaca. Gunakan berkas PDF teks yang valid.",
  } }));
} finally { if (loading) await loading.destroy(); }
