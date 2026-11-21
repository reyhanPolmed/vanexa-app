import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { singleQuestion, singleTemplate, textPdf } from "../fixtures/pdf";

const origin = "http://127.0.0.1:3100";
async function login(request: APIRequestContext, username = "confirm_host") {
  expect((await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username, password: "Practice-test-only-2026" } })).status()).toBe(200);
}
async function upload(request: APIRequestContext, lines = singleTemplate) {
  const response = await request.post("/api/imports", { headers: { Origin: origin, "Content-Type": "application/pdf" }, data: await textPdf(lines) });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
async function draft(request: APIRequestContext, id: string) { return (await (await request.get(`/api/imports/${id}`)).json()).draft; }
async function save(request: APIRequestContext, id: string, revision: number, state: unknown) { return request.patch(`/api/imports/${id}`, { headers: { Origin: origin }, data: { revision, state } }); }
async function confirm(request: APIRequestContext, id: string, revision: number, idempotencyKey = randomUUID()) { return request.post(`/api/imports/${id}/confirm`, { headers: { Origin: origin }, data: { revision, idempotencyKey } }); }

test("server refuses to confirm an invalid draft even if the client claims it is valid", async ({ request }) => {
  await login(request);
  const pdf = await textPdf(singleTemplate.filter((line) => line !== "E: 8"));
  const uploaded = await request.post("/api/imports", { headers: { Origin: origin, "Content-Type": "application/pdf" }, data: pdf });
  expect(uploaded.status()).toBe(201);
  const { id } = await uploaded.json();
  const response = await request.post(`/api/imports/${id}/confirm`, { headers: { Origin: origin }, data: { revision: 0, idempotencyKey: randomUUID(), valid: true } });
  expect(response.status()).toBe(422);
  expect((await response.json()).code).toBe("IMPORT_INVALID");
  expect((await (await request.get("/api/banks")).json()).banks).toEqual([]);
});

test("Host repairs a question, discards another, reviews exact final count, then corrects the saved bank", async ({ page }) => {
  await login(page.request);
  const invalid = singleQuestion.filter((line) => line !== "E: 8").map((line) => line === "KEY: B" ? "KEY: Z" : line);
  const second = singleQuestion.map((line) => line === "QUESTION: 1" ? "QUESTION: 2" : line === "KEY: B" ? "KEY: Z" : line);
  const third = singleQuestion.map((line) => line === "QUESTION: 1" ? "QUESTION: 3" : line === "KEY: B" ? "KEY: C" : line);
  const id = await upload(page.request, ["VANEXA-PDF-V1", "CATEGORY: TIU", "BANK: Bank hasil perbaikan", ...invalid, ...second, ...third]);
  await page.goto(`/imports/${id}`);
  await expect(page.getByRole("button", { name: "Tinjau impor" })).toBeDisabled();
  await page.getByText("Perbaiki soal 1", { exact: true }).click();
  const firstEditor = page.getByRole("group", { name: "Editor soal 1", exact: true });
  await firstEditor.getByLabel("Pilihan E", { exact: true }).fill("8");
  await firstEditor.getByLabel("Kunci jawaban", { exact: true }).fill("B");
  await page.getByRole("button", { name: "Buang soal 2", exact: true }).click();
  await page.getByRole("button", { name: "Simpan perbaikan", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Perbaikan tersimpan." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Peringatan duplikat" })).toBeVisible();
  await page.getByRole("button", { name: "Tinjau impor", exact: true }).click();
  await expect(page.getByRole("region", { name: "Konfirmasi final" })).toContainText("2 soal akan disimpan");
  await expect(page.getByRole("region", { name: "Konfirmasi final" })).toContainText("soal sumber 2");
  await page.getByRole("button", { name: "Konfirmasi impor", exact: true }).click();
  await expect(page).toHaveURL(/\/banks\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: "Bank hasil perbaikan", exact: true })).toBeVisible();
  const bankId = page.url().split("/").pop()!;
  const stored = (await (await page.request.get(`/api/banks/${bankId}`)).json()).bank;
  expect(stored.questions).toHaveLength(2);
  expect(stored.questions.map((q: { sourceNumber: string; key: string }) => [q.sourceNumber, q.key])).toEqual([["1", "B"], ["3", "C"]]);
  const ids = stored.questionIds;
  await page.getByText("Perbaiki soal 1", { exact: true }).click();
  const savedEditor = page.getByRole("group", { name: "Editor soal 1", exact: true });
  await savedEditor.getByLabel("Jenis skor").selectOption("WEIGHTED");
  for (const [letter, weight] of [["A", "0"], ["B", "1"], ["C", "2"], ["D", "4"], ["E", "5"]]) await savedEditor.getByLabel(`Bobot ${letter}`, { exact: true }).fill(weight);
  await page.getByLabel("Nama bank", { exact: true }).fill("Bank setelah koreksi");
  await page.getByRole("button", { name: "Simpan perbaikan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bank setelah koreksi", exact: true })).toBeVisible();
  const changed = (await (await page.request.get(`/api/banks/${bankId}`)).json()).bank;
  expect(changed.revision).toBe(1);
  expect(changed.questionIds).toEqual(ids);
  expect(changed.questions[0].weights).toEqual({ A: 0, B: 1, C: 2, D: 4, E: 5 });
  expect(changed.questions[0].key).toBe(null);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".vanexa-setup/confirmed-bank-mobile.png", fullPage: true });
  await page.goto(`/imports/${id}`);
  await expect(page.getByRole("heading", { name: "Impor sudah dikonfirmasi" })).toBeVisible();
});

