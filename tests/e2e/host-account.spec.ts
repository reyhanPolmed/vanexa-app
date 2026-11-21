import { expect, test, type Page } from "@playwright/test";

const bankA = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const bankB = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const password = "Practice-test-only-2026";
const origin = "http://127.0.0.1:3100";

async function login(page: Page, username: string) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test("guest is sent to login and can use username and password only", async ({ page }) => {
  await page.goto("/banks");
  await expect(page).toHaveURL(/\/auth\?next=%2Fbanks$/);
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk", exact: true })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
});

test("Host sees only owned banks in UI and API, and retains session after reload", async ({ page }) => {
  await page.goto("/banks");
  await login(page, "HOST_A");
  await expect(page.getByRole("heading", { name: "Bank soal pribadi", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Latihan TIU pribadi A" })).toBeVisible();
  await expect(page.getByText("Latihan TWK pribadi B")).toHaveCount(0);
  const banks = await page.request.get("/api/banks");
  expect(banks.status()).toBe(200);
  expect((await banks.json()).banks).toEqual([{ id: bankA, name: "Latihan TIU pribadi A", category: "TIU" }]);
  expect((await page.request.get(`/api/banks/${bankB}`)).status()).toBe(404);
  expect((await page.request.patch(`/api/banks/${bankB}`, { headers: { Origin: origin }, data: { revision: 0, state: {} } })).status()).toBe(404);
  await page.goto(`/banks/${bankB}`);
  await expect(page.getByText("Latihan TWK pribadi B")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await page.goto("/banks");
  await page.reload();
  await expect(page.getByRole("link", { name: "Latihan TIU pribadi A" })).toBeVisible();
});

test("login preserves a safe bank destination and prevents external redirects", async ({ page }) => {
  await page.goto(`/banks/${bankB.toUpperCase()}`);
  await expect(page).toHaveURL(new RegExp(`next=%2Fbanks%2F${bankB.toUpperCase()}`));
  await login(page, "host_b");
  await expect(page).toHaveURL(`/banks/${bankB.toUpperCase()}`);
  await expect(page.getByRole("heading", { name: "Latihan TWK pribadi B" })).toBeVisible();
  const response = await page.request.post("/api/auth/login", {
    headers: { Origin: origin }, data: { username: "host_b", password, next: "https://example.com" },
  });
  expect((await response.json()).destination).toBe("/banks");
});

test("empty bank has an honest import entry, and logout revokes the old session", async ({ page, context, playwright }) => {
  await page.goto("/auth");
  await login(page, "empty_host");
  await expect(page.getByRole("heading", { name: "Bank soal Anda masih kosong" })).toBeVisible();
  await page.getByRole("link", { name: "Impor PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Impor PDF", exact: true })).toBeVisible();
  await page.goto("/banks");
  const cookie = (await context.cookies()).find((c) => c.name === "vanexa_host_session")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL("/auth");
  await page.goto("/banks");
  await expect(page).toHaveURL(/\/auth\?next=/);
  const replay = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `${cookie.name}=${cookie.value}` } });
  expect((await replay.get("/api/banks")).status()).toBe(401);
  await replay.dispose();
});

test("wrong and unknown credentials return the same generic message", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Username").fill("host_a");
  await page.getByLabel("Password", { exact: true }).fill("Incorrect-test-password");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Username atau password tidak sesuai." })).toBeVisible();
  const known = await page.request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "host_a", password: "incorrect" } });
  const unknown = await page.request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "unknown_host", password: "incorrect" } });
  expect(known.status()).toBe(401);
  expect(await known.json()).toEqual({ code: "INVALID_CREDENTIALS", message: "Username atau password tidak sesuai.", retryable: false });
  expect(unknown.status()).toBe(401);
  expect(await unknown.json()).toEqual(await known.json());
  expect((await page.request.get("/api/banks")).status()).toBe(401);
});

test("cross-origin auth and forged sessions are rejected; login has a database-backed attempt limit", async ({ request }) => {
  expect((await request.post("/api/auth/login", { headers: { Origin: "https://example.com" }, data: { username: "host_a", password } })).status()).toBe(403);
  expect((await request.post("/api/auth/logout", { headers: { Origin: "https://example.com" } })).status()).toBe(403);
  expect((await request.get("/api/banks", { headers: { Cookie: `vanexa_host_session=${"0".repeat(64)}` } })).status()).toBe(401);
  expect((await request.get(`/api/banks/${bankA}`)).status()).toBe(401);
  for (let i = 0; i < 10; i++) {
    expect((await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "limited_host", password: "wrong" } })).status()).toBe(401);
  }
  expect((await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "limited_host", password } })).status()).toBe(429);
});

test("mobile login works with keyboard and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");
  await page.getByLabel("Username").focus();
  await page.keyboard.type("host_a");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type(password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Bank soal pribadi", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".vanexa-setup/banks-mobile.png", fullPage: true });
});
