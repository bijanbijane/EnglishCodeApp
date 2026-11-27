import { describe, expect, it } from "vitest";
import a2PersonalGoalsLesson from "../../../packages/learning-core/examples/a2-personal-goals";
import {
  filterErrorCorrections,
  getSenseSynonyms,
  LESSON_STAGE_ORDER,
  parseErrorCorrectionJsonl,
  parseVocabularyDataset,
  searchVocabulary,
  validateLessonBlueprint,
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

const lesson = {
  id: "lesson-a2-speaking",
  title: "Talk about personal goals",
  level: "A2" as const,
  communicativeOutcome: "The learner can describe a personal goal and give one reason.",
  realWorldTask: "Record a short voice message about a goal for this month.",
  targetLanguage: ["want to", "plan to", "because"],
  stages: LESSON_STAGE_ORDER.map((type) => ({
    type,
    activity: `Complete the ${type} activity.`,
    expectedEvidence: `Observable evidence for ${type}.`,
  })),
  mastery: { minimumAttempts: 2, minimumScorePercent: 80, requireDelayedRecall: true },
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

  it("rejects malformed vocabulary rows instead of silently dropping them", () => {\n    expect(() => parseVocabularyDataset({\n      ...vocabularyInput,\n      entries: [...vocabularyInput.entries, { ...vocabularyInput.entries[0], word: "" }],\n    })).toThrow(/Invalid vocabulary entry at index 2/);\n  });\n\n  it("rejects duplicate word/sense keys", () => {\n    expect(() => parseVocabularyDataset({\n      ...vocabularyInput,\n      entries: [...vocabularyInput.entries, { ...vocabularyInput.entries[0] }],\n    })).toThrow(/Duplicate vocabulary word\\/sense key at index 2/);\n  });\n\n  it("rejects an invalid vocabulary envelope", () => {
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

  it("accepts a complete communicative lesson with delayed recall", () => {
    expect(validateLessonBlueprint(lesson)).toEqual({ valid: true, errors: [] });
  });

  it("rejects lessons that skip stages or promote one-shot mastery", () => {
    const invalid = {
      ...lesson,
      stages: lesson.stages.slice(0, -1),
      mastery: { minimumAttempts: 1, minimumScorePercent: 60, requireDelayedRecall: false },
    };
    const result = validateLessonBlueprint(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });

  it("validates the original A2 communicative lesson sample", () => {
    expect(validateLessonBlueprint(a2PersonalGoalsLesson)).toEqual({ valid: true, errors: [] });
    expect(a2PersonalGoalsLesson.stages).toHaveLength(8);
    expect(a2PersonalGoalsLesson.mastery.requireDelayedRecall).toBe(true);
  });

  it("caps result limits to avoid unbounded response sizes", () => {
    const records = Array.from({ length: 60 }, (_, index) => ({
      ...mistake,
      id: `test-${index}`,
    }));
    expect(filterErrorCorrections(records, { limit: 500 })).toHaveLength(50);
  });
});
