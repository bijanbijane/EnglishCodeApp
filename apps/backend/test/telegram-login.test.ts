import { describe, expect, it, vi } from "vitest";
import app from "../src/app";

const botToken = "123456:TEST_BOT_TOKEN";

async function makeValidInitData(): Promise<string> {
  const authDate = String(Math.floor(Date.now() / 1000));
  const params = new URLSearchParams({
    auth_date: authDate,
    query_id: "AAEAAE",
    user: JSON.stringify({ id: 123456789, first_name: "Test", username: "test_user" }),
  });
  const encoder = new TextEncoder();
  const botKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(botToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", botKey, encoder.encode("WebAppData"));
  const secretKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", secretKey, encoder.encode(dataCheckString)),
  );
  params.set(
    "hash",
    Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
  return params.toString();
}

function makeDatabase(replayInserted = 1, requestCount = 1) {
  const batch = vi.fn().mockResolvedValue([
    { meta: { changes: 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: replayInserted } },
    { meta: { changes: replayInserted } },
    {
      results: [{ id: "canonical-user-id", display_name: "Test" }],
      meta: { changes: 0 },
    },
  ]);
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn((...values: unknown[]) => ({ sql, values, first: vi.fn().mockResolvedValue({ request_count: requestCount }) })),
  }));
  return { prepare, batch };
}

describe("Telegram login endpoint", () => {
  it("issues an opaque bearer token only when replay and session inserts succeed", async () => {
    const initData = await makeValidInitData();
    const DB = makeDatabase(1);
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      },
      { DB, TELEGRAM_BOT_TOKEN: botToken } as never,
    );

    expect(response.status).toBe(201);
    const body = await response.json() as {
      data: { accessToken: string; tokenType: string; user: { id: string } };
    };
    expect(body.data.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.data.tokenType).toBe("Bearer");
    expect(body.data.user.id).toBe("canonical-user-id");
    expect(DB.batch).toHaveBeenCalledTimes(1);
    expect(DB.batch.mock.calls[0][0]).toHaveLength(5);
    expect(JSON.stringify(DB.batch.mock.calls[0][0])).not.toContain(initData);
  });

  it("rejects a replay when the unique replay insert does not win", async () => {
    const initData = await makeValidInitData();
    const DB = makeDatabase(0);
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      },
      { DB, TELEGRAM_BOT_TOKEN: botToken } as never,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "CONFLICT" },
    });
  });

  it("rejects login attempts above the per-IP minute limit before database writes", async () => {
    const initData = await makeValidInitData();
    const DB = makeDatabase(1, 31);
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
        body: JSON.stringify({ initData }),
      },
      { DB, TELEGRAM_BOT_TOKEN: botToken } as never,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(DB.batch).not.toHaveBeenCalled();
  });

  it("does not accept a login if the bot token is not configured", async () => {
    const initData = await makeValidInitData();
    const DB = makeDatabase();
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      },
      { DB } as never,
    );

    expect(response.status).toBe(503);
    expect(DB.batch).not.toHaveBeenCalled();
  });

  it("rejects invalid initData without touching the database", async () => {
    const initData = await makeValidInitData();
    const DB = makeDatabase();
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: `${initData}&auth_date=1735689600` }),
      },
      { DB, TELEGRAM_BOT_TOKEN: botToken } as never,
    );

    expect(response.status).toBe(401);
    expect(DB.batch).not.toHaveBeenCalled();
  });
});
