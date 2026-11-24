"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavedAnswer } from "@/lib/attempts";
import { useRoomSync } from "../../use-room-sync";

export type QuestionData = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
};

export type QuizRoomData = {
  id: string;
  name: string;
  category: "TIU" | "TWK" | "TKP" | "RANDOM";
  durationMinutes: number;
  status: string;
  startedAt: string | null;
  deadlineAt: string | null;
  version: number;
  serverNow: string;
  currentSessionId: string | null;
};

export type QuizViewProps = {
  room: QuizRoomData;
  questions: QuestionData[];
  participantNickname: string;
  attemptId: string;
  attemptStatus: string;
  initialAnswers: Record<string, SavedAnswer>;
};

type QuestionAnswerState = {
  effectiveChoice: string | null; // Value verified and acknowledged by server
  selectedChoice: string | null;  // Value currently chosen in UI
  revision: number;
  status: "idle" | "saving" | "saved" | "failed";
  errorMessage: string | null;
};

const optionLetters = ["A", "B", "C", "D", "E"] as const;

export function QuizView({
  room,
  questions,
  participantNickname,
  attemptId,
  initialAnswers,
}: QuizViewProps) {
  const router = useRouter();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydration starts with the same question as SSR; restore browser storage after mount.
  const [currentIndex, setCurrentIndex] = useState(0);
  const restoredNavigation = useRef(false);
  useEffect(() => {
    let mounted = true;
    let restoredIndex = 0;
    try {
      const savedIndex = sessionStorage.getItem(`vanexa_active_question_${room.id}_${attemptId}`);
      if (savedIndex !== null) {
        const parsed = parseInt(savedIndex, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < questions.length) {
          restoredIndex = parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    queueMicrotask(() => {
      if (mounted) {
        restoredNavigation.current = true;
        setCurrentIndex(restoredIndex);
      }
    });
    return () => { mounted = false; restoredNavigation.current = false; };
  }, [room.id, questions.length, attemptId]);

  // Persist current question index to sessionStorage
  useEffect(() => {
    if (!restoredNavigation.current) return;
    try {
      sessionStorage.setItem(`vanexa_active_question_${room.id}_${attemptId}`, String(currentIndex));
    } catch {
      // Ignore storage errors
    }
  }, [currentIndex, room.id, attemptId]);
  const [answersState, setAnswersState] = useState<Record<string, QuestionAnswerState>>(() => {
    const initial: Record<string, QuestionAnswerState> = {};
    for (const q of questions) {
      const saved = initialAnswers[q.id];
      if (saved && saved.selectedOption) {
        initial[q.id] = {
          effectiveChoice: saved.selectedOption,
          selectedChoice: saved.selectedOption,
          revision: saved.revision,
          status: "saved",
          errorMessage: null,
        };
      } else {
        initial[q.id] = {
          effectiveChoice: null,
          selectedChoice: null,
          revision: saved ? saved.revision : 0,
          status: "idle",
          errorMessage: null,
        };
      }
    }
    return initial;
  });

  const stateRef = useRef(answersState);
  useEffect(() => {
    stateRef.current = answersState;
  }, [answersState]);

  // Queue to serialize mutations per question
  const mutationQueues = useRef<Record<string, Promise<void>>>({});

  const [clock, setClock] = useState({ serverNow: room.serverNow, deadlineAt: room.deadlineAt });
  const deadlineTime = clock.deadlineAt ? new Date(clock.deadlineAt).getTime() : 0;
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, Math.ceil((deadlineTime - new Date(clock.serverNow).getTime()) / 1000)));
  useRoomSync(room.id, true, room.version, (snapshot) => {
    setClock({ serverNow: snapshot.serverNow, deadlineAt: snapshot.room.deadlineAt });
    if (snapshot.room.currentSessionId !== room.currentSessionId) router.refresh();
    if (snapshot.room.status === "FINISHED") router.replace(`/rooms/${room.id}/result`);
  });
  useEffect(() => {
    const anchor = performance.now();
    const initial = deadlineTime - new Date(clock.serverNow).getTime();
    const timer = setInterval(() => setRemainingSeconds(Math.max(0, Math.ceil((initial - (performance.now() - anchor)) / 1000))), 250);
    return () => clearInterval(timer);
  }, [deadlineTime, clock.serverNow]);
  const timeExpired = remainingSeconds <= 0;
  useEffect(() => {
    if (!timeExpired) return;
    let stopped = false;
    const sync = async () => {
      try {
        const response = await fetch(`/api/rooms/${room.id}/quiz`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped && data.attempt?.status !== "ACTIVE") router.replace(`/rooms/${room.id}/result`);
      } catch { /* worker finalizes independently; reconnect retrieves the Result */ }
    };
    void sync();
    const timer = setInterval(() => { void sync(); }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [timeExpired, room.id, router]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const currentQ = questions[currentIndex];
  const currentQState = currentQ ? answersState[currentQ.id] : undefined;
  const currentChoice = currentQState?.selectedChoice ?? null;

  // Function to perform save operation with serialized queue per question
  function saveOptionMutation(questionId: string, choiceLetter: string) {
    const mutationId = crypto.randomUUID();

    // Optimistically update UI selection and mark status as saving
    setAnswersState((prev) => {
      const qState = prev[questionId] || {
        effectiveChoice: null,
        selectedChoice: null,
        revision: 0,
        status: "idle",
        errorMessage: null,
      };
      const updated = {
        ...prev,
        [questionId]: {
          ...qState,
          selectedChoice: choiceLetter,
          status: "saving" as const,
          errorMessage: null,
        },
      };
      stateRef.current = updated;
      return updated;
    });

    const runSave = async () => {
      const currentRevision = stateRef.current[questionId]?.revision ?? 0;
      try {
        const res = await fetch(`/api/attempts/${attemptId}/answers/${questionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice: choiceLetter,
            mutationId,
            expectedRevision: currentRevision,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choice: string | null;
            revision: number;
            acceptedAt: string;
            mutationId: string;
          };

          setAnswersState((prev) => {
            const current = prev[questionId];
            // If user has not changed selection since this request finished:
            const updated = {
              ...prev,
              [questionId]: {
                ...current,
                effectiveChoice: data.choice,
                revision: data.revision,
                status: (current?.selectedChoice === data.choice ? "saved" : current?.status) as "saved",
                errorMessage: null,
              },
            };
            stateRef.current = updated;
            return updated;
          });
        } else {
          const errData = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string; currentRevision?: number; currentChoice?: string | null };
          };

          if (res.status === 409 && errData.error?.code === "REVISION_CONFLICT") {
            // Revision conflict: server has a different/newer state
            setAnswersState((prev) => {
              const serverChoice = errData.error?.currentChoice ?? null;
              const serverRev = errData.error?.currentRevision ?? prev[questionId]?.revision ?? 0;
              const updated = {
                ...prev,
                [questionId]: {
                  ...prev[questionId],
                  effectiveChoice: serverChoice,
                  selectedChoice: serverChoice,
                  revision: serverRev,
                  status: "saved" as const,
                  errorMessage: "Jawaban disesuaikan dengan versi server terbaru.",
                },
              };
              stateRef.current = updated;
              return updated;
            });
          } else if (errData.error?.code === "DEADLINE_PASSED") {
            setAnswersState((prev) => {
              const updated = {
                ...prev,
                [questionId]: {
                  ...prev[questionId],
                  status: "failed" as const,
                  errorMessage: "Waktu pengerjaan kuis telah habis. Jawaban tidak dapat disimpan.",
                },
              };
              stateRef.current = updated;
              return updated;
            });
          } else {
            setAnswersState((prev) => {
              const updated = {
                ...prev,
                [questionId]: {
                  ...prev[questionId],
                  status: "failed" as const,
                  errorMessage: errData.error?.message || "Gagal menyimpan jawaban.",
                },
              };
              stateRef.current = updated;
              return updated;
            });
          }
        }
      } catch {
        // Network or fetch failure
        setAnswersState((prev) => {
          const updated = {
            ...prev,
            [questionId]: {
              ...prev[questionId],
              status: "failed" as const,
              errorMessage: "Koneksi terputus. Jawaban belum tersimpan.",
            },
          };
          stateRef.current = updated;
          return updated;
        });
      }
    };

    // Chain execution in queue for this question
    const prevTask = mutationQueues.current[questionId] || Promise.resolve();
    const nextTask = prevTask.then(runSave, runSave);
    mutationQueues.current[questionId] = nextTask;
  }

  function handleSelectOption(letter: string) {
    if (!currentQ) return;
    saveOptionMutation(currentQ.id, letter);
  }

  function handleRetry(questionId: string) {
    const qState = answersState[questionId];
    if (!qState || !qState.selectedChoice) return;
    saveOptionMutation(questionId, qState.selectedChoice);
  }

  // Answered count is strictly based on effective acknowledged answers
  const answeredCount = Object.values(answersState).filter(
    (s) => Boolean(s.effectiveChoice),
  ).length;
  const unansweredCount = questions.length - answeredCount;
  const showSendAnswer = currentIndex === questions.length - 1 || unansweredCount === 0 || (unansweredCount === 1 && !currentQState?.effectiveChoice);
  const isAnySaving = Object.values(answersState).some((s) => s.status === "saving");
  const isAnyFailed = Object.values(answersState).some((s) => s.status === "failed");

  async function handleSubmitQuiz() {
    if (isSubmitting || isAnySaving) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { redirectUrl?: string };
        router.push(data.redirectUrl || `/rooms/${room.id}/result`);
      } else {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setSubmitError(err.error?.message || "Gagal mengumpulkan kuis.");
        setIsSubmitting(false);
      }
    } catch {
      setSubmitError("Koneksi terputus. Silakan periksa jaringan Anda dan coba lagi.");
      setIsSubmitting(false);
    }
  }

  const isTimeUp = remainingSeconds <= 0;

  return (
    <main className="page-width py-6 sm:py-8">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="brand">
              vanexa<span className="text-red-600">.</span>
            </span>
            <span className="badge">{room.category}</span>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-800 break-words">{room.name}</h1>
        </div>

        {/* Server Timer & Submit Action */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2 border font-mono font-semibold text-base sm:text-lg ${
              isTimeUp
                ? "border-rose-300 bg-rose-50 text-rose-700 animate-pulse"
                : remainingSeconds < 300
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
            role="timer"
            aria-label="Sisa waktu kuis"
          >
            <span>{isTimeUp ? "00:00 (Waktu Habis)" : formattedTime}</span>
          </div>

          <span className="hidden sm:inline text-xs text-slate-500">
            Peserta: <strong>{participantNickname}</strong>
          </span>
        </div>
      </header>

      {/* Main Quiz Area */}
      <div className="mt-6 grid gap-6 lg:grid-cols-4">
        {/* Question & Options Area */}
        <section className="min-w-0 lg:col-span-3 space-y-6">
          {currentQ ? (
            <div className="panel p-6 sm:p-8 space-y-6">
              {/* Question Number & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <span className="text-sm font-semibold text-red-600" suppressHydrationWarning>
                  Soal Nomor {currentQ.position} dari {questions.length}
                </span>

                {/* Status indicator differentiating: Saving, Saved, Failed, or Unanswered */}
                <div className="flex items-center gap-2">
                  {currentQState?.status === "saving" ? (
                    <span
                      data-testid="answer-status-saving"
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="inline-block animate-spin" aria-hidden="true">🔄</span>
                      <span>Menyimpan...</span>
                    </span>
                  ) : currentQState?.status === "failed" ? (
                    <div className="flex items-center gap-1.5" role="alert">
                      <span
                        data-testid="answer-status-failed"
                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"
                      >
                        <span aria-hidden="true">⚠️</span>
                        <span>Gagal menyimpan</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetry(currentQ.id)}
                        className="text-xs font-semibold text-red-700 hover:underline"
                        aria-label={`Coba lagi simpan jawaban soal nomor ${currentQ.position}`}
                      >
                        Coba Lagi
                      </button>
                    </div>
                  ) : currentQState?.effectiveChoice ? (
                    <span
                      data-testid="answer-status-saved"
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"
                      role="status"
                    >
                      <span aria-hidden="true">✅</span>
                      <span>Tersimpan ({currentQState.effectiveChoice})</span>
                    </span>
                  ) : (
                    <span
                      data-testid="answer-status-unanswered"
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500"
                    >
                      Belum dijawab
                    </span>
                  )}
                </div>
              </div>

              {/* Error Message if any */}
              {currentQState?.errorMessage && (
                <div
                  className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center justify-between gap-2"
                  role="alert"
                >
                  <span>{currentQState.errorMessage}</span>
                  {currentQState.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => handleRetry(currentQ.id)}
                      className="shrink-0 font-semibold underline text-rose-900 hover:text-rose-950"
                    >
                      Coba Lagi
                    </button>
                  )}
                </div>
              )}

              {/* Question Prompt */}
              <div className="break-words text-base sm:text-lg text-slate-900 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {currentQ.prompt}
              </div>

              {/* Options Radio Group */}
              <fieldset className="space-y-3 pt-2" role="radiogroup">
                <legend className="sr-only">Pilihan jawaban untuk soal {currentQ.position}</legend>
                {optionLetters.map((letter, idx) => {
                  const optionText = currentQ.options[idx] ?? "";
                  const isSelected = currentChoice === letter;

                  return (
                    <label
                      key={letter}
                      data-testid={`option-label-${letter}`}
                      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-red-600 bg-red-50/60 ring-2 ring-red-500/20"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-option-${currentQ.position}`}
                        value={letter}
                        checked={isSelected}
                        onChange={() => handleSelectOption(letter)}
                        aria-label={`Pilihan ${letter}: ${optionText}`}
                        className="mt-1 size-4 text-red-600 border-slate-300 focus:ring-red-500"
                      />
                      <div className="min-w-0 flex-1 break-words text-sm sm:text-base text-slate-800 [overflow-wrap:anywhere]">
                        <strong className="mr-2 font-semibold text-slate-900">{letter}.</strong>
                        <span className="whitespace-pre-wrap">{optionText}</span>
                      </div>
                    </label>
                  );
                })}
              </fieldset>

              {/* Navigation Controls */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:flex sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Soal Sebelumnya
                </button>

                <button
                  type="button"
                  data-testid="quiz-next-or-submit"
                  onClick={() => {
                    if (showSendAnswer) { setIsSubmitModalOpen(true); return; }
                    const next = questions.findIndex((question, index) => index > currentIndex && !answersState[question.id]?.effectiveChoice);
                    const pending = questions.findIndex((question, index) => index !== currentIndex && !answersState[question.id]?.effectiveChoice);
                    setCurrentIndex(next >= 0 ? next : pending >= 0 ? pending : Math.min(questions.length - 1, currentIndex + 1));
                  }}
                  disabled={isSubmitting || isTimeUp}
                  className="primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {showSendAnswer ? "Kirim jawaban" : "Soal Berikutnya"}
                </button>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                💡 <strong>Autosave aktif:</strong> Jawaban Anda otomatis tersimpan di server setiap kali memilih opsi. Refresh browser memulihkan progres yang tersimpan.
              </div>
            </div>
          ) : (
            <div className="panel p-8 text-center text-slate-500">
              Tidak ada soal tersedia.
            </div>
          )}
        </section>

        {/* Side Question Navigation Grid */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="panel p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">Navigasi Soal</h2>
              <p className="text-xs text-slate-500 mt-0.5" data-testid="answered-counter">
                Terjawab {answeredCount} dari {questions.length} soal
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Daftar nomor soal">
              {questions.map((q, idx) => {
                const qState = answersState[q.id];
                const isEffectiveAnswered = Boolean(qState?.effectiveChoice);
                const isSaving = qState?.status === "saving";
                const isFailed = qState?.status === "failed";
                const isActive = idx === currentIndex;

                return (
                  <button
                    key={q.position}
                    type="button"
                    data-testid={`question-nav-${q.position}`}
                    data-answered={isEffectiveAnswered ? "true" : "false"}
                    onClick={() => setCurrentIndex(idx)}
                    className={`size-10 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                      isActive
                        ? "ring-2 ring-red-600 bg-red-600 text-white"
                        : isEffectiveAnswered
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                          : isSaving
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : isFailed
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent"
                    }`}
                    aria-label={`Nomor ${q.position}${
                      isEffectiveAnswered
                        ? ` (Tersimpan pilihan ${qState.effectiveChoice})`
                        : isSaving
                          ? " (Sedang menyimpan)"
                          : isFailed
                            ? " (Gagal menyimpan)"
                            : " (Belum dijawab)"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {q.position}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-red-600 inline-block" />
                <span>Soal aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
                <span>Sudah dijawab (tersimpan)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-amber-100 border border-amber-300 inline-block" />
                <span>Sedang menyimpan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-rose-100 border border-rose-300 inline-block" />
                <span>Gagal menyimpan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-slate-100 inline-block" />
                <span>Belum dijawab</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                href={`/rooms/${room.id}`}
                className="text-xs text-red-700 underline-offset-4 hover:underline block text-center pt-1"
              >
                Kembali ke Info Room
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation Submit Modal */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
        >
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="space-y-2">
              <h3 id="submit-modal-title" className="text-lg font-bold text-slate-900">
                Konfirmasi kirim jawaban
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin mengakhiri pengerjaan kuis ini? Jawaban yang sudah dikumpulkan akan difinalisasi dan skor langsung dihitung.
              </p>
            </div>

            {/* Answered & Unanswered count */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-700">
                <span>Soal Terjawab:</span>
                <strong className="text-emerald-700 font-semibold" data-testid="modal-answered-count">
                  {answeredCount} soal
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>Belum Dijawab (Kosong):</span>
                <strong className="text-slate-800 font-semibold" data-testid="modal-unanswered-count">
                  {unansweredCount} soal
                </strong>
              </div>
            </div>

            {/* Warning if any question is saving */}
            {isAnySaving && (
              <div
                className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2"
                role="status"
                aria-live="polite"
              >
                <span className="animate-spin inline-block">🔄</span>
                <span>Sedang menyimpan jawaban ke server. Harap tunggu sebentar...</span>
              </div>
            )}

            {/* Warning if any question failed */}
            {isAnyFailed && (
              <div
                className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800"
                role="alert"
              >
                ⚠️ Terdapat jawaban yang gagal tersimpan. Silakan periksa kembali atau kumpulkan jawaban yang sudah tersimpan.
              </div>
            )}

            {submitError && (
              <div
                className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800"
                role="alert"
              >
                {submitError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  setSubmitError(null);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                data-testid="confirm-submit-button"
                disabled={isSubmitting || isAnySaving}
                onClick={handleSubmitQuiz}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span>Mengumpulkan...</span>
                  </>
                ) : (
                  <span>Kirim sekarang</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
