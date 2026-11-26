import test from "node:test";
import assert from "node:assert/strict";
import { parseLessonProgressList } from "../src/features/progress/api/progress.contract.ts";

test("parses valid per-lesson progress", () => {
  assert.deepEqual(parseLessonProgressList([{
    lesson_id: "lesson-1", best_score: 85, completed_count: 2,
    last_completed_at: "2026-11-26T10:00:00.000Z",
  }]), [{
    lesson_id: "lesson-1", best_score: 85, completed_count: 2,
    last_completed_at: "2026-11-26T10:00:00.000Z",
  }]);
  assert.deepEqual(parseLessonProgressList([]), []);
});

test("rejects malformed progress lists and duplicate lesson IDs", () => {
  assert.throws(() => parseLessonProgressList({ data: [] }));
  const row = { lesson_id: "lesson-1", best_score: 50, completed_count: 1, last_completed_at: null };
  assert.throws(() => parseLessonProgressList([row, row]), /تکراری/);
});

test("rejects invalid score, count, identity and timestamps", () => {
  const valid = { lesson_id: "lesson-1", best_score: 50, completed_count: 1, last_completed_at: null };
  for (const patch of [
    { best_score: -1 }, { best_score: 101 }, { best_score: 50.5 },
    { completed_count: -1 }, { completed_count: 1.5 },
    { lesson_id: " " }, { last_completed_at: "not-a-date" },
  ]) {
    assert.throws(() => parseLessonProgressList([{ ...valid, ...patch }]));
  }
});
