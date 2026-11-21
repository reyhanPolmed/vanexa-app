import { expect, test, type APIRequestContext } from "@playwright/test";
import { singleQuestion, singleTemplate, textPdf } from "../fixtures/pdf";

const origin = "http://127.0.0.1:3100";
async function login(request: APIRequestContext, username = "import_host") {
  const response = await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username, password: "Practice-test-only-2026" } });
  expect(response.status()).toBe(200);
}
async function upload(request: APIRequestContext, pdf: Buffer) {
  return request.post("/api/imports", { headers: { Origin: origin, "Content-Type": "application/pdf", "X-File-Name": "latihan.pdf" }, data: pdf });
}

test("Host uploads a text PDF and reads an exact private preview without creating a bank", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Username").fill("host_a");
  await page.getByLabel("Password", { exact: true }).fill("Practice-test-only-2026");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bank soal pribadi", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Impor PDF", exact: true }).click();
  await page.getByLabel("File PDF").setInputFiles({ name: "latihan.pdf", mimeType: "application/pdf", buffer: await textPdf(singleTemplate, { pageBreakAt: 10 }) });
  await page.getByRole("button", { name: "Ekstrak soal" }).click();
  await expect(page.getByRole("heading", { name: "Preview impor", exact: true })).toBeVisible();
  await expect(page.getByText("Berapakah jumlah 2 dan 3?", { exact: true })).toBeVisible();
  await expect(page.getByText("Kunci: B", { exact: true })).toBeVisible();
  await expect(page.getByText("Dua ditambah tiga sama dengan lima.", { exact: true })).toBeVisible();
  await expect(page.getByText("1 valid", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/banks")).json()).banks).toHaveLength(1);
  await page.reload();
  await expect(page.getByText("Berapakah jumlah 2 dan 3?", { exact: true })).toBeVisible();
});

test("weighted questions preserve explicit 0–5 weights and optional explanation", async ({ request }) => {
  await login(request);
  const lines = singleTemplate.join("\n").replace("CATEGORY: TIU", "CATEGORY: TKP").replace("SINGLE_CORRECT", "WEIGHTED").replace("KEY: B", "WEIGHTS: A=0;B=1;C=2;D=4;E=5").replace("EXPLANATION:\nDua ditambah tiga sama dengan lima.\n", "").replace("Berapakah jumlah 2 dan 3?", "Apa arti “musyawarah” dalam kehidupan sehari-hari?").split("\n");
  const response = await upload(request, await textPdf(lines));
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  const { draft } = await (await request.get(`/api/imports/${id}`)).json();
  expect(draft.preview.category).toBe("TKP");
  expect(draft.preview.questions[0].weights).toEqual({ A: 0, B: 1, C: 2, D: 4, E: 5 });
  expect(draft.preview.questions[0].errors).toEqual([]);
  expect(draft.preview.questions[0].explanation).toBe("");
  expect(draft.preview.questions[0].prompt).toBe("Apa arti “musyawarah” dalam kehidupan sehari-hari?");
});

test("invalid fields and duplicates stay in preview with source and cannot become a bank", async ({ page }) => {
  await login(page.request);
  const first = singleQuestion.filter((line) => line !== "E: 8").map((line) => line === "KEY: B" ? "KEY: Z" : line);
  const lines = ["VANEXA-PDF-V1", "CATEGORY: TIU", "BANK: Perlu diperiksa", ...first, ...singleQuestion];
  const response = await upload(page.request, await textPdf(lines));
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  const { draft } = await (await page.request.get(`/api/imports/${id}`)).json();
  expect(draft.preview.questions).toHaveLength(2);
  expect(draft.preview.questions[0].errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "options.E", code: "MISSING_OPTION" }),
    expect.objectContaining({ field: "key", code: "INVALID_KEY" }),
    expect.objectContaining({ code: "DUPLICATE_NUMBER" }),
  ]));
  expect(draft.preview.questions[1].errors).toContainEqual(expect.objectContaining({ code: "DUPLICATE_NUMBER" }));
  await page.goto(`/imports/${id}`);
  await expect(page.getByText("Pilihan E belum diisi.", { exact: false })).toBeVisible();
  await page.getByText("Teks sumber soal", { exact: true }).first().click();
  await expect(page.locator("pre").first()).toContainText("KEY: Z");
  expect((await (await page.request.get("/api/banks")).json()).banks).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".vanexa-setup/import-preview-mobile.png", fullPage: true });
});

