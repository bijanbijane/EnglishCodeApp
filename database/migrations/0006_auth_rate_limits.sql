CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated
  ON auth_rate_limits(updated_at);