test("discarding all questions blocks confirmation; restoring one and retrying is safe", async ({ request }) => {
  await login(request, "confirm_race");
  const id = await upload(request);
  const initial = await draft(request, id);
  const removed = { ...initial.state, items: initial.state.items.map((item: { source: string }) => ({ ...item, discarded: true })) };
  expect((await save(request, id, 0, removed)).status()).toBe(200);
  expect((await confirm(request, id, 1)).status()).toBe(422);
  expect((await (await request.get("/api/banks")).json()).banks).toEqual([]);
  expect((await save(request, id, 0, initial.state)).status()).toBe(409);
  expect((await save(request, id, 1, initial.state)).status()).toBe(200);
  const key = randomUUID();
  const first = await confirm(request, id, 2, key);
  const repeated = await confirm(request, id, 2, key);
  expect(first.status()).toBe(201);
  expect(repeated.status()).toBe(200);
  expect(await first.json()).toEqual(await repeated.json());
  expect((await confirm(request, id, 2)).status()).toBe(409);
  expect((await save(request, id, 2, initial.state)).status()).toBe(409);
  expect((await (await request.get("/api/banks")).json()).banks).toHaveLength(1);
});

test("concurrent saves reject the stale writer and concurrent confirmation creates one bank", async ({ request }) => {
  await login(request, "confirm_owner");
  const id = await upload(request);
  const initial = await draft(request, id);
  const responses = await Promise.all([save(request, id, 0, { ...initial.state, bankName: "Pemenang A" }), save(request, id, 0, { ...initial.state, bankName: "Pemenang B" })]);
  expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
  const latest = await draft(request, id);
  expect(latest.revision).toBe(1);
  const key = randomUUID();
  const confirmations = await Promise.all([confirm(request, id, 1, key), confirm(request, id, 1, key)]);
  expect(confirmations.map((response) => response.status()).sort()).toEqual([200, 201]);
  const first = await confirmations[0].json();
  expect(await confirmations[1].json()).toEqual(first);
  const bank = (await (await request.get(`/api/banks/${first.bankId}`)).json()).bank;
  expect(bank.name).toBe(latest.state.bankName);
  expect(bank.questions).toHaveLength(1);
  expect((await (await request.get("/api/banks")).json()).banks).toHaveLength(1);
});

test("only owner can edit/confirm and invalid or stale bank edits do not partially commit", async ({ request, playwright }) => {
  await login(request);
  const id = await upload(request);
  const initial = await draft(request, id);
  const guest = await playwright.request.newContext({ baseURL: origin });
  expect((await save(guest, id, 0, initial.state)).status()).toBe(401);
  await login(guest, "host_b");
  expect((await save(guest, id, 0, initial.state)).status()).toBe(404);
  expect((await confirm(guest, id, 0)).status()).toBe(404);
  expect((await request.patch(`/api/imports/${id}`, { headers: { Origin: "https://example.com" }, data: { revision: 0, state: initial.state } })).status()).toBe(403);
  const confirmed = await (await confirm(request, id, 0)).json();
  const bank = (await (await request.get(`/api/banks/${confirmed.bankId}`)).json()).bank;
  expect((await guest.patch(`/api/banks/${bank.id}`, { headers: { Origin: origin }, data: { revision: 0, state: bank.state } })).status()).toBe(404);
  const invalidState = { ...bank.state, bankName: "NAMA YANG TIDAK BOLEH TERSIMPAN", items: bank.state.items.map((item: { source: string }) => ({ ...item, source: item.source.replace("KEY: B", "KEY: Z") })) };
  expect((await request.patch(`/api/banks/${bank.id}`, { headers: { Origin: origin }, data: { revision: 0, state: invalidState } })).status()).toBe(422);
  const unchanged = (await (await request.get(`/api/banks/${bank.id}`)).json()).bank;
  expect(unchanged.name).toBe(bank.name);
  expect(unchanged.revision).toBe(0);
  expect(unchanged.questions[0].key).toBe("B");
  expect((await request.patch(`/api/banks/${bank.id}`, { headers: { Origin: origin }, data: { revision: 7, state: bank.state } })).status()).toBe(409);
  await guest.dispose();
});

