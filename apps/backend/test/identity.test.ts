import { describe, expect, it } from "vitest";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { ensureTelegramIdentity } from "../src/modules/identity/service";

function fakeIdentityDb(initial: { user_id: string } | null = null) {
  let linked = initial;
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) { values = args; return statement; },
        async first<T>() {
          if (sql.includes("SELECT user_id FROM user_identities")) return linked as T | null;
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO user_identities") && !linked) {
            linked = { user_id: String(values[1]) };
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all<T>() { return { results: [] as T[] }; }
      };
      return statement as unknown as D1PreparedStatement;
    }
  } as unknown as D1Database;
  return { db, getLinked: () => linked };
}

describe("provider-neutral Telegram identity", () => {
  it("creates a mapping from verified Telegram subject to internal user", async () => {
    const fake = fakeIdentityDb();
    const result = await ensureTelegramIdentity(fake.db, "internal-user-1", "telegram-123");
    expect(result).toEqual({ userId: "internal-user-1", provider: "telegram" });
    expect(fake.getLinked()).toEqual({ user_id: "internal-user-1" });
  });

  it("is idempotent for the same provider subject and user", async () => {
    const fake = fakeIdentityDb({ user_id: "internal-user-1" });
    await expect(ensureTelegramIdentity(fake.db, "internal-user-1", "telegram-123"))
      .resolves.toMatchObject({ userId: "internal-user-1" });
  });

  it("rejects a provider subject already linked to another internal user", async () => {
    const fake = fakeIdentityDb({ user_id: "different-user" });
    await expect(ensureTelegramIdentity(fake.db, "internal-user-1", "telegram-123"))
      .rejects.toMatchObject({ code: "IDENTITY_CONFLICT", status: 409 });
  });

  it("rejects invalid identity input", async () => {
    const fake = fakeIdentityDb();
    await expect(ensureTelegramIdentity(fake.db, "", "telegram-123"))
      .rejects.toMatchObject({ code: "IDENTITY_INPUT_INVALID" });
  });
});
