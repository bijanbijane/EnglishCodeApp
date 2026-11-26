import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LessonProgress = {
  lesson_id: string;
  best_score: number;
  completed_count: number;
  last_completed_at: string | null;
};

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

function parseProgress(value: unknown): LessonProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار یکی از سوابق پیشرفت معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.lesson_id !== "string" || typeof row.best_score !== "number" ||
      typeof row.completed_count !== "number" ||
      !(row.last_completed_at === null || typeof row.last_completed_at === "string")) {
    throw new Error("اطلاعات یکی از سوابق پیشرفت ناقص است.");
  }
  return {
    lesson_id: row.lesson_id,
    best_score: row.best_score,
    completed_count: row.completed_count,
    last_completed_at: row.last_completed_at,
  };
}

export async function getMyProgress(): Promise<LessonProgress[]> {
  const payload = await authenticatedGet<unknown>("/api/v1/me/progress");
  if (!Array.isArray(payload)) throw new Error("پاسخ سوابق پیشرفت معتبر نیست.");
  return payload.map(parseProgress);
}

