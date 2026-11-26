import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

function makeDatabase(attemptExists = true) {
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({
      first: vi.fn().mockImplementation(async () => {
        if (sql.includes("FROM sessions")) {
          return { id: "session-1", user_id: "owner-1" };
        }
        if (sql.includes("FROM lesson_attempts")) {
          return attemptExists
            ? {
                id: "attempt-1",
                lesson_id: "lesson-1",
                lesson_version: 3,
                status: "in_progress",
                score: null,
                started_at: "2026-11-26T10:00:00.000Z",
                completed_at: null,
              }
            : null;
        }
        return null;
      }),
      all: vi.fn().mockResolvedValue({
        results: [{
          question_id: "question-1",
          question_type: "multiple_choice",
          prompt: "Choose the correct greeting.",
          options_json: '[{"id":"a","text":"Good morning"},{"id":"b","text":"Good night"}]',
          position: 1,
          submitted_answer: "a",
          is_correct: 1,
        }],
      }),
    })),
  }));
  return { prepare };
}

describe("attempt snapshot read API", () => {
  it("returns only the owner's immutable snapshot and omits private answer keys", async () => {
    const token = await createSessionToken();
    const DB = makeDatabase();
    const response = await app.request(
      "/api/v1/attempts/attempt-1",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Choose the correct greeting.");
    expect(body).toContain("Good morning");
    expect(body).not.toContain("answer_key");
    expect(body).not.toContain('"is_correct":1');
    expect(DB.prepare.mock.calls.some(([sql]) => sql.includes("user_id = ?"))).toBe(true);
  });

  it("does not query snapshot rows when the attempt is not owned by the current user", async () => {
    const token = await createSessionToken();
    const DB = makeDatabase(false);
    const response = await app.request(
      "/api/v1/attempts/attempt-1",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB } as never,
    );

    expect(response.status).toBe(404);
    expect(DB.prepare.mock.calls.some(([sql]) => sql.includes("FROM attempt_questions q"))).toBe(false);
  });
});
