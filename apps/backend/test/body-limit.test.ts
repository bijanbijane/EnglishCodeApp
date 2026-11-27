import { describe, expect, it } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

describe("API request body limits", () => {
  it("rejects oversized request bodies before reaching route handlers", async () => {
    const DB = {
      prepare() {
        throw new Error("database must not be touched for an oversized body");
      },
    };
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(2 * 1024 * 1024 + 1),
      },
      { DB, TELEGRAM_BOT_TOKEN: "test-bot-token" } as never,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });

  it("allows the larger transcription request through the API-wide guard but keeps parsing before D1", async () => {
    const token = await createSessionToken();
    const DB = {
      prepare() {
        throw new Error("database must not be touched for an invalid audio container");
      },
      batch() {
        throw new Error("quota must not be reserved for an invalid audio container");
      },
    };
    const oversizedForStandardApis = JSON.stringify({
      audioBase64: "A".repeat(400 * 1024),
      mimeType: "audio/webm;codecs=opus",
      durationSeconds: 1,
    });
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: oversizedForStandardApis,
      },
      { DB, AI: { run: async () => ({ text: "unused" }) } } as never,
    );

    // The body is >256 KiB, so only the route's 1.5 MiB ceiling permits it.
    // Invalid EBML is rejected before quota storage or Workers AI.
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
