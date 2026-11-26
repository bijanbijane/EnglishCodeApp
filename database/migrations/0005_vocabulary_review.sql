PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vocabulary_items (
  id TEXT PRIMARY KEY,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  lemma TEXT NOT NULL,
  normalized_lemma TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  pronunciation TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  content_version INTEGER NOT NULL DEFAULT 1 CHECK (content_version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_language,target_language,normalized_lemma)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_items_pair_status
  ON vocabulary_items(source_language,target_language,status,normalized_lemma);

CREATE TABLE IF NOT EXISTS user_vocabulary (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'learning' CHECK (state IN ('learning','review','mastered','suspended')),
  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  ease_factor REAL NOT NULL DEFAULT 2.5 CHECK (ease_factor BETWEEN 1.3 AND 3.0),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_reviewed_at TEXT,
  scheduler_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vocabulary_due
  ON user_vocabulary(user_id,state,due_at);

CREATE TABLE IF NOT EXISTS vocabulary_review_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 3),
  scheduler_version INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL,
  previous_due_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL CHECK (interval_days >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_review_history
  ON vocabulary_review_events(user_id,item_id,reviewed_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_vocabulary_review_events_no_update
BEFORE UPDATE ON vocabulary_review_events
BEGIN
  SELECT RAISE(ABORT,'vocabulary review events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_vocabulary_review_events_no_delete
BEFORE DELETE ON vocabulary_review_events
BEGIN
  SELECT RAISE(ABORT,'vocabulary review events cannot be deleted');
END;
