import type { PoolClient } from "pg";

export async function scoreAttempt(client: PoolClient, roomId: string, attemptId: string) {
  const questions = (await client.query<{ id: string; scoring_type: string; answer_key: string | null; weights: number[] | null }>("SELECT id, scoring_type, answer_key, weights FROM room_questions WHERE room_id = $1 ORDER BY position", [roomId])).rows;
  const answers = (await client.query<{ question_id: string; selected_option: string | null }>("SELECT question_id, selected_option FROM answers WHERE attempt_id = $1", [attemptId])).rows;
  const selected = new Map(answers.map((answer) => [answer.question_id, answer.selected_option]));
  let totalScore = 0, maxScore = 0, correctCount = 0, incorrectCount = 0, unansweredCount = 0;
  for (const question of questions) {
    const choice = selected.get(question.id) ?? null;
    if (!choice) unansweredCount++;
    if (question.scoring_type === "SINGLE_CORRECT") {
      maxScore++;
      if (choice && choice === question.answer_key) { totalScore++; correctCount++; }
      else if (choice) incorrectCount++;
    } else {
      const weights = question.weights!;
      maxScore += Math.max(...weights);
      if (choice) totalScore += weights[["A", "B", "C", "D", "E"].indexOf(choice)];
    }
  }
  return { totalScore, maxScore, correctCount, incorrectCount, unansweredCount, questionCount: questions.length };
}
