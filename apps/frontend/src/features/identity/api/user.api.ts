import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

export type LearnerProfile = { id: string; displayName: string | null };

export async function getMyProfile(): Promise<LearnerProfile> {
  const accessToken = await getSessionToken();
  try {
    return await apiGet<LearnerProfile>("/api/v1/me", { accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession().catch(() => undefined);
      throw new Error("نشست تلگرام منقضی یا لغو شده است؛ Mini App را دوباره از ربات باز کن.");
    }
    throw error;
  }
}
