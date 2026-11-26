import { describe, expect, it, vi } from "vitest";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { app } from "../src/app";

const token = "x".repeat(43);

function contentDb(options: {
  userId?: string;
  role?: boolean;
  version?: { id: string; status: string; created_by_user_id: string | null } | null;
  review?: { id: string; author_user_id: string; status: string; lesson_version_id?: string; lesson_id?: string; version?: number } | null;
  nextStatus?: { status: string; reviewed_by_user_id: string | null } | null;
} = {}) {
  const sqls: string[] = [];
  const batches: string[][] = [];
  const userId = options.userId ?? "author-1";
  const db = {
    prepare(sql: string) {
      sqls.push(sql);
      const statement: any = {
        bind(..._values: unknown[]) { return statement; },
        async first<T>() {
          if (sql.includes("FROM sessions INNER JOIN users")) {
            return { id: userId, telegram_user_id: "tg-1", display_name: "Test", token_hash: "hash" } as T;
          }
          if (sql.includes("FROM user_roles")) return options.role === false ? null : ({ allowed: 1 } as T);
          if (sql.includes("FROM lesson_versions WHERE id=? AND lesson_id=?")) return (options.version ?? null) as T | null;
          if (sql.includes("SELECT id,author_user_id,status FROM content_review_requests")) return (options.review ?? null) as T | null;
          if (sql.includes("SELECT status,reviewed_by_user_id FROM content_review_requests")) return (options.nextStatus ?? null) as T | null;
          if (sql.includes("FROM content_review_requests") && sql.includes("INNER JOIN lesson_versions")) return (options.review ?? null) as T | null;
          if (sql.includes("FROM lessons l")) return { title: "Lesson", level: "A1", position: 1 } as T;
          if (sql.includes("MAX(version)")) return { version: 2 } as T;
          if (sql.includes("FROM content_review_requests WHERE id=?")) return (options.review ?? null) as T | null;
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM questions WHERE lesson_id")) {
            return { results: [{ id: "question-1" }, { id: "question-2" }] as T[] };
          }
          return { results: [] as T[] };
        },
        async run() { return { success: true, meta: { changes: 1 } }; }
      };
      return statement as D1PreparedStatement;
    },
    async batch(statements: D1PreparedStatement[]) {
      batches.push(statements.map((statement: any) => sqls[sqls.length - 1] ?? ""));
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    }
  } as unknown as D1Database;
  return { db, sqls, batches };
}

describe("admin content workflow", () => {
  it("creates a draft version and writes the audit statement in the same D1 batch", async () => {
    const fake = contentDb({ role: true });
    const response = await app.request("/api/v1/admin/content/lessons/lesson-1/versions", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Lesson v2",
        level: "A2",
        questions: [
          { sourceQuestionId: "question-1", prompt: "Pick A", options: ["A", "B"], answerKey: "A", weight: 2 },
          { sourceQuestionId: "question-2", prompt: "Pick B", options: ["A", "B"], answerKey: "B", weight: 1 }
        ]
      })
    }, { DB: fake.db });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { version: 2, status: "draft", questionCount: 2 } });
    expect(fake.sqls.some((sql) => sql.includes("INSERT INTO lesson_versions"))).toBe(true);
    expect(fake.sqls.some((sql) => sql.includes("INSERT INTO question_versions"))).toBe(true);
    expect(fake.sqls.some((sql) => sql.includes("INSERT INTO admin_audit_events"))).toBe(true);
  });

  it("prevents an author from approving their own content even if they also hold reviewer role", async () => {
    const fake = contentDb({
      userId: "author-1",
      role: true,
      review: { id: "review-1", author_user_id: "author-1", status: "pending" }
    });
    const response = await app.request("/api/v1/admin/content/reviews/review-1/decision", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" })
    }, { DB: fake.db });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "SELF_REVIEW_FORBIDDEN" } });
    expect(fake.batches).toHaveLength(0);
  });

  it("writes reviewer decision, event and conditional audit in one D1 batch", async () => {
    const fake = contentDb({
      userId: "reviewer-1",
      role: true,
      review: { id: "review-1", author_user_id: "author-1", status: "pending" },
      nextStatus: { status: "approved", reviewed_by_user_id: "reviewer-1" }
    });
    const response = await app.request("/api/v1/admin/content/reviews/review-1/decision", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", reasonCode: "approved" })
    }, { DB: fake.db });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "approved" } });
    expect(fake.sqls.some((sql) => sql.includes("UPDATE content_review_requests"))).toBe(true);
    expect(fake.sqls.some((sql) => sql.includes("INSERT INTO content_review_events"))).toBe(true);
    expect(fake.sqls.some((sql) => sql.includes("INSERT INTO admin_audit_events") && sql.includes("WHERE changes()=1"))).toBe(true);
  });

  it("does not publish a review request that has not been approved", async () => {
    const fake = contentDb({
      userId: "admin-1",
      role: true,
      review: {
        id: "review-1", author_user_id: "author-1", status: "pending",
        lesson_version_id: "version-2", lesson_id: "lesson-1", version: 2
      }
    });
    const response = await app.request("/api/v1/admin/content/reviews/review-1/publish", {
      method: "POST",
      headers: { authorization: "Bearer " + token }
    }, { DB: fake.db });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CONTENT_NOT_APPROVED" } });
    expect(fake.batches).toHaveLength(0);
  });
});
