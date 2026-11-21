import { NextResponse } from "next/server";
import { currentHost } from "@/lib/auth";
import { findBank } from "@/lib/banks";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const host = await currentHost();
  if (!host) return NextResponse.json({ message: "Silakan masuk." }, { status: 401 });
  const bank = await findBank(host.id, (await params).id);
  if (!bank) return NextResponse.json({ message: "Bank soal tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ bank }, { headers: { "Cache-Control": "private, no-store" } });
}
