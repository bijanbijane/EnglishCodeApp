-- Read paths for admin audit history and reviewer queues.
-- This migration adds indexes only; it does not change existing data.
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_id
  ON admin_audit_events(created_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_content_review_status_submitted_id
  ON content_review_requests(status,submitted_at ASC,id ASC);
