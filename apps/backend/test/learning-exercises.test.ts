import { describe, expect, it } from "vitest";
import { validateExercisePack, validateLearningExercise } from "../../../packages/learning-core/src";

const pack = {
  id: "a2-grammar-foundations",
  title: "Grammar Foundations",
  level: "A2",
  items: [
    { id: "mc-1", type: "multiple-choice", level: "A2", prompt: "Choose.", tags: ["grammar"], options: [{ id: "a", text: "She go." }, { id: "b", text: "She goes." }], correctOptionId: "b" },
    { id: "gap-1", type: "gap-fill", level: "A2", prompt: "Complete.", tags: ["grammar"], acceptedAnswers: ["goes"] },
    { id: "reorder-1", type: "reorder", level: "A2", prompt: "Order.", tags: ["syntax"], tokens: ["I", "usually", "read"], correctOrder: ["I", "usually", "read"] },
    { id: "transform-1", type: "transformation", level: "A2", prompt: "Make it negative.", tags: ["negation"], sourceText: "They are ready.", instruction: "Write the negative form.", acceptedAnswers: ["They are not ready."] },
    { id: "error-1", type: "error-spotting", level: "A2", prompt: "Correct.", tags: ["agreement"], sourceText: "He go.", correctedText: "He goes.", explanation: "Third-person singular takes -s." },
    { id: "match-1", type: "matching", level: "A2", prompt: "Match.", tags: ["vocabulary"], pairs: [{ left: "rapid", right: "fast" }, { left: "begin", right: "start" }] },
    { id: "card-1", type: "flashcard", level: "A2", prompt: "Recall.", tags: ["vocabulary"], front: "reliable", back: "able to be trusted" },
  ],
};

describe("learning-core exercise contracts", () => {
  it("accepts all supported exercise formats in a valid pack", () => {
    expect(validateExercisePack(pack)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an answer key that does not identify an available option", () => {
    const result = validateLearningExercise({
      id: "bad-mc", type: "multiple-choice", level: "A2", prompt: "Choose.", tags: ["grammar"],
      options: [{ id: "a", text: "One" }, { id: "b", text: "Two" }], correctOptionId: "c",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("The correct option id must match one of the available options.");
  });

  it("rejects reorder exercises that lose or duplicate tokens", () => {
    const result = validateLearningExercise({
      id: "bad-order", type: "reorder", level: "A2", prompt: "Order.", tags: ["syntax"],
      tokens: ["I", "read", "books"], correctOrder: ["I", "read", "a book"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Correct order must contain exactly the supplied tokens.");
  });

  it("rejects duplicate ids and pack-level mismatches", () => {
    const result = validateExercisePack({
      ...pack, items: [pack.items[0], { ...pack.items[1], id: pack.items[0].id, level: "B1" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("Duplicate exercise id"))).toBe(true);
    expect(result.errors.some((error) => error.includes("level must match its pack level"))).toBe(true);
  });
});
