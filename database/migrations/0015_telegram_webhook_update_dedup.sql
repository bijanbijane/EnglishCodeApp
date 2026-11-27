-- Persist Telegram update claims so Telegram retries cannot send duplicate bot replies.
CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
  update_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_status_updated
  ON telegram_webhook_updates(status, updated_at);
