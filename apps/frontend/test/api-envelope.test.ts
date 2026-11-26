import test from "node:test";
import assert from "node:assert/strict";
import { ApiContractError, unwrapApiEnvelope } from "../src/shared/api/client.ts";

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
