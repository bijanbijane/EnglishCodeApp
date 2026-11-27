const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

export async function cleanupExpiredAuthState(
  db: D1Database,
  now: Date = new Date(),
): Promise<D1Result[]> {
  const nowIso = now.toISOString();
  const expiredSessionCutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const revokedSessionCutoff = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const expiredQuotaDay = new Date(now.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);

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
      `DELETE FROM auth_rate_limits
       WHERE bucket_key IN (
         SELECT bucket_key
         FROM auth_rate_limits
         WHERE updated_at < ?
         ORDER BY updated_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(new Date(now.getTime() - 2 * DAY_MS).toISOString()),
    db.prepare(
      `DELETE FROM sessions
       WHERE id IN (
         SELECT id
         FROM sessions INDEXED BY idx_sessions_expires_at
         WHERE expires_at < ? AND revoked_at IS NULL
         ORDER BY expires_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(expiredSessionCutoff),
    db.prepare(
      `DELETE FROM sessions
       WHERE id IN (
         SELECT id
         FROM sessions
         WHERE revoked_at < ?
         ORDER BY revoked_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(revokedSessionCutoff),
    db.prepare(
      `DELETE FROM ai_transcription_reservations
       WHERE id IN (
         SELECT id
         FROM ai_transcription_reservations
         WHERE day_utc < ?
         ORDER BY day_utc ASC, created_at ASC
         LIMIT ${BATCH_LIMIT}
       )`,
    ).bind(expiredQuotaDay),
  ]);
}
