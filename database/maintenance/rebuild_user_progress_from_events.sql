-- Rebuild the derived user_progress projection from immutable completion facts.
-- Run only as an explicit maintenance operation after migration 0016 is applied.
-- This script is transactional; it does not alter or delete learning_events.
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
