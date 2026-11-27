import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";
import { cleanupExpiredAuthState } from "../src/modules/maintenance/cleanup";

function makeDb(quotaGranted = true) {
  const statements: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      statements.push(sql);
      return {
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(
            sql.includes("FROM sessions")
              ? { id: "session-1", user_id: "user-1" }
              : null,
          ),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      };
    }),
    batch: vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },
      { meta: { changes: quotaGranted ? 1 : 0 } },
      { meta: { changes: quotaGranted ? 0 : 1 } },
    ]),
  };
  return { db, statements };
}

const validPayload = {
  audioBase64: "AQID",
  mimeType: "audio/webm",
  durationSeconds: 10,
};

describe("AI speech transcription API", () => {
  it("requires an authenticated session before transcription", async () => {
    const { db } = makeDb();
    const AI = { run: vi.fn() };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(401);
    expect(AI.run).not.toHaveBeenCalled();
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects malformed base64 without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, audioBase64: "%%%not-base64%%%" }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects audio larger than 96 KiB without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const oversizedAudio = btoa("x".repeat(96 * 1024 + 1));
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, audioBase64: oversizedAudio }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(413);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects unsupported audio formats without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, mimeType: "video/mp4" }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns the transcription and quota metadata on success", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const AI = {
      run: vi.fn().mockResolvedValue({
        text: "Good morning",
        word_count: 2,
        transcription_info: { language: "en" },
      }),
    };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { transcription: "Good morning", wordCount: 2, language: "en" },
      meta: { quota: { userDailyLimit: 2, globalDailyLimit: 60 } },
    });
    expect(AI.run).toHaveBeenCalledOnce();
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it("returns 429 when the user quota reservation cannot be created", async () => {
    const token = await createSessionToken();
    const { db } = makeDb(false);
    const AI = { run: vi.fn() };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(429);
    expect(AI.run).not.toHaveBeenCalled();
  });

  it("retains quota reservations when Workers AI fails to prevent retry abuse", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const AI = { run: vi.fn().mockRejectedValue(new Error("upstream unavailable")) };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(503);
    expect(db.prepare.mock.calls.some(([sql]) => sql.includes("DELETE FROM ai_transcription_reservations WHERE id IN"))).toBe(false);
  });
});

describe("AI quota maintenance", () => {
  it("prunes at most 500 expired reservations while retaining seven days", async () => {
    const prepared: Array<{ sql: string; bound: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => {
          prepared.push({ sql, bound: values });
          return { run: vi.fn() };
        }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };
    await cleanupExpiredAuthState(db as never, new Date("2026-11-27T12:00:00.000Z"));

    expect(db.batch).toHaveBeenCalledOnce();
    expect(prepared).toHaveLength(5);
    expect(prepared[4].sql).toContain("DELETE FROM ai_transcription_reservations");
    expect(prepared[4].sql).toContain("LIMIT 500");
    expect(prepared[4].bound).toEqual(["2026-11-20"]);
  });
});
