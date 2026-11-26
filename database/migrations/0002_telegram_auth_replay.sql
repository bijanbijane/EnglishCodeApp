CREATE TABLE IF NOT EXISTS telegram_auth_replays (
  init_data_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_replays_expires ON telegram_auth_replays(expires_at);