import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../lib/password";
import { loadLocalEnv } from "./env";

async function main() {
  loadLocalEnv();
  const username = process.env.HOST_USERNAME?.toLowerCase();
  const password = process.env.HOST_PASSWORD;
  if (!username || !/^[a-z0-9_]{3,32}$/.test(username) || !password || password.length < 12 || password.length > 128) {
    throw new Error("Set HOST_USERNAME (3–32 letters/numbers/underscores) and HOST_PASSWORD (12–128 characters).");
  }
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("INSERT INTO hosts (id, username, password_hash) VALUES ($1, $2, $3)", [randomUUID(), username, await hashPassword(password)]);
    console.log("Host account created. Sign in using the supplied username and password.");
  } finally { await pool.end(); }
}

main().catch(() => { console.error("Account not created. Check input, duplicate username, database, and migrations. Username: 3–32 letters/numbers/underscores; password: 12–128 characters."); process.exitCode = 1; });
