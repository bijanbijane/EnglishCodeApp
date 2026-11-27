import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";

const webhookSecret = "test-webhook-secret";
const botToken = "123456:TEST_BOT_TOKEN";
const webhookUrl = "https://englishcode-backend-dev.bijanbijane-1.workers.dev/api/v1/telegram/webhook";
const env = {
  TELEGRAM_BOT_TOKEN: botToken,
  TELEGRAM_WEBHOOK_SECRET: webhookSecret,
} as never;

afterEach(() => vi.unstubAllGlobals());

describe("Telegram webhook setup", () => {
  it("does not re-register an already-correct webhook", async () => {
    const makeInfoResponse = () => new Response(JSON.stringify({
      ok: true,
      result: { url: webhookUrl, pending_update_count: 0, allowed_updates: ["message"] },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeInfoResponse())
      .mockResolvedValueOnce(makeInfoResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/v1/telegram/setup", { method: "GET" }, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      webhook: "already_registered",
      url: webhookUrl,
      pendingUpdateCount: 0,
      allowedUpdates: ["message"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("registers and verifies the fixed Development webhook URL when not configured", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: { url: "", pending_update_count: 0, allowed_updates: [] },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: { url: webhookUrl, pending_update_count: 0, allowed_updates: ["message"] },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/v1/telegram/setup", { method: "GET" }, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      webhook: "registered",
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
});

describe("Telegram webhook", () => {
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
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
        },
        body: JSON.stringify({
          update_id: 1,
          message: { text: "/start", chat: { id: 42, type: "private" } },
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
      chat_id: 42,
      text: expect.stringContaining("Welcome to EnglishCode"),
    });
  });

  it("rejects null as an invalid Telegram update", async () => {
    const response = await app.request(
      "/api/v1/telegram/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
        },
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
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
        },
        body: JSON.stringify({ update_id: 2, callback_query: { id: "abc" } }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