test("PDF paragraphs survive extraction and malformed scoring markers stay invalid", async ({ request }) => {
  await login(request);
  const lines = singleTemplate.join("\n").replace("Berapakah jumlah 2 dan 3?", "Paragraf satu.\n\nParagraf dua.").replace("A: 4", "A: Pilihan baris satu.\n\nPilihan baris dua.").replace("Dua ditambah tiga sama dengan lima.", "KEY : C").split("\n");
  const response = await upload(request, await textPdf(lines));
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  const { draft } = await (await request.get(`/api/imports/${id}`)).json();
  const question = draft.preview.questions[0];
  expect(question.prompt).toBe("Paragraf satu.\n\nParagraf dua.");
  expect(question.options.A).toBe("Pilihan baris satu.\n\nPilihan baris dua.");
  expect(question.errors).toContainEqual(expect.objectContaining({ code: "MALFORMED_MARKER" }));
  expect(question.rawText).toContain("KEY : C");
});

test("draft requires owner session, is private after refresh, and expires after 24 hours", async ({ request, playwright }) => {
  await login(request);
  const response = await upload(request, await textPdf());
  const { id } = await response.json();
  const guest = await playwright.request.newContext({ baseURL: origin });
  expect((await guest.get(`/api/imports/${id}`)).status()).toBe(401);
  expect((await upload(guest, await textPdf())).status()).toBe(401);
  await login(guest, "host_b");
  expect((await guest.get(`/api/imports/${id}`)).status()).toBe(404);
  const otherPage = await guest.get(`/imports/${id}`);
  expect(await otherPage.text()).not.toContain("Berapakah jumlah 2 dan 3?");
  expect((await request.get("/api/imports/cccccccc-cccc-4ccc-cccc-cccccccccccc")).status()).toBe(404);
  expect((await request.get(`/api/imports/${id}`)).headers()["cache-control"]).toContain("no-store");
  const rejected = await request.post("/api/imports", { headers: { Origin: "https://example.com", "Content-Type": "application/pdf" }, data: await textPdf() });
  expect(rejected.status()).toBe(403);
  await guest.dispose();
});

test("rejects malformed, encrypted, image-only and ambiguous PDFs explicitly", async ({ request }) => {
  test.setTimeout(60_000);
  await login(request);
  const cases = [
    { pdf: Buffer.from("not a PDF"), code: "INVALID_PDF" },
    { pdf: Buffer.from("%PDF-1.7\ncorrupt data"), code: "INVALID_PDF" },
    { pdf: await textPdf([], {}), code: "UNSUPPORTED_PDF" },
    { pdf: await textPdf([], { image: true }), code: "UNSUPPORTED_PDF" },
    { pdf: await textPdf(singleTemplate, { image: true }), code: "UNSUPPORTED_PDF" },
    { pdf: await textPdf(singleTemplate, { largeImage: true }), code: "UNSUPPORTED_PDF" },
    { pdf: await textPdf(singleTemplate, { encrypted: true }), code: "ENCRYPTED_PDF" },
    { pdf: await textPdf(singleTemplate, { twoColumns: true }), code: "AMBIGUOUS_PDF" },
    { pdf: await textPdf(["Arbitrary PDF with no template"]), code: "UNSUPPORTED_TEMPLATE" },
  ];
  for (const { pdf, code } of cases) {
    const response = await upload(request, pdf);
    expect(response.status(), code).toBe(422);
    expect((await response.json()).code).toBe(code);
  }
});

test("server enforces file byte, page and question limits, not just browser validation", async ({ request }) => {
  test.setTimeout(60_000);
  await login(request);
  expect((await upload(request, Buffer.alloc(5 * 1024 * 1024 + 1))).status()).toBe(413);
  const pages = await upload(request, await textPdf(singleTemplate, { pages: 51 }));
  expect((await pages.json()).code).toBe("IMPORT_LIMIT");
  const questions = ["VANEXA-PDF-V1", "CATEGORY: TIU", "BANK: Batas soal", ...Array.from({ length: 201 }, (_, i) => singleQuestion.map((line) => line === "QUESTION: 1" ? `QUESTION: ${i + 1}` : line)).flat()];
  // A compact PDF stays within page limit so the question-count guard is tested independently.
  const tooMany = await upload(request, await textPdf(questions, { compact: true }));
  expect((await tooMany.json()).code).toBe("IMPORT_LIMIT");
  const wrongType = await request.post("/api/imports", { headers: { Origin: origin, "Content-Type": "text/plain" }, data: "text" });
  expect(wrongType.status()).toBe(415);
});
