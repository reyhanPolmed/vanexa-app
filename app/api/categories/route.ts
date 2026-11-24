import { NextResponse } from "next/server";

const categories = [
  { code: "TIU", name: "Tes Intelegensia Umum", description: "Latihan penalaran, logika, dan kemampuan berpikir." },
  { code: "TWK", name: "Tes Wawasan Kebangsaan", description: "Latihan wawasan nasional, hukum, dan pemerintahan." },
  { code: "TKP", name: "Tes Karakteristik Pribadi", description: "Latihan penilaian situasi dan kepribadian." },
  { code: "RANDOM", name: "Random", description: "Pengetahuan umum dan topik lain di luar TIU, TWK, serta TKP." },
];

export async function GET() {
  return NextResponse.json({ categories }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
