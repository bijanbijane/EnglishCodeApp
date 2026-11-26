export type LessonAttempt = { attemptId: string; status: "started" | "completed" };
export type AnswerSubmissionResult = { questionId: string; answerId: string; isCorrect: boolean; explanation: string };
export type LessonCompletionResult = { attemptId: string; status: "completed"; score: number };

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

export function parseAttemptResponse(value: unknown): LessonAttempt {
  const row = record(value, "پاسخ شروع تمرین معتبر نیست.");
  if (typeof row.attemptId !== "string" || !row.attemptId.trim() || (row.status !== "started" && row.status !== "completed")) {
    throw new Error("ساختار پاسخ شروع تمرین معتبر نیست.");
  }
  return { attemptId: row.attemptId, status: row.status };
}

export function parseAnswerSubmissionResult(value: unknown): AnswerSubmissionResult {
  const row = record(value, "پاسخ ثبت تمرین معتبر نیست.");
  if (typeof row.questionId !== "string" || !row.questionId.trim() || typeof row.answerId !== "string" || !row.answerId.trim() ||
      typeof row.isCorrect !== "boolean" || typeof row.explanation !== "string") {
    throw new Error("ساختار بازخورد پاسخ از سرور معتبر نیست.");
  }
  return { questionId: row.questionId, answerId: row.answerId, isCorrect: row.isCorrect, explanation: row.explanation };
}

export function parseLessonCompletionResult(value: unknown): LessonCompletionResult {
  const row = record(value, "نتیجهٔ تکمیل درس معتبر نیست.");
  if (typeof row.attemptId !== "string" || !row.attemptId.trim() || row.status !== "completed" ||
      typeof row.score !== "number" || !Number.isSafeInteger(row.score) || row.score < 0 || row.score > 100) {
    throw new Error("ساختار نتیجهٔ نهایی از سرور معتبر نیست.");
  }
  return { attemptId: row.attemptId, status: "completed", score: row.score };
}

export function assertAnswerMatchesRequest(result: AnswerSubmissionResult, questionId: string, answerId: string): void {
  if (result.questionId !== questionId || result.answerId !== answerId) {
    throw new Error("بازخورد سرور با پرسش و گزینهٔ ارسال‌شده مطابقت ندارد.");
  }
}

export function assertCompletionMatchesAttempt(result: LessonCompletionResult, attemptId: string): void {
  if (result.attemptId !== attemptId) throw new Error("نتیجهٔ دریافتی متعلق به تلاش جاری نیست.");
}
