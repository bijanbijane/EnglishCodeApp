import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

const userId = "author-1";

function makeAdminDb(options: {
  role?: boolean;
  version?: { id: string; status: string; created_by_user_id: string | null } | null;
  review?: { id: string; author_user_id: string; status: string; lesson_version_id?: string; lesson_id?: string; version?: number } | null;
} = {}) {
  const sqlCalls: Array<{ sql: string; values: unknown[] }> = [];
  const batch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }]);
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn((...values: unknown[]) => {
      sqlCalls.push({ sql, values });
      return {
        first: vi.fn().mockImplementation(async () => {
          if (sql.includes("FROM sessions")) return { id: "session-1", user_id: userId };
          if (sql.includes("FROM user_roles")) return options.role === false ? null : { allowed: 1 };
          if (sql.includes("FROM lessons l")) return { title: "Published lesson", level: "A1", position: 1 };
          if (sql.includes("MAX(version)")) return { version: 2 };
          if (sql.includes("FROM lesson_versions WHERE id=? AND lesson_id=?")) return options.version ?? null;
          if (sql.includes("FROM content_review_requests") && sql.includes("WHERE id=? LIMIT 1")) return options.review ?? null;
          return null;
        }),
        all: vi.fn().mockResolvedValue({
          results: sql.includes("FROM questions WHERE lesson_id")
            ? [{ id: "question-1" }, { id: "question-2" }]
            : [],
        }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      };
    }),
  }));
  return { DB: { prepare, batch } as never, prepare, batch, sqlCalls };
}

describe("admin RBAC and content workflow", () => {
  it("denies users without the required database role", async () => {
    const fake = makeAdminDb({ role: false });
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ questions: [{ prompt: "Pick", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerKey: "a" }] }),
      },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(403);
    expect(fake.batch).not.toHaveBeenCalled();
  });

  it("creates a draft version with structured option IDs and an audit statement in one batch", async () => {
    const fake = makeAdminDb();
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Lesson v2",
          level: "A2",
          questions: [{
            type: "multiple_choice",
            prompt: "Pick A",
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            answerKey: "a",
            weight: 2,
          }],
        }),
      },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { version: 2, status: "draft", questionCount: 1 },
    });
    expect(fake.batch).toHaveBeenCalledTimes(1);
    expect(fake.sqlCalls.some((entry) => entry.sql.includes("question_type"))).toBe(true);
    expect(fake.sqlCalls.some((entry) => entry.sql.includes("INSERT INTO admin_audit_events"))).toBe(true);
  });

  it("prevents an author from submitting another author's draft for review", async () => {
    const fake = makeAdminDb({
      version: { id: "version-2", status: "draft", created_by_user_id: "different-author" },
    });
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/content/lessons/lesson-1/versions/version-2/submit-review",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(403);
    expect(fake.batch).not.toHaveBeenCalled();
  });

  it("prevents an author from reviewing their own submission", async () => {
    const fake = makeAdminDb({
      review: { id: "review-1", author_user_id: userId, status: "pending" },
    });
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/content/reviews/review-1/decision",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve", reasonCode: "approved" }),
      },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "SELF_REVIEW_FORBIDDEN" } });
    expect(fake.batch).not.toHaveBeenCalled();
  });

  it("refuses to publish content before reviewer approval", async () => {
    const fake = makeAdminDb({
      role: true,
      review: {
        id: "review-1",
        author_user_id: "author-2",
        status: "pending",
        lesson_version_id: "version-2",
        lesson_id: "lesson-1",
        version: 2,
      },
    });
    const token = await createSessionToken();
    const response = await app.request(
      "/api/v1/admin/content/reviews/review-1/publish",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      { DB: fake.DB } as never,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CONTENT_NOT_APPROVED" } });
    expect(fake.batch).not.toHaveBeenCalled();
  });
});
