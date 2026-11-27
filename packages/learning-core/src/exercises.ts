import type { CefrLevel } from "./types";

export type ExerciseKind =
  | "multiple-choice"
  | "gap-fill"
  | "reorder"
  | "transformation"
  | "error-spotting"
  | "matching"
  | "flashcard";

export interface ExerciseBase {
  id: string;
  type: ExerciseKind;
  level: CefrLevel;
  prompt: string;
  tags: string[];
  feedback?: string;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  type: "multiple-choice";
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
}

export interface GapFillExercise extends ExerciseBase {
  type: "gap-fill";
  acceptedAnswers: string[];
}

export interface ReorderExercise extends ExerciseBase {
  type: "reorder";
  tokens: string[];
  correctOrder: string[];
}

export interface TransformationExercise extends ExerciseBase {
  type: "transformation";
  sourceText: string;
  instruction: string;
  acceptedAnswers: string[];
}

export interface ErrorSpottingExercise extends ExerciseBase {
  type: "error-spotting";
  sourceText: string;
  correctedText: string;
  explanation: string;
}

export interface MatchingExercise extends ExerciseBase {
  type: "matching";
  pairs: Array<{ left: string; right: string }>;
}

export interface FlashcardExercise extends ExerciseBase {
  type: "flashcard";
  front: string;
  back: string;
}

export type LearningExercise =
  | MultipleChoiceExercise
  | GapFillExercise
  | ReorderExercise
  | TransformationExercise
  | ErrorSpottingExercise
  | MatchingExercise
  | FlashcardExercise;

export interface ExercisePack {
  id: string;
  title: string;
  level: CefrLevel;
  items: LearningExercise[];
}

export interface ExerciseValidationResult {
  valid: boolean;
  errors: string[];
}

const CEFR_LEVELS = new Set<CefrLevel>(["PRE_A1", "A1", "A2", "B1", "B2", "C1", "C2"]);
const EXERCISE_KINDS = new Set<ExerciseKind>([
  "multiple-choice",
  "gap-fill",
  "reorder",
  "transformation",
  "error-spotting",
  "matching",
  "flashcard",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTextArray(value: unknown, minimum = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.every(hasText);
}

function sameMultiset(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of right) {
    const count = counts.get(item) ?? 0;
    if (count === 0) return false;
    counts.set(item, count - 1);
  }
  return true;
}

export function validateLearningExercise(input: unknown): ExerciseValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["Exercise must be an object."] };

  if (!hasText(input.id)) errors.push("Exercise id is required.");
  if (!hasText(input.prompt)) errors.push("Exercise prompt is required.");
  if (!CEFR_LEVELS.has(input.level as CefrLevel)) errors.push("Exercise level must be a supported CEFR level.");
  if (!Array.isArray(input.tags) || !input.tags.every(hasText)) errors.push("Exercise tags must be an array of non-empty strings.");
  if (!EXERCISE_KINDS.has(input.type as ExerciseKind)) {
    errors.push("Exercise type is not supported.");
    return { valid: false, errors };
  }

  switch (input.type) {
    case "multiple-choice": {
      const options = input.options;
      if (!Array.isArray(options) || options.length < 2 || !options.every(
        (option) => isRecord(option) && hasText(option.id) && hasText(option.text),
      )) {
        errors.push("Multiple-choice exercises require at least two options with ids and text.");
      } else {
        const ids = options.map((option) => (option as Record<string, string>).id);
        if (new Set(ids).size !== ids.length) errors.push("Multiple-choice option ids must be unique.");
        if (!hasText(input.correctOptionId) || !ids.includes(input.correctOptionId)) {
          errors.push("The correct option id must match one of the available options.");
        }
      }
      break;
    }
    case "gap-fill":
      if (!isTextArray(input.acceptedAnswers)) errors.push("Gap-fill exercises require at least one accepted answer.");
      break;
    case "reorder":
      if (!isTextArray(input.tokens, 2) || !isTextArray(input.correctOrder, 2)) {
        errors.push("Reorder exercises require at least two tokens and a complete correct order.");
      } else if (!sameMultiset(input.tokens, input.correctOrder)) {
        errors.push("Correct order must contain exactly the supplied tokens.");
      }
      break;
    case "transformation":
      if (!hasText(input.sourceText)) errors.push("Transformation source text is required.");
      if (!hasText(input.instruction)) errors.push("Transformation instruction is required.");
      if (!isTextArray(input.acceptedAnswers)) errors.push("Transformation exercises require accepted answers.");
      break;
    case "error-spotting":
      if (!hasText(input.sourceText)) errors.push("Error-spotting source text is required.");
      if (!hasText(input.correctedText)) errors.push("Error-spotting corrected text is required.");
      if (!hasText(input.explanation)) errors.push("Error-spotting explanation is required.");
      break;
    case "matching":
      if (!Array.isArray(input.pairs) || input.pairs.length < 2 || !input.pairs.every(
        (pair) => isRecord(pair) && hasText(pair.left) && hasText(pair.right),
      )) errors.push("Matching exercises require at least two complete pairs.");
      break;
    case "flashcard":
      if (!hasText(input.front)) errors.push("Flashcard front is required.");
      if (!hasText(input.back)) errors.push("Flashcard back is required.");
      break;
  }

  return { valid: errors.length === 0, errors };
}

export function validateExercisePack(input: unknown): ExerciseValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["Exercise pack must be an object."] };
  if (!hasText(input.id)) errors.push("Exercise pack id is required.");
  if (!hasText(input.title)) errors.push("Exercise pack title is required.");
  if (!CEFR_LEVELS.has(input.level as CefrLevel)) errors.push("Exercise pack level must be a supported CEFR level.");
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push("Exercise pack must contain at least one exercise.");
    return { valid: false, errors };
  }

  const ids = new Set<string>();
  input.items.forEach((item, index) => {
    const result = validateLearningExercise(item);
    result.errors.forEach((error) => errors.push(`Item ${index + 1}: ${error}`));
    if (isRecord(item) && hasText(item.id)) {
      if (ids.has(item.id)) errors.push(`Duplicate exercise id: ${item.id}.`);
      ids.add(item.id);
    }
    if (isRecord(item) && item.level !== input.level) {
      errors.push(`Item ${index + 1}: exercise level must match its pack level.`);
    }
  });

  return { valid: errors.length === 0, errors };
}
