import { readFile, writeFile } from "node:fs/promises";

// PDF.js 6.5.438 resolves getOperatorList() before rejecting a failed stream.
// Reject first so stopAtErrors/maxImageSize failures reach our public-API catch.
// Fail closed on upgrades; do not silently rewrite an unknown dependency version.
const root = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const version = JSON.parse(await readFile(new URL("package.json", root), "utf8")).version;
if (version !== "6.5.438") throw new Error("Revalidate the PDF.js operator-list error correction before upgrading.");
const original = `        if (intentState.operatorList) {
          intentState.operatorList.lastChunk = true;
          for (const internalRenderTask of intentState.renderTasks) {`;
const corrected = `        // Vanexa: reject a failed operator stream before success notification.
        intentState.opListReadCapability?.reject(reason);
${original}`;
for (const build of ["legacy/build/pdf.mjs", "build/pdf.mjs"]) {
  const path = new URL(build, root);
  const source = await readFile(path, "utf8");
  if (source.includes(corrected)) continue;
  if (source.split(original).length !== 2) throw new Error(`Unexpected PDF.js error-handler shape in ${build}; correction not applied.`);
  await writeFile(path, source.replace(original, corrected));
}
console.log("PDF.js operator-list error propagation verified.");
