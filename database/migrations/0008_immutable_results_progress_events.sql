PRAGMA foreign_keys = ON;

-- Immutable facts captured when an assessment is completed.
CREATE TABLE IF NOT EXISTS attempt_results (
  attempt_id TEXT PRIMARY KEY REFERENCES lesson_attempts(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  lesson_version_id TEXT NOT NULL REFERENCES lesson_versions(id) ON DELETE RESTRICT,
  assessment_policy_version_id TEXT NOT NULL REFERENCES assessment_policy_versions(id) ON DELETE RESTRICT,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  earned_weight REAL NOT NULL CHECK (earned_weight >= 0),
  total_weight REAL NOT NULL CHECK (total_weight > 0),
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempt_results_user_completed
  ON attempt_results(user_id,completed_at DESC,attempt_id DESC);
CREATE INDEX IF NOT EXISTS idx_attempt_results_user_lesson
  ON attempt_results(user_id,lesson_id,completed_at DESC);

-- Append-only completion facts are the source for the rebuildable progress projection.
CREATE TABLE IF NOT EXISTS progress_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempt_results(attempt_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type='lesson_completed'),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_events_user_time
  ON progress_events(user_id,occurred_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_progress_events_user_lesson
  ON progress_events(user_id,lesson_id,occurred_at DESC);

-- Backfill immutable facts from already completed attempts and pinned content.
INSERT OR IGNORE INTO attempt_results (
  attempt_id,user_id,lesson_id,lesson_version_id,assessment_policy_version_id,
  score,earned_weight,total_weight,correct_count,question_count,completed_at
)
SELECT a.id,a.user_id,a.lesson_id,a.lesson_version_id,a.assessment_policy_version_id,
  a.score,
  COALESCE((SELECT SUM(qv.weight) FROM attempt_answers aa
    INNER JOIN question_versions qv ON qv.source_question_id=aa.question_id
      AND qv.lesson_version_id=a.lesson_version_id
    WHERE aa.attempt_id=a.id AND aa.is_correct=1),0),
  (SELECT SUM(weight) FROM question_versions WHERE lesson_version_id=a.lesson_version_id),
  (SELECT COUNT(*) FROM attempt_answers aa
    INNER JOIN question_versions qv ON qv.source_question_id=aa.question_id
      AND qv.lesson_version_id=a.lesson_version_id
    WHERE aa.attempt_id=a.id AND aa.is_correct=1),
  (SELECT COUNT(*) FROM question_versions WHERE lesson_version_id=a.lesson_version_id),
  a.completed_at
FROM lesson_attempts a
WHERE a.status='completed' AND a.completed_at IS NOT NULL
  AND a.lesson_version_id IS NOT NULL
  AND a.assessment_policy_version_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM question_versions qv WHERE qv.lesson_version_id=a.lesson_version_id);

INSERT OR IGNORE INTO progress_events
  (id,user_id,lesson_id,attempt_id,event_type,score,occurred_at)
SELECT 'lesson-completed:' || attempt_id,user_id,lesson_id,attempt_id,
  'lesson_completed',score,completed_at
FROM attempt_results;

-- Rebuild the materialized progress view from immutable events.
DELETE FROM user_progress;
INSERT INTO user_progress(user_id,lesson_id,best_score,completed_count,last_completed_at)
SELECT user_id,lesson_id,MAX(score),COUNT(*),MAX(occurred_at)
FROM progress_events
GROUP BY user_id,lesson_id;

CREATE TRIGGER IF NOT EXISTS trg_attempt_results_no_update
BEFORE UPDATE ON attempt_results
BEGIN
  SELECT RAISE(ABORT,'attempt result facts are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_attempt_results_no_delete
BEFORE DELETE ON attempt_results
BEGIN
  SELECT RAISE(ABORT,'attempt result facts cannot be deleted');
END;
CREATE TRIGGER IF NOT EXISTS trg_progress_events_no_update
BEFORE UPDATE ON progress_events
BEGIN
  SELECT RAISE(ABORT,'progress events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_progress_events_no_delete
BEFORE DELETE ON progress_events
BEGIN
  SELECT RAISE(ABORT,'progress events cannot be deleted');
END;
