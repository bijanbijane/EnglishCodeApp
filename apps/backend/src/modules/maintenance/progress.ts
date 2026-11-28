export async function rebuildUserProgressFromEvents(db: D1Database): Promise<D1Result[]> {
  // D1 batch is transactional: if the projection insert fails, the delete rolls back.
  // learning_events remains the immutable source of truth and is never modified here.
  return db.batch([
    db.prepare("DELETE FROM user_progress"),
    db.prepare(
      `INSERT INTO user_progress
         (user_id, lesson_id, best_score, completed_count, last_completed_at)
       SELECT
         user_id,
         lesson_id,
         MAX(score),
         COUNT(*),
         MAX(occurred_at)
       FROM learning_events
       WHERE event_type = 'lesson_attempt_completed'
       GROUP BY user_id, lesson_id`,
    ),
  ]);
}
