import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredAuthState } from "../src/modules/maintenance/cleanup";

describe("bounded authentication-state cleanup", () => {
  it("uses separate indexed session expiry predicates and bounded batches", async () => {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => {
          prepared.push({ sql, values });
          return { sql, values };
        }),
      })),
      batch: vi.fn().mockResolvedValue([
        { meta: { changes: 3 } },
        { meta: { changes: 2 } },
        { meta: { changes: 4 } },
        { meta: { changes: 5 } },
        { meta: { changes: 6 } },
      ]),
    };

    const now = new Date("2026-11-26T03:17:00.000Z");
    await cleanupExpiredAuthState(db as never, now);

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(prepared).toHaveLength(5);
    expect(prepared[0].sql).toContain("LIMIT 500");
    expect(prepared[0].sql).toContain("expires_at < ?");
    expect(prepared[1].sql).toContain("LIMIT 500");
    expect(prepared[1].sql).toContain("auth_rate_limits");
    expect(prepared[2].sql).toContain("LIMIT 500");
    expect(prepared[2].sql).toContain("INDEXED BY idx_sessions_expires_at");
    expect(prepared[2].sql).toContain("expires_at < ?");
    expect(prepared[2].sql).toContain("revoked_at IS NULL");
    expect(prepared[2].sql).not.toContain(" OR ");
    expect(prepared[3].sql).toContain("LIMIT 500");
    expect(prepared[3].sql).toContain("revoked_at < ?");
    expect(prepared[3].sql).toContain("ORDER BY revoked_at ASC");
    expect(prepared[4].sql).toContain("ai_transcription_reservations");
    expect(prepared[4].sql).toContain("LIMIT 500");
    expect(prepared[4].sql).toContain("day_utc < ?");
    expect(prepared[0].values[0]).toBe(now.toISOString());
    expect(prepared[1].values).toEqual(["2026-11-24T03:17:00.000Z"]);
    expect(prepared[2].values).toEqual(["2026-11-19T03:17:00.000Z"]);
    expect(prepared[3].values).toEqual(["2026-10-27T03:17:00.000Z"]);
    expect(prepared[4].values).toEqual(["2026-11-19"]);
  });
});
