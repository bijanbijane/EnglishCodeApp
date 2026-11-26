import type { D1Database } from "../../env";
import { createOpaqueToken, sha256Hex } from "../../shared/crypto";

interface SessionRow { id: string; telegram_user_id: string; display_name: string | null; token_hash: string; }
export async function createSession(db: D1Database, userId: string, ttlSeconds: number) {
  const token = createOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").bind(now.toISOString()).run();
  await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt, now.toISOString()).run();
  return { token, expiresAt };
}
export async function findSessionUser(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  return db.prepare(`SELECT users.id, users.telegram_user_id, users.display_name, sessions.token_hash
    FROM sessions INNER JOIN users ON users.id=sessions.user_id
    WHERE sessions.token_hash=? AND sessions.revoked_at IS NULL AND sessions.expires_at>? LIMIT 1`)
    .bind(tokenHash, new Date().toISOString()).first<SessionRow>();
}
export async function revokeSession(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  await db.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash).run();
}
