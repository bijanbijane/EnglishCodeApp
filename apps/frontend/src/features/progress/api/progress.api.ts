import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";
import { parseLessonProgressList, type LessonProgress } from "./progress.contract";

export type { LessonProgress } from "./progress.contract";

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

export async function getMyProgress(): Promise<LessonProgress[]> {
  return parseLessonProgressList(await authenticatedGet<unknown>("/api/v1/me/progress"));
}
