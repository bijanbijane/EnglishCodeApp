import test from "node:test";
import assert from "node:assert/strict";
import { parseLearnerProfile } from "../src/features/identity/api/user.contract.ts";

test("parses a valid learner profile", () => {
  assert.deepEqual(parseLearnerProfile({ id: "user-1", displayName: "Learner" }), {
    id: "user-1", displayName: "Learner",
  });
  assert.deepEqual(parseLearnerProfile({ id: "user-2", displayName: null }), {
    id: "user-2", displayName: null,
  });
});

test("rejects malformed profile payloads", () => {
  assert.throws(() => parseLearnerProfile(null));
  assert.throws(() => parseLearnerProfile([]));
  assert.throws(() => parseLearnerProfile({ id: "  ", displayName: "Learner" }));
  assert.throws(() => parseLearnerProfile({ id: "user-1", displayName: 42 }));
});
