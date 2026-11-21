import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTemplate } from "../lib/imports/template";
import { singleQuestion, singleTemplate } from "./fixtures/pdf";

test("single-key template preserves exact Indonesian content and option order", () => {
  const result = parseTemplate(singleTemplate.join("\n"));
  assert.equal(result.category, "TIU");
  assert.equal(result.bankName, "Latihan Bahasa Indonesia");
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].sourceNumber, "1");
  assert.equal(result.questions[0].prompt, "Berapakah jumlah 2 dan 3?");
  assert.deepEqual(result.questions[0].options, { A: "4", B: "5", C: "6", D: "7", E: "8" });
  assert.equal(result.questions[0].key, "B");
  assert.equal(result.questions[0].explanation, "Dua ditambah tiga sama dengan lima.");
  assert.deepEqual(result.questions[0].errors, []);
});

test("weighted template accepts all integer weights 0–5 and optional explanation", () => {
  const input = singleTemplate.join("\n").replace("CATEGORY: TIU", "CATEGORY: TKP").replace("SINGLE_CORRECT", "WEIGHTED")
    .replace("KEY: B", "WEIGHTS: A=0;B=1;C=2;D=4;E=5").replace("EXPLANATION:\nDua ditambah tiga sama dengan lima.\n", "");
  const question = parseTemplate(input).questions[0];
  assert.deepEqual(question.weights, { A: 0, B: 1, C: 2, D: 4, E: 5 });
  assert.equal(question.key, null);
  assert.equal(question.explanation, "");
  assert.deepEqual(question.errors, []);
});

test("invalid questions retain readable source, missing options, and invalid keys", () => {
  const input = singleTemplate.join("\n").replace("E: 8\n", "").replace("KEY: B", "KEY: Z");
  const question = parseTemplate(input).questions[0];
  assert.equal(question.prompt, "Berapakah jumlah 2 dan 3?");
  assert.equal(question.options.E, undefined);
  assert.equal(question.key, "Z");
  assert.ok(question.errors.some((e) => e.field === "options.E" && e.code === "MISSING_OPTION"));
  assert.ok(question.errors.some((e) => e.field === "key" && e.code === "INVALID_KEY"));
  assert.ok(question.rawText.includes("KEY: Z"));
});

test("duplicate source numbers flag every affected question, not just the last", () => {
  const result = parseTemplate([...singleTemplate, ...singleQuestion].join("\n"));
  assert.equal(result.questions.length, 2);
  for (const q of result.questions) assert.ok(q.errors.some((e) => e.code === "DUPLICATE_NUMBER"));
});

test("duplicate and unknown markers remain explicit errors with source available", () => {
  const q = parseTemplate(singleTemplate.join("\n").replace("KEY: B", "KEY: B\nKEY: C\nUNKNOWN: content")).questions[0];
  assert.ok(q.errors.some((e) => e.code === "DUPLICATE_MARKER"));
  assert.ok(q.errors.some((e) => e.code === "UNKNOWN_MARKER"));
  assert.ok(q.rawText.includes("KEY: C"));
});

test("missing end delimiter retains both questions and marks the unclosed block", () => {
  const first = singleTemplate.filter((line) => line !== "---END---");
  const second = singleQuestion.map((line) => line === "QUESTION: 1" ? "QUESTION: 2" : line);
  const result = parseTemplate([...first, ...second].join("\n"));
  assert.equal(result.questions.length, 2);
  assert.ok(result.questions[0].errors.some((e) => e.code === "MISSING_END"));
  assert.deepEqual(result.questions[1].errors, []);
});

test("weighted conflicts and missing, duplicate, fractional or excessive weights are invalid", () => {
  const input = singleTemplate.join("\n").replace("SINGLE_CORRECT", "WEIGHTED").replace("KEY: B", "KEY: B\nWEIGHTS: A=0;A=2;B=1.5;C=6;D=4");
  const errors = parseTemplate(input).questions[0].errors;
  assert.ok(errors.some((e) => e.code === "CONFLICTING_SCORE"));
  assert.ok(errors.some((e) => e.code === "INVALID_WEIGHT"));
  for (const field of ["weights.B", "weights.C", "weights.E"]) assert.ok(errors.some((e) => e.field === field));
});

test("metadata validation cannot infer an unknown category or unnamed bank", () => {
  const result = parseTemplate(singleTemplate.join("\n").replace("CATEGORY: TIU", "CATEGORY: UNKNOWN").replace("BANK: Latihan Bahasa Indonesia", "BANK:"));
  assert.ok(result.errors.some((e) => e.field === "category"));
  assert.ok(result.errors.some((e) => e.field === "bankName"));
});

test("multiline prompt and options preserve their line breaks", () => {
  const q = parseTemplate(singleTemplate.join("\n").replace("Berapakah jumlah 2 dan 3?", "Perhatikan kalimat berikut.\nApakah jumlahnya lima?").replace("B: 5", "B: Lima\nmerupakan jumlahnya.")).questions[0];
  assert.equal(q.prompt, "Perhatikan kalimat berikut.\nApakah jumlahnya lima?");
  assert.equal(q.options.B, "Lima\nmerupakan jumlahnya.");
  assert.deepEqual(q.errors, []);
});

test("question limit rejects 201 questions rather than silently truncating", () => {
  const questions = Array.from({ length: 201 }, (_, i) => singleQuestion.join("\n").replace("QUESTION: 1", `QUESTION: ${i + 1}`));
  assert.throws(() => parseTemplate(["VANEXA-PDF-V1", "CATEGORY: TIU", "BANK: Batas", ...questions].join("\n")), /200 soal/);
});

test("unsupported templates and files with no question blocks are rejected", () => {
  assert.throws(() => parseTemplate("random text"), /VANEXA-PDF-V1/);
  assert.throws(() => parseTemplate("VANEXA-PDF-V1\nCATEGORY: TIU\nBANK: kosong"), /QUESTION/);
});
