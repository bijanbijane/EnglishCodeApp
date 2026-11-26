import test from "node:test";
import assert from "node:assert/strict";
import { hashFromRoute, routeFromHash } from "../src/app/navigation/routes.ts";

test("empty and unknown hashes resolve to home", () => {
  assert.deepEqual(routeFromHash(""), { name: "home" });
  assert.deepEqual(routeFromHash("#/"), { name: "home" });
  assert.deepEqual(routeFromHash("#/not-a-route"), { name: "home" });
});

test("learn, profile and progress routes round-trip", () => {
  assert.deepEqual(routeFromHash(hashFromRoute({ name: "learn" })), { name: "learn" });
  assert.deepEqual(routeFromHash(hashFromRoute({ name: "profile" })), { name: "profile" });
  assert.deepEqual(routeFromHash(hashFromRoute({ name: "progress" })), { name: "progress" });
});

test("learn route supports a query suffix", () => {
  assert.deepEqual(routeFromHash("#/learn?level=B1"), { name: "learn" });
});

test("lesson IDs are safely encoded and decoded", () => {
  const route = { name: "lesson", lessonId: "lesson/with spaces-آ" } as const;
  assert.equal(hashFromRoute(route), "#/lessons/lesson%2Fwith%20spaces-%D8%A2");
  assert.deepEqual(routeFromHash(hashFromRoute(route)), route);
});

test("malformed percent encoding fails closed to home", () => {
  assert.deepEqual(routeFromHash("#/lessons/%E0%A4%A"), { name: "home" });
});

test("query suffixes do not alter the lesson route", () => {
  assert.deepEqual(routeFromHash("#/lessons/lesson-1?debug=true"), { name: "lesson", lessonId: "lesson-1" });
});

test("empty lesson IDs never generate a broken lesson URL", () => {
  assert.equal(hashFromRoute({ name: "lesson", lessonId: "" }), "#/");
  assert.equal(hashFromRoute({ name: "lesson", lessonId: "   " }), "#/");
});
