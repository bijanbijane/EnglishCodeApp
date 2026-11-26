export type ActiveSession = {
  id: string;
  user_id: string;
};

export const sessionRepository = {
  findActive(db: D1Database, tokenHash: string, nowIso: string): Promise<ActiveSession | null> {
    return db.prepare(
      `SELECT id, user_id FROM sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
       LIMIT 1`,
    ).bind(tokenHash, nowIso).first<ActiveSession>();
  },

  async revoke(db: D1Database, sessionId: string, userId: string, nowIso: string): Promise<boolean> {
    const result = await db.prepare(
      `UPDATE sessions SET revoked_at = ?
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(nowIso, sessionId, userId, nowIso).run();
    return result.meta.changes === 1;
  },
};
