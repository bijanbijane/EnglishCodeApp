import { describe, expect, it } from "vitest";
import {
  filterErrorCorrections,
  getSenseSynonyms,
  parseErrorCorrectionJsonl,
  parseVocabularyDataset,
  searchVocabulary,
} from "../../../packages/learning-core/src";

const vocabularyInput = {
  meta: { title: "Test", version: "1.0.0", license: "MIT", language: "en" },
  entries: [
    {
      word: "happy",
      sense: "feeling joy",
      pos: "adj",
      definition: "feeling pleasure",
      level: 1,
      synonyms: ["joyful", "happy", "cheerful"],
      verified: true,
    },
    {
      word: "bank",
      sense: "financial institution",
      pos: "n",
      definition: "a business that keeps and lends money",
      level: 2,
      synonyms: ["financial institution"],
      verified: true,
    },
  ],
};

const mistake = {
  id: "test-001",
  category: "preposition",
  cefr: "A2",
  learner_sentence: "I am interested on music.",
  corrected_sentence: "I am interested in music.",
  explanation: "Use interested in.",
  practice_prompt: "Name three things you are interested in.",
  tags: ["speaking", "collocation"],
};

describe("learning-core open content", () => {
  it("parses the vocabulary dataset and searches by exact headword", () => {
    const dataset = parseVocabularyDataset(vocabularyInput);
    expect(dataset.entries).toHaveLength(2);
    expect(searchVocabulary(dataset.entries, "HAPPY")).toHaveLength(1);
    expect(searchVocabulary(dataset.entries, "happy", { level: 2 })).toHaveLength(0);
  });

  it("rejects an invalid vocabulary envelope", () => {
    expect(() => parseVocabularyDataset({ entries: [] })).toThrow(TypeError);
  });

  it("returns unique synonyms without repeating the headword", () => {
    const dataset = parseVocabularyDataset(vocabularyInput);
    expect(getSenseSynonyms(dataset.entries[0])).toEqual(["joyful", "cheerful"]);
  });

  it("parses JSONL and filters error corrections", () => {
    const records = parseErrorCorrectionJsonl(JSON.stringify(mistake));
    expect(records).toHaveLength(1);
    expect(filterErrorCorrections(records, { cefr: "A2", tag: "speaking" })).toHaveLength(1);
    expect(filterErrorCorrections(records, { cefr: "B1" })).toHaveLength(0);
  });

  it("rejects malformed JSONL and invalid records", () => {
    expect(() => parseErrorCorrectionJsonl("{")).toThrow(SyntaxError);
    expect(() => parseErrorCorrectionJsonl(JSON.stringify({ id: "missing-fields" }))).toThrow(TypeError);
  });

  it("caps result limits to avoid unbounded response sizes", () => {
    const records = Array.from({ length: 60 }, (_, index) => ({
      ...mistake,
      id: `test-${index}`,
    }));
    expect(filterErrorCorrections(records, { limit: 500 })).toHaveLength(50);
  });
});
