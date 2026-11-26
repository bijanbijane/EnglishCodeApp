import { describe, expect, it } from "vitest";
import { decodeAttemptCursor, encodeAttemptCursor } from "../src/modules/learning/routes";

describe("attempt history cursor", () => {
  it("round-trips a timestamp and attempt ID", () => {
    const cursor = encodeAttemptCursor("2026-11-26 14:30:00", "attempt-123");
    expect(decodeAttemptCursor(cursor)).toEqual({
      startedAt: "2026-11-26 14:30:00",
      id: "attempt-123"
    });
  });

  it("rejects malformed and oversized cursors", () => {
    expect(decodeAttemptCursor("not-a-valid-cursor")).toBeNull();
    expect(decodeAttemptCursor("x".repeat(300))).toBeNull();
  });
});
