import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAttemptResponse,
  parseAnswerSubmissionResult,
  parseLessonCompletionResult,
} from "../src/features/lessons/api/attempts.api.ts";

test("accepts a valid started attempt", () => {
  assert.deepEqual(parseAttemptResponse({ attemptId: "attempt-1", status: "started" }), {
    attemptId: "attempt-1", status: "started",
  });
});

test("rejects incomplete or unknown attempt responses", () => {
  assert.throws(() => parseAttemptResponse({ attemptId: "", status: "started" }));
  assert.throws(() => parseAttemptResponse({ attemptId: "attempt-1", status: "pending" }));
});

test("accepts server-confirmed answer feedback", () => {
  assert.deepEqual(parseAnswerSubmissionResult({
    questionId: "q-1", answerId: "a-2", isCorrect: true, explanation: "Correct.",
  }), { questionId: "q-1", answerId: "a-2", isCorrect: true, explanation: "Correct." });
});

test("rejects malformed answer feedback", () => {
  assert.throws(() => parseAnswerSubmissionResult({
    questionId: "q-1", answerId: "a-2", isCorrect: "yes", explanation: "Correct.",
  }));
  assert.throws(() => parseAnswerSubmissionResult({
    questionId: "", answerId: "a-2", isCorrect: true, explanation: "Correct.",
  }));
});

test("accepts only bounded integer completion scores", () => {
  assert.equal(parseLessonCompletionResult({
    attemptId: "attempt-1", status: "completed", score: 85,
  }).score, 85);
  for (const score of [-1, 101, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseLessonCompletionResult({
      attemptId: "attempt-1", status: "completed", score,
    }));
  }
});
