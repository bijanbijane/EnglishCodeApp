import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LearnerProfile = { id: string; displayName: string | null };

function parseLearnerProfile(value: unknown): LearnerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار اطلاعات حساب معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || !(row.displayName === null || typeof row.displayName === "string")) {
    throw new Error("اطلاعات شناسه یا نام نمایشی حساب ناقص است.");
  }
  return { id: row.id, displayName: row.displayName };
}

export async function getMyProfile(): Promise<LearnerProfile> {
  const accessToken = await getSessionToken();
  try {
    return parseLearnerProfile(await apiGet<unknown>("/api/v1/me", { accessToken }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession().catch(() => undefined);
      throw new Error("نشست تلگرام منقضی یا لغو شده است؛ Mini App را دوباره از ربات باز کن.");
    }
    throw error;
  }
}
