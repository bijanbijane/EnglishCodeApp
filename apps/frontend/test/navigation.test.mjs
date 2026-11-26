import test from "node:test";
import assert from "node:assert/strict";
import { hashFromRoute, routeFromHash } from "../src/app/navigation/routes.ts";

test("home route accepts empty and root hashes", () => {
  assert.deepEqual(routeFromHash(""), { name: "home" });
  assert.deepEqual(routeFromHash("#/"), { name: "home" });
  assert.equal(hashFromRoute({ name: "home" }), "#/");
});

test("profile and progress routes round-trip", () => {
  for (const route of [{ name: "profile" }, { name: "progress" }]) {
    assert.deepEqual(routeFromHash(hashFromRoute(route)), route);
  }
});

test("lesson route encodes and decodes reserved characters", () => {
  const route = { name: "lesson", lessonId: "unit/intro?x=1" };
  assert.deepEqual(routeFromHash(hashFromRoute(route)), route);
});

test("lesson route ignores query suffix but rejects malformed encoding", () => {
  assert.deepEqual(routeFromHash("#/lessons/lesson-1?source=share"), { name: "lesson", lessonId: "lesson-1" });
  assert.deepEqual(routeFromHash("#/lessons/%E0%A4%A"), { name: "home" });
});

test("unknown and nested routes safely fall back to home", () => {
  assert.deepEqual(routeFromHash("#/settings/security"), { name: "home" });
  assert.deepEqual(routeFromHash("#/lessons/"), { name: "home" });
});
