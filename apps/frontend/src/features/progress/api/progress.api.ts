import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LessonProgress = {
  lesson_id: string;
  best_score: number;
  completed_count: number;
  last_completed_at: string | null;
};

export type LearnerProfile = { id: string; displayName: string | null };

async function authenticatedGet<T>(path: string): Promise<T> {
  const accessToken = await getSessionToken();
  try {
    return await apiGet<T>(path, { accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession().catch(() => undefined);
      throw new Error("نشست تلگرام منقضی یا لغو شده است؛ Mini App را دوباره از ربات باز کن.");
    }
    throw error;
  }
}

export function getMyProgress(): Promise<LessonProgress[]> {
  return authenticatedGet<LessonProgress[]>("/api/v1/me/progress");
}

export function getMyProfile(): Promise<LearnerProfile> {
  return authenticatedGet<LearnerProfile>("/api/v1/me");
}
