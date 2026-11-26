import { describe, expect, it, vi } from "vitest";
import app from "../src/app";

describe("public lesson content", () => {
  it("never exposes answer_key in a published lesson response", async () => {
    const lesson = {
      id: "lesson-1",
      course_id: "course-1",
      slug: "greetings",
      title: "Greetings",
      description: null,
      level: "A1",
      position: 1,
      version: 1,
    };
    const question = {
      id: "question-1",
      type: "multiple_choice",
      prompt: "Choose a greeting.",
      options_json: '[{"id":"a","text":"Hello"}]',
      explanation: "Hello is a greeting.",
      position: 1,
      answer_key: "a",
    };
    const statements = [
      { first: vi.fn().mockResolvedValue(lesson) },
      { all: vi.fn().mockResolvedValue({ results: [question] }) },
    ];
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => statements.shift()),
      })),
    };

    const response = await app.request(
      "/api/v1/lessons/lesson-1",
      {},
      { DB: db } as never,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"text":"Hello"');
    expect(body).not.toContain("answer_key");
    expect(body).not.toContain("Hello is a greeting.");
    expect(body).not.toContain('"answer":"a"');
  });
});
