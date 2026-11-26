import { describe, expect, it, vi } from "vitest";
import type { D1Database, D1PreparedStatement } from "../src/env";
import { rebuildUserProgress } from "../src/modules/progress/rebuild";

describe("progress projection rebuild", () => {
  it("rebuilds one user's projection from immutable progress events in one batch", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const entry = { sql, values: [] as unknown[] };
        const statement: any = {
          bind(...values: unknown[]) { entry.values = values; return statement; },
          async first<T>() {
            return { lesson_count: 2, completed_count: 5 } as T;
          },
          async all<T>() { return { results: [] as T[] }; },
          async run() { return { success: true, meta: { changes: 1 } }; }
        };
        statements.push(entry);
        return statement as D1PreparedStatement;
      },
      async batch(batchStatements: D1PreparedStatement[]) {
        expect(batchStatements).toHaveLength(2);
        return [];
      }
    } as unknown as D1Database;

    const result = await rebuildUserProgress(db, "user-123");
    expect(result).toEqual({ userId: "user-123", lessonCount: 2, completedCount: 5 });
    expect(statements[0].sql).toContain("DELETE FROM user_progress WHERE user_id=?");
    expect(statements[0].values).toEqual(["user-123"]);
    expect(statements[1].sql).toContain("FROM progress_events WHERE user_id=? GROUP BY user_id,lesson_id");
    expect(statements[1].values).toEqual(["user-123"]);
  });

  it("rejects an invalid user ID before touching the database", async () => {
    const batch = vi.fn();
    const db = { batch } as unknown as D1Database;
    await expect(rebuildUserProgress(db, "")).rejects.toThrow("Invalid user ID");
    expect(batch).not.toHaveBeenCalled();
  });
});
