import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { allowedOrigin, cookieOptions, createSession, safeDestination, sessionCookie, tokenHash } from "@/lib/auth";
import { database } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ message: "Input terlalu panjang." }, { status: 400 });
    let input;
    try { input = JSON.parse(body); } catch { return NextResponse.json({ message: "Input tidak valid." }, { status: 400 }); }
    if (!input || typeof input.username !== "string" || typeof input.password !== "string" || input.password.length > 128 || !/^[a-zA-Z0-9_]{3,32}$/.test(input.username)) {
      return NextResponse.json({ message: "Username atau password tidak sesuai." }, { status: 401 });
    }
    const username = input.username.toLowerCase();
    const limit = await database().query<{ attempts: number }>(
      `INSERT INTO auth_attempts (bucket, attempts, reset_at) VALUES ($1, 1, now() + interval '15 minutes')
       ON CONFLICT (bucket) DO UPDATE SET
       attempts = CASE WHEN auth_attempts.reset_at <= now() THEN 1 ELSE auth_attempts.attempts + 1 END,
       reset_at = CASE WHEN auth_attempts.reset_at <= now() THEN now() + interval '15 minutes' ELSE auth_attempts.reset_at END
       RETURNING attempts`, [tokenHash(username)],
    );
    if (limit.rows[0].attempts > 10) return NextResponse.json({ message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, { status: 429 });
    const result = await database().query<{ id: string; password_hash: string }>("SELECT id, password_hash FROM hosts WHERE username = $1", [username]);
    const host = result.rows[0];
    const valid = await verifyPassword(input.password, host?.password_hash);
    if (!host || !valid) return NextResponse.json({ message: "Username atau password tidak sesuai." }, { status: 401 });
    const response = NextResponse.json({ destination: safeDestination(input.next) });
    response.headers.set("Cache-Control", "no-store");
    const previousToken = (await cookies()).get(sessionCookie)?.value;
    response.cookies.set(sessionCookie, await createSession(host.id, previousToken), cookieOptions());
    return response;
  } catch {
    console.error("Host login unavailable.");
    return NextResponse.json({ message: "Layanan masuk belum tersedia. Coba lagi." }, { status: 503 });
  }
}
