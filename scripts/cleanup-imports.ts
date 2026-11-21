import { Pool } from "pg";
import { loadLocalEnv } from "./env";

loadLocalEnv();
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("DELETE FROM import_drafts WHERE expires_at <= now()")
  .then((result) => console.log(`Expired import drafts deleted: ${result.rowCount}.`))
  .catch(() => { console.error("Import cleanup unavailable. Check database configuration."); process.exitCode = 1; })
  .finally(() => pool.end());
