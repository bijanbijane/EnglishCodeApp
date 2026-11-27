import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

const question = {
  id: "question-1",
  options_json: '[{"id":"a","text":"Correct"},{"id":"b","text":"Wrong"}]',
  answer_key: "a",
};

function makeDb(options: {
  existingAnswer?: { submitted_answer: string; is_correct: number } | null;
  insertChanges?: number;
  batchResults?: unknown[];
} = {}) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => {
        if (sql.includes("FROM sessions")) {
          return { first: vi.fn().mockResolvedValue({ id: "session-1", user_id: "user-1" }) };
        }
        if (sql.includes("FROM attempt_questions q")) {
          return { first: vi.fn().mockResolvedValue(question) };
        }
        if (sql.includes("FROM attempt_answers")) {
          return { first: vi.fn().mockResolvedValue(options.existingAnswer ?? null) };
        }
        if (sql.includes("INSERT INTO lesson_attempts")) {
          return { run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
        }
        if (sql.includes("INSERT INTO attempt_answers")) {
          return { run: vi.fn().mockResolvedValue({ meta: { changes: options.insertChanges ?? 1 } }) };
        }
        if (sql.includes("UPDATE lesson_attempts")) {
          return { run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
        }
        return { first: vi.fn().mockResolvedValue(null), run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
      }),
    })),
    batch: vi.fn().mockResolvedValue(options.batchResults ?? [
      { meta: { changes: 1 } },
      { meta: { changes: 1 } },
      { meta: { changes: 1 } },
      { results: [{ status: "completed", score: 50, completed_at: "2026-11-26T00:00:00.000Z" }] },
    ]),
  };
}

describe("learning write API", () => {
  it("starts an attempt for the authenticated owner", async () => {
    const token = await createSessionToken();
    const db = makeDb();
    const response = await app.request(
      "/api/v1/lessons/lesson-1/attempts",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      { DB: db } as never,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { status: "in_progress" },
    });
    const statements = db.prepare.mock.calls.map(([sql]) => sql);
    expect(statements.some((sql) => sql.includes("current_published_version_id"))).toBe(true);
    expect(statements.some((sql) => sql.includes("assessment_policy_versions"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO attempt_questions"))).toBe(true);
  });

  it("grades submitted answers on the server", async () => {
    const token = await createSessionToken();
    const db = makeDb();
    const response = await app.request(
      "/api/v1/attempts/attempt-1/answers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questionId: "question-1", answer: "a" }),
      },
      { DB: db } as never,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { accepted: true, isCorrect: true, duplicate: false },
    });
  });

  it("returns the existing result for an identical duplicate answer", async () => {
    const token = await createSessionToken();
    const db = makeDb({ existingAnswer: { submitted_answer: "a", is_correct: 1 } });
    const response = await app.request(
      "/api/v1/attempts/attempt-1/answers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questionId: "question-1", answer: "a" }),
      },
      { DB: db } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { accepted: true, isCorrect: true, duplicate: true },
    });
  });

  it("rejects a conflicting second answer", async () => {
    const token = await createSessionToken();
    const db = makeDb({ existingAnswer: { submitted_answer: "b", is_correct: 0 } });
    const response = await app.request(
      "/api/v1/attempts/attempt-1/answers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questionId: "question-1", answer: "a" }),
      },
      { DB: db } as never,
    );

    expect(response.status).toBe(409);
  });

  it("returns a completed score and runs progress update in a D1 batch", async () => {
    const token = await createSessionToken();
    const db = makeDb();
    const response = await app.request(
      "/api/v1/attempts/attempt-1/complete",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      { DB: db } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { status: "completed", score: 50 },
    });
    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.prepare.mock.calls.map(([sql]) => sql);
    expect(statements.some((sql) => sql.includes("question_weight"))).toBe(true);
    expect(statements.some((sql) => sql.includes("SUM(q.question_weight)"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO learning_events"))).toBe(true);
    expect(statements.some((sql) => sql.includes("ON CONFLICT(event_type, aggregate_id) DO NOTHING"))).toBe(true);
    const eventInsertIndex = statements.findIndex((sql) => sql.includes("INSERT INTO learning_events"));
    const progressInsertIndex = statements.findIndex((sql) => sql.includes("INSERT INTO user_progress"));
    expect(eventInsertIndex).toBeGreaterThan(-1);
    expect(progressInsertIndex).toBeGreaterThan(eventInsertIndex);
    expect(db.batch.mock.calls[0][0]).toHaveLength(4);
  });
});
