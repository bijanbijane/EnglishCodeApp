import { describe, expect, it } from "vitest";
import app from "../src/app";

describe("backend HTTP foundation", () => {
  it("exposes a dependency-free liveness endpoint with non-cacheable security headers", async () => {
    const response = await app.request("/api/v1/health", {}, {} as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { status: "ok" },
    });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
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
