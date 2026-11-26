import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { AppError, errorBody } from "../../shared/errors";
import { requireAuth } from "./middleware";
import { createTelegramSession, revokeSession } from "./session";
import { telegramInitDataFingerprint, verifyTelegramInitData } from "./telegram";
import { ensureTelegramIdentity } from "../identity/service";

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/telegram", async (c) => {
  if (!c.env.DB || !c.env.TELEGRAM_BOT_TOKEN) {
    return c.json(errorBody("AUTH_NOT_CONFIGURED", "Telegram sign-in is not configured.", c.get("requestId")), 503);
  }
  let parsed: unknown;
  try { parsed = await c.req.json(); }
  catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return c.json(errorBody("INVALID_REQUEST", "Request body must be a JSON object.", c.get("requestId")), 400);
  }
  const body = parsed as { initData?: unknown };
  if (typeof body.initData !== "string" || body.initData.length === 0 || body.initData.length > 8192) {
    return c.json(errorBody("INVALID_REQUEST", "initData is required and must be at most 8192 characters.", c.get("requestId")), 400);
  }

  try {
    const maxAgeSeconds = Number(c.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 3600);
    const ttlSeconds = Number(c.env.SESSION_TTL_SECONDS ?? 604800);
    if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 60 || maxAgeSeconds > 86400 ||
        !Number.isInteger(ttlSeconds) || ttlSeconds < 300 || ttlSeconds > 2592000) {
      throw new AppError("AUTH_CONFIGURATION_INVALID", "Authentication lifetime settings are invalid.", 500);
    }

    const verified = await verifyTelegramInitData(body.initData, {
      botToken: c.env.TELEGRAM_BOT_TOKEN,
      maxAgeSeconds
    });
    const fingerprint = await telegramInitDataFingerprint(body.initData);

    const displayName = [verified.user.firstName, verified.user.lastName].filter(Boolean).join(" ").slice(0, 257);
    await c.env.DB.prepare("INSERT INTO users (id,telegram_user_id,display_name) VALUES (?,?,?) " +
      "ON CONFLICT(telegram_user_id) DO UPDATE SET display_name=excluded.display_name")
      .bind(crypto.randomUUID(), verified.user.id, displayName).run();
    const user = await c.env.DB.prepare("SELECT id,display_name FROM users WHERE telegram_user_id=? LIMIT 1")
      .bind(verified.user.id).first<{ id: string; display_name: string | null }>();
    if (!user) throw new AppError("USER_CREATE_FAILED", "Could not create the user account.", 503);
    // Link the verified provider subject to the stable internal user ID. This
    // keeps Telegram as an identity provider, not the primary domain identity.
    await ensureTelegramIdentity(c.env.DB, user.id, verified.user.id);

    const session = await createTelegramSession(
      c.env.DB,
      user.id,
      ttlSeconds,
      fingerprint,
      new Date((verified.authDate + maxAgeSeconds) * 1000).toISOString()
    );
    if (session.replayed) {
      throw new AppError("TELEGRAM_INIT_DATA_REPLAYED", "This Telegram sign-in payload has already been used.", 409);
    }

    return c.json({ data: {
      token: session.token,
      tokenType: "Bearer",
      expiresAt: session.expiresAt,
      user: { id: user.id, displayName: user.display_name }
    } });
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
