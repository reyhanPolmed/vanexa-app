import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const headers = { Origin: "http://127.0.0.1:3100" };
const bankId = "33333333-3333-4333-3333-333333333333";
let pool: Pool;
test.beforeAll(() => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== "/vanexa_test") throw new Error("Dedicated test database required.");
  pool = new Pool({ connectionString: url });
});
test.afterAll(async () => { await pool.end(); });

async function createRoom(api: APIRequestContext) {
  expect((await api.post("/api/auth/login", { headers, data: { username: "room_host", password: "Practice-test-only-2026" } })).ok()).toBeTruthy();
  const response = await api.post("/api/rooms", { headers, data: { name: `Lifecycle ${randomUUID()}`, category: "TIU", bankId, durationMinutes: 5 } });
  expect(response.status()).toBe(201);
  return (await response.json()).roomId as string;
}
async function join(api: APIRequestContext, room: string, nickname: string) {
  const response = await api.post(`/api/rooms/${room}/join`, { headers, data: { nickname } });
  expect(response.ok()).toBeTruthy();
}
async function submit(api: APIRequestContext, attempt: string) {
  const response = await api.post(`/api/attempts/${attempt}/submit`, { headers, data: { idempotencyKey: randomUUID() } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function board(api: APIRequestContext, room: string) {
  const response = await api.get(`/api/rooms/${room}/leaderboard`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("deadline finalizes offline/never-opened participants; early submit is stable and late writes rejected", async ({ browser, request }) => {
  const room = await createRoom(request);
  const online = await browser.newContext();
  const offline = await browser.newContext();
  const early = await browser.newContext();
  try {
    await join(online.request, room, "DeadlineOnline");
    await join(offline.request, room, "DeadlineOffline");
    await join(early.request, room, "EarlySubmit");
    expect((await request.post(`/api/rooms/${room}/start`, { headers })).ok()).toBeTruthy();
    const quiz = await (await online.request.get(`/api/rooms/${room}/quiz`)).json();
    const first = quiz.questions[0].id;
    expect((await online.request.put(`/api/attempts/${quiz.attempt.id}/answers/${first}`, { headers, data: { choice: "B", expectedRevision: 0, mutationId: randomUUID() } })).ok()).toBeTruthy();
    const earlyQuiz = await (await early.request.get(`/api/rooms/${room}/quiz`)).json();
    const earlyResult = await submit(early.request, earlyQuiz.attempt.id);
    const page = await online.newPage();
    // Fixture time control only; assertions use the public application interface.
    await pool.query("UPDATE rooms SET deadline_at=clock_timestamp()+interval '4 seconds' WHERE id=$1", [room]);
    await page.goto(`/rooms/${room}/quiz`);
    await page.evaluate(() => { Date.now = () => 0; });
    await offline.setOffline(true);
    await expect(page).toHaveURL(`/rooms/${room}/result`, { timeout: 15_000 });
    await expect(page.getByTestId("final-score")).toHaveText("1");
    await expect(page.getByTestId("count-unanswered")).toHaveText("2");
    await expect(page.getByText("Peringkat final", { exact: false })).toBeVisible();
    const late = await online.request.put(`/api/attempts/${quiz.attempt.id}/answers/${first}`, { headers, data: { choice: "A", expectedRevision: 1, mutationId: randomUUID() } });
    expect(late.ok()).toBeFalsy();
    const replay = await submit(early.request, earlyQuiz.attempt.id);
    expect(replay.submittedAt).toBe(earlyResult.submittedAt);
    expect(replay.finalScore).toBe(earlyResult.finalScore);
    await offline.setOffline(false);
    const recovered = await (await offline.request.get(`/api/rooms/${room}/quiz`)).json();
    expect(recovered.attempt.status).toBe("EXPIRED");
    const recoveredResult = await (await offline.request.get(`/api/attempts/${recovered.attempt.id}/result`)).json();
    expect(recoveredResult.attempt.finalScore).toBe(0);
    expect(recoveredResult.summary.unansweredCount).toBe(3);
    const final = await board(request, room);
    expect(final.final).toBe(true);
    expect(final.entries.every((entry: { status: string }) => entry.status !== "ACTIVE")).toBe(true);
  } finally { await online.close(); await offline.close(); await early.close(); }
});

test("leaderboard privacy, active scores hidden, ties 1/1/3, realtime refresh and duplicate events", async ({ browser, request }) => {
  const room = await createRoom(request);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const outsider = await browser.newContext();
  try {
    for (const [index, context] of contexts.entries()) await join(context.request, room, `Rank${index}${"x".repeat(20)}`);
    expect((await outsider.request.get(`/api/rooms/${room}/leaderboard`)).status()).toBe(401);
    await request.post(`/api/rooms/${room}/start`, { headers });
    const quizzes = await Promise.all(contexts.map(async (context) => (await context.request.get(`/api/rooms/${room}/quiz`)).json()));
    const initial = await board(request, room);
    expect(initial.final).toBe(false);
    expect(initial.entries.every((entry: { score: number | null; rank: number | null }) => entry.score === null && entry.rank === null)).toBe(true);
    for (const index of [0, 1]) await contexts[index].request.put(`/api/attempts/${quizzes[index].attempt.id}/answers/${quizzes[index].questions[0].id}`, { headers, data: { choice: "B", expectedRevision: 0, mutationId: randomUUID() } });
    await submit(contexts[0].request, quizzes[0].attempt.id);
    const page = await contexts[0].newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/rooms/${room}/result`);
    await expect(page.getByRole("cell", { name: "#1", exact: true })).toHaveCount(1);
    await submit(contexts[1].request, quizzes[1].attempt.id);
    await submit(contexts[2].request, quizzes[2].attempt.id);
    await expect(page.getByRole("cell", { name: "#1", exact: true })).toHaveCount(2);
    await expect(page.getByRole("cell", { name: "#3", exact: true })).toHaveCount(1);
    const current = await board(request, room);
    expect(current.entries.filter((entry: { score: number | null }) => entry.score !== null).map((entry: { rank: number }) => entry.rank)).toEqual([1, 1, 3]);
    expect(JSON.stringify(current)).not.toMatch(/answer_key|answerKey|selectedOption|explanation|weights/);
    const event = JSON.stringify({ eventId: randomUUID(), type: "leaderboard.updated", roomId: room, roomVersion: current.version, payload: {} });
    for (let i = 0; i < 2; i++) await pool.query("SELECT pg_notify('vanexa_events',$1)", [event]);
    await pool.query("SELECT pg_notify('vanexa_events',$1)", [JSON.stringify({ eventId: randomUUID(), type: "quiz.started", roomId: room, roomVersion: 0, payload: {} })]);
    await page.reload();
    await expect(page.getByRole("cell", { name: "#1", exact: true })).toHaveCount(2);
    await expect(page.getByText("Peringkat sementara", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally { await Promise.all(contexts.map(context => context.close())); await outsider.close(); }
});

test("Host presence follows last tab; reconnect retains identity; expired grace closes lobby", async ({ browser, request }) => {
  const room = await createRoom(request);
  const host = await browser.newContext({ storageState: await request.storageState() });
  const guest = await browser.newContext();
  try {
    await join(guest.request, room, "GraceObserver");
    const observer = await guest.newPage();
    await observer.goto(`/rooms/${room}`);
    const one = await host.newPage();
    const two = await host.newPage();
    await one.goto(`/rooms/${room}`);
    await two.goto(`/rooms/${room}`);
    const state = async () => (await request.get(`/api/rooms/${room}`)).json();
    await expect.poll(async () => (await state()).participants.find((p: { isHost: boolean }) => p.isHost)?.online).toBe(true);
    const ids = (await state()).participants.map((p: { id: string }) => p.id);
    await one.close();
    expect((await state()).room.hostOfflineSince).toBeNull();
    await two.close();
    await expect.poll(async () => (await state()).room.hostOfflineSince).not.toBeNull();
    const returned = await host.newPage();
    await returned.goto(`/rooms/${room}`);
    await expect.poll(async () => (await state()).room.hostOfflineSince).toBeNull();
    expect((await state()).participants.map((p: { id: string }) => p.id)).toEqual(ids);
    await returned.close();
    await expect.poll(async () => (await state()).room.hostOfflineSince).not.toBeNull();
    await pool.query("UPDATE rooms SET host_offline_since=clock_timestamp()-interval '6 minutes' WHERE id=$1", [room]);
    await expect.poll(async () => (await state()).room.status).toBe("CLOSED");
    await expect(observer.getByText(/Host tidak kembali/)).toBeVisible({ timeout: 15_000 });
    expect((await request.post(`/api/rooms/${room}/start`, { headers })).ok()).toBeFalsy();
    expect((await guest.request.post(`/api/rooms/${room}/join`, { headers, data: { nickname: "Again" } })).ok()).toBeFalsy();
    const listing = await (await request.get("/api/rooms?category=TIU")).json();
    expect(listing.rooms.some((r: { id: string }) => r.id === room)).toBe(false);
  } finally { await host.close(); await guest.close(); }
});

test("missed start recovers from server snapshot; refresh keeps attempt and saved answer", async ({ browser, request }) => {
  const room = await createRoom(request);
  const guest = await browser.newContext();
  try {
    await join(guest.request, room, "ReconnectGuest");
    const page = await guest.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/rooms/${room}`);
    await guest.setOffline(true);
    await request.post(`/api/rooms/${room}/start`, { headers });
    await guest.setOffline(false);
    await expect(page).toHaveURL(`/rooms/${room}/quiz`, { timeout: 20_000 });
    const before = await (await guest.request.get(`/api/rooms/${room}/quiz`)).json();
    await page.getByTestId("question-nav-2").click();
    await page.getByTestId("option-label-B").click();
    await expect(page.getByTestId("answer-status-saved")).toBeVisible();
    await page.reload();
    const after = await (await guest.request.get(`/api/rooms/${room}/quiz`)).json();
    expect(after.attempt.id).toBe(before.attempt.id);
    expect(after.savedAnswers[before.questions[1].id].selectedOption).toBe("B");
    await expect(page.getByText("Soal Nomor 2 dari 3")).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await guest.close(); }
});

test("save and submit waiting on Room lock cannot cross deadline with a late answer", async ({ browser, request }) => {
  const room = await createRoom(request);
  const guest = await browser.newContext();
  const blocker = await pool.connect();
  try {
    await join(guest.request, room, "DeadlineRace");
    await request.post(`/api/rooms/${room}/start`, { headers });
    const quiz = await (await guest.request.get(`/api/rooms/${room}/quiz`)).json();
    await blocker.query("BEGIN");
    await blocker.query("UPDATE rooms SET deadline_at=clock_timestamp()+interval '2 seconds' WHERE id=$1", [room]);
    const save = guest.request.put(`/api/attempts/${quiz.attempt.id}/answers/${quiz.questions[0].id}`, { headers, data: { choice: "B", expectedRevision: 0, mutationId: randomUUID() } });
    const sending = submit(guest.request, quiz.attempt.id);
    await blocker.query("SELECT pg_sleep(2.2)");
    await blocker.query("COMMIT");
    expect((await save).ok()).toBeFalsy();
    const result = await sending;
    expect(result.status).toBe("EXPIRED");
    expect(result.finalScore).toBe(0);
    expect(result.unansweredCount).toBe(3);
    const replay = await submit(guest.request, quiz.attempt.id);
    expect(replay.submittedAt).toBe(result.submittedAt);
    expect(replay.finalScore).toBe(result.finalScore);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); await guest.close(); }
});
