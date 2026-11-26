import { AppError } from "../../shared/errors";
import { bytesToHex, constantTimeHexEqual, hmacSha256, sha256Hex } from "../../shared/crypto";

export interface TelegramUser {
  id: string; firstName: string; lastName: string | null; username: string | null; languageCode: string | null;
}
export interface VerifiedTelegramInitData { user: TelegramUser; authDate: number; queryId: string | null; }

function sortedEntries(rawInitData: string): [string, string][] {
  const entries = Array.from(new URLSearchParams(rawInitData).entries());
  return entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

export async function telegramInitDataFingerprint(rawInitData: string): Promise<string> {
  return sha256Hex(sortedEntries(rawInitData).map(([key, value]) => `${key}=${value}`).join("\n"));
}

export async function verifyTelegramInitData(
  rawInitData: string,
  options: { botToken: string; nowSeconds?: number; maxAgeSeconds?: number; futureSkewSeconds?: number }
): Promise<VerifiedTelegramInitData> {
  if (!rawInitData || rawInitData.length > 8192) throw new AppError("INVALID_TELEGRAM_INIT_DATA", "Telegram authentication data is invalid.", 401);
  const entries = sortedEntries(rawInitData);
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new AppError("INVALID_TELEGRAM_INIT_DATA", "Telegram authentication data is invalid.", 401);
  }
  const params = new URLSearchParams(rawInitData);
  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new AppError("INVALID_TELEGRAM_SIGNATURE", "Telegram signature is invalid.", 401);
  }

  const authDate = Number(params.get("auth_date"));
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? 3600;
  const futureSkew = options.futureSkewSeconds ?? 30;
  if (!Number.isInteger(authDate) || authDate <= 0 || authDate > now + futureSkew || now - authDate >= maxAge) {
    throw new AppError("TELEGRAM_AUTH_EXPIRED", "Telegram authentication data has expired.", 401);
  }

  const checkString = entries.filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`).join("\n");

  // Telegram Mini Apps: secret_key = HMAC_SHA256(key=bot_token, data="WebAppData").
  // Then calculate HMAC_SHA256(key=secret_key, data=data_check_string).
  const secret = await hmacSha256(new TextEncoder().encode(options.botToken), "WebAppData");
  const expectedHash = bytesToHex(await hmacSha256(secret, checkString));
  if (!constantTimeHexEqual(expectedHash, receivedHash.toLowerCase())) {
    throw new AppError("INVALID_TELEGRAM_SIGNATURE", "Telegram signature is invalid.", 401);
  }

  let user: Record<string, unknown>;
  try {
    const rawUser = params.get("user");
    if (!rawUser) throw new Error("missing user");
    user = JSON.parse(rawUser) as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_TELEGRAM_USER", "Telegram user data is invalid.", 401);
  }
  if ((typeof user.id !== "number" && typeof user.id !== "string") || !String(user.id).trim() ||
      typeof user.first_name !== "string" || !user.first_name.trim()) {
    throw new AppError("INVALID_TELEGRAM_USER", "Telegram user data is invalid.", 401);
  }
  return {
    user: {
      id: String(user.id), firstName: user.first_name.slice(0, 128),
      lastName: typeof user.last_name === "string" ? user.last_name.slice(0, 128) : null,
      username: typeof user.username === "string" ? user.username.slice(0, 64) : null,
      languageCode: typeof user.language_code === "string" ? user.language_code.slice(0, 16) : null
    },
    authDate, queryId: params.get("query_id")
  };
}
