import { constantTimeEqual, encoder } from "../../shared/crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function telegramDataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!initData || initData.length > 16_384) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !authDateRaw || !userRaw) return null;

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) return null;

  let user: TelegramUser;
  try { user = JSON.parse(userRaw) as TelegramUser; } catch { return null; }
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== "string") return null;

  const secretKey = await crypto.subtle.importKey(
    "raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC", dataKey, encoder.encode(telegramDataCheckString(params))
  ));
  const calculated = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(calculated.toLowerCase(), hash.toLowerCase()) ? { user, authDate } : null;
}