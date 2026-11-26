import type { D1Database } from "../../env";
import { createOpaqueToken, sha256Hex } from "../../shared/crypto";

interface SessionRow { id: string; telegram_user_id: string; display_name: string | null; token_hash: string; }

/** Atomically claims a Telegram initData fingerprint and issues its session. */
export async function createTelegramSession(
  db: D1Database,
  userId: string,
  ttlSeconds: number,
  initDataHash: string,
  replayExpiresAt: string
) {
  const token = createOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // D1 batch is transactional. The final INSERT runs only if the replay claim
  // immediately before it inserted exactly one row.
  const results = await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").bind(nowIso),
    db.prepare("DELETE FROM telegram_auth_replays WHERE expires_at <= ?").bind(nowIso),
    db.prepare("INSERT OR IGNORE INTO telegram_auth_replays (init_data_hash,expires_at,created_at) VALUES (?,?,?)")
      .bind(initDataHash, replayExpiresAt, nowIso),
    db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) SELECT ?,?,?,?,? WHERE changes()=1")
      .bind(crypto.randomUUID(), userId, tokenHash, expiresAt, nowIso)
  ]);

  if ((results[2]?.meta?.changes ?? 0) !== 1) return { replayed: true as const };
  if ((results[3]?.meta?.changes ?? 0) !== 1) {
    throw new Error("Telegram session issuance did not complete atomically.");
  }
  return { replayed: false as const, token, expiresAt };
}

export async function findSessionUser(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  return db.prepare("SELECT users.id, users.telegram_user_id, users.display_name, sessions.token_hash " +
    "FROM sessions INNER JOIN users ON users.id=sessions.user_id " +
    "WHERE sessions.token_hash=? AND sessions.revoked_at IS NULL AND sessions.expires_at>? LIMIT 1")
    .bind(tokenHash, new Date().toISOString()).first<SessionRow>();
}
export async function revokeSession(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  await db.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash).run();
}
