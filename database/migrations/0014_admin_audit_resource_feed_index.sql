-- Preserve descending audit-feed order when filtering by resource type.
-- The existing resource index includes resource_id between resource_type and created_at,
-- so it cannot satisfy this ordered feed without a temporary sort.
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource_created_id
  ON admin_audit_events(resource_type, created_at DESC, id DESC);
