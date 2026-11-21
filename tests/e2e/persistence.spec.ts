import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://127.0.0.1:3120";

async function stop(server: ChildProcess) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill();
  await exited;
}

async function start(request: APIRequestContext) {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3120"], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: process.env.TEST_DATABASE_URL, APP_ORIGIN: origin, NEXT_DIST_DIR: ".next-e2e" },
  });
  try {
    await expect.poll(async () => {
      if (server.exitCode !== null) throw new Error("Production server exited; run npm run build first and check port 3120.");
      try { return (await request.get(origin)).status(); } catch { return 0; }
    }, { timeout: 30_000 }).toBe(200);
    return server;
  } catch (error) { await stop(server); throw error; }
}

test("bank ownership and login session survive a production application restart", async ({ playwright }) => {
  test.setTimeout(90_000);
  const request = await playwright.request.newContext();
  let server = await start(request);
  try {
    const login = await request.post(`${origin}/api/auth/login`, {
      headers: { Origin: origin }, data: { username: "host_b", password: "Practice-test-only-2026" },
    });
    expect(login.status()).toBe(200);
    const cookie = login.headers()["set-cookie"].split(";")[0];
    expect(login.headers()["set-cookie"]).toContain("Secure");
    const before = await request.get(`${origin}/api/banks`, { headers: { Cookie: cookie } });
    expect(before.status()).toBe(200);
    const expected = { banks: [{ id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", name: "Latihan TWK pribadi B", category: "TWK" }] };
    expect(await before.json()).toEqual(expected);
    await stop(server);
    server = await start(request);
    const after = await request.get(`${origin}/api/banks`, { headers: { Cookie: cookie } });
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual(expected);
    expect((await request.get(`${origin}/api/banks/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`, { headers: { Cookie: cookie } })).status()).toBe(404);
  } finally { await stop(server); await request.dispose(); }
});
