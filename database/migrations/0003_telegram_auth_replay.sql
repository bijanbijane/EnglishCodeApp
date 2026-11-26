PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS telegram_auth_replays (
  init_data_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_replays_expiry
  ON telegram_auth_replays(expires_at);