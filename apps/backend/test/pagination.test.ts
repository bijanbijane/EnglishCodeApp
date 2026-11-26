import { describe, expect, it } from "vitest";
import { decodePageCursor, encodePageCursor } from "../src/shared/pagination";

describe("pagination cursors", () => {
  it("round-trips canonical ISO timestamps used by completed-attempt history", () => {
    const timestamp = "2026-11-26T20:29:07.123Z";
    expect(decodePageCursor(encodePageCursor(timestamp, "attempt-123"))).toEqual({
      timestamp,
      id: "attempt-123",
    });
  });

  it("accepts canonical SQLite timestamps used by review queue defaults", () => {
    const timestamp = "2026-11-26 20:29:07";
    expect(decodePageCursor(encodePageCursor(timestamp, "review-123"))).toEqual({
      timestamp,
      id: "review-123",
    });
  });

  it.each([
    "11/26/2026 20:29:07",
    "2026-11-26",
    "2026-02-31T20:29:07.123Z",
    "2026-11-26T20:29:07Z",
  ])("rejects non-canonical or invalid timestamp %s", (timestamp) => {
    expect(decodePageCursor(encodePageCursor(timestamp, "attempt-123"))).toBeNull();
  });

  it("rejects malformed IDs and oversized cursor values", () => {
    expect(decodePageCursor(encodePageCursor("2026-11-26T20:29:07.123Z", "bad/id"))).toBeNull();
    expect(decodePageCursor("x".repeat(513))).toBeNull();
  });
});
