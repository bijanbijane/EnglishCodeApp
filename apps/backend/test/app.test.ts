import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database } from "../src/env";

const demoDatabase: D1Database = {
  prepare: () => ({
    all: async <T>() => ({
      results: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }] as T[]
    })
  })
};

describe("EnglishCodeApp API", () => {
  it("returns a versioned health response", async () => {
    const response = await app.request("/api/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "englishcode-backend",
      version: "v1"
    });
  });

  it("returns published lessons from the configured database", async () => {
    const response = await app.request("/api/v1/lessons", {}, { DB: demoDatabase });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }]
    });
  });

  it("returns a clear unavailable response when D1 is not configured", async () => {
    const response = await app.request("/api/v1/lessons");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "DATABASE_UNAVAILABLE" }
    });
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await app.request("/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND" }
    });
  });
});
