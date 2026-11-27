import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import app from "../src/app";
import { encodeAdminPageCursor } from "../src/modules/admin/pagination";

const bearer = "x".repeat(43);
const versionRows = [
  {
    id: "version-2", version: 2, title: "Lesson v2", level: "A2",
    status: "draft", created_at: "2026-11-27 10:00:00", review_status: null
  },
  {
    id: "version-1", version: 1, title: "Lesson v1", level: "A1",
    status: "archived", created_at: "2026-11-26 10:00:00", review_status: null
  }
];

function makeDatabase(roles: string[] = ["content_author"]) {
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
          if (sql.includes("FROM lesson_versions lv LEFT JOIN content_review_requests")) {
            const rows = statement.values[5] === "version-1" ? [versionRows[1]] : versionRows;
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

describe("author lesson version history pagination", () => {
  it("returns a bounded first page with a stable created_at/id cursor", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions?limit=1",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ id: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.id)).toEqual(["version-2"]);
    expect(body.meta.nextCursor).toBe(encodeAdminPageCursor("2026-11-27 10:00:00", "version-2"));
    const query = fake.calls.find((call) => call.sql.includes("FROM lesson_versions lv LEFT JOIN content_review_requests"));
    expect(query?.sql).toContain("ORDER BY lv.created_at DESC,lv.id DESC");
    expect(query?.values).toEqual(["lesson-1", "user-1", null, null, null, null, 2]);
  });

  it("continues after the exact created_at/id pair without repeating a version", async () => {
    const fake = makeDatabase();
    const cursor = encodeAdminPageCursor("2026-11-27 10:00:00", "version-2");
    const response = await app.request(
      `/api/v1/admin/content/lessons/lesson-1/versions?limit=1&cursor=${encodeURIComponent(cursor)}`,
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    const body = await response.json() as {
      data: Array<{ id: string }>;
      meta: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.id)).toEqual(["version-1"]);
    expect(body.meta.nextCursor).toBeNull();
    const query = fake.calls.find((call) => call.sql.includes("FROM lesson_versions lv LEFT JOIN content_review_requests"));
    expect(query?.values).toEqual([
      "lesson-1", "user-1", "2026-11-27 10:00:00",
      "2026-11-27 10:00:00", "2026-11-27 10:00:00", "version-2", 2
    ]);
  });

  it("rejects malformed cursors and invalid page sizes before querying version rows", async () => {
    const fake = makeDatabase();
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions?limit=51&cursor=invalid",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(400);
    expect(fake.calls.some((call) => call.sql.includes("FROM lesson_versions lv LEFT JOIN content_review_requests"))).toBe(false);
  });

  it("denies access without the content-author role", async () => {
    const fake = makeDatabase(["content_reviewer"]);
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions",
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: fake.db }
    );
    expect(response.status).toBe(403);
    expect(fake.calls.some((call) => call.sql.includes("FROM lesson_versions lv LEFT JOIN content_review_requests"))).toBe(false);
  });
});
