import { describe, expect, it, vi } from "vitest";
import {
  consumeTelegramLoginLimit,
  hashRateLimitKey,
} from "../src/modules/auth/rate-limit";

describe("Telegram login rate limiting", () => {
  it("stores a keyed pseudonymous identifier rather than a raw IP address", async () => {
    const first = await hashRateLimitKey("203.0.113.8", "test-secret");
    const same = await hashRateLimitKey("203.0.113.8", "test-secret");
    const different = await hashRateLimitKey("203.0.113.9", "test-secret");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(same);
    expect(first).not.toBe(different);
    expect(first).not.toContain("203.0.113.8");
  });

  it("increments within a fixed UTC minute window", async () => {
    const first = { request_count: 1 };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(first),
        })),
      })),
    };

    const count = await consumeTelegramLoginLimit(
      db as never,
      "f".repeat(64),
      new Date("2026-11-26T15:00:35.000Z"),
    );

    expect(count).toBe(1);
    expect(db.prepare.mock.calls[0][0]).toContain("RETURNING request_count");
  });
});
