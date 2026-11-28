-- Store quota reservations only. Raw learner audio is never persisted.
CREATE TABLE IF NOT EXISTS ai_transcription_reservations (
  id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_transcription_reservations_day_user
  ON ai_transcription_reservations(day_utc, user_id);

-- Quota reservations contain internal user IDs for per-user accounting.
-- Remove those rows immediately when an account is deleted; the '*' global
-- reservations are intentionally retained until their normal seven-day cleanup.
CREATE TRIGGER IF NOT EXISTS trg_ai_transcription_reservations_user_delete
AFTER DELETE ON users
BEGIN
  DELETE FROM ai_transcription_reservations WHERE user_id = OLD.id;
END;
