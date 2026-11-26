import { describe, expect, it, vi } from "vitest";
import worker from "../src/worker";

describe("frontend edge Worker", () => {
  it("does not proxy paths outside the API namespace", async () => {
    const fetchBackend = vi.fn();
    const response = await worker.fetch(
      new Request("https://englishcode.example/unknown"),
      { BACKEND: { fetch: fetchBackend } },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("forwards API requests to the backend and applies no-store security headers", async () => {
    const fetchBackend = vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: "course-1" }] }),
    );
    const request = new Request("https://englishcode.example/api/v1/courses", {
      headers: { "cf-ray": "test-ray-id" },
    });

    const response = await worker.fetch(
      request,
      { BACKEND: { fetch: fetchBackend } },
    );

    expect(fetchBackend).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("X-Request-Id")).toBe("test-ray-id");
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "course-1" }],
    });
  });

  it("returns a generic 502 response when the backend binding is unavailable", async () => {
    const fetchBackend = vi.fn().mockRejectedValue(new Error("internal upstream detail"));
    const response = await worker.fetch(
      new Request("https://englishcode.example/api/v1/courses"),
      { BACKEND: { fetch: fetchBackend } },
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "The application API is temporarily unavailable.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("internal upstream detail");
  });
});
