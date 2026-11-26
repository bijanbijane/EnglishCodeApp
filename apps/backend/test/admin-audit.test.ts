import { describe, expect, it } from "vitest";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { writeAdminAuditEvent } from "../src/modules/admin/audit";

function captureDatabase() {
  let inserted: unknown[] = [];
  const db = {
    prepare(_sql: string) {
      const statement: any = {
        bind(...values: unknown[]) { inserted = values; return statement; },
        async first<T>() { return null as T | null; },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { success: true, meta: { changes: 1 } }; }
      };
      return statement as D1PreparedStatement;
    }
  } as unknown as D1Database;
  return { db, getInserted: () => inserted };
}

describe("admin audit writer", () => {
  it("stores allowlisted metadata and drops free text or sensitive fields", async () => {
    const fake = captureDatabase();
    await writeAdminAuditEvent(fake.db, {
      actorUserId: "user-admin",
      action: "content.publish",
      resourceType: "lesson",
      resourceId: "lesson-1",
      requestId: "request-12345678",
      metadata: {
        version: 3,
        reasonCode: "review-approved",
        source: "admin-console",
        transcript: "private user speech",
        botToken: "must-not-be-stored"
      }
    });
    const values = fake.getInserted();
    const metadata = JSON.parse(String(values[6]));
    expect(metadata).toEqual({ version: 3, reasonCode: "review-approved", source: "admin-console" });
    expect(String(values[6])).not.toContain("private user speech");
    expect(String(values[6])).not.toContain("must-not-be-stored");
  });

  it("rejects malformed audit identifiers", async () => {
    const fake = captureDatabase();
    await expect(writeAdminAuditEvent(fake.db, {
      actorUserId: "",
      action: "x",
      resourceType: "lesson",
      requestId: "short"
    })).rejects.toThrow("Invalid admin audit event");
  });
});
