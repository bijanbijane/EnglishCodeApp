import { describe, expect, it } from "vitest";
import app from "../src/app";

describe("exact-origin CORS policy", () => {
  it("allows only an explicitly configured origin", async () => {
    const response = await app.request(
      "/api/v1/health",
      { headers: { Origin: "https://app.example.test" } },
      { ALLOWED_ORIGINS: "https://app.example.test, https://admin.example.test" } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-Id");
  });

  it("does not reflect an unconfigured or wildcard origin", async () => {
    const response = await app.request(
      "/api/v1/health",
      { headers: { Origin: "https://attacker.example" } },
      { ALLOWED_ORIGINS: "https://app.example.test, *" } as never,
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("handles preflight with only the supported methods and headers", async () => {
    const response = await app.request(
      "/api/v1/auth/telegram",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://app.example.test",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,authorization",
        },
      },
      { ALLOWED_ORIGINS: "https://app.example.test" } as never,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});
