import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";
import { decodePageCursor, encodePageCursor } from "../src/shared/pagination";

const rows = [
  {
    attempt_id: "attempt-3",
    lesson_id: "lesson-1",
    lesson_version: 2,
    lesson_title: "Published lesson v2",
    course_id: "course-1",
    course_title: "English Foundations",
    score: 100,
    started_at: "2026-11-26T12:00:00.000Z",
    completed_at: "2026-11-26T12:05:00.000Z",
    question_count: 5,
    correct_answer_count: 5,
  },
  {
    attempt_id: "attempt-2",
    lesson_id: "lesson-1",
    lesson_version: 1,
    lesson_title: "Published lesson v1",
    course_id: "course-1",
    course_title: "English Foundations",
    score: 80,
    started_at: "2026-11-25T12:00:00.000Z",
    completed_at: "2026-11-25T12:05:00.000Z",
    question_count: 5,
    correct_answer_count: 4,
  },
  {
    attempt_id: "attempt-1",
    lesson_id: "lesson-2",
    lesson_version: 1,
    lesson_title: "Another lesson",
    course_id: "course-1",
    course_title: "English Foundations",
    score: 60,
    started_at: "2026-11-24T12:00:00.000Z",
    completed_at: "2026-11-24T12:05:00.000Z",
    question_count: 5,
    correct_answer_count: 3,
  },
];

function makeDb(resultRows = rows, session: { id: string; user_id: string } | null = {
  id: "session-1",
  user_id: "user-1",
}) {
  let historySql = "";
  let historyValues: unknown[] = [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...values: unknown[]) => {
        if (sql.includes("FROM sessions")) {
          return { first: vi.fn().mockResolvedValue(session) };
        }
        if (sql.includes("FROM lesson_attempts a")) {
          historySql = sql;
          historyValues = values;
          return { all: vi.fn().mockResolvedValue({ results: resultRows }) };
        }
        return {
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
    })),
  };
  return {
    db,
    getHistorySql: () => historySql,
    getHistoryValues: () => historyValues,
  };
}

describe("learner attempt history", () => {
  it("returns a bounded newest-first page with a next cursor", async () => {
    const token = await createSessionToken();
    const fixture = makeDb();
    const response = await app.request(
      "/api/v1/me/history?limit=2",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fixture.db } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: Array<{ attemptId: string; lessonTitle: string; correctAnswerCount: number }>;
      meta: { nextCursor: string | null };
    };
    expect(body.data.map((item) => item.attemptId)).toEqual(["attempt-3", "attempt-2"]);
    expect(body.data[0]).toMatchObject({
      lessonTitle: "Published lesson v2",
      correctAnswerCount: 5,
    });
    expect(decodePageCursor(body.meta.nextCursor ?? "")).toEqual({
      timestamp: "2026-11-25T12:05:00.000Z",
      id: "attempt-2",
    });
    expect(fixture.getHistorySql()).toContain("a.user_id = ?");
    expect(fixture.getHistorySql()).toContain("ORDER BY a.completed_at DESC, a.id DESC");
    expect(fixture.getHistorySql()).toContain("a.status = 'completed'");
    expect(fixture.getHistoryValues()).toEqual(["user-1", null, null, null, null, 3]);
  });

  it("uses the cursor as a stable timestamp and ID boundary", async () => {
    const token = await createSessionToken();
    const cursor = encodePageCursor("2026-11-25T12:05:00.000Z", "attempt-2");
    const fixture = makeDb([rows[2]]);
    const response = await app.request(
      `/api/v1/me/history?limit=1&cursor=${encodeURIComponent(cursor)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fixture.db } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: Array<{ attemptId: string }>;
      meta: { nextCursor: string | null };
    };
    expect(body.data.map((item) => item.attemptId)).toEqual(["attempt-1"]);
    expect(body.meta.nextCursor).toBeNull();
    expect(fixture.getHistoryValues()).toEqual([
      "user-1",
      "2026-11-25T12:05:00.000Z",
      "2026-11-25T12:05:00.000Z",
      "2026-11-25T12:05:00.000Z",
      "attempt-2",
      2,
    ]);
  });

  it("rejects malformed cursors before querying history", async () => {
    const token = await createSessionToken();
    const fixture = makeDb();
    const response = await app.request(
      "/api/v1/me/history?cursor=invalid",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fixture.db } as never,
    );

    expect(response.status).toBe(400);
    expect(fixture.getHistorySql()).toBe("");
  });

  it("rejects invalid limits", async () => {
    const token = await createSessionToken();
    const fixture = makeDb();
    const response = await app.request(
      "/api/v1/me/history?limit=51",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: fixture.db } as never,
    );

    expect(response.status).toBe(400);
    expect(fixture.getHistorySql()).toBe("");
  });

  it("requires an active session", async () => {
    const fixture = makeDb(rows, null);
    const response = await app.request(
      "/api/v1/me/history",
      {},
      { DB: fixture.db } as never,
    );

    expect(response.status).toBe(401);
    expect(fixture.getHistorySql()).toBe("");
  });
});
