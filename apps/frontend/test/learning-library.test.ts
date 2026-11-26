import test from "node:test";
import assert from "node:assert/strict";
import { filterLessons } from "../src/features/lessons/model/lesson-search.ts";

const lessons = [
  { id: "1", title: "Everyday English", level: "A2", position: 1, description: "Daily conversations" },
  { id: "2", title: "Academic Writing", level: "B2", position: 2, description: "Essay structure" },
];

test("filters lessons by title, level and description", () => {
  assert.deepEqual(filterLessons(lessons, "academic").map((lesson) => lesson.id), ["2"]);
  assert.deepEqual(filterLessons(lessons, "b2").map((lesson) => lesson.id), ["2"]);
  assert.deepEqual(filterLessons(lessons, "conversations").map((lesson) => lesson.id), ["1"]);
});

test("returns a copy of the original list for an empty query", () => {
  const result = filterLessons(lessons, "  ");
  assert.deepEqual(result, lessons);
  assert.notEqual(result, lessons);
});

test("does not mutate the source list", () => {
  const original = [...lessons];
  filterLessons(lessons, "writing");
  assert.deepEqual(lessons, original);
});

test("filters by CEFR level independently of search", () => {
  assert.deepEqual(filterLessons(lessons, "", "b2").map((lesson) => lesson.id), ["2"]);
  assert.deepEqual(filterLessons(lessons, "academic", "A2"), []);
});

test("normalizes Persian and Arabic character variants", () => {
  const localized = [{
    id: "fa-1", title: "کتاب انگليسی", level: "B1", position: 3,
  }];
  assert.deepEqual(filterLessons(localized, "كتاب انگلیسی").map((lesson) => lesson.id), ["fa-1"]);
});
