import type { D1Database } from "../../env";

export interface ProgressRebuildResult {
  userId: string;
  lessonCount: number;
  completedCount: number;
}

/**
 * Rebuilds one user's read model from append-only progress facts.
 * The delete and insert run in one D1 batch/transaction; immutable facts are untouched.
 */
export async function rebuildUserProgress(
  db: D1Database,
  userId: string
): Promise<ProgressRebuildResult> {
  if (!userId || userId.length > 128) throw new Error("Invalid user ID.");

  await db.batch([
    db.prepare("DELETE FROM user_progress WHERE user_id=?").bind(userId),
    db.prepare(
      "INSERT INTO user_progress(user_id,lesson_id,best_score,completed_count,last_completed_at) " +
      "SELECT user_id,lesson_id,MAX(score),COUNT(*),MAX(occurred_at) " +
      "FROM progress_events WHERE user_id=? GROUP BY user_id,lesson_id"
    ).bind(userId)
  ]);

  const projection = await db.prepare(
    "SELECT COUNT(*) AS lesson_count,COALESCE(SUM(completed_count),0) AS completed_count " +
    "FROM user_progress WHERE user_id=?"
  ).bind(userId).first<{ lesson_count: number; completed_count: number }>();

  return {
    userId,
    lessonCount: projection?.lesson_count ?? 0,
    completedCount: projection?.completed_count ?? 0
  };
}
