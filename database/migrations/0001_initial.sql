PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS external_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_user
  ON external_identities(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry
  ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  source_language TEXT NOT NULL DEFAULT 'fa',
  target_language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lessons_published_order
  ON lessons(status, course_id, position);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'multiple_choice',
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_key TEXT NOT NULL,
  explanation TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_lesson_order
  ON questions(lesson_id, position);

CREATE TABLE IF NOT EXISTS lesson_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK(status IN ('in_progress', 'completed', 'abandoned')),
  score INTEGER CHECK(score IS NULL OR (score >= 0 AND score <= 100)),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_started
  ON lesson_attempts(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  submitted_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
  answered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score BETWEEN 0 AND 100),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_count >= 0),
  last_completed_at TEXT,
  PRIMARY KEY(user_id, lesson_id)
);
