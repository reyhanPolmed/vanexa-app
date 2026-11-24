import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:3100";
const password = "Practice-test-only-2026";
const multiBankId = "33333333-3333-4333-3333-333333333333";

async function login(page: Page, username = "room_host") {
  await page.goto("/auth");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL("/banks");
}

test.describe("Autosave jawaban dan pemulihan progres (Tiket 06)", () => {
  test("Pilih jawaban -> acknowledgement server -> refresh memulihkan jawaban dan navigasi aktif tanpa membuat peserta baru", async ({
    browser,
  }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Room Autosave & Recovery Test", category: "TIU", bankId: multiBankId, durationMinutes: 60 },
    });
    expect(createRes.status()).toBe(201);
    const { roomId } = await createRes.json();

    // 2. Guest joins room
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Budi");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();
    await expect(guestPage.getByText("Anda sudah di Lobby")).toBeVisible();

    // 3. Host starts quiz
    await hostPage.goto(`/rooms/${roomId}`);
    await hostPage.getByRole("button", { name: "Mulai Kuis Sekarang" }).click();

    // Both land on quiz
    await expect(guestPage).toHaveURL(`/rooms/${roomId}/quiz`, { timeout: 10_000 });
    await expect(hostPage).toHaveURL(`/rooms/${roomId}/quiz`, { timeout: 10_000 });

    // Initial state on Guest:
    // Soal 1 is visible, Belum dijawab, 0 dari 3 soal terjawab
    await expect(guestPage.getByText("Soal Nomor 1 dari 3")).toBeVisible();
    await expect(guestPage.getByTestId("answer-status-unanswered")).toBeVisible();
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 0 dari 3 soal");
    await expect(guestPage.getByTestId("question-nav-1")).toHaveAttribute("data-answered", "false");

    // 4. Guest selects option B for Question 1
    await guestPage.getByTestId("option-label-B").click();

    // Status transitions to Tersimpan (B)
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.getByText("Tersimpan (B)")).toBeVisible();

    // Sidebar navigation and counter update to reflect effective answered state
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 1 dari 3 soal");
    await expect(guestPage.getByTestId("question-nav-1")).toHaveAttribute("data-answered", "true");

    // 5. Guest moves to Question 2
    await guestPage.getByRole("button", { name: "Soal Berikutnya →" }).click();
    await expect(guestPage.getByText("Soal Nomor 2 dari 3")).toBeVisible();
    await expect(guestPage.getByTestId("answer-status-unanswered")).toBeVisible();

    // Guest selects option C for Question 2
    await guestPage.getByTestId("option-label-C").click();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.getByText("Tersimpan (C)")).toBeVisible();
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 2 dari 3 soal");
    await expect(guestPage.getByTestId("question-nav-2")).toHaveAttribute("data-answered", "true");

    // 6. Guest refreshes page (Simulate browser reload)
    await guestPage.reload();

    // Verify recovery:
    // User remains on Question 2 (restored via sessionStorage)
    await expect(guestPage.getByText("Soal Nomor 2 dari 3")).toBeVisible();
    // Option C is selected and acknowledged
    await expect(guestPage.getByRole("radio", { name: /C/ })).toBeChecked();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible();
    await expect(guestPage.getByText("Tersimpan (C)")).toBeVisible();
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 2 dari 3 soal");
    await expect(guestPage.getByTestId("question-nav-2")).toHaveAttribute("data-answered", "true");

    // Check Question 1 was also recovered
    await guestPage.getByTestId("question-nav-1").click();
    await expect(guestPage.getByText("Soal Nomor 1 dari 3")).toBeVisible();
    await expect(guestPage.getByRole("radio", { name: /B/ })).toBeChecked();
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible();
    await expect(guestPage.getByText("Tersimpan (B)")).toBeVisible();

    // 7. Verify participant was not recreated
    const quizStateRes = await guestPage.request.get(`/api/rooms/${roomId}/quiz`);
    expect(quizStateRes.status()).toBe(200);
    const quizState = await quizStateRes.json();
    expect(Object.keys(quizState.savedAnswers).length).toBe(2);

    const roomStateRes = await hostPage.request.get(`/api/rooms/${roomId}`);
    expect(roomStateRes.status()).toBe(200);
    const roomState = await roomStateRes.json();
    // Participants count is exactly 2: Host and Budi (no duplicate participant row)
    expect(roomState.participants.length).toBe(2);

    await hostContext.close();
    await guestContext.close();
  });

  test("Idempotensi retry mutation dan proteksi konflik revisi (AC09)", async ({
    browser,
  }) => {
    // 1. Host creates room and starts it
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Idempotency & Conflict Room", category: "TIU", bankId: multiBankId, durationMinutes: 40 },
    });
    expect(createRes.status()).toBe(201);
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Rina");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    // Load quiz data to get attemptId and questionIds
    const quizRes = await guestPage.request.get(`/api/rooms/${roomId}/quiz`);
    expect(quizRes.status()).toBe(200);
    const quizData = await quizRes.json();
    const attemptId = quizData.attempt.id;
    const q1 = quizData.questions[0];

    // 2. Initial answer: revision 0 -> 1
    const mutationId1 = randomUUID();
    const answerRes1 = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1.id}`, {
      headers: { Origin: origin },
      data: {
        choice: "A",
        mutationId: mutationId1,
        expectedRevision: 0,
      },
    });
    expect(answerRes1.status()).toBe(200);
    const data1 = await answerRes1.json();
    expect(data1.choice).toBe("A");
    expect(data1.revision).toBe(1);
    expect(data1.mutationId).toBe(mutationId1);
    expect(data1.idempotent).toBe(false);

    // 3. Retry same mutationId (network retry simulation)
    const retryRes = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1.id}`, {
      headers: { Origin: origin },
      data: {
        choice: "A",
        mutationId: mutationId1,
        expectedRevision: 0,
      },
    });
    expect(retryRes.status()).toBe(200);
    const retryData = await retryRes.json();
    expect(retryData.choice).toBe("A");
    expect(retryData.revision).toBe(1);
    expect(retryData.acceptedAt).toBe(data1.acceptedAt);
    expect(retryData.idempotent).toBe(true);

    // 4. Update answer to B: revision 1 -> 2
    const mutationId2 = randomUUID();
    const answerRes2 = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1.id}`, {
      headers: { Origin: origin },
      data: {
        choice: "B",
        mutationId: mutationId2,
        expectedRevision: 1,
      },
    });
    expect(answerRes2.status()).toBe(200);
    const data2 = await answerRes2.json();
    expect(data2.choice).toBe("B");
    expect(data2.revision).toBe(2);

    // 5. Outdated / out-of-order request arriving with old expectedRevision 0 and new mutationId
    const oldMutationId = randomUUID();
    const conflictRes = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1.id}`, {
      headers: { Origin: origin },
      data: {
        choice: "C", // Tries to overwrite with C using old revision 0
        mutationId: oldMutationId,
        expectedRevision: 0,
      },
    });
    expect(conflictRes.status()).toBe(409);
    const conflictData = await conflictRes.json();
    expect(conflictData.error.code).toBe("REVISION_CONFLICT");
    expect(conflictData.error.currentRevision).toBe(2);
    expect(conflictData.error.currentChoice).toBe("B");

    // Verify database value remained "B"
    const verifyRes = await guestPage.request.get(`/api/attempts/${attemptId}`);
    expect(verifyRes.status()).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.answers[q1.id].selectedOption).toBe("B");
    expect(verifyData.answers[q1.id].revision).toBe(2);

    await hostContext.close();
    await guestContext.close();
  });

  test("Pemeriksaan deadline server atomik & jawaban pada/setelah deadline ditolak (AC10)", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    // Room with 5 minute duration
    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Deadline Strictness Room", category: "TIU", bankId: multiBankId, durationMinutes: 5 },
    });
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Farhan");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    const quizRes = await guestPage.request.get(`/api/rooms/${roomId}/quiz`);
    const quizData = await quizRes.json();
    const attemptId = quizData.attempt.id;
    const q1 = quizData.questions[0];

    // Client clock manipulation simulation:
    // Even if client clock is set 2 hours in the past or future, server's own clock determines deadline
    // Simulate setting room deadline into the past in PostgreSQL database directly:
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query("UPDATE rooms SET deadline_at = now() - interval '5 seconds' WHERE id = $1", [roomId]);
    await pool.end();

    // Now attempt to save an answer
    const pastDeadlineRes = await guestPage.request.put(`/api/attempts/${attemptId}/answers/${q1.id}`, {
      headers: { Origin: origin },
      data: {
        choice: "D",
        mutationId: randomUUID(),
        expectedRevision: 0,
      },
    });

    expect(pastDeadlineRes.status()).toBe(400);
    const err = await pastDeadlineRes.json();
    expect(err.code).toBe("DEADLINE_PASSED");

    await hostContext.close();
    await guestContext.close();
  });

  test("Isolasi data: Satu peserta tidak dapat membaca atau menulis jawaban peserta lain (AC23)", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Isolation Guard Room", category: "TIU", bankId: multiBankId, durationMinutes: 30 },
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

    // Start quiz
    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    // Obtain Guest 1 attempt
    const g1Quiz = await (await g1Page.request.get(`/api/rooms/${roomId}/quiz`)).json();
    const g1AttemptId = g1Quiz.attempt.id;
    const q1Id = g1Quiz.questions[0].id;

    // Obtain Guest 2 attempt
    const g2Quiz = await (await g2Page.request.get(`/api/rooms/${roomId}/quiz`)).json();
    const g2AttemptId = g2Quiz.attempt.id;

    expect(g1AttemptId).not.toBe(g2AttemptId);

    // Guest 2 attempts to write to Guest 1's attempt -> 403 FORBIDDEN
    const crossWriteRes = await g2Page.request.put(`/api/attempts/${g1AttemptId}/answers/${q1Id}`, {
      headers: { Origin: origin },
      data: {
        choice: "E",
        mutationId: randomUUID(),
        expectedRevision: 0,
      },
    });
    expect(crossWriteRes.status()).toBe(403);
    expect((await crossWriteRes.json()).code).toBe("FORBIDDEN");

    // Guest 2 attempts to read Guest 1's attempt data -> 403 FORBIDDEN
    const crossReadRes = await g2Page.request.get(`/api/attempts/${g1AttemptId}`);
    expect(crossReadRes.status()).toBe(403);
    expect((await crossReadRes.json()).code).toBe("FORBIDDEN");

    await hostContext.close();
    await g1Context.close();
    await g2Context.close();
  });

  test("Gangguan jaringan mempertahankan status pending/gagal dan retry memulihkan penyimpanan (AC08, AC17)", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await login(hostPage, "room_host");

    const createRes = await hostPage.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: { name: "Network Retry Room", category: "TIU", bankId: multiBankId, durationMinutes: 45 },
    });
    const { roomId } = await createRes.json();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/rooms/${roomId}`);
    await guestPage.getByLabel("Nickname Anda").fill("Toni");
    await guestPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

    await hostPage.request.post(`/api/rooms/${roomId}/start`, {
      headers: { Origin: origin },
    });

    await guestPage.goto(`/rooms/${roomId}/quiz`);
    await expect(guestPage.getByText("Soal Nomor 1 dari 3")).toBeVisible();

    // 1. Simulate network failure by intercepting PUT /api/attempts/.../answers/... and aborting
    await guestPage.route("**/api/attempts/*/answers/*", (route) => route.abort());

    // Guest selects Option A while network is broken
    await guestPage.getByTestId("option-label-A").click();

    // UI shows failed status
    await expect(guestPage.getByTestId("answer-status-failed")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.getByTestId("answer-status-failed")).toContainText("Gagal menyimpan");
    await expect(guestPage.getByRole("button", { name: "Coba Lagi" }).first()).toBeVisible();

    // Sidebar navigation does NOT mark Question 1 as answered effective
    await expect(guestPage.getByTestId("question-nav-1")).toHaveAttribute("data-answered", "false");
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 0 dari 3 soal");

    // 2. Restore network by unrouting
    await guestPage.unroute("**/api/attempts/*/answers/*");

    // Click "Coba Lagi"
    await guestPage.getByRole("button", { name: "Coba Lagi" }).first().click();

    // UI succeeds and updates to Tersimpan (A)
    await expect(guestPage.getByTestId("answer-status-saved")).toBeVisible({ timeout: 5_000 });
    await expect(guestPage.getByText("Tersimpan (A)")).toBeVisible();

    // Sidebar navigation and counter now acknowledge effective answer
    await expect(guestPage.getByTestId("question-nav-1")).toHaveAttribute("data-answered", "true");
    await expect(guestPage.getByTestId("answered-counter")).toHaveText("Terjawab 1 dari 3 soal");

    await hostContext.close();
    await guestContext.close();
  });
});
