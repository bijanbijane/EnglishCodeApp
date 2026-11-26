-- Support the authenticated progress feed and author draft history without temp sorting.
CREATE INDEX IF NOT EXISTS idx_user_progress_recent
  ON user_progress(user_id, last_completed_at DESC, lesson_id ASC);

CREATE INDEX IF NOT EXISTS idx_lesson_versions_author_history
  ON lesson_versions(lesson_id, created_by_user_id, version DESC);
