PRAGMA foreign_keys = ON;

-- Provider-neutral identity map. Telegram IDs remain in users temporarily for
-- compatibility; this table becomes the canonical external identity lookup.
CREATE TABLE IF NOT EXISTS user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 2 AND 32),
  provider_subject TEXT NOT NULL CHECK (length(provider_subject) BETWEEN 1 AND 191),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_subject),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

-- Backfill existing Telegram-linked users without changing their internal IDs.
INSERT OR IGNORE INTO user_identities (id,user_id,provider,provider_subject)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
       substr(hex(randomblob(2)),2) || '-' ||
       substr('89ab',abs(random()) % 4 + 1,1) || substr(hex(randomblob(2)),2) || '-' ||
       hex(randomblob(6))),
       id,'telegram',telegram_user_id
FROM users
WHERE telegram_user_id IS NOT NULL AND length(telegram_user_id) > 0;
