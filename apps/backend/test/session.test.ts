import { describe, expect, it } from "vitest";
import { createSessionToken, hashSessionToken } from "../src/modules/auth/session";

describe("opaque session credentials", () => {
  it("creates high-entropy URL-safe tokens and persists only a one-way hash", async () => {
    const token = await createSessionToken();
    const hash = await hashSessionToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(await hashSessionToken(token)).toBe(hash);
  });

  it("generates distinct tokens", async () => {
    const first = await createSessionToken();
    const second = await createSessionToken();
    expect(first).not.toBe(second);
  });
});
