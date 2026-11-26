PRAGMA foreign_keys = ON;

ALTER TABLE lesson_versions
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS content_review_requests (
  id TEXT PRIMARY KEY,
  lesson_version_id TEXT NOT NULL UNIQUE REFERENCES lesson_versions(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','published')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 3 AND 64),
  CHECK (
    (status='pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
    OR
    (status IN ('approved','rejected','published') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_content_review_status_submitted
  ON content_review_requests(status,submitted_at DESC);

CREATE TABLE IF NOT EXISTS content_review_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES content_review_requests(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted','approved','rejected','published')),
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 3 AND 64),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_review_events_request_time
  ON content_review_events(request_id,occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_content_review_events_no_update
BEFORE UPDATE ON content_review_events
BEGIN
  SELECT RAISE(ABORT,'content review events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_review_events_no_delete
BEFORE DELETE ON content_review_events
BEGIN
  SELECT RAISE(ABORT,'content review events cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_review_no_self_approval
BEFORE UPDATE OF status ON content_review_requests
WHEN NEW.status IN ('approved','rejected')
 AND NEW.author_user_id=NEW.reviewed_by_user_id
BEGIN
  SELECT RAISE(ABORT,'content author cannot review own submission');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_review_identity_immutable
BEFORE UPDATE OF lesson_version_id,author_user_id ON content_review_requests
BEGIN
  SELECT RAISE(ABORT,'content review identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_review_state_machine
BEFORE UPDATE OF status ON content_review_requests
WHEN NOT (
  (OLD.status='pending' AND NEW.status IN ('approved','rejected'))
  OR (OLD.status='approved' AND NEW.status='published')
)
BEGIN
  SELECT RAISE(ABORT,'invalid content review state transition');
END;
