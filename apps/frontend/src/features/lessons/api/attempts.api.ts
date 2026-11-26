import { apiPost, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LessonAttempt = { attemptId: string; status: "started" | "completed" };
export type AnswerSubmissionResult = { questionId: string; answerId: string; isCorrect: boolean; explanation: string };
export type LessonCompletionResult = { attemptId: string; status: "completed"; score: number };

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
  return withSession((accessToken) => apiPost<LessonAttempt>(
    "/api/v1/lessons/" + encodeURIComponent(lessonId) + "/attempts",
    {},
    { accessToken },
  ));
}

export async function submitLessonAnswer(attemptId: string, questionId: string, answerId: string): Promise<AnswerSubmissionResult> {
  return withSession((accessToken) => apiPost<AnswerSubmissionResult>(
    "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/answers",
    { questionId, answerId },
    { accessToken },
  ));
}

export async function completeLessonAttempt(attemptId: string): Promise<LessonCompletionResult> {
  return withSession((accessToken) => apiPost<LessonCompletionResult>(
    "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/complete",
    {},
    { accessToken },
  ));
}
