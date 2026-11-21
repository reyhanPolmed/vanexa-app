import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { loadLocalEnv } from "./env";

export async function migrate(connectionString: string) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(18012026)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of (await readdir("db/migrations")).filter((n) => n.endsWith(".sql")).sort()) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(`db/migrations/${name}`, "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/migrate.ts")) {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before migrating.");
  migrate(process.env.DATABASE_URL).then(() => console.log("Database migrations applied."))
    .catch(() => { console.error("Migration failed. Check database configuration."); process.exitCode = 1; });
}
