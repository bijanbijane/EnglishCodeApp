-- Support the learner's newest-first completed-attempt history feed.
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user_completed
  ON lesson_attempts(user_id, completed_at DESC, id DESC)
  WHERE status = 'completed' AND completed_at IS NOT NULL;
