import { apiGet, ApiError } from "../../../shared/api/client";
import { clearSession, getSessionToken } from "../../../services/auth/session";

import { parseLearnerProfile, type LearnerProfile } from "./user.contract";

export type { LearnerProfile } from "./user.contract";

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
