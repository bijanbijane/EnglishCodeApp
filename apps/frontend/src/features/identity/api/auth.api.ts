import { apiPost, ApiError } from "../../../shared/api/client";
import { getPlatformContext, isTelegramSecureStorageAvailable } from "../../../services/platform/telegram";
import { readSession, saveSession, clearSession, getSessionToken } from "../../../services/auth/session";

type TelegramAuthResponse = {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: { id: string; displayName: string | null };
};

export type SessionBootstrapResult =
  | { status: "authenticated"; displayName?: string | null }
  | { status: "browser-preview" }
  | { status: "missing-init-data" }
  | { status: "secure-storage-unavailable"; message: string }
  | { status: "error"; message: string };

let bootstrapPromise: Promise<SessionBootstrapResult> | null = null;

export function bootstrapTelegramSession(): Promise<SessionBootstrapResult> {
  if (!bootstrapPromise) bootstrapPromise = performBootstrap();
  return bootstrapPromise;
}

async function performBootstrap(): Promise<SessionBootstrapResult> {
  const platform = getPlatformContext();
  if (platform.host !== "telegram") return { status: "browser-preview" };
  if (!platform.initData) return { status: "missing-init-data" };
  if (!isTelegramSecureStorageAvailable()) {
    return { status: "secure-storage-unavailable", message: "برای نگه‌داری امن نشست، تلگرام نسخهٔ ۹ یا بالاتر لازم است." };
  }

  try {
    const existing = await readSession();
    if (existing) return { status: "authenticated" };
    const response = await apiPost<TelegramAuthResponse>("/api/v1/auth/telegram", { initData: platform.initData });
    if (response.tokenType !== "Bearer") throw new Error("نوع نشست دریافتی از سرور پشتیبانی نمی‌شود.");
    await saveSession({ token: response.token, expiresAt: response.expiresAt });
    return { status: "authenticated", displayName: response.user.displayName };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "ورود به حساب انجام نشد." };
  }
}

export async function signOut(): Promise<void> {
  const token = await getSessionToken();
  try {
    await apiPost<{ signedOut: boolean }>("/api/v1/auth/logout", {}, { accessToken: token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  await clearSession();
}
