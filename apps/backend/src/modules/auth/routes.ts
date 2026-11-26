import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";
import { requireSession } from "./middleware";
import { sessionRepository } from "./repository";
import { createSessionToken, hashSessionToken } from "./session";
import { validateTelegramInitData, TelegramInitDataError } from "./telegram";

const auth = new Hono<AppEnv>();
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 300;

type TelegramLoginBody = { initData: string };

function parseLoginBody(value: unknown): TelegramLoginBody {
  if (
    typeof value !== "object" ||
    value === null ||
    !("initData" in value) ||
    typeof value.initData !== "string" ||
    value.initData.length === 0 ||
    value.initData.length > 16_384
  ) {
    throw new AppError("VALIDATION_ERROR", "A valid Telegram initData value is required.", 400);
  }
  return { initData: value.initData };
}

function displayName(user: { first_name?: string; last_name?: string; username?: string }): string {
  const fullName = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .trim();
  return (fullName || user.username || "Telegram user").slice(0, 80);
}

auth.post("/auth/telegram", async (c) => {
  if (!c.env.TELEGRAM_BOT_TOKEN) {
    throw new AppError("SERVICE_UNAVAILABLE", "Telegram authentication is not configured.", 503);
  }

  if (!c.req.header("content-type")?.toLowerCase().includes("application/json")) {
    throw new AppError("VALIDATION_ERROR", "Content-Type must be application/json.", 400);
  }

  const rawBody = await c.req.text();
  if (rawBody.length > 20_000) {
    throw new AppError("VALIDATION_ERROR", "The request body is too large.", 400);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new AppError("VALIDATION_ERROR", "A valid JSON payload is required.", 400);
  }

  const { initData } = parseLoginBody(parsedBody);
  let validated;
  try {
    validated = await validateTelegramInitData(
      initData,
      c.env.TELEGRAM_BOT_TOKEN,
      { maxAgeSeconds: TELEGRAM_INIT_DATA_MAX_AGE_SECONDS },
    );
  } catch (error) {
    if (error instanceof TelegramInitDataError) {
      throw new AppError("UNAUTHENTICATED", "Telegram authentication could not be verified.", 401);
    }
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const userId = crypto.randomUUID();
  const identityId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const token = await createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  const replayExpiresAt = new Date(
    (validated.authDate + TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) * 1000,
  ).toISOString();

  // D1 batch is transactional. The session INSERT is gated by changes() from
  // the immediately preceding replay INSERT, so a replay cannot issue a token.
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, display_name)
       SELECT ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM external_identities
         WHERE provider = 'telegram' AND provider_user_id = ?
       )
       ON CONFLICT(id) DO NOTHING`,
    ).bind(userId, displayName(validated.user), validated.userId),
    c.env.DB.prepare(
      `INSERT INTO external_identities (id, user_id, provider, provider_user_id)
       SELECT ?, ?, 'telegram', ?
       WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
       ON CONFLICT(provider, provider_user_id) DO NOTHING`,
    ).bind(identityId, userId, validated.userId, userId),
    c.env.DB.prepare(
      `INSERT INTO telegram_auth_replays (fingerprint, expires_at)
       VALUES (?, ?)
       ON CONFLICT(fingerprint) DO NOTHING`,
    ).bind(validated.replayFingerprint, replayExpiresAt),
    c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       SELECT ?, user_id, ?, ?
       FROM external_identities
       WHERE provider = 'telegram'
         AND provider_user_id = ?
         AND changes() = 1`,
    ).bind(sessionId, tokenHash, expiresAt, validated.userId),
    c.env.DB.prepare(
      `SELECT u.id, u.display_name
       FROM users u
       JOIN external_identities i ON i.user_id = u.id
       WHERE i.provider = 'telegram' AND i.provider_user_id = ?
       LIMIT 1`,
    ).bind(validated.userId),
  ]);

  if (results[3]?.meta.changes !== 1) {
    throw new AppError("CONFLICT", "This Telegram login payload has already been used.", 409);
  }

  const account = results[4]?.results[0] as { id: string; display_name: string | null } | undefined;
  if (!account) {
    throw new AppError("INTERNAL_ERROR", "The authenticated account could not be loaded.", 500);
  }

  return c.json({
    data: {
      accessToken: token,
      tokenType: "Bearer",
      expiresAt,
      user: {
        id: account.id,
        displayName: account.display_name,
      },
    },
    meta: { requestId: c.get("requestId") },
  }, 201);
});

auth.post("/auth/logout", requireSession, async (c) => {
  const revoked = await sessionRepository.revoke(
    c.env.DB,
    c.get("sessionId"),
    c.get("userId"),
    new Date().toISOString(),
  );
  return c.json({
    data: { loggedOut: revoked },
    meta: { requestId: c.get("requestId") },
  });
});

export default auth;
