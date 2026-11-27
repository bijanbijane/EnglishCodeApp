-- Rebuild the derived user_progress projection from immutable completion facts.
-- SQLite maintenance/test script only. It is executed by verify_backend_sqlite.py.
-- Do not pass this file to Wrangler D1: explicit BEGIN IMMEDIATE/COMMIT is not
-- the supported D1 transaction interface. A D1 rebuild procedure remains deferred.
-- Run only after migration 0016 has been applied. This script never alters learning_events.
BEGIN IMMEDIATE;

DELETE FROM user_progress;

INSERT INTO user_progress
  (user_id, lesson_id, best_score, completed_count, last_completed_at)
SELECT
  user_id,
  lesson_id,
  MAX(score),
  COUNT(*),
  MAX(occurred_at)
FROM learning_events
WHERE event_type = 'lesson_attempt_completed'
GROUP BY user_id, lesson_id;

COMMIT;