test("duplicate warnings compare question and options with owner banks without merging scores", async ({ request }) => {
  await login(request);
  const seed = await upload(request);
  expect((await confirm(request, seed, 0)).status()).toBe(201);
  const id = await upload(request, singleTemplate.map((line) => line === "KEY: B" ? "KEY: E" : line));
  const initial = await draft(request, id);
  expect(initial.duplicates).toContainEqual({ index: 0, inDraft: false, inExistingBank: true });
  const confirmed = await confirm(request, id, 0);
  expect(confirmed.status()).toBe(201);
  const { bankId } = await confirmed.json();
  const bank = (await (await request.get(`/api/banks/${bankId}`)).json()).bank;
  expect(bank.questions[0].key).toBe("E");
});

test("ambiguous source is not silently repaired by save, and metadata needs explicit review", async ({ request }) => {
  await login(request);
  const lines = [...singleTemplate.map((line) => line === "Dua ditambah tiga sama dengan lima." ? "KEY : C" : line), "Teks penting di luar blok soal"];
  const id = await upload(request, lines);
  const initial = await draft(request, id);
  expect((await save(request, id, 0, initial.state)).status()).toBe(200);
  expect((await confirm(request, id, 1)).status()).toBe(422);
  const repaired = { ...initial.state, reviewedDocument: true, items: initial.state.items.map((item: { source: string; discarded: boolean }) => ({ ...item, source: item.source.replace("KEY : C", "Penjelasan setelah diperiksa oleh Host.") })) };
  expect((await save(request, id, 1, repaired)).status()).toBe(200);
  const result = await confirm(request, id, 2);
  expect(result.status()).toBe(201);
  const current = await draft(request, id);
  expect(current.originalPreview.questions[0].rawText).toContain("KEY : C");
});

test("ambiguous duplicate weights require explicit source correction before field editing", async ({ page }) => {
  await login(page.request, "confirm_owner");
  const lines = singleTemplate.join("\n").replace("SINGLE_CORRECT", "WEIGHTED").replace("KEY: B", "WEIGHTS: A=1;B=2;C=3;D=4;E=5;A=0").split("\n");
  const id = await upload(page.request, lines);
  await page.goto(`/imports/${id}`);
  await page.getByText("Perbaiki soal 1", { exact: true }).click();
  const editor = page.getByRole("group", { name: "Editor soal 1", exact: true });
  await expect(editor.getByLabel("Teks sumber untuk diperbaiki")).toHaveValue(/E=5;A=0/);
  await expect(editor.getByRole("button", { name: "Gunakan editor isian" })).toBeDisabled();
  await editor.getByLabel("Teks sumber untuk diperbaiki").fill(lines.slice(3).join("\n").replace(";A=0", ""));
  await editor.getByRole("button", { name: "Gunakan editor isian" }).click();
  await editor.getByLabel("Pertanyaan", { exact: true }).fill("Pertanyaan yang diperiksa Host.");
  await page.getByRole("button", { name: "Simpan perbaikan", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Perbaikan tersimpan." })).toBeVisible();
  const saved = await draft(page.request, id);
  expect(saved.preview.questions[0].weights.A).toBe(1);
  expect(saved.preview.questions[0].errors).toEqual([]);
  expect(saved.originalPreview.questions[0].rawText).toContain(";A=0");
});

test("overlapping draft and bank saves acknowledge their own committed revision and content", async ({ request }) => {
  await login(request, "confirm_race");
  const id = await upload(request);
  const initial = await draft(request, id);
  const firstState = { ...initial.state, bankName: "Snapshot draft A" };
  const secondState = { ...initial.state, bankName: "Snapshot draft B" };
  const [first, second] = await Promise.all([save(request, id, 0, firstState), save(request, id, 1, secondState)]);
  expect(first.status()).toBe(200);
  const acknowledgement = (await first.json()).draft;
  expect(acknowledgement.revision).toBe(1);
  expect(acknowledgement.state.bankName).toBe("Snapshot draft A");
  expect([200, 409]).toContain(second.status());
  if (second.status() === 200) {
    const acknowledgementB = (await second.json()).draft;
    expect(acknowledgementB.revision).toBe(2);
    expect(acknowledgementB.state.bankName).toBe("Snapshot draft B");
  }
  const current = await draft(request, id);
  const { bankId } = await (await confirm(request, id, current.revision)).json();
  const bank = (await (await request.get(`/api/banks/${bankId}`)).json()).bank;
  const [bankA, bankB] = await Promise.all([
    request.patch(`/api/banks/${bankId}`, { headers: { Origin: origin }, data: { revision: 0, state: { ...bank.state, bankName: "Snapshot bank A" } } }),
    request.patch(`/api/banks/${bankId}`, { headers: { Origin: origin }, data: { revision: 1, state: { ...bank.state, bankName: "Snapshot bank B" } } }),
  ]);
  expect(bankA.status()).toBe(200);
  expect((await bankA.json()).bank).toMatchObject({ name: "Snapshot bank A", revision: 1 });
  expect([200, 409]).toContain(bankB.status());
  if (bankB.status() === 200) expect((await bankB.json()).bank).toMatchObject({ name: "Snapshot bank B", revision: 2 });
});
