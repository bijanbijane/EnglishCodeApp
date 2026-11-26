PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','content_author','content_reviewer','support')),
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_active_unique
  ON user_roles(user_id,role) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup
  ON user_roles(user_id,role,revoked_at);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 3 AND 96),
  resource_type TEXT NOT NULL CHECK (length(resource_type) BETWEEN 2 AND 64),
  resource_id TEXT CHECK (resource_id IS NULL OR length(resource_id) <= 128),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 8 AND 128),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created
  ON admin_audit_events(actor_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource_created
  ON admin_audit_events(resource_type,resource_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_events(created_at DESC,id DESC);

CREATE TRIGGER IF NOT EXISTS trg_admin_audit_events_append_only
BEFORE UPDATE ON admin_audit_events
WHEN NOT (
  OLD.actor_user_id IS NOT NULL
  AND NEW.actor_user_id IS NULL
  AND NEW.id=OLD.id
  AND NEW.action=OLD.action
  AND NEW.resource_type=OLD.resource_type
  AND NEW.resource_id IS OLD.resource_id
  AND NEW.request_id=OLD.request_id
  AND NEW.metadata_json=OLD.metadata_json
  AND NEW.created_at=OLD.created_at
)
BEGIN
  SELECT RAISE(ABORT,'admin audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_admin_audit_events_no_delete
BEFORE DELETE ON admin_audit_events
BEGIN
  SELECT RAISE(ABORT,'admin audit events cannot be deleted');
END;
