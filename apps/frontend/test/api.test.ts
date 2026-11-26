import { afterEach, describe, expect, it, vi } from "vitest";
import { api, setAccessToken } from "../src/api";

describe("frontend API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it("loads the published course catalogue from the versioned API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "course-1", title: "Foundations" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const courses = await api.courses();

    expect(courses).toEqual([{ id: "course-1", title: "Foundations" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/courses", expect.objectContaining({
      credentials: "omit",
      headers: expect.any(Headers),
    }));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("Accept")).toBe("application/json");
  });

  it("attaches the bearer token only in the Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "user-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("test-session-token");

    await api.profile();

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer test-session-token");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/me");
  });

  it("surfaces safe API error messages without accepting malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }),
    }));

    await expect(api.profile()).rejects.toThrow("Authentication is required.");
  });

  it("rejects successful responses that do not contain the API data envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [] }),
    }));

    await expect(api.courses()).rejects.toThrow("The server returned an invalid response.");
  });
});
