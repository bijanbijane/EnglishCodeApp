import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const progress = readFileSync(new URL("../src/features/progress/ui/ProgressPanel.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/features/lessons/ui/LessonWorkspace.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/features/lessons/ui/LessonCatalog.tsx", import.meta.url), "utf8");

test("progress bars are announced with learner-facing lesson names", () => {
  assert.match(progress, /aria-label=\{\"بهترین امتیاز درس \" \+ title\}/);
  assert.doesNotMatch(progress, /aria-label=\{\"بهترین امتیاز \" \+ row\.lesson_id\}/);
});

test("progress and lesson loading states are announced politely", () => {
  assert.match(progress, /role=\"status\" aria-live=\"polite\"/);
  assert.match(workspace, /role=\"status\" aria-live=\"polite\"/);
  assert.match(progress, /className=\"loader\" aria-hidden=\"true\"/);
  assert.match(workspace, /className=\"loader\" aria-hidden=\"true\"/);
});

test("catalog retry action has an explicit non-submit button type", () => {
  assert.match(catalog, /className=\"button button--secondary\" type=\"button\" onClick=\{onRetry\}/);
});
