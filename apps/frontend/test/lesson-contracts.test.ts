import test from "node:test";
import assert from "node:assert/strict";
import { parseLessonQuestions } from "../src/features/lessons/api/questions.contract.ts";

test("parses a valid multiple-choice lesson payload", () => {
  const questions = parseLessonQuestions([{
    id: "q-1",
    prompt: "Choose the correct form.",
    position: 0,
    options: [
      { id: "a", text: "go" },
      { id: "b", text: "goes" },
    ],
  }]);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].options.length, 2);
});

test("rejects a non-array lesson payload", () => {
  assert.throws(() => parseLessonQuestions({ data: [] }));
});

test("rejects duplicate question identifiers", () => {
  const question = { id: "q-1", prompt: "Question", position: 0, options: ["A", "B"] };
  assert.throws(() => parseLessonQuestions([question, question]), /تکراری/);
});

test("rejects duplicate option identifiers", () => {
  assert.throws(() => parseLessonQuestions([{
    id: "q-1", prompt: "Question", position: 0,
    options: [{ id: "same", text: "A" }, { id: "same", text: "B" }],
  }]), /تکراری/);
});

test("rejects empty prompts and option labels", () => {
  assert.throws(() => parseLessonQuestions([{
    id: "q-1", prompt: "  ", position: 0, options: ["A", "B"],
  }]));
  assert.throws(() => parseLessonQuestions([{
    id: "q-1", prompt: "Question", position: 0,
    options: [{ id: "a", text: " " }, { id: "b", text: "B" }],
  }]));
});
