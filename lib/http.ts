import { NextResponse } from "next/server";

export function apiError(code: string, message: string, status: number, retryable = false) {
  return NextResponse.json({ code, message, retryable }, { status, headers: { "Cache-Control": "no-store" } });
}
