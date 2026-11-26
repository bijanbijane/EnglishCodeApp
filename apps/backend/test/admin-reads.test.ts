import { describe, expect, it } from "vitest";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { app } from "../src/app";
import { decodeAdminPageCursor, encodeAdminPageCursor } from "../src/modules/admin/pagination";

const token = "x".repeat(43);
const auditRows = [
  {
    id: "audit-2", actor_user_id: "admin-1", action: "content.version.published",
    resource_type: "lesson_version", resource_id: "version-2", request_id: "request-00000002",
    metadata_json: '{"status":"published","version":2}', created_at: "2026-11-26 12:00:00"
  },
  {
    id: "audit-1", actor_user_id: "admin-1", action: "content.version.published",
    resource_type: "lesson_version", resource_id: "version-1", request_id: "request-00000001",
    metadata_json: '{"status":"published","version":1}', created_at: "2026-11-26 11:00:00"
  }
];
const reviewRows = [
  {
    review_request_id: "review-2", status: "pending", submitted_at: "2026-11-26 10:00:00",
    reviewed_at: null, reason_code: null, lesson_version_id: "version-2",
    version: 2, title: "Lesson 2", level: "A2", lesson_id: "lesson-1"
  },
  {
    review_request_id: "review-3", status: "pending", submitted_at: "2026-11-26 11:00:00",
    reviewed_at: null, reason_code: null, lesson_version_id: "version-3",
    version: 3, title: "Lesson 3", level: "B1", lesson_id: "lesson-1"
  }
];

function readDatabase(options: { roles?: string[] } = {}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const statement: any = {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          statement.values = values;
          calls.push({ sql, values });
          return statement;
        },
        async first<T>() {
          if (sql.includes("FROM sessions INNER JOIN users")) {
            return {
              id: "user-1", telegram_user_id: "telegram-1",
              display_name: "Test", token_hash: "hash"
            } as T;
          }
          if (sql.includes("FROM user_roles")) {
            return options.roles?.includes(String(statement.values[1])) ? ({ allowed: 1 } as T) : null;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM admin_audit_events")) return { results: auditRows as T[] };
          if (sql.includes("FROM content_review_requests r INNER JOIN lesson_versions")) {
            return { results: reviewRows as T[] };
          }
          return { results: [] as T[] };
        },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
      return statement as D1PreparedStatement;
    },
    async batch() { return []; }
  } as unknown as D1Database;
  return { db, calls };
}

const headers = { authorization: "Bearer " + token };

describe("admin read APIs", () => {
  it("denies the audit feed to users without the admin role", async () => {
    const fake = readDatabase({ roles: ["content_reviewer"] });
    const response = await app.request("/api/v1/admin/audit", { headers }, { DB: fake.db });

    expect(response.status).toBe(403);
    expect(fake.calls.some((call) => call.sql.includes("FROM admin_audit_events"))).toBe(false);
  });

  it("returns filtered audit events with a stable keyset cursor to admins", async () => {
    const fake = readDatabase({ roles: ["admin"] });
    const response = await app.request(
      "/api/v1/admin/audit?limit=1&action=content.version.published&resourceType=lesson_version",
      { headers },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ id: string; metadata: Record<string, unknown> }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "audit-2",
      metadata: { status: "published", version: 2 }
    });
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-26 12:00:00", "audit-2"));
    const query = fake.calls.find((call) => call.sql.includes("FROM admin_audit_events"));
    expect(query?.sql).toContain("ORDER BY created_at DESC,id DESC");
    expect(query?.values).toEqual([
      "content.version.published", "content.version.published",
      "lesson_version", "lesson_version",
      null, null, null, null, 2
    ]);
  });

  it("rejects malformed audit cursors before querying audit rows", async () => {
    const fake = readDatabase({ roles: ["admin"] });
    const response = await app.request("/api/v1/admin/audit?cursor=not-a-valid-cursor", { headers }, { DB: fake.db });

    expect(response.status).toBe(400);
    expect(fake.calls.some((call) => call.sql.includes("FROM admin_audit_events"))).toBe(false);
  });

  it("paginates the review queue with a deterministic timestamp/id tie-breaker", async () => {
    const fake = readDatabase({ roles: ["content_reviewer"] });
    const response = await app.request(
      "/api/v1/admin/content/reviews?status=pending&limit=1",
      { headers },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ review_request_id: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].review_request_id).toBe("review-2");
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-26 10:00:00", "review-2"));
    const query = fake.calls.find((call) => call.sql.includes("FROM content_review_requests r INNER JOIN lesson_versions"));
    expect(query?.sql).toContain("ORDER BY r.submitted_at ASC,r.id ASC");
    expect(query?.values).toEqual(["pending", null, null, null, null, 2]);
  });

  it("round-trips only valid cursor timestamps and identifiers", () => {
    const cursor = encodeAdminPageCursor("2026-11-26 10:00:00", "review-2");
    expect(decodeAdminPageCursor(cursor)).toEqual({
      timestamp: "2026-11-26 10:00:00",
      id: "review-2"
    });
    expect(decodeAdminPageCursor("bad~invalid id")).toBeNull();
    expect(decodeAdminPageCursor("bad")).toBeNull();
  });
});
