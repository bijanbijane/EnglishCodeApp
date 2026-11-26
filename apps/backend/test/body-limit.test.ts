import { describe, expect, it } from "vitest";
import app from "../src/app";

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
        body: "x".repeat(300 * 1024),
      },
      { DB, TELEGRAM_BOT_TOKEN: "test-bot-token" } as never,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });
});
