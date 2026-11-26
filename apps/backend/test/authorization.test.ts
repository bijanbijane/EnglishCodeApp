import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "../src/env";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { requireRole } from "../src/modules/admin/authorization";

function roleDatabase(granted: boolean, fail = false): D1Database {
  return {
    prepare(_sql: string) {
      const statement: any = {
        bind(..._values: unknown[]) { return statement; },
        async first<T>() {
          if (fail) throw new Error("database unavailable");
          return granted ? ({ allowed: 1 } as T) : null;
        },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
      return statement as D1PreparedStatement;
    },
    async batch() { return []; }
  };
}

function protectedApp(db: D1Database) {
  const app = new Hono<AppBindings>();
  app.use("*", async (c, next) => {
    c.set("requestId", "request-12345678");
    c.set("user", { id: "user-1", telegramUserId: "tg-1", displayName: "Test", sessionTokenHash: "hash" });
    await next();
  });
  app.get("/content/publish", requireRole("content_author"), (c) => c.json({ ok: true }));
  return app;
}

describe("admin role authorization", () => {
  it("allows a role grant read from D1", async () => {
    const response = await protectedApp(roleDatabase(true)).request("/content/publish", {}, { DB: roleDatabase(true) });
    expect(response.status).toBe(200);
  });

  it("denies authenticated users without the required role", async () => {
    const db = roleDatabase(false);
    const response = await protectedApp(db).request("/content/publish", {}, { DB: db });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("fails closed when role storage is unavailable", async () => {
    const db = roleDatabase(false, true);
    const response = await protectedApp(db).request("/content/publish", {}, { DB: db });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "AUTHORIZATION_UNAVAILABLE" } });
  });
});
