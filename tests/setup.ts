import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { hashPassword } from "../lib/password";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== "/vanexa_test") throw new Error("Use the dedicated vanexa_test database.");
  const pool = new Pool({ connectionString: url });
  try {
    // Fixture preparation only: never read back storage to assert application behavior.
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await migrate(url);
    await migrate(url); // Migration runner must also tolerate a repeated invocation.
    const passwordHash = await hashPassword("Practice-test-only-2026");
    for (const username of ["host_a", "host_b", "limited_host"]) {
      const hostId = randomUUID();
      await pool.query("INSERT INTO hosts (id, username, password_hash) VALUES ($1, $2, $3)", [hostId, username, passwordHash]);
      if (username === "host_a") await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", ["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", hostId, "Latihan TIU pribadi A", "TIU"]);
      if (username === "host_b") await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", ["bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", hostId, "Latihan TWK pribadi B", "TWK"]);
    }
    execFileSync(process.execPath, ["--import", "tsx", "scripts/create-host.ts"], {
      env: { ...process.env, DATABASE_URL: url, HOST_USERNAME: "empty_host", HOST_PASSWORD: "Practice-test-only-2026" },
      stdio: "pipe",
    });
  } finally { await pool.end(); }
}
