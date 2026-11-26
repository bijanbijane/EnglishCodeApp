import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database, D1PreparedStatement } from "../src/env";

const demoQuestion = {
  id: "q-1",
  prompt: "Choose the morning greeting.",
  options_json: '[{"id":"a","text":"Good morning"},{"id":"b","text":"Good night"}]',
  answer_key: "a",
  explanation: "Use Good morning in the morning."
};

const demoDatabase: D1Database = {
  prepare: (query) => {
    let values: unknown[] = [];
    const statement: D1PreparedStatement = {
      bind: (...nextValues) => { values = nextValues; return statement; },
      all: async <T>() => {
        if (query.includes("FROM questions") && query.includes("WHERE id = ?")) {
          return { results: (values[0] === "q-1" ? [{ id: "q-1", answer_key: "a", explanation: demoQuestion.explanation }] : []) as T[] };
        }
        if (query.includes("FROM questions")) return { results: [demoQuestion] as T[] };
        if (query.includes("WHERE id = ?")) return { results: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }] as T[] };
        return { results: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }] as T[] };
      }
    };
    return statement;
  }
};

describe("EnglishCodeApp API", () => {
  it("returns a versioned health response", async () => {
    const response = await app.request("/api/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "englishcode-backend", version: "v1" });
  });

  it("returns published lessons from the configured database", async () => {
    const response = await app.request("/api/v1/lessons", {}, { DB: demoDatabase });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }] });
  });

  it("returns lesson questions without exposing the answer key", async () => {
    const response = await app.request("/api/v1/lessons/lesson-1", {}, { DB: demoDatabase });
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { questions: Array<Record<string, unknown>> } };
    expect(body.data.questions[0]).toMatchObject({ id: "q-1", prompt: demoQuestion.prompt });
    expect(body.data.questions[0]).not.toHaveProperty("answer_key");
  });

  it("checks answers on the server", async () => {
    const response = await app.request("/api/v1/lessons/lesson-1/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "q-1", answerId: "a" })
    }, { DB: demoDatabase });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { correct: true, explanation: demoQuestion.explanation } });
  });

  it("rejects malformed answer payloads", async () => {
    const response = await app.request("/api/v1/lessons/lesson-1/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: 123 })
    }, { DB: demoDatabase });
    expect(response.status).toBe(400);
  });

  it("returns a clear unavailable response when D1 is not configured", async () => {
    const response = await app.request("/api/v1/lessons");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "DATABASE_UNAVAILABLE" } });
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await app.request("/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
