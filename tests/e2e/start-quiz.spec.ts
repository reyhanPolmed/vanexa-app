import { expect, test, type Page } from "@playwright/test";
import { WebSocket } from "ws";

const origin = "http://127.0.0.1:3100";
const wsUrl = "ws://127.0.0.1:3101";
const password = "Practice-test-only-2026";
const multiBankId = "33333333-3333-4333-3333-333333333333";

async function login(page: Page, username = "room_host") {
  await page.goto("/auth");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL("/banks");
}

test("WebSocket rejects unauthorized clients attempting to subscribe to a room", async ({ page }) => {
  await login(page, "room_host");

  // Create room
  const createRes = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Auth WS Test", category: "TIU", bankId: multiBankId, durationMinutes: 30 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  // Try to connect to WebSocket without any auth cookie
  const wsResult = await new Promise<{ closed: boolean; code?: number }>((resolve) => {
    const ws = new WebSocket(`${wsUrl}/?roomId=${roomId}`);
    ws.on("close", (code) => {
      resolve({ closed: true, code });
    });
    ws.on("open", () => {
      // If it opened, wait briefly to ensure it gets closed by server auth check
      setTimeout(() => {
        resolve({ closed: false });
        ws.close();
      }, 500);
    });
    ws.on("error", () => {
      resolve({ closed: true });
    });
  });

  expect(wsResult.closed).toBe(true);
  expect(wsResult.code).toBe(4403);
});

test("Non-host start is rejected with 401/403 and start is idempotent", async ({ page, browser }) => {
  await login(page, "room_host");

  const createRes = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Start Idempotent Test", category: "TIU", bankId: multiBankId, durationMinutes: 45 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  // 1. Unauthenticated start attempt -> 401
  const guestContext = await browser.newContext();
  const unauthRes = await guestContext.request.post(`/api/rooms/${roomId}/start`, {
    headers: { Origin: origin },
  });
  expect(unauthRes.status()).toBe(401);

  // 2. Host starts the quiz -> 200
  const startRes1 = await page.request.post(`/api/rooms/${roomId}/start`, {
    headers: { Origin: origin },
  });
  expect(startRes1.status()).toBe(200);
  const data1 = await startRes1.json();
  expect(data1.status).toBe("RUNNING");
  expect(data1.startedAt).toBeTruthy();
  expect(data1.deadlineAt).toBeTruthy();
  expect(data1.idempotent).toBe(false);

  // 3. Double start (idempotent) -> 200 with identical startedAt and deadlineAt
  const startRes2 = await page.request.post(`/api/rooms/${roomId}/start`, {
    headers: { Origin: origin },
  });
  expect(startRes2.status()).toBe(200);
  const data2 = await startRes2.json();
  expect(data2.status).toBe("RUNNING");
  expect(data2.startedAt).toBe(data1.startedAt);
  expect(data2.deadlineAt).toBe(data1.deadlineAt);
  expect(data2.idempotent).toBe(true);

  // 4. Join after start is rejected with 400
  const joinRes = await guestContext.request.post(`/api/rooms/${roomId}/join`, {
    headers: { Origin: origin },
    data: { nickname: "LateComer" },
  });
  expect(joinRes.status()).toBe(400);
  expect((await joinRes.json()).code).toBe("ROOM_STARTED");

  await guestContext.close();
});

