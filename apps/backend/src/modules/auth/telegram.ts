export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  [key: string]: unknown;
};

export type ValidatedTelegramInitData = {
  userId: string;
  user: TelegramUser;
  authDate: number;
  replayFingerprint: string;
};

export type TelegramValidationOptions = {
  nowSeconds?: number;
  maxAgeSeconds?: number;
  futureSkewSeconds?: number;
};

export class TelegramInitDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramInitDataError";
  }
}

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

/**
 * Validates Telegram Mini App initData using Telegram's documented two-stage
 * HMAC-SHA-256 construction. Callers must still apply replay protection and
 * create the application session atomically before accepting the login.
 */
export async function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  options: TelegramValidationOptions = {},
): Promise<ValidatedTelegramInitData> {
  const {
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAgeSeconds = 300,
    futureSkewSeconds = 30,
  } = options;

  if (!botToken || rawInitData.length === 0 || rawInitData.length > 16_384) {
    throw new TelegramInitDataError("Invalid Telegram authentication payload.");
  }

  const params = new URLSearchParams(rawInitData);
  const values = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (values.has(key)) {
      throw new TelegramInitDataError("Duplicate Telegram authentication parameter.");
    }
    values.set(key, value);
  }

  const receivedHash = values.get("hash");
  const authDateRaw = values.get("auth_date");
  const userRaw = values.get("user");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !authDateRaw || !userRaw) {
    throw new TelegramInitDataError("Required Telegram authentication fields are missing.");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new TelegramInitDataError("Invalid Telegram authentication timestamp.");
  }
  if (authDate > nowSeconds + futureSkewSeconds || nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramInitDataError("Telegram authentication data has expired or is not yet valid.");
  }

  const dataCheckString = Array.from(values.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Telegram: secret_key = HMAC_SHA256(key=bot_token, message="WebAppData").
  const secretKey = await hmacSha256(encoder.encode(botToken), "WebAppData");
  const calculatedHash = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!constantTimeHexEqual(calculatedHash, receivedHash.toLowerCase())) {
    throw new TelegramInitDataError("Telegram authentication signature is invalid.");
  }

  let user: TelegramUser;
  try {
    const parsed: unknown = JSON.parse(userRaw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      typeof parsed.id !== "number" ||
      !Number.isSafeInteger(parsed.id) ||
      parsed.id <= 0
    ) {
      throw new Error("Invalid user object");
    }
    user = parsed as TelegramUser;
  } catch {
    throw new TelegramInitDataError("Telegram user data is invalid.");
  }

  const canonicalPayload = Array.from(values.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  return {
    userId: String(user.id),
    user,
    authDate,
    replayFingerprint: await sha256Hex(canonicalPayload),
  };
}
