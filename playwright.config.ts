import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile(".env.local");
if (!process.env.TEST_DATABASE_URL || new URL(process.env.TEST_DATABASE_URL).pathname !== "/vanexa_test") {
  throw new Error("TEST_DATABASE_URL must point to the dedicated vanexa_test database.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/setup.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      APP_ORIGIN: "http://127.0.0.1:3100",
    },
  },
});
