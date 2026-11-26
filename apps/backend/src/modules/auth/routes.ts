import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { AppError, errorBody } from "../../shared/errors";
import { requireAuth } from "./middleware";
import { createSession, revokeSession } from "./session";
import { telegramInitDataFingerprint, verifyTelegramInitData } from "./telegram";

export const authRoutes = new Hono<AppBindings>();
authRoutes.post("/telegram", async (c) => {
  if (!c.env.DB || !c.env.TELEGRAM_BOT_TOKEN) return c.json(errorBody("AUTH_NOT_CONFIGURED", "Telegram sign-in is not configured.", c.get("requestId")), 503);
  let parsed: unknown;
  try { parsed = await c.req.json(); }
  catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return c.json(errorBody("INVALID_REQUEST", "Request body must be a JSON object.", c.get("requestId")), 400);
  }
  const body = parsed as { initData?: unknown };
  if (typeof body.initData !== "string") return c.json(errorBody("INVALID_REQUEST", "initData is required.", c.get("requestId")), 400);

  try {
    const configuredMaxAge = Number(c.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 3600);
    const maxAgeSeconds = Number.isFinite(configuredMaxAge) ? Math.min(Math.max(configuredMaxAge, 60), 86400) : 3600;
    const verified = await verifyTelegramInitData(body.initData, {
      botToken: c.env.TELEGRAM_BOT_TOKEN,
      maxAgeSeconds
    });

    // Store only a fingerprint, never raw Telegram initData. A unique key prevents replay.
    const fingerprint = await telegramInitDataFingerprint(body.initData);
    const now = new Date();
    await c.env.DB.prepare("DELETE FROM telegram_auth_replays WHERE expires_at <= ?")
      .bind(now.toISOString()).run();
    const replay = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO telegram_auth_replays (init_data_hash,expires_at,created_at) VALUES (?,?,?)"
    ).bind(fingerprint, new Date((verified.authDate + maxAgeSeconds) * 1000).toISOString(), now.toISOString()).run();
    if ((replay.meta?.changes ?? 0) !== 1) {
      throw new AppError("TELEGRAM_INIT_DATA_REPLAYED", "This Telegram sign-in payload has already been used.", 401);
    }

    const displayName = [verified.user.firstName, verified.user.lastName].filter(Boolean).join(" ").slice(0, 257);
    await c.env.DB.prepare(`INSERT INTO users (id,telegram_user_id,display_name) VALUES (?,?,?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET display_name=excluded.display_name`)
      .bind(crypto.randomUUID(), verified.user.id, displayName).run();
    const user = await c.env.DB.prepare("SELECT id,display_name FROM users WHERE telegram_user_id=? LIMIT 1")
      .bind(verified.user.id).first<{ id: string; display_name: string | null }>();
    if (!user) throw new AppError("USER_CREATE_FAILED", "Could not create the user account.", 503);
    const configuredTtl = Number(c.env.SESSION_TTL_SECONDS ?? 604800);
    const ttl = Number.isFinite(configuredTtl) ? Math.min(Math.max(configuredTtl, 300), 2592000) : 604800;
    const session = await createSession(c.env.DB, user.id, ttl);
    return c.json({ data: { token: session.token, tokenType: "Bearer", expiresAt: session.expiresAt,
      user: { id: user.id, displayName: user.display_name } } });
  } catch (error) {
    if (error instanceof AppError) return c.json(errorBody(error.code, error.message, c.get("requestId")), error.status as 400);
    return c.json(errorBody("AUTH_FAILED", "Telegram sign-in could not be completed.", c.get("requestId")), 503);
  }
});
authRoutes.post("/logout", requireAuth, async (c) => {
  const token = c.req.header("authorization")!.slice(7);
  try {
    await revokeSession(c.env.DB!, token);
    return c.json({ data: { signedOut: true } });
  } catch {
    return c.json(errorBody("SESSION_REVOKE_FAILED", "Could not end the session.", c.get("requestId")), 503);
  }
});
