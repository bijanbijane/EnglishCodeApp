import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";

const webhookSecret = "test-webhook-secret";
const setupKey = "test-one-time-setup-key";
const botToken = "123456:TEST_BOT_TOKEN";
const webhookUrl = "https://englishcode-backend-dev.bijanbijane-1.workers.dev/api/v1/telegram/webhook";
const miniAppUrl = new URL("https://englishcode-frontend-dev.bijanbijane-1.workers.dev").toString();
function createD1Mock() {
  const updates = new Map<number, { status: string; updatedAt: number }>();
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          values = args;
          return {
            async run() {
              const updateId = Number(values[0]);
              if (query.includes("INSERT INTO telegram_webhook_updates")) {
                const current = updates.get(updateId);
                if (!current) {
                  updates.set(updateId, { status: "processing", updatedAt: Date.now() });
                  return { meta: { changes: 1 } };
                }
                if (current.status === "processing" && current.updatedAt < Date.now() - 300_000) {
                  updates.set(updateId, { status: "processing", updatedAt: Date.now() });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("UPDATE telegram_webhook_updates")) {
                const current = updates.get(updateId);
                if (!current || current.status !== "processing") return { meta: { changes: 0 } };
                updates.set(updateId, { status: "processed", updatedAt: Date.now() });
                return { meta: { changes: 1 } };
              }
              if (query.includes("DELETE FROM telegram_webhook_updates")) {
                const current = updates.get(updateId);
                if (current?.status === "processing") {
                  updates.delete(updateId);
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              throw new Error("Unexpected D1 run query in test: " + query);
            },
            async first() {
              const current = updates.get(Number(values[0]));
              return current ? { status: current.status } : null;
            },
          };
        },
      };
    },
  };
}

const env = {
  TELEGRAM_BOT_TOKEN: botToken,
  TELEGRAM_WEBHOOK_SECRET: webhookSecret,
  TELEGRAM_SETUP_KEY: setupKey,
  TELEGRAM_MINI_APP_URL: miniAppUrl,
  DB: createD1Mock(),
} as never;

afterEach(() => vi.unstubAllGlobals());

describe("Telegram webhook setup", () => {
  it("serves a no-store setup page without exposing the setup key", async () => {
    const response = await app.request("/api/v1/telegram/setup", { method: "GET" }, env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain('location.hash.slice(1)');
    expect(html).not.toContain(setupKey);
    expect(html).toContain('X-EnglishCode-Setup-Token');
  });

  it("rejects setup requests without the setup key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request("/api/v1/telegram/setup", { method: "POST" }, env);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an incorrect setup key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/setup",
      { method: "POST", headers: { "X-EnglishCode-Setup-Token": "wrong-key" } },
      env,
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-applies the expected secret when the webhook URL already matches", async () => {
    const makeInfoResponse = () => new Response(JSON.stringify({
      ok: true,
      result: { url: webhookUrl, pending_update_count: 0, allowed_updates: ["message"] },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeInfoResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(makeInfoResponse());
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/setup",
      { method: "POST", headers: { "X-EnglishCode-Setup-Token": setupKey } },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      webhook: "reconfigured",
      url: webhookUrl,
      pendingUpdateCount: 0,
      allowedUpdates: ["message"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [setUrl, setInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(setUrl).toBe(`https://api.telegram.org/bot${botToken}/setWebhook`);
    expect(JSON.parse(String(setInit.body))).toEqual({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
  });

  it("rejects setup when Telegram does not confirm the requested allowed updates", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, result: { url: "", pending_update_count: 0, allowed_updates: [] },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, result: { url: webhookUrl, pending_update_count: 0, allowed_updates: [] },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/setup",
      { method: "POST", headers: { "X-EnglishCode-Setup-Token": setupKey } },
      env,
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Telegram webhook verification failed." });
  });

  it("registers and verifies the fixed Development webhook URL when not configured", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, result: { url: "", pending_update_count: 0, allowed_updates: [] },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, result: { url: webhookUrl, pending_update_count: 0, allowed_updates: ["message"] },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/setup",
      { method: "POST", headers: { "X-EnglishCode-Setup-Token": setupKey } },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true, webhook: "registered", url: webhookUrl,
      pendingUpdateCount: 0, allowedUpdates: ["message"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [setUrl, setInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(setUrl).toBe(`https://api.telegram.org/bot${botToken}/setWebhook`);
    expect(JSON.parse(String(setInit.body))).toEqual({
      url: webhookUrl, secret_token: webhookSecret,
      allowed_updates: ["message"], drop_pending_updates: false,
    });
  });
});

describe("Telegram webhook", () => {
  it("adds a Mini App button for /start commands addressed to the bot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({
          update_id: 8, message: { text: "/start@EnglishCodeBot", chat: { id: 42, type: "private" } },
        }),
      },
      env,
    );
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      text: expect.stringContaining("Open the app"),
      reply_markup: { inline_keyboard: [[{ web_app: { url: miniAppUrl } }]] },
    });
  });

  it.each([
    ["missing", undefined, 90],
    ["non-HTTPS", "http://example.com", 91],
    ["credential-bearing", "https://user:pass@example.com", 92],
    ["fragment-bearing", "https://example.com/#section", 93],
    ["whitespace-padded", " https://example.com ", 94],
  ])("does not expose a Mini App button for %s URL configuration", async (_label, configuredUrl, updateId) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const invalidEnv = {
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
      TELEGRAM_SETUP_KEY: setupKey,
      TELEGRAM_MINI_APP_URL: configuredUrl,
      DB: createD1Mock(),
    } as never;
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({
          update_id: updateId, message: { text: "/app", chat: { id: 42, type: "private" } },
        }),
      },
      invalidEnv,
    );
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.text).toContain("link is not configured");
    expect(payload).not.toHaveProperty("reply_markup");
  });

  it("rejects requests without the Telegram secret header", async () => {
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: 1, message: { text: "/start", chat: { id: 42, type: "private" } } }),
      },
      env,
    );
    expect(response.status).toBe(401);
  });

  it("replies to private /start messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({
          update_id: 1, message: { text: "/start", chat: { id: 42, type: "private" } },
        }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${botToken}/sendMessage`);
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: 42, text: expect.stringContaining("Open the app"),
      reply_markup: {
        inline_keyboard: [[{
          text: "Open EnglishCode",
          web_app: { url: miniAppUrl },
        }]],
      },
    });
    const replay = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({
          update_id: 1, message: { text: "/start", chat: { id: 42, type: "private" } },
        }),
      },
      env,
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ok: true, duplicate: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects updates without a valid update_id", async () => {
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({ message: { text: "/start", chat: { id: 42, type: "private" } } }),
      },
      env,
    );
    expect(response.status).toBe(400);
  });

  it("rejects null as an invalid Telegram update", async () => {
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: "null",
      },
      env,
    );
    expect(response.status).toBe(400);
  });

  it("acknowledges unsupported update types without sending a message", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
        body: JSON.stringify({ update_id: 2, callback_query: { id: "abc" } }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
