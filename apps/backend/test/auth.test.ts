import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { bytesToHex, hmacSha256 } from "../src/shared/crypto";

async function makeInitData(botToken: string): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "replay-test",
    user: JSON.stringify({ id: 12345, first_name: "Test User" })
  });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmacSha256(new TextEncoder().encode(botToken), "WebAppData");
  params.set("hash", bytesToHex(await hmacSha256(secret, checkString)));
  return params.toString();
}

function makeReplayAwareDatabase(): D1Database {
  let replayConsumed = false;
  return {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first<T>() {
          if (sql.includes("SELECT id,display_name FROM users")) {
            return { id: "user-test", display_name: "Test User" } as T;
          }
          return null;
        },
        async all<T>() { return { results: [] as T[] }; },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO telegram_auth_replays")) {
            if (replayConsumed) return { success: true, meta: { changes: 0 } };
            replayConsumed = true;
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        }
      };
      return statement as unknown as D1PreparedStatement;
    },
    async batch() { return []; }
  };
}

describe("Telegram login replay protection", () => {
  it("accepts a signed initData once and rejects its second use", async () => {
    const botToken = "test-bot-token";
    const initData = await makeInitData(botToken);
    const env = {
      DB: makeReplayAwareDatabase(),
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_AUTH_MAX_AGE_SECONDS: "3600",
      SESSION_TTL_SECONDS: "3600"
    };

    const first = await app.request("/api/v1/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    }, env);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { tokenType: "Bearer", user: { id: "user-test" } } });

    const second = await app.request("/api/v1/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    }, env);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: "TELEGRAM_INIT_DATA_REPLAYED" } });
  });

  it("fails closed when authentication lifetime configuration is invalid", async () => {
    const botToken = "test-bot-token";
    const initData = await makeInitData(botToken);
    const response = await app.request("/api/v1/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    }, {
      DB: makeReplayAwareDatabase(),
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_AUTH_MAX_AGE_SECONDS: "not-a-number"
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "AUTH_CONFIGURATION_INVALID" } });
  });
});