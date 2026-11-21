import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { database } from "./db";

export const sessionCookie = "vanexa_host_session";
export const sessionLifetime = 7 * 24 * 60 * 60;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function safeDestination(value: unknown) {
  return typeof value === "string" && /^\/banks(?:\/[a-f0-9-]{36})?$/.test(value) ? value : "/banks";
}

export function allowedOrigin(request: Request) {
  return Boolean(process.env.APP_ORIGIN) && request.headers.get("origin") === process.env.APP_ORIGIN;
}

export async function currentHost() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await database().query<{ id: string; username: string }>(
    `SELECT h.id, h.username FROM hosts h JOIN host_sessions s ON s.host_id = h.id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash(token)],
  );
  return result.rows[0] ?? null;
}

export async function requireHost(destination = "/banks") {
  const host = await currentHost();
  if (!host) redirect(`/auth?next=${encodeURIComponent(safeDestination(destination))}`);
  return host;
}

export async function createSession(hostId: string, previousToken?: string) {
  const token = randomBytes(32).toString("hex");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    if (previousToken) await client.query("DELETE FROM host_sessions WHERE token_hash = $1", [tokenHash(previousToken)]);
    await client.query("DELETE FROM host_sessions WHERE expires_at <= now()");
    await client.query("INSERT INTO host_sessions (token_hash, host_id, expires_at) VALUES ($1, $2, now() + interval '7 days')", [tokenHash(token), hostId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return token;
}

export function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionLifetime };
}
