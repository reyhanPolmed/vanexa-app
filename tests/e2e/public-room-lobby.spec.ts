import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
const password = "Practice-test-only-2026";
const bankTiu = "11111111-1111-4111-1111-111111111111";
const bankEmpty = "22222222-2222-4222-2222-222222222222";
const bankOther = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"; // owned by host_b

async function login(page: Page, username = "room_host") {
  await page.goto("/auth");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL("/banks");
}

test("Home displays three categories with full names and links to category rooms", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Latihan soal, belajar bersama." })).toBeVisible();

  // Three categories with complete names
  await expect(page.getByText("Tes Intelegensia Umum", { exact: true })).toBeVisible();
  await expect(page.getByText("Tes Wawasan Kebangsaan", { exact: true })).toBeVisible();
  await expect(page.getByText("Tes Karakteristik Pribadi", { exact: true })).toBeVisible();

  // Click on TIU
  await page.getByRole("link", { name: "Lihat room publik" }).first().click();
  await expect(page).toHaveURL("/categories/TIU");
  await expect(page.getByRole("heading", { name: "Tes Intelegensia Umum (TIU)" })).toBeVisible();

  // Check empty state
  await expect(page.getByText("Belum ada room yang menunggu peserta.")).toBeVisible();
});

test("Host creates a public room from owned bank and is automatically added as participant", async ({ page }) => {
  await login(page, "room_host");

  await page.goto("/rooms/new");
  await expect(page.getByRole("heading", { name: "Buat Room Publik" })).toBeVisible();

  await page.getByLabel("Nama Room").fill("Latihan TIU Kelompok Alpha");
  await page.getByLabel("Kategori Latihan").selectOption("TIU");
  await page.getByLabel("Pilih Bank Soal").selectOption(bankTiu);
  await page.getByLabel("Durasi Kuis (menit)").fill("45");

  await page.getByRole("button", { name: "Buat room & Buka Lobby" }).click();

  // Redirect to room lobby
  await expect(page).toHaveURL(/\/rooms\/[a-f0-9-]+$/);

  // Lobby displays quiz summary
  await expect(page.getByRole("heading", { name: "Latihan TIU Kelompok Alpha" })).toBeVisible();
  await expect(page.getByText("1 Soal")).toBeVisible();
  await expect(page.getByText("45 Menit")).toBeVisible();
  await expect(page.getByText("1 Orang")).toBeVisible();
  await expect(page.getByText("Lobby Terbuka")).toBeVisible();

  // Host is recognized as participant and host
  await expect(page.getByText("Anda sudah di Lobby")).toBeVisible();
  await expect(page.getByText("Bergabung sebagai: room_host")).toBeVisible();
  await expect(page.getByText("Anda adalah Host room ini.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Mulai Kuis/ })).toBeVisible();

  // Category page displays the room with complete details
  await page.goto("/categories/TIU");
  await expect(page.getByText("Latihan TIU Kelompok Alpha")).toBeVisible();
  await expect(page.getByText("Host: room_host")).toBeVisible();
  await expect(page.getByText("1 soal")).toBeVisible();
  await expect(page.getByText("1 peserta")).toBeVisible();
  await expect(page.getByText("45 menit")).toBeVisible();
  await expect(page.getByText("Menunggu peserta")).toBeVisible();
  await expect(page.getByRole("link", { name: "Gabung lobby" })).toBeVisible();
});

test("Server validation rejects invalid room creation attempts", async ({ page }) => {
  await login(page, "room_host");

  // Non-owned bank -> 403 FORBIDDEN
  const resForbidden = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Ilegal", category: "TWK", bankId: bankOther, durationMinutes: 30 },
  });
  expect(resForbidden.status()).toBe(403);
  expect((await resForbidden.json()).code).toBe("FORBIDDEN");

  // Empty bank (0 questions) -> 400 NO_VALID_QUESTIONS
  const resEmpty = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Bank Kosong", category: "TIU", bankId: bankEmpty, durationMinutes: 30 },
  });
  expect(resEmpty.status()).toBe(400);
  expect((await resEmpty.json()).code).toBe("NO_VALID_QUESTIONS");

  // Category mismatch (bank is TIU, room requested as TWK) -> 400 VALIDATION_ERROR
  const resMismatch = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Mismatch", category: "TWK", bankId: bankTiu, durationMinutes: 30 },
  });
  expect(resMismatch.status()).toBe(400);
  expect((await resMismatch.json()).code).toBe("VALIDATION_ERROR");

  // Invalid duration (< 5 or > 180) -> 400 VALIDATION_ERROR
  const resTooShort = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Terlalu Singkat", category: "TIU", bankId: bankTiu, durationMinutes: 4 },
  });
  expect(resTooShort.status()).toBe(400);

  const resTooLong = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Terlalu Panjang", category: "TIU", bankId: bankTiu, durationMinutes: 181 },
  });
  expect(resTooLong.status()).toBe(400);

  // Invalid name (< 1 or > 120) -> 400 VALIDATION_ERROR
  const resEmptyName = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "   ", category: "TIU", bankId: bankTiu, durationMinutes: 30 },
  });
  expect(resEmptyName.status()).toBe(400);
});

