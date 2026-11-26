import { apiPost } from "../../../shared/api/client";
import { getSessionToken } from "../../../services/auth/session";

export type LessonAttempt = { attemptId: string; status: "started" | "completed" };
export type AnswerSubmissionResult = { questionId: string; answerId: string; isCorrect: boolean; explanation: string };
export type LessonCompletionResult = { attemptId: string; status: "completed"; score: number };

export async function startLessonAttempt(lessonId: string): Promise<LessonAttempt> {
  const accessToken = await getSessionToken();
  return apiPost<LessonAttempt>(
    "/api/v1/lessons/" + encodeURIComponent(lessonId) + "/attempts",
    {},
    { accessToken },
  );
}

export async function submitLessonAnswer(attemptId: string, questionId: string, answerId: string): Promise<AnswerSubmissionResult> {
  const accessToken = await getSessionToken();
  return apiPost<AnswerSubmissionResult>(
    "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/answers",
    { questionId, answerId },
    { accessToken },
  );
}

export async function completeLessonAttempt(attemptId: string): Promise<LessonCompletionResult> {
  const accessToken = await getSessionToken();
  return apiPost<LessonCompletionResult>(
    "/api/v1/attempts/" + encodeURIComponent(attemptId) + "/complete",
    {},
    { accessToken },
  );
}
