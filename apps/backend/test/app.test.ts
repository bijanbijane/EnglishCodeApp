import { describe, expect, it } from "vitest";
import app from "../src/app";

describe("backend HTTP foundation", () => {
  it("exposes a dependency-free liveness endpoint with non-cacheable security headers", async () => {
    const response = await app.request("/api/v1/health", {}, {} as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "englishcode-backend",
      data: { status: "ok" },
    });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("applies no-store and request correlation to authentication errors", async () => {
    const response = await app.request("/api/v1/me/progress", {}, {} as never);
    const body = await response.json() as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects oversized API request bodies before route processing", async () => {
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: "x".repeat(270_000) }),
      },
      {} as never,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("returns a structured 404 with non-cacheable headers for unknown routes", async () => {
    const response = await app.request("/not-a-route", {}, {} as never);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
