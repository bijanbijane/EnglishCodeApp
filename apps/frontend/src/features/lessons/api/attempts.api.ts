import { apiPost, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LessonAttempt = { attemptId: string; status: "started" | "completed" };
export type AnswerSubmissionResult = { questionId: string; answerId: string; isCorrect: boolean; explanation: string };
export type LessonCompletionResult = { attemptId: string; status: "completed"; score: number };

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function parseAttempt(value: unknown): LessonAttempt {
  const row = record(value, "پاسخ شروع تمرین معتبر نیست.");
  if (typeof row.attemptId !== "string" || !row.attemptId || (row.status !== "started" && row.status !== "completed")) {
    throw new Error("ساختار پاسخ شروع تمرین معتبر نیست.");
  }
  return { attemptId: row.attemptId, status: row.status };
}

function parseAnswer(value: unknown): AnswerSubmissionResult {
  const row = record(value, "پاسخ ثبت تمرین معتبر نیست.");
  if (typeof row.questionId !== "string" || !row.questionId || typeof row.answerId !== "string" || !row.answerId ||
      typeof row.isCorrect !== "boolean" || typeof row.explanation !== "string") {
    throw new Error("ساختار بازخورد پاسخ از سرور معتبر نیست.");
  }
  return { questionId: row.questionId, answerId: row.answerId, isCorrect: row.isCorrect, explanation: row.explanation };
}

function parseCompletion(value: unknown): LessonCompletionResult {
  const row = record(value, "نتیجهٔ تکمیل درس معتبر نیست.");
  if (typeof row.attemptId !== "string" || row.status !== "completed" ||
      typeof row.score !== "number" || !Number.isSafeInteger(row.score) || row.score < 0 || row.score > 100) {
    throw new Error("ساختار نتیجهٔ نهایی از سرور معتبر نیست.");
  }
  return { attemptId: row.attemptId, status: "completed", score: row.score };
}

async function withSession<T>(action: (accessToken: string) => Promise<T>): Promise<T> {
  const accessToken = await getSessionToken();
  try {
    return await action(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession().catch(() => undefined);
      throw new Error("نشست تلگرام منقضی یا لغو شده است؛ Mini App را ببند و دوباره از ربات باز کن.");
    }
    throw error;
  }
}

export async function startLessonAttempt(lessonId: string): Promise<LessonAttempt> {
  return withSession(async (accessToken) => parseAttempt(await apiPost<unknown>(
    "/api/v1/lessons/" + encodeURIComponent(lessonId) + "/attempts", {}, { accessToken },
  )));
}

export async function submitLessonAnswer(attemptId: string, questionId: string, answerId: string): Promise<AnswerSubmissionResult> {
  return withSession(async (accessToken) => {
    const result = parseAnswer(await apiPost<unknown>(
      "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/answers", { questionId, answerId }, { accessToken },
    ));
    if (result.questionId !== questionId || result.answerId !== answerId) {
      throw new Error("بازخورد سرور با پرسش و گزینهٔ ارسال‌شده مطابقت ندارد.");
    }
    return result;
  });
}

export async function completeLessonAttempt(attemptId: string): Promise<LessonCompletionResult> {
  return withSession(async (accessToken) => {
    const result = parseCompletion(await apiPost<unknown>(
      "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/complete", {}, { accessToken },
    ));
    if (result.attemptId !== attemptId) throw new Error("نتیجهٔ دریافتی متعلق به تلاش جاری نیست.");
    return result;
  });
}
