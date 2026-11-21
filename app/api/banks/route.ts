import { NextResponse } from "next/server";
import { currentHost } from "@/lib/auth";
import { listBanks } from "@/lib/banks";

export async function GET() {
  const host = await currentHost();
  if (!host) return NextResponse.json({ message: "Silakan masuk." }, { status: 401 });
  return NextResponse.json({ banks: await listBanks(host.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
