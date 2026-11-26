import test from "node:test";
import assert from "node:assert/strict";
import { ApiContractError, ApiError, apiGet, unwrapApiEnvelope } from "../src/shared/api/client.ts";

test("unwraps a documented success envelope", () => {
  assert.deepEqual(unwrapApiEnvelope<{ id: string }>({ data: { id: "user-1" } }), { id: "user-1" });
  assert.deepEqual(unwrapApiEnvelope<string[]>( { data: ["a", "b"] }), ["a", "b"]);
});

test("rejects bare payloads and malformed envelopes", () => {
  assert.throws(() => unwrapApiEnvelope(["a", "b"]), ApiContractError);
  assert.throws(() => unwrapApiEnvelope({ result: [] }), ApiContractError);
  assert.throws(() => unwrapApiEnvelope(null), ApiContractError);
  assert.throws(() => unwrapApiEnvelope([]), ApiContractError);
});

test("preserves null when null is explicitly carried by the data field", () => {
  assert.equal(unwrapApiEnvelope<null>({ data: null }), null);
});

test("attaches bearer credentials only when the caller supplies a token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | null = null;
  globalThis.fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await apiGet("/private", { accessToken: "test-token" });
    assert.equal(capturedHeaders?.get("Authorization"), "Bearer test-token");
    await apiGet("/public");
    assert.equal(capturedHeaders?.has("Authorization"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes backend error envelopes without losing status or code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: "SESSION_EXPIRED", message: "Session expired." },
  }), { status: 401, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(apiGet("/private"), (error: unknown) =>
      error instanceof ApiError && error.status === 401 && error.code === "SESSION_EXPIRED" && error.message === "Session expired.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
