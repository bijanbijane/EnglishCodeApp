import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireSession } from "../auth/middleware";
import { requireRole } from "./authorization";
import { decodeAdminPageCursor, encodeAdminPageCursor } from "./pagination";

export const adminReadRoutes = new Hono<AppEnv>();

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_id: string;
  metadata_json: string;
  created_at: string;
}

function parseMetadata(value: string): Record<string, string | number | boolean | null> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | number | boolean | null>;
    }
  } catch {
    // Malformed legacy metadata must not make the audit feed unavailable.
  }
  return {};
}

adminReadRoutes.get("/audit", requireSession, requireRole("admin"), async (c) => {
  const limit = Number(c.req.query("limit") ?? 25);
  const action = c.req.query("action");
  const resourceType = c.req.query("resourceType");
  const rawCursor = c.req.query("cursor");
  const cursor = rawCursor ? decodeAdminPageCursor(rawCursor) : null;

  if (
    !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    (action !== undefined && !/^[A-Za-z0-9._-]{3,96}$/.test(action)) ||
    (resourceType !== undefined && !/^[A-Za-z0-9_-]{2,64}$/.test(resourceType)) ||
    (rawCursor !== undefined && !cursor)
  ) {
    return c.json(errorBody("INVALID_AUDIT_QUERY", "Audit filters, limit or cursor are invalid.", c.get("requestId")), 400);
  }

  const rows = await c.env.DB.prepare(
    "SELECT id,actor_user_id,action,resource_type,resource_id,request_id,metadata_json,created_at " +
    "FROM admin_audit_events " +
    "WHERE (? IS NULL OR action=?) " +
    "AND (? IS NULL OR resource_type=?) " +
    "AND (? IS NULL OR (created_at<? OR (created_at=? AND id<?))) " +
    "ORDER BY created_at DESC,id DESC LIMIT ?",
  ).bind(
    action ?? null, action ?? null,
    resourceType ?? null, resourceType ?? null,
    cursor?.timestamp ?? null,
    cursor?.timestamp ?? null, cursor?.timestamp ?? null, cursor?.id ?? null,
    limit + 1,
  ).all<AuditRow>();

  const items = rows.results ?? [];
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];

  return c.json({
    data: page.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      requestId: row.request_id,
      metadata: parseMetadata(row.metadata_json),
      createdAt: row.created_at,
    })),
    meta: {
      nextCursor: hasMore && last ? encodeAdminPageCursor(last.created_at, last.id) : null,
    },
  });
});

export default adminReadRoutes;
