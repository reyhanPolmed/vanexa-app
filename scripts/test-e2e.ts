import { spawnSync } from "node:child_process";

const env = { ...process.env, NEXT_DIST_DIR: ".next-e2e" };
for (const args of [
  ["--import", "tsx", "--test", "tests/import-template.test.ts"],
  ["node_modules/next/dist/bin/next", "build"],
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