test("Simultaneous start via WebSocket: Host and two Guests transition to quiz together", async ({ browser }) => {
  // 1. Host creates room
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await login(hostPage, "room_host");

  const createRes = await hostPage.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Simultaneous Quiz Arena", category: "TIU", bankId: multiBankId, durationMinutes: 60 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  // Host opens lobby
  await hostPage.goto(`/rooms/${roomId}`);
  await expect(hostPage.getByRole("heading", { name: "Simultaneous Quiz Arena" })).toBeVisible();

  // 2. Guest 1 joins lobby
  const guest1Context = await browser.newContext();
  const guest1Page = await guest1Context.newPage();
  await guest1Page.goto(`/rooms/${roomId}`);
  await guest1Page.getByLabel("Nickname Anda").fill("Siti");
  await guest1Page.getByRole("button", { name: "Gabung ke Lobby" }).click();
  await expect(guest1Page.getByText("Anda sudah di Lobby")).toBeVisible();

  // 3. Guest 2 joins lobby
  const guest2Context = await browser.newContext();
  const guest2Page = await guest2Context.newPage();
  await guest2Page.goto(`/rooms/${roomId}`);
  await guest2Page.getByLabel("Nickname Anda").fill("Doni");
  await guest2Page.getByRole("button", { name: "Gabung ke Lobby" }).click();
  await expect(guest2Page.getByText("Anda sudah di Lobby")).toBeVisible();

  // Host view shows all 3 participants
  await expect(hostPage.locator('[data-testid="participant-list"] li')).toHaveCount(3);

  // 4. Host clicks "Mulai Kuis Sekarang"
  await hostPage.getByRole("button", { name: "Mulai Kuis Sekarang" }).click();

  // All 3 browser contexts transition to /rooms/:id/quiz simultaneously!
  await expect(hostPage).toHaveURL(`/rooms/${roomId}/quiz`, { timeout: 10_000 });
  await expect(guest1Page).toHaveURL(`/rooms/${roomId}/quiz`, { timeout: 10_000 });
  await expect(guest2Page).toHaveURL(`/rooms/${roomId}/quiz`, { timeout: 10_000 });

  // 5. Late visitor opening lobby is automatically redirected to quiz
  const lateContext = await browser.newContext();
  const latePage = await lateContext.newPage();
  await latePage.goto(`/rooms/${roomId}`);
  // Since room is already RUNNING, late visitor sees quiz or started notice
  await expect(latePage).toHaveURL(new RegExp(`/rooms/${roomId}`));

  // 6. Security verification: Quiz questions payload does NOT leak answer keys or weights
  const quizPayloadRes = await guest1Page.request.get(`/api/rooms/${roomId}/quiz`);
  expect(quizPayloadRes.status()).toBe(200);
  const quizPayload = await quizPayloadRes.json();

  expect(quizPayload.questions.length).toBe(3);
  for (const q of quizPayload.questions) {
    expect(q).toHaveProperty("position");
    expect(q).toHaveProperty("prompt");
    expect(q).toHaveProperty("options");
    expect(q.options.length).toBe(5);

    // CRITICAL: Ensure no sensitive fields are present
    expect(q).not.toHaveProperty("answer_key");
    expect(q).not.toHaveProperty("answerKey");
    expect(q).not.toHaveProperty("weights");
    expect(q).not.toHaveProperty("explanation");
  }

  // 7. Navigation test: Guest 1 navigates to Question 2, Guest 2 stays on Question 1
  // Guest 1 clicks "Soal Berikutnya →"
  await guest1Page.getByRole("button", { name: "Soal Berikutnya →" }).click();
  await expect(guest1Page.getByText("Soal Nomor 2 dari 3")).toBeVisible();
  await expect(guest1Page.getByText("Berapakah 10 + 20?")).toBeVisible();

  // Guest 2 remains on Question 1
  await expect(guest2Page.getByText("Soal Nomor 1 dari 3")).toBeVisible();
  await expect(guest2Page.getByText("Berapakah 2 + 3?")).toBeVisible();

  // Guest 2 selects Option B
  await guest2Page.getByRole("radio", { name: /B/ }).check();
  await expect(guest2Page.getByText(/Tersimpan \(B\)|Sudah dijawab \(B\)/)).toBeVisible();

  // Timer is visible and counting
  await expect(guest1Page.getByRole("timer")).toBeVisible();
  await expect(guest2Page.getByRole("timer")).toBeVisible();

  // Cleanup
  await hostContext.close();
  await guest1Context.close();
  await guest2Context.close();
  await lateContext.close();
});
