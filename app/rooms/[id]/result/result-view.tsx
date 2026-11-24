"use client";

import Link from "next/link";
import type { FullAttemptResult } from "@/lib/attempts";
import { Leaderboard } from "../../leaderboard";
import { useRouter } from "next/navigation";

const optionLetters = ["A", "B", "C", "D", "E"] as const;

export function ResultView({ data, history = [], followNewSession = true }: { data: FullAttemptResult; history?: { id: string; number: number; score: number }[]; followNewSession?: boolean }) {
  const router = useRouter();
  const { attempt, room, summary, items } = data;
  const isSingleCorrect = items.some((it) => it.scoringType === "SINGLE_CORRECT");

  return (
    <main className="page-width py-6 sm:py-8 space-y-8">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="brand">
              vanexa<span className="text-red-600">.</span>
            </span>
            <span className="badge">{room.category}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Pengerjaan Selesai
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 break-words">
            Hasil & Pembahasan: {room.name}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Peserta: <strong>{attempt.participantNickname}</strong>
            {attempt.submittedAt && (
              <span className="ml-2">
                • Dikumpulkan: {new Date(attempt.submittedAt).toLocaleTimeString("id-ID")}
              </span>
            )}
          </p>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali ke Home
        </Link>
      </header>

      {history.length > 0 && <section className="panel p-5" aria-label="Riwayat hasil pribadi"><h2 className="font-bold">Riwayat hasilmu</h2><div className="mt-3 flex flex-wrap gap-2">{history.map(entry => <Link key={entry.id} href={`/rooms/${room.id}/result?attempt=${entry.id}`} aria-current={entry.id === attempt.id ? "page" : undefined} className={`action-button rounded-lg border px-3 py-2 text-sm ${entry.id === attempt.id ? "border-red-200 bg-red-50 text-red-700" : "border-stone-200 text-stone-600"}`}>Sesi {entry.number} · {entry.score} poin</Link>)}</div></section>}
      <Leaderboard roomId={room.id} onSessionRunning={sessionId => { if (followNewSession && sessionId && sessionId !== attempt.sessionId) router.replace(`/rooms/${room.id}/quiz`); }} />
      {/* Score Summary Banner */}
      <section className="panel p-6 sm:p-8 space-y-6" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Ringkasan Hasil Skor
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Skor Anda
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold text-red-600" data-testid="final-score">
                {summary.totalScore}
              </span>
              <span className="text-lg text-slate-400 font-semibold">
                / {summary.maxScore} poin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dari total {summary.questionCount} butir soal
            </p>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
            {isSingleCorrect ? (
              <>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-emerald-700" data-testid="count-correct">
                    {summary.correctCount}
                  </span>
                  <span className="text-xs font-medium text-emerald-800">Benar</span>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-rose-700" data-testid="count-incorrect">
                    {summary.incorrectCount}
                  </span>
                  <span className="text-xs font-medium text-rose-800">Salah</span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-slate-700" data-testid="count-unanswered">
                    {summary.unansweredCount}
                  </span>
                  <span className="text-xs font-medium text-slate-800">Kosong</span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-red-700">
                    {summary.questionCount - summary.unansweredCount}
                  </span>
                  <span className="text-xs font-medium text-red-800">Dijawab</span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-slate-700" data-testid="count-unanswered">
                    {summary.unansweredCount}
                  </span>
                  <span className="text-xs font-medium text-slate-800">Kosong</span>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center min-w-0">
                  <span className="block text-xl font-bold text-amber-700">
                    {summary.maxScore > 0
                      ? `${Math.round((summary.totalScore / summary.maxScore) * 100)}%`
                      : "0%"}
                  </span>
                  <span className="text-xs font-medium text-amber-800">Perolehan</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Honest Notice */}
        <div data-testid="disclaimer-notice" className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 leading-relaxed">
          <strong>Catatan:</strong> Skor dihitung murni dari snapshot kunci jawaban atau bobot yang ditetapkan pada room ini. Hasil ini adalah simulasi mandiri dan tidak menyatakan standar resmi atau kelulusan CPNS.
        </div>
      </section>

      {/* Review per Question */}
      <section className="space-y-6" aria-labelledby="review-heading">
        <h2 id="review-heading" className="text-lg font-bold text-slate-900">
          Rincian Soal & Pembahasan Pribadi
        </h2>

        <div className="space-y-6">
          {items.map((item) => {
            return (
              <article
                key={item.position}
                data-testid={`question-review-${item.position}`}
                className="panel p-6 sm:p-7 space-y-5"
              >
                {/* Question Header & Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <span className="text-sm font-semibold text-slate-900">
                    Soal Nomor {item.position}
                  </span>

                  {item.scoringType === "SINGLE_CORRECT" ? (
                    item.isCorrect ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        Benar (+1 poin)
                      </span>
                    ) : item.selectedOption === null ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Tidak Dijawab (0 poin)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        Salah (0 poin)
                      </span>
                    )
                  ) : item.selectedOption === null ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Tidak Dijawab (0 poin)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                      Perolehan: +{item.scoreEarned} poin (maks {item.maxScore})
                    </span>
                  )}
                </div>

                {/* Prompt */}
                <div className="text-base text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {item.prompt}
                </div>

                {/* Options List */}
                <div className="space-y-2.5 pt-1" role="list">
                  {optionLetters.map((letter, idx) => {
                    const text = item.options[idx] ?? "";
                    const isUserChoice = item.selectedOption === letter;
                    const isKey = item.answerKey === letter;
                    const weight = item.weights ? item.weights[idx] : null;

                    let optionStyle = "border-slate-200 bg-white text-slate-700";
                    if (item.scoringType === "SINGLE_CORRECT") {
                      if (isKey) {
                        optionStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-500/20";
                      } else if (isUserChoice && !isKey) {
                        optionStyle = "border-rose-400 bg-rose-50/70 text-rose-950 line-through";
                      }
                    } else if (item.scoringType === "WEIGHTED") {
                      if (isUserChoice) {
                        optionStyle = "border-red-600 bg-red-50/70 text-red-950 font-medium ring-1 ring-red-500/20";
                      }
                    }

                    return (
                      <div
                        key={letter}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 text-sm sm:text-base transition-colors ${optionStyle}`}
                        role="listitem"
                      >
                        <div className="flex-1">
                          <strong className="mr-2 font-semibold">{letter}.</strong>
                          <span className="whitespace-pre-wrap">{text}</span>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {weight !== null && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                              Bobot: {weight}
                            </span>
                          )}
                          {isUserChoice && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-white font-semibold">
                              Pilihan Anda
                            </span>
                          )}
                          {isKey && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-700 text-white font-semibold">
                              Kunci
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <span>Pembahasan Soal</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {item.explanation}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="text-sm font-semibold text-red-700 hover:underline"
        >
          Kembali ke Home
        </Link>
        <Link
          href={`/categories/${room.category}`}
          className="text-sm font-semibold text-slate-600 hover:underline"
        >
          Lihat Room Kategori Lain
        </Link>
      </footer>
    </main>
  );
}
