import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database, D1PreparedStatement } from "../src/env";

function versionedContentDb(): D1Database {
  return {
    prepare(sql: string) {
      const statement: any = {
        bind(..._values: unknown[]) { return statement; },
        async first<T>() {
          if (sql.includes("FROM lessons l") && sql.includes("lesson_versions")) {
            return { id: "lesson-v1", version: 1 } as T;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM question_versions")) {
            // Extra answer_key is deliberately supplied by the mock; route DTO must not leak it.
            return { results: [{
              source_question_id: "question-1",
              prompt: "Choose the correct answer",
              options_json: "[\"a\",\"b\"]",
              position: 1,
              answer_key: "a"
            }] as T[] };
          }
          return { results: [] as T[] };
        },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
      return statement as D1PreparedStatement;
    },
    async batch() { return []; }
  };
}

describe("versioned public learning content", () => {
  it("preserves the question-array API shape and never returns answer keys", async () => {
    const response = await app.request("/api/v1/lessons/lesson-1/questions", {}, {
      DB: versionedContentDb()
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      data: Array<Record<string, unknown>>;
      meta: { lessonVersion: number };
    };
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta.lessonVersion).toBe(1);
    expect(payload.data[0]).toMatchObject({
      id: "question-1",
      prompt: "Choose the correct answer",
      options: ["a", "b"],
      position: 1
    });
    expect(payload.data[0]).not.toHaveProperty("answer_key");
    expect(payload.data[0]).not.toHaveProperty("answerKey");
  });

  it("returns 409 when an owned attempt has already completed", async () => {
    const database = {
      prepare(sql: string) {
        const statement: any = {
          bind(..._values: unknown[]) { return statement; },
          async first<T>() {
            if (sql.includes("FROM sessions INNER JOIN users")) {
              return { id: "user-1", telegram_user_id: "tg-1", display_name: "Test", token_hash: "hash" } as T;
            }
            if (sql.includes("FROM lesson_attempts") && sql.includes("WHERE id=? AND user_id=?")) {
              return { id: "attempt-1", lesson_id: "lesson-1", lesson_version_id: "lesson-1:v1", status: "completed" } as T;
            }
            return null;
          },
          async all<T>() { return { results: [] as T[] }; },
          async run() { return { success: true, meta: { changes: 0 } }; }
        };
        return statement as D1PreparedStatement;
      },
      async batch() { return []; }
    } as unknown as D1Database;
    const response = await app.request("/api/v1/attempts/attempt-1/answers", {
      method: "POST",
      headers: {
        authorization: "Bearer " + "x".repeat(43),
        "content-type": "application/json"
      },
      body: JSON.stringify({ questionId: "question-1", answerId: "a" })
    }, { DB: database });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "ATTEMPT_NOT_ACTIVE" } });
  });
});
