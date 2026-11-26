const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

export async function cleanupExpiredAuthState(
  db: D1Database,
  now: Date = new Date(),
): Promise<D1Result[]> {
  const nowIso = now.toISOString();
  const expiredSessionCutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const revokedSessionCutoff = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  return db.batch([
    db.prepare(
      `DELETE FROM telegram_auth_replays
       WHERE fingerprint IN (
         SELECT fingerprint
         FROM telegram_auth_replays
         WHERE expires_at < ?
         ORDER BY expires_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(nowIso),
    db.prepare(
      `DELETE FROM sessions
       WHERE id IN (
         SELECT id
         FROM sessions
         WHERE (expires_at < ? AND revoked_at IS NULL)
            OR (revoked_at IS NOT NULL AND revoked_at < ?)
         ORDER BY expires_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(expiredSessionCutoff, revokedSessionCutoff),
  ]);
}
