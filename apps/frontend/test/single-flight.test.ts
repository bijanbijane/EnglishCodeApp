import test from "node:test";
import assert from "node:assert/strict";
import { createSingleFlightGuard } from "../src/shared/async/single-flight.ts";

test("only one concurrent UI action is allowed to run", async () => {
  const guard = createSingleFlightGuard();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  const first = guard.run(async () => {
    calls += 1;
    await gate;
    return "completed";
  });
  const duplicate = guard.run(async () => {
    calls += 1;
    return "duplicate";
  });

  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(await duplicate, undefined);
  release();
  assert.equal(await first, "completed");
  assert.equal(await guard.run(async () => ++calls), 2);
});

test("the guard is released when an action rejects", async () => {
  const guard = createSingleFlightGuard();
  await assert.rejects(guard.run(async () => { throw new Error("network failure"); }), /network failure/);
  assert.equal(await guard.run(async () => "retry"), "retry");
});
