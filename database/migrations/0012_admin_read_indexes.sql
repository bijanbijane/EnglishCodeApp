-- Indexes for bounded, deterministic admin read paths.
-- Existing migrations remain immutable; this is an additive migration.
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_id
  ON admin_audit_events(created_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_content_review_status_submitted_id
  ON content_review_requests(status,submitted_at ASC,id ASC);
