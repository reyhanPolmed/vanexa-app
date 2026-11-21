import { Pool, type PoolClient } from "pg";

const globalDb = globalThis as typeof globalThis & { vanexaPool?: Pool };

export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!globalDb.vanexaPool) {
    globalDb.vanexaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30_000,
    });
    globalDb.vanexaPool.on("error", () => console.error("PostgreSQL connection unavailable."));
  }
  return globalDb.vanexaPool;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
