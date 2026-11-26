import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { D1Database, D1PreparedStatement } from "../src/env";

const token = "x".repeat(43);

function ownerScopedDatabase() {
  const bindings: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      const statement: any = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; bindings.push(values); return statement; },
        async first<T>() {
          if (sql.includes("FROM sessions INNER JOIN users")) {
            return { id: "owner-user", telegram_user_id: "owner-tg", display_name: "Owner", token_hash: "hash" } as T;
          }
          // No foreign attempt/result belongs to this authenticated owner.
          if (sql.includes("FROM lesson_attempts") || sql.includes("FROM attempt_results")) return null;
          return null;
        },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
      return statement as D1PreparedStatement;
    },
    async batch() { return []; }
  } as unknown as D1Database;
  return { db, bindings };
}

const auth = { authorization: "Bearer " + token };

describe("cross-user attempt ownership", () => {
  it("hides another user's attempt metadata and result as not found", async () => {
    const fake = ownerScopedDatabase();
    const metadata = await app.request("/api/v1/attempts/foreign-attempt", { headers: auth }, { DB: fake.db });
    const result = await app.request("/api/v1/attempts/foreign-attempt/result", { headers: auth }, { DB: fake.db });
    expect(metadata.status).toBe(404);
    expect(result.status).toBe(404);
    expect(await metadata.json()).toMatchObject({ error: { code: "ATTEMPT_NOT_FOUND" } });
    expect(await result.json()).toMatchObject({ error: { code: "ATTEMPT_NOT_FOUND" } });
  });

  it("rejects answer and completion writes for another user's attempt", async () => {
    const fake = ownerScopedDatabase();
    const answer = await app.request("/api/v1/attempts/foreign-attempt/answers", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ questionId: "q1", answerId: "a" })
    }, { DB: fake.db });
    const complete = await app.request("/api/v1/attempts/foreign-attempt/complete", {
      method: "POST", headers: auth
    }, { DB: fake.db });
    expect(answer.status).toBe(404);
    expect(complete.status).toBe(404);
  });

  it("binds the authenticated owner ID into attempt history queries", async () => {
    const fake = ownerScopedDatabase();
    const response = await app.request("/api/v1/me/attempts?limit=10", { headers: auth }, { DB: fake.db });
    expect(response.status).toBe(200);
    expect(fake.bindings.some((values) => values[0] === "owner-user")).toBe(true);
    expect(await response.json()).toMatchObject({ data: [], meta: { nextCursor: null } });
  });
});
