import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:3100";
const password = "Practice-test-only-2026";
const multiBankId = "33333333-3333-4333-3333-333333333333";
const weightedBankId = "44444444-4444-4444-4444-444444444444";

async function login(page: Page, username = "room_host") {
  await page.goto("/auth");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL("/banks");
}

test.describe("Submit pengerjaan dan lihat skor serta pembahasan pribadi (Tiket 07)", () => {
  test("Modal konfirmasi submit menampilkan hitungan kosong & submit menghasilkan skor single correct yang akurat", async ({
    browser,
  }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Room Submit TIU", category: "TIU", bankId: multiBankId, durationMinutes: 60 },
    });
    expect(createRes.status()).toBe(201);
    const { roomId } = await createRes.json();

    // 2. Guest joins
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Dimas");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    // Host starts quiz
    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    await guestPage.goto(`/rooms/${roomId}/quiz`);
    await expect(guestPage.getByText("Soal Nomor 1 dari 3")).toBeVisible();

    // 3. Guest answers only Question 1 with Option B (correct key)
    await guestPage.getByTestId("option-label-B").click();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });

    // Questions 2 & 3 remain unanswered (kosong)

    // 4. Guest clicks "Selesai & Kumpulkan"
    await guestPage.getByTestId("header-open-submit-modal").click();

    // 5. Modal dialog appears with honest count
    await expect(guestPage.getByRole("dialog")).toBeVisible();
    await expect(guestPage.getByTestId("modal-answered-count")).toHaveText("1 soal");
    await expect(guestPage.getByTestId("modal-unanswered-count")).toHaveText("2 soal");

    // Guest confirms submission
    await guestPage.getByTestId("confirm-submit-button").click();

    // 6. Navigation transitions to /rooms/:id/result
    await expect(guestPage).toHaveURL(`/rooms/${roomId}/result`, { timeout: 10_000 });

    // 7. Verify result presentation
    await expect(guestPage.getByTestId("final-score")).toHaveText("1");
    await expect(guestPage.getByText("/ 3 poin")).toBeVisible();
    await expect(guestPage.getByTestId("count-correct")).toHaveText("1");
    await expect(guestPage.getByTestId("count-incorrect")).toHaveText("0");
    await expect(guestPage.getByTestId("count-unanswered")).toHaveText("2");

    // Review per question
    // Question 1: Benar (+1 poin), user selected B, key B, explanation shown
    const q1Review = guestPage.getByTestId("question-review-1");
    await expect(q1Review.getByText("Benar (+1 poin)")).toBeVisible();
    await expect(q1Review.getByText("Pilihan Anda")).toBeVisible();
    await expect(q1Review.getByText("Kunci")).toBeVisible();
    await expect(q1Review.getByText("2 + 3 = 5")).toBeVisible();

    // Question 2: Tidak Dijawab (0 poin), key C
    const q2Review = guestPage.getByTestId("question-review-2");
    await expect(q2Review.getByText("Tidak Dijawab (0 poin)")).toBeVisible();
    await expect(q2Review.getByText("Kunci")).toBeVisible();

    // Question 3: Tidak Dijawab (0 poin), key B
    const q3Review = guestPage.getByTestId("question-review-3");
    await expect(q3Review.getByText("Tidak Dijawab (0 poin)")).toBeVisible();

    // Disclaimer notice is visible
    await expect(guestPage.getByTestId("disclaimer-notice")).toBeVisible();
    await expect(guestPage.getByTestId("disclaimer-notice")).toContainText("tidak menyatakan standar resmi atau kelulusan CPNS");

    await hostContext.close();
    await guestContext.close();
  });

  test("Formula scoring soal berbobot (WEIGHTED / TKP) menghitung bobot opsi tanpa memaksakan benar/salah", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    // Create room with weighted TKP bank
    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Room Submit TKP", category: "TKP", bankId: weightedBankId, durationMinutes: 45 },
    });
    expect(createRes.status()).toBe(201);
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Nabila");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    await guestPage.goto(`/rooms/${roomId}/quiz`);
    await expect(guestPage.getByText("Soal Nomor 1 dari 2")).toBeVisible();

    // Question 1 weights are [1, 2, 3, 4, 5]. Choose E (+5)
    await guestPage.getByTestId("option-label-E").click();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });

    // Go to Question 2 (weights [5, 4, 3, 2, 1]). Choose B (+4)
    await guestPage.getByRole("button", { name: "Soal Berikutnya →" }).click();
    await expect(guestPage.getByText("Soal Nomor 2 dari 2")).toBeVisible();
    await guestPage.getByTestId("option-label-B").click();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });

    // Submit via sidebar button
    await guestPage.getByTestId("sidebar-open-submit-modal").click();
    await expect(guestPage.getByTestId("modal-answered-count")).toHaveText("2 soal");
    await expect(guestPage.getByTestId("modal-unanswered-count")).toHaveText("0 soal");
    await guestPage.getByTestId("confirm-submit-button").click();

    // Land on results
    await expect(guestPage).toHaveURL(`/rooms/${roomId}/result`, { timeout: 10_000 });

    // Total score is 5 + 4 = 9, out of max 10
    await expect(guestPage.getByTestId("final-score")).toHaveText("9");
    await expect(guestPage.getByText("/ 10 poin")).toBeVisible();

    // Does NOT say benar/salah, shows score breakdown
    const q1Review = guestPage.getByTestId("question-review-1");
    await expect(q1Review.getByText("Perolehan: +5 poin (maks 5)")).toBeVisible();
    await expect(q1Review.getByText("Bobot: 5")).toBeVisible();
    await expect(q1Review.getByText("Mengajak diskusi solutif bernilai paling tinggi.")).toBeVisible();

    const q2Review = guestPage.getByTestId("question-review-2");
    await expect(q2Review.getByText("Perolehan: +4 poin (maks 5)")).toBeVisible();
    await expect(q2Review.getByText("Bobot: 4")).toBeVisible();
    // Honest empty explanation
    await expect(q2Review.getByText("Tidak ada pembahasan untuk soal ini.")).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test("Submit idempoten dan mengunci pengerjaan (mutasi setelah submit ditolak)", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Room Submit Lock", category: "TIU", bankId: multiBankId, durationMinutes: 30 },
    });
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Bayu");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    const quizRes = await guestPage.request.get(`/api/rooms/${roomId}/quiz`);
    const quizData = await quizRes.json();
    const attemptId = quizData.attempt.id;
    const q1Id = quizData.questions[0].id;

    // Answer Q1 with A
    await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1Id}`, {
      headers: { Origin: origin },
      data: { choice: "A", mutationId: randomUUID(), expectedRevision: 0 },
    });

    // 1. First submit
    const submitKey = randomUUID();
    const submitRes1 = await guestPage.request.post(`/api/attempts/${attemptId}/submit`, {
      headers: { Origin: origin },
      data: { idempotencyKey: submitKey },
    });
    expect(submitRes1.status()).toBe(200);
    const data1 = await submitRes1.json();
    expect(data1.status).toBe("SUBMITTED");
    expect(data1.idempotent).toBe(false);

    // 2. Second submit (idempotent)
    const submitRes2 = await guestPage.request.post(`/api/attempts/${attemptId}/submit`, {
      headers: { Origin: origin },
      data: { idempotencyKey: submitKey },
    });
    expect(submitRes2.status()).toBe(200);
    const data2 = await submitRes2.json();
    expect(data2.status).toBe("SUBMITTED");
    expect(data2.submittedAt).toBe(data1.submittedAt);
    expect(data2.finalScore).toBe(data1.finalScore);
    expect(data2.idempotent).toBe(true);

    // 3. Attempting to change answer after submit is rejected with ATTEMPT_FINALIZED
    const mutateAfterSubmit = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1Id}`, {
      headers: { Origin: origin },
      data: { choice: "B", mutationId: randomUUID(), expectedRevision: 1 },
    });
    expect(mutateAfterSubmit.status()).toBe(400);
    const mutateErr = await mutateAfterSubmit.json();
    expect(mutateErr.code).toBe("ATTEMPT_FINALIZED");

    await hostContext.close();
    await guestContext.close();
  });

  test("Peserta aktif tidak dapat melihat hasil/kunci sebelum submit dan peserta lain ditolak (AC13, AC21)", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Room Isolation Check", category: "TIU", bankId: multiBankId, durationMinutes: 30 },
    });
    const { roomId } = await createRes.json();

    // Guest 1 joins
    const g1Context = await browser.newContext();
    const g1Page = await g1Context.newPage();
    await g1Page.goto(`/rooms/${roomId}`);
    await g1Page.getByLabel("Nickname Anda").fill("PesertaSatu");
    await g1Page.getByRole("button", { name: "Gabung ke Lobby" }).click();

    // Guest 2 joins
    const g2Context = await browser.newContext();
    const g2Page = await g2Context.newPage();
    await g2Page.goto(`/rooms/${roomId}`);
    await g2Page.getByLabel("Nickname Anda").fill("PesertaDua");
    await g2Page.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    const g1Quiz = await (await g1Page.request.get(`/api/rooms/${roomId}/quiz`)).json();
    const g1AttemptId = g1Quiz.attempt.id;

    // 1. While attempt is ACTIVE, requesting result via API is 403 FORBIDDEN
    const preSubmitApi = await g1Page.request.get(`/api/attempts/${g1AttemptId}/result`);
    expect(preSubmitApi.status()).toBe(403);
    expect((await preSubmitApi.json()).code).toBe("FORBIDDEN");

    // Visiting /rooms/:id/result in browser redirects back to /rooms/:id/quiz
    await g1Page.goto(`/rooms/${roomId}/result`);
    await expect(g1Page).toHaveURL(`/rooms/${roomId}/quiz`);

    // 2. Guest 1 submits
    await g1Page.request.post(`/api/attempts/${g1AttemptId}/submit`, {
      headers: { Origin: origin },
      data: { idempotencyKey: randomUUID() },
    });

    // Now Guest 1 can access result
    const postSubmitApi = await g1Page.request.get(`/api/attempts/${g1AttemptId}/result`);
    expect(postSubmitApi.status()).toBe(200);

    // 3. Guest 2 tries to read Guest 1's result -> 403 FORBIDDEN
    const crossResultApi = await g2Page.request.get(`/api/attempts/${g1AttemptId}/result`);
    expect(crossResultApi.status()).toBe(403);
    expect((await crossResultApi.json()).code).toBe("FORBIDDEN");

    await hostContext.close();
    await g1Context.close();
    await g2Context.close();
  });

  test("Responsivitas mobile dan tampilan bersih di viewport kecil (AC17)", async ({
    page,
    browser,
  }) => {
    await login(page, "room_host");
    const createRes = await page.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Mobile Result Room", category: "TIU", bankId: multiBankId, durationMinutes: 20 },
    });
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("MobileUser");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await page.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    const quizRes = await (await guestPage.request.get(`/api/rooms/${roomId}/quiz`)).json();
    await guestPage.request.post(`/api/attempts/${quizRes.attempt.id}/submit`, {
      headers: { Origin: origin },
      data: { idempotencyKey: randomUUID() },
    });

    // Set mobile viewport 390x844
    await guestPage.setViewportSize({ width: 390, height: 844 });
    await guestPage.goto(`/rooms/${roomId}/result`);

    await expect(guestPage.getByRole("heading", { name: /Hasil & Pembahasan/ })).toBeVisible();
    await expect(guestPage.getByTestId("final-score")).toBeVisible();

    // Verify no horizontal overflow
    const hasHorizontalOverflow = await guestPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await guestContext.close();
  });
});
