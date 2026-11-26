import type { D1Database } from "../../env";
import { AppError } from "../../shared/errors";

/**
 * Attach a cryptographically verified Telegram provider subject to an existing
 * internal user. This operation is idempotent and fails closed on identity conflict.
 */
export async function ensureTelegramIdentity(db: D1Database, userId: string, telegramSubject: string) {
  if (!userId || !telegramSubject || telegramSubject.length > 191) {
    throw new AppError("IDENTITY_INPUT_INVALID", "Verified identity is invalid.", 400);
  }

  const existing = await db.prepare(
    "SELECT user_id FROM user_identities WHERE provider='telegram' AND provider_subject=? LIMIT 1"
  ).bind(telegramSubject).first<{ user_id: string }>();

  if (existing && existing.user_id !== userId) {
    throw new AppError("IDENTITY_CONFLICT", "This Telegram identity is already linked to another account.", 409);
  }

  await db.prepare(
    "INSERT OR IGNORE INTO user_identities (id,user_id,provider,provider_subject) VALUES (? ,?,'telegram',?)"
  ).bind(crypto.randomUUID(), userId, telegramSubject).run();

  const linked = await db.prepare(
    "SELECT user_id FROM user_identities WHERE provider='telegram' AND provider_subject=? LIMIT 1"
  ).bind(telegramSubject).first<{ user_id: string }>();

  if (!linked || linked.user_id !== userId) {
    throw new AppError("IDENTITY_CONFLICT", "This Telegram identity could not be linked safely.", 409);
  }
  return { userId, provider: "telegram" as const };
}
