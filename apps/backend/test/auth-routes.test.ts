import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";

function makeDatabase() {
  const session = { id: "session-1", user_id: "user-1" };
  const profile = {
    id: "user-1",
    display_name: "Test User",
    created_at: "2026-01-01T00:00:00.000Z",
  };
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(
          sql.includes("FROM sessions") ? session : profile,
        ),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      })),
    })),
  };
}

describe("authenticated API routes", () => {
  it("returns the current profile only with an active bearer session", async () => {
    const token = await createSessionToken();
    const db = makeDatabase();
    const response = await app.request(
      "/api/v1/me",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: db } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { id: "user-1", display_name: "Test User" },
    });
  });

  it("rejects requests without a valid bearer token", async () => {
    const db = makeDatabase();
    const response = await app.request("/api/v1/me", {}, { DB: db } as never);

    expect(response.status).toBe(401);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("revokes the current session on logout", async () => {
    const token = await createSessionToken();
    const db = makeDatabase();
    const response = await app.request(
      "/api/v1/auth/logout",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      { DB: db } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { loggedOut: true },
    });
  });
});
