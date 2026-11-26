import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

describe("learner progress", () => {
  it("uses the current published lesson title instead of the legacy lesson title", async () => {
    const token = await createSessionToken();
    let progressSql = "";
    const rows = [{
      lesson_id: "lesson-1",
      best_score: 90,
      completed_count: 2,
      last_completed_at: "2026-11-26T12:00:00.000Z",
      lesson_title: "Updated lesson title",
      course_id: "course-1",
    }];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => {
          if (sql.includes("FROM sessions")) {
            return {
              first: vi.fn().mockResolvedValue({ id: "session-1", user_id: "user-1" }),
            };
          }
          if (sql.includes("FROM user_progress p")) {
            progressSql = sql;
            return { all: vi.fn().mockResolvedValue({ results: rows }) };
          }
          return {
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          };
        }),
      })),
    };

    const response = await app.request(
      "/api/v1/me/progress",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: db } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: rows });
    expect(progressSql).toContain("LEFT JOIN lesson_versions lv");
    expect(progressSql).toContain("COALESCE(lv.title, l.title) AS lesson_title");
  });
});
