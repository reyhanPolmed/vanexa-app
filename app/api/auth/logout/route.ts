import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { allowedOrigin, cookieOptions, sessionCookie, tokenHash } from "@/lib/auth";
import { database } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return apiError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
  const token = (await cookies()).get(sessionCookie)?.value;
  try {
    if (token) await database().query("DELETE FROM host_sessions WHERE token_hash = $1", [tokenHash(token)]);
    const response = NextResponse.redirect(new URL("/auth", process.env.APP_ORIGIN), 303);
    response.cookies.set(sessionCookie, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch {
    return apiError("SERVICE_UNAVAILABLE", "Belum berhasil keluar. Coba lagi.", 503, true);
  }
}
