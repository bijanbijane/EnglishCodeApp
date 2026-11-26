const WINDOW_MS = 60 * 1000;

export const TELEGRAM_LOGIN_LIMIT_PER_MINUTE = 30;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashRateLimitKey(ipAddress: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`telegram-login-rate-limit:${ipAddress}`),
  );
  return toHex(new Uint8Array(digest));
}

export async function consumeTelegramLoginLimit(
  db: D1Database,
  bucketKey: string,
  now: Date = new Date(),
): Promise<number> {
  const windowStart = new Date(
    Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS,
  ).toISOString();
  const updatedAt = now.toISOString();

  const result = await db.prepare(
    `INSERT INTO auth_rate_limits (bucket_key, window_start, request_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       request_count = CASE
         WHEN auth_rate_limits.window_start = excluded.window_start
           THEN auth_rate_limits.request_count + 1
         ELSE 1
       END,
       window_start = excluded.window_start,
       updated_at = excluded.updated_at
     RETURNING request_count`,
  ).bind(bucketKey, windowStart, updatedAt).first<{ request_count: number }>();

  if (!result || !Number.isSafeInteger(result.request_count)) {
    throw new Error("Rate limit storage returned an invalid result.");
  }
  return result.request_count;
}
