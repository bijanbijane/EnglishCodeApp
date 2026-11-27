PRAGMA foreign_keys = ON;

-- A completed attempt is an immutable learning fact. The attempt ID is the
-- aggregate key, making completion-event insertion idempotent.
CREATE TABLE IF NOT EXISTS learning_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('lesson_attempt_completed')),
  aggregate_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(event_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_lesson_time
  ON learning_events(user_id, lesson_id, occurred_at DESC, aggregate_id DESC);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_time
  ON learning_events(user_id, occurred_at DESC, aggregate_id DESC);

-- Backfill completed attempts before switching the write path. The event ID
-- and aggregate uniqueness make this safe to rerun.
INSERT OR IGNORE INTO learning_events
  (event_id, user_id, event_type, aggregate_id, lesson_id, score, occurred_at, payload_json)
SELECT
  'attempt-completed:' || a.id,
  a.user_id,
  'lesson_attempt_completed',
  a.id,
  a.lesson_id,
  a.score,
  a.completed_at,
  json_object(
    'attemptId', a.id,
    'lessonId', a.lesson_id,
    'lessonVersion', a.lesson_version,
    'lessonVersionId', a.lesson_version_id,
    'assessmentPolicyVersionId', a.assessment_policy_version_id,
    'score', a.score,
    'completedAt', a.completed_at
  )
FROM lesson_attempts a
WHERE a.status = 'completed'
  AND a.completed_at IS NOT NULL
  AND a.score IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_learning_events_no_update
BEFORE UPDATE ON learning_events
BEGIN
  SELECT RAISE(ABORT, 'learning events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_events_no_delete
BEFORE DELETE ON learning_events
BEGIN
  SELECT RAISE(ABORT, 'learning events cannot be deleted directly');
END;
