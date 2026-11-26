import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { app } from "../src/app";
import { encodeAdminPageCursor } from "../src/modules/admin/pagination";

const bearer = "x".repeat(43);
const events = [
  {
    id: "event-2", actor_user_id: "admin-1", action: "content.publish",
    resource_type: "lesson", resource_id: "lesson-2", request_id: "request-0002",
    metadata_json: '{"status":"published"}', created_at: "2026-11-26 11:00:00"
  },
  {
    id: "event-1", actor_user_id: "admin-1", action: "content.review.approved",
    resource_type: "content_review", resource_id: "review-1", request_id: "request-0001",
    metadata_json: '{"status":"approved"}', created_at: "2026-11-26 10:00:00"
  }
];

function makeDatabase(roles: string[] = ["admin"]) {
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
          if (sql.includes("FROM sessions")) return { id: "session-1", user_id: "user-1" } as T;
          if (sql.includes("FROM user_roles")) {
            return roles.includes(String(statement.values[1])) ? ({ allowed: 1 } as T) : null;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM admin_audit_events")) return { results: events as T[] };
          return { results: [] as T[] };
        },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
      return statement;
    },
    async batch() { return []; }
  };
  return { db: db as unknown as Env["DB"], calls };
}

describe("admin audit event feed", () => {
  it("returns bounded events in deterministic descending order with a next cursor", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/audit/events?limit=1",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ id: string; created_at: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("event-2");
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-26 11:00:00", "event-2"));
    const query = fake.calls.find((call) => call.sql.includes("FROM admin_audit_events"));
    expect(query?.sql).toContain("ORDER BY created_at DESC,id DESC");
    expect(query?.values).toEqual([null, null, null, null, 2]);
  });

  it("uses an exclusive descending cursor for the next page", async () => {
    const fake = makeDatabase();
    const cursor = encodeAdminPageCursor("2026-11-26 11:00:00", "event-2");
    const response = await app.request(
      `/api/v1/admin/audit/events?limit=1&cursor=${encodeURIComponent(cursor)}`,
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const query = fake.calls.find((call) => call.sql.includes("FROM admin_audit_events"));
    expect(response.status).toBe(200);
    expect(query?.values).toEqual([
      "2026-11-26 11:00:00", "2026-11-26 11:00:00",
      "2026-11-26 11:00:00", "event-2", 2
    ]);
  });

  it("rejects invalid limits and malformed cursors without reading audit events", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/audit/events?limit=100&cursor=bad",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(400);
    expect(fake.calls.some((call) => call.sql.includes("FROM admin_audit_events"))).toBe(false);
  });

  it("denies users without the admin role", async () => {
    const fake = makeDatabase(["content_reviewer"]);
    const response = await app.request(
      "/api/v1/admin/audit/events",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(403);
    expect(fake.calls.some((call) => call.sql.includes("FROM admin_audit_events"))).toBe(false);
  });
});
