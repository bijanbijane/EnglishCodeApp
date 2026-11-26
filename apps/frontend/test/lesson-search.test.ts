import test from "node:test";
import assert from "node:assert/strict";
import { filterLessons } from "../src/features/lessons/model/lesson-search.ts";
import type { Lesson } from "../src/features/lessons/model/lesson.types.ts";

const lessons: Lesson[] = [
  { id: "a1", title: "Everyday introductions", level: "A1", position: 1, description: "Meet people" },
  { id: "b1", title: "Work and communication", level: "B1", position: 2, description: "Professional English" },
  { id: "a2", title: "At the market", level: "A2", position: 3, description: null },
];

test("returns all lessons for an empty or whitespace query", () => {
  assert.deepEqual(filterLessons(lessons, ""), lessons);
  assert.deepEqual(filterLessons(lessons, "   "), lessons);
});

test("filters by title without case sensitivity", () => {
  assert.deepEqual(filterLessons(lessons, "EVERYDAY").map((lesson) => lesson.id), ["a1"]);
});

test("filters by CEFR level", () => {
  assert.deepEqual(filterLessons(lessons, "b1").map((lesson) => lesson.id), ["b1"]);
});

test("filters by lesson description and handles null descriptions", () => {
  assert.deepEqual(filterLessons(lessons, "professional").map((lesson) => lesson.id), ["b1"]);
});

test("returns an empty list when nothing matches", () => {
  assert.deepEqual(filterLessons(lessons, "C2 advanced"), []);
});
