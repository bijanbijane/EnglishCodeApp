import { describe, expect, it } from "vitest";
import vocabulary from "../src/features/learning-content/data/vocabulary.json";
import mistakes from "../src/features/learning-content/data/common-mistakes.json";

describe("open learning content datasets", () => {
  it("contains the expected learner thesaurus records with usable sense-level fields", () => {
    expect(vocabulary).toHaveLength(2138);
    for (const entry of vocabulary) {
      expect(entry.word.trim().length).toBeGreaterThan(0);
      expect(entry.sense.trim().length).toBeGreaterThan(0);
      expect(entry.definition.trim().length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(entry.level);
      expect(Array.isArray(entry.synonyms)).toBe(true);
      expect(Array.isArray(entry.related)).toBe(true);
    }
  });

  it("keeps separate senses for ambiguous headwords instead of merging definitions", () => {
    const bankSenses = vocabulary.filter((entry) => entry.word === "bank");
    expect(bankSenses.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bankSenses.map((entry) => entry.sense)).size).toBe(bankSenses.length);
  });

  it("contains unique, complete synthetic learner-error examples", () => {
    expect(mistakes).toHaveLength(40);
    expect(new Set(mistakes.map((entry) => entry.id)).size).toBe(mistakes.length);
    for (const entry of mistakes) {
      expect(entry.learner_sentence.trim().length).toBeGreaterThan(0);
      expect(entry.corrected_sentence.trim().length).toBeGreaterThan(0);
      expect(entry.explanation.trim().length).toBeGreaterThan(0);
      expect(entry.practice_prompt.trim().length).toBeGreaterThan(0);
      expect(entry.cefr).toMatch(/^(A1|A2|B1|B2|C1|C2)$/);
    }
  });
});
