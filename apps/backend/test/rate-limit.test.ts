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

  it("increments requests within the same fixed UTC minute window", async () => {
    const resultRows = [{ request_count: 1 }, { request_count: 2 }];
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => {
          statements.push({ sql, values });
          return { first: vi.fn().mockResolvedValue(resultRows.shift()) };
        }),
      })),
    };

    const first = await consumeTelegramLoginLimit(
      db as never,
      "f".repeat(64),
      new Date("2026-11-26T15:00:35.000Z"),
    );
    const second = await consumeTelegramLoginLimit(
      db as never,
      "f".repeat(64),
      new Date("2026-11-26T15:00:59.000Z"),
    );

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(statements[0].sql).toContain("RETURNING request_count");
    expect(statements[0].values[1]).toBe("2026-11-26T15:00:00.000Z");
    expect(statements[1].values[1]).toBe("2026-11-26T15:00:00.000Z");
  });
});
