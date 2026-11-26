import { apiPost, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";
import {
  parseAttemptResponse,
  parseAnswerSubmissionResult,
  parseLessonCompletionResult,
  type LessonAttempt,
  type AnswerSubmissionResult,
  type LessonCompletionResult,
} from "./attempts.contract";

export type { LessonAttempt, AnswerSubmissionResult, LessonCompletionResult } from "./attempts.contract";

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
  return withSession(async (accessToken) => parseAttemptResponse(await apiPost<unknown>(
    "/api/v1/lessons/" + encodeURIComponent(lessonId) + "/attempts", {}, { accessToken },
  )));
}

export async function submitLessonAnswer(attemptId: string, questionId: string, answerId: string): Promise<AnswerSubmissionResult> {
  return withSession(async (accessToken) => {
    const result = parseAnswerSubmissionResult(await apiPost<unknown>(
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
    const result = parseLessonCompletionResult(await apiPost<unknown>(
      "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/complete", {}, { accessToken },
    ));
    if (result.attemptId !== attemptId) throw new Error("نتیجهٔ دریافتی متعلق به تلاش جاری نیست.");
    return result;
  });
}
