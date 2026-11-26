import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database } from "../src/env";

const demoDatabase = {
  prepare: () => ({
    all: async <T>() => ({
      results: [{ id: "lesson-1", title: "Greetings", level: "A1", position: 1 }] as T[]
    })
  })
} as unknown as D1Database;

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
  it("returns a clear unavailable response when D1 is not configured", async () => {
    const response = await app.request("/api/v1/lessons");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "DATABASE_UNAVAILABLE" } });
  });
  it("generates an application request ID independently of Cloudflare Ray ID", async () => {
    const response = await app.request("/api/v1/health", {
      headers: { "cf-ray": "edge-ray-example" }
    });
    const requestId = response.headers.get("X-Request-Id");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requestId).not.toBe("edge-ray-example");
  });
  it("does not expose internal exception messages in API responses or logs", async () => {
    const original = console.error;
    let logged = "";
    console.error = (...args: unknown[]) => { logged = args.map(String).join(" "); };
    try {
      const failingApp = app;
      const response = await failingApp.request("/api/v1/lessons", {}, {
        DB: {
          prepare: () => ({
            all: async () => { throw new Error("private SQL fragment and bound value"); }
          })
        } as unknown as D1Database
      });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private SQL fragment");
      expect(logged).not.toContain("private SQL fragment");
    } finally {
      console.error = original;
    }
  });
  it("returns a structured 404 for unknown routes", async () => {
    const response = await app.request("/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
