import PDFDocument from "pdfkit";

export const singleQuestion = [
  "QUESTION: 1", "TYPE: SINGLE_CORRECT", "PROMPT:",
  "Berapakah jumlah 2 dan 3?", "A: 4", "B: 5", "C: 6", "D: 7", "E: 8",
  "KEY: B", "EXPLANATION:", "Dua ditambah tiga sama dengan lima.", "---END---",
];

export const singleTemplate = ["VANEXA-PDF-V1", "CATEGORY: TIU", "BANK: Latihan Bahasa Indonesia", ...singleQuestion];

export function textPdf(lines = singleTemplate, options: { pageBreakAt?: number; encrypted?: boolean; pages?: number; twoColumns?: boolean; compact?: boolean; image?: boolean; largeImage?: boolean } = {}) {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 40, ...(options.encrypted ? { userPassword: "fixture-password", ownerPassword: "fixture-owner" } : {}) });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    let y = 45;
    if (options.image) pdf.image(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=", "base64"), 40, 400, { width: 120 });
    if (options.largeImage) {
      const image = pdf.ref({ Type: "XObject", Subtype: "Image", Width: 100_000, Height: 100_000, ColorSpace: "DeviceRGB", BitsPerComponent: 8 });
      image.end(Buffer.from([0, 0, 0]));
      pdf.page.xobjects.HugeImage = image;
      pdf.addContent("q 1 0 0 1 0 0 cm /HugeImage Do Q");
    }
    for (let i = 0; i < lines.length; i++) {
      if (i === options.pageBreakAt || y > 780) { pdf.addPage(); y = 45; }
      pdf.fontSize(options.compact ? 5 : 10).text(lines[i], 40, y, { lineBreak: false });
      if (options.twoColumns && i === 0) pdf.text("OTHER COLUMN", 350, y, { lineBreak: false });
      y += options.compact ? 7 : 17;
    }
    for (let i = 1; i < (options.pages ?? 1); i++) pdf.addPage();
    pdf.end();
  });
}
