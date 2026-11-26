import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const progress = readFileSync(new URL("../src/features/progress/ui/ProgressPanel.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/features/lessons/ui/LessonWorkspace.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/features/lessons/ui/LessonCatalog.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

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

test("empty lesson catalog is announced as a polite status update", () => {
  assert.match(catalog, /if \(lessons\.length === 0\) return <div className=\"state-panel\" role=\"status\" aria-live=\"polite\">/);
});

test("lesson route loading and missing-lesson states are announced", () => {
  assert.match(app, /className="state-panel" role="status" aria-live="polite"><span className="loader" aria-hidden="true" \/> در حال بارگذاری درس/);
  assert.match(app, /className="state-panel" role="status" aria-live="polite"><strong>این درس در فهرست فعلی وجود ندارد/);
});

test("mobile navigation exposes the active route with aria-current", () => {
  assert.match(app, /aria-current=\{route\.name === "home" \? "page" : undefined\}/);
  assert.match(app, /aria-current=\{route\.name === "learn" \|\| route\.name === "lesson" \? "page" : undefined\}/);
  assert.match(app, /aria-current=\{route\.name === "progress" \? "page" : undefined\}/);
  assert.match(app, /aria-current=\{route\.name === "profile" \? "page" : undefined\}/);
});

test("lesson completion exposes a numeric progressbar value", () => {
  assert.match(workspace, /role="progressbar" aria-label="درصد پیشرفت درس"/);
  assert.match(workspace, /aria-valuemin=\{0\} aria-valuemax=\{100\} aria-valuenow=\{progressPercent\}/);
  assert.match(workspace, /const progressPercent = Math\.round\(completion \? 100 : questions\.length \? answeredIds\.length \/ questions\.length \* 100 : 0\)/);
});

test("empty lesson question state is announced as a polite status update", () => {
  assert.match(workspace, /state\.status === "ready" && state\.questions\.length === 0 && <div className="state-panel" role="status" aria-live="polite">/);
});

test("empty progress history is announced as a polite status update", () => {
  assert.match(progress, /className="state-panel" role="status" aria-live="polite"><div><strong>هنوز پیشرفتی ثبت نشده است\./);
});