test("Guest joins lobby without account, retains identity on refresh, and duplicate nickname is permitted", async ({ browser }) => {
  // 1. Host creates a room
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await login(hostPage, "room_host");

  const createRes = await hostPage.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Multiplayer Guest", category: "TIU", bankId: bankTiu, durationMinutes: 60 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  // 2. Guest A joins via category page
  const guestAContext = await browser.newContext();
  const guestAPage = await guestAContext.newPage();

  await guestAPage.goto("/categories/TIU");
  await expect(guestAPage.getByText("Room Multiplayer Guest")).toBeVisible();
  await guestAPage.getByRole("link", { name: "Gabung lobby" }).first().click();

  await expect(guestAPage).toHaveURL(`/rooms/${roomId}`);
  await expect(guestAPage.getByRole("heading", { name: "Gabung sebagai Guest" })).toBeVisible();

  // Guest A joins as "Budi"
  await guestAPage.getByLabel("Nickname Anda").fill("Budi");
  await guestAPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

  await expect(guestAPage.getByText("Anda sudah di Lobby")).toBeVisible();
  await expect(guestAPage.getByText("Bergabung sebagai: Budi")).toBeVisible();

  // Refresh page: identity is preserved via cookie
  await guestAPage.reload();
  await expect(guestAPage.getByText("Anda sudah di Lobby")).toBeVisible();
  await expect(guestAPage.getByText("Bergabung sebagai: Budi")).toBeVisible();

  // 3. Guest B joins with the SAME nickname "Budi" in separate context
  const guestBContext = await browser.newContext();
  const guestBPage = await guestBContext.newPage();

  await guestBPage.goto(`/rooms/${roomId}`);
  await guestBPage.getByLabel("Nickname Anda").fill("Budi");
  await guestBPage.getByRole("button", { name: "Gabung ke Lobby" }).click();

  await expect(guestBPage.getByText("Anda sudah di Lobby")).toBeVisible();
  await expect(guestBPage.getByText("Bergabung sebagai: Budi")).toBeVisible();

  // Participant list in Guest B view shows 3 participants: room_host (Host), Budi, Budi
  await expect(guestBPage.getByText("Daftar Peserta (3)")).toBeVisible();
  const participants = guestBPage.locator("ul.divide-y li");
  await expect(participants).toHaveCount(3);

  // Clean up contexts
  await hostContext.close();
  await guestAContext.close();
  await guestBContext.close();
});

test("Room questions are snapshotted; subsequent bank edits do not affect the room", async ({ page }) => {
  await login(page, "room_host");

  // Create room
  const createRes = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Room Snapshot Test", category: "TIU", bankId: bankTiu, durationMinutes: 60 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  // Check state of the room via API
  const roomStateBefore = await page.request.get(`/api/rooms/${roomId}`);
  expect(roomStateBefore.status()).toBe(200);
  expect((await roomStateBefore.json()).room.questionCount).toBe(1);

  // Now edit the bank question
  const bankBefore = await (await page.request.get(`/api/banks/${bankTiu}`)).json();
  const revision = bankBefore.bank.revision;
  const state = bankBefore.bank.state;

  // Modify question 1 prompt in bank source
  const updatedState = {
    ...state,
    items: (state.items as Array<{ source: string; discarded: boolean }>).map((item) => ({
      ...item,
      source: item.source.replace("Berapakah 2 + 3?", "Berapakah 100 + 200?"),
    })),
  };

  const patchRes = await page.request.patch(`/api/banks/${bankTiu}`, {
    headers: { Origin: origin },
    data: { revision, state: updatedState },
  });
  expect(patchRes.status()).toBe(200);

  // Verify the room state remains unchanged
  const roomStateAfter = await page.request.get(`/api/rooms/${roomId}`);
  expect(roomStateAfter.status()).toBe(200);
  const stateJson = await roomStateAfter.json();
  expect(stateJson.room.questionCount).toBe(1);
  expect(stateJson.room.status).toBe("LOBBY");

  // Verify the bank question was indeed updated to the new prompt
  const bankAfter = await (await page.request.get(`/api/banks/${bankTiu}`)).json();
  expect(bankAfter.bank.questions[0].prompt).toBe("Berapakah 100 + 200?");
});

test("Public input is rendered safely as plain text (no XSS execution)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "room_host");

  const xssName = '<b id="xss-test">Bold Room Name</b>';
  const createRes = await page.request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: xssName, category: "TIU", bankId: bankTiu, durationMinutes: 30 },
  });
  expect(createRes.status()).toBe(201);
  const { roomId } = await createRes.json();

  await page.goto(`/rooms/${roomId}`);
  // The raw HTML tag should be displayed as text content, not parsed as HTML element
  await expect(page.locator("#xss-test")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: xssName })).toBeVisible();

  await context.close();
});

test("Mobile responsive layout and accessible keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
  await login(page, "room_host");

  await page.goto("/categories/TIU");
  await expect(page.getByRole("heading", { name: /Tes Intelegensia Umum/ })).toBeVisible();

  await page.goto("/rooms/new");
  await expect(page.getByRole("heading", { name: "Buat Room Publik" })).toBeVisible();

  // Test keyboard focus
  await page.getByLabel("Nama Room").focus();
  await expect(page.getByLabel("Nama Room")).toBeFocused();
  await page.keyboard.type("Mobile Keyboard Room");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Kategori Latihan")).toBeFocused();
});
