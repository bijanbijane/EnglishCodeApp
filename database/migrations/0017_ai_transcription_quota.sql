-- Store quota reservations only. Raw learner audio is never persisted.
CREATE TABLE IF NOT EXISTS ai_transcription_reservations (
  id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_transcription_reservations_day_user
  ON ai_transcription_reservations(day_utc, user_id);
