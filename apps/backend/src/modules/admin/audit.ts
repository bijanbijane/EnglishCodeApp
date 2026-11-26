import type { D1Database } from "../../env";

const SAFE_METADATA_KEYS = new Set(["version", "reasonCode", "status", "count", "source", "policyVersion"]);

export interface AdminAuditEventInput {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persist a minimal audit fact. Free text, credentials, request bodies and user
 * submissions are intentionally not accepted in metadata.
 */
export async function writeAdminAuditEvent(db: D1Database, input: AdminAuditEventInput): Promise<void> {
  if (!input.actorUserId || input.action.length < 3 || input.action.length > 96 ||
      input.resourceType.length < 2 || input.resourceType.length > 64 ||
      (input.resourceId != null && input.resourceId.length > 128) ||
      input.requestId.length < 8 || input.requestId.length > 128) {
    throw new Error("Invalid admin audit event.");
  }

  const safeMetadata: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (value === null || typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && value.length <= 128)) {
      safeMetadata[key] = value;
    }
  }
  const metadataJson = JSON.stringify(safeMetadata);
  if (metadataJson.length > 1024) throw new Error("Audit metadata is too large.");

  await db.prepare(
    "INSERT INTO admin_audit_events (id,actor_user_id,action,resource_type,resource_id,request_id,metadata_json) " +
    "VALUES (?,?,?,?,?,?,?)"
  ).bind(
    crypto.randomUUID(), input.actorUserId, input.action, input.resourceType,
    input.resourceId ?? null, input.requestId, metadataJson
  ).run();
}
