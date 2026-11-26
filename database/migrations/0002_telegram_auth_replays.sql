CREATE TABLE IF NOT EXISTS telegram_auth_replays (
  fingerprint TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_telegram_auth_replays_expiry
  ON telegram_auth_replays(expires_at);
