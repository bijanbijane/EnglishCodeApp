import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";
import { encodeAdminPageCursor } from "../src/modules/admin/pagination";

const auditRows = [
  {
    id: "audit-2",
    actor_user_id: "admin-1",
    action: "content.version.published",
    resource_type: "lesson_version",
    resource_id: "version-2",
    request_id: "request-00000002",
    metadata_json: '{"status":"published","version":2}',
    created_at: "2026-11-26T12:00:00.000Z",
  },
  {
    id: "audit-1",
    actor_user_id: "admin-1",
    action: "content.version.published",
    resource_type: "lesson_version",
    resource_id: "version-1",
    request_id: "request-00000001",
    metadata_json: '{"status":"published","version":1}',
    created_at: "2026-11-26T11:00:00.000Z",
  },
];

function makeDb(roleGranted = true) {
  const calls: string[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({
      first: vi.fn().mockImplementation(async () => {
        if (sql.includes("FROM sessions")) return { id: "session-1", user_id: "admin-1" };
        if (sql.includes("FROM user_roles")) return roleGranted ? { allowed: 1 } : null;
        return null;
      }),
      all: vi.fn().mockResolvedValue({
        results: sql.includes("FROM admin_audit_events") ? auditRows : [],
      }),
    })),
  }));
  return { DB: { prepare } as never, calls, prepare };
}

describe("admin audit read API", () => {
  it("denies the audit feed without an active admin role", async () => {
    const fake = makeDb(false);
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/audit",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(403);
    expect(fake.prepare.mock.calls.some(([sql]) => sql.includes("FROM admin_audit_events"))).toBe(false);
  });

  it("returns a filtered audit page with a deterministic keyset cursor", async () => {
    const fake = makeDb(true);
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/audit?limit=1&action=content.version.published&resourceType=lesson_version",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fake.DB } as never,
    );
    const body = await response.json() as {
      data: Array<{ id: string; metadata: Record<string, unknown> }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "audit-2",
      metadata: { status: "published", version: 2 },
    });
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-26T12:00:00.000Z", "audit-2"));
  });

  it("rejects malformed cursors before querying the audit table", async () => {
    const fake = makeDb(true);
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/audit?cursor=not-a-valid-cursor",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(400);
    expect(fake.prepare.mock.calls.some(([sql]) => sql.includes("FROM admin_audit_events"))).toBe(false);
  });
});
