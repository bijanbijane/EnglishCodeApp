import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { app } from "../src/app";
import { decodeAdminPageCursor, encodeAdminPageCursor } from "../src/modules/admin/pagination";

const bearer = "x".repeat(43);
const reviewRows = [
  {
    review_request_id: "review-1", status: "pending", submitted_at: "2026-11-26 10:00:00",
    reviewed_at: null, reason_code: null, lesson_version_id: "version-1",
    version: 1, title: "Lesson 1", level: "A1", lesson_id: "lesson-1"
  },
  {
    review_request_id: "review-2", status: "pending", submitted_at: "2026-11-26 10:00:00",
    reviewed_at: null, reason_code: null, lesson_version_id: "version-2",
    version: 2, title: "Lesson 2", level: "A2", lesson_id: "lesson-1"
  }
];

function makeDatabase(roles: string[] = ["content_reviewer"]) {
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
          if (sql.includes("FROM content_review_requests r INNER JOIN lesson_versions")) {
            const rows = statement.values[4] === "review-1" ? [reviewRows[1]] : reviewRows;
            return { results: rows as T[] };
          }
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

describe("admin review queue pagination", () => {
  it("returns a stable timestamp/id cursor and bounds the page", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/content/reviews?status=pending&limit=1",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ review_request_id: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].review_request_id).toBe("review-1");
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-26 10:00:00", "review-1"));
    const query = fake.calls.find((call) => call.sql.includes("FROM content_review_requests r INNER JOIN lesson_versions"));
    expect(query?.sql).toContain("ORDER BY r.submitted_at ASC,r.id ASC");
    expect(query?.values).toEqual(["pending", null, null, null, null, 2]);
  });

  it("continues after the exact timestamp/id pair without repeating the first row", async () => {
    const fake = makeDatabase();
    const cursor = encodeAdminPageCursor("2026-11-26 10:00:00", "review-1");
    const response = await app.request(
      `/api/v1/admin/content/reviews?status=pending&limit=1&cursor=${encodeURIComponent(cursor)}`,
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ review_request_id: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.review_request_id)).toEqual(["review-2"]);
    expect(body.meta.nextCursor).toBeNull();
    const query = fake.calls.find((call) => call.sql.includes("FROM content_review_requests r INNER JOIN lesson_versions"));
    expect(query?.values).toEqual([
      "pending", "2026-11-26 10:00:00", "2026-11-26 10:00:00",
      "2026-11-26 10:00:00", "review-1", 2
    ]);
  });

  it("rejects malformed cursors before reading the review queue", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/content/reviews?cursor=invalid",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(400);
    expect(fake.calls.some((call) => call.sql.includes("FROM content_review_requests r INNER JOIN lesson_versions"))).toBe(false);
  });

  it("denies queue access without the reviewer role", async () => {
    const fake = makeDatabase(["admin"]);
    const response = await app.request(
      "/api/v1/admin/content/reviews",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(403);
    expect(fake.calls.some((call) => call.sql.includes("FROM content_review_requests r INNER JOIN lesson_versions"))).toBe(false);
  });

  it("round-trips valid cursors and rejects invalid identifiers", () => {
    const cursor = encodeAdminPageCursor("2026-11-26 10:00:00", "review-1");
    expect(decodeAdminPageCursor(cursor)).toEqual({ timestamp: "2026-11-26 10:00:00", id: "review-1" });
    expect(decodeAdminPageCursor("bad~invalid id")).toBeNull();
  });
});
