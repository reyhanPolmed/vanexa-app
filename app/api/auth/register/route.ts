import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { allowedOrigin, cookieOptions, createSession, safeDestination, sessionCookie, tokenHash } from "@/lib/auth";
import { database, transaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  try {
    const body = await request.text();
    if (body.length > 4096) return apiError("VALIDATION_ERROR", "Input terlalu panjang.", 400);
    let input;
    try { input = JSON.parse(body); } catch { return apiError("VALIDATION_ERROR", "Input tidak valid.", 400); }
    const username = typeof input?.username === "string" ? input.username.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,32}$/.test(username)) return apiError("VALIDATION_ERROR", "Username harus 3–32 huruf, angka, atau garis bawah.", 400);
    if (typeof input?.password !== "string" || input.password.length < 12 || input.password.length > 128) return apiError("VALIDATION_ERROR", "Password harus 12–128 karakter.", 400);
    if (input.confirmPassword !== input.password) return apiError("VALIDATION_ERROR", "Konfirmasi password tidak sama.", 400);
    const limit = (await database().query<{ attempts: number }>(
      `INSERT INTO auth_attempts(bucket,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes')
       ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN auth_attempts.reset_at<=now() THEN 1 ELSE auth_attempts.attempts+1 END,
       reset_at=CASE WHEN auth_attempts.reset_at<=now() THEN now()+interval '15 minutes' ELSE auth_attempts.reset_at END RETURNING attempts`,
      [tokenHash(`register:${username}`)],
    )).rows[0];
    if (limit.attempts > 5) return apiError("RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi dalam 15 menit.", 429, true);
    if ((await database().query("SELECT 1 FROM hosts WHERE username=$1", [username])).rowCount) return apiError("USERNAME_TAKEN", "Username sudah digunakan. Pilih username lain.", 409);
    const passwordHash = await hashPassword(input.password);
    const previousToken = (await cookies()).get(sessionCookie)?.value;
    const token = await transaction(async client => {
      const account = (await client.query<{ id: string }>("INSERT INTO hosts(id,username,password_hash) VALUES($1,$2,$3) ON CONFLICT(username) DO NOTHING RETURNING id", [randomUUID(), username, passwordHash])).rows[0];
      if (!account) return null;
      return createSession(account.id, previousToken, client);
    });
    if (!token) return apiError("USERNAME_TAKEN", "Username sudah digunakan. Pilih username lain.", 409);
    const response = NextResponse.json({ destination: safeDestination(input.next) }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(sessionCookie, token, cookieOptions());
    return response;
  } catch {
    console.error("Account registration unavailable.");
    return apiError("SERVICE_UNAVAILABLE", "Akun belum berhasil dibuat. Coba lagi.", 503, true);
  }
}
