import type { CefrLevel } from "./types";

export const LESSON_STAGE_ORDER = [
  "context",
  "input",
  "noticing",
  "guided-practice",
  "production",
  "feedback",
  "spaced-recall",
  "assessment",
] as const;

export type LessonStage = (typeof LESSON_STAGE_ORDER)[number];

export interface LessonBlueprint {
  id: string;
  title: string;
  level: CefrLevel;
  communicativeOutcome: string;
  realWorldTask: string;
  targetLanguage: string[];
  stages: Array<{
    type: LessonStage;
    activity: string;
    expectedEvidence: string;
  }>;
  mastery: {
    minimumAttempts: number;
    minimumScorePercent: number;
    requireDelayedRecall: boolean;
  };
}

export interface LessonValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLessonBlueprint(lesson: LessonBlueprint): LessonValidationResult {
  const errors: string[] = [];

  if (!lesson.id.trim()) errors.push("Lesson id is required.");
  if (!lesson.title.trim()) errors.push("Lesson title is required.");
  if (!lesson.communicativeOutcome.trim()) errors.push("A measurable communicative outcome is required.");
  if (!lesson.realWorldTask.trim()) errors.push("A meaningful real-world task is required.");
  if (lesson.targetLanguage.length === 0) errors.push("At least one target language item is required.");

  const actualStages = lesson.stages.map((stage) => stage.type);
  const expected = [...LESSON_STAGE_ORDER];
  if (actualStages.length !== expected.length || actualStages.some((stage, index) => stage !== expected[index])) {
    errors.push("Lesson stages must follow the complete Context-to-Assessment sequence.");
  }

  for (const stage of lesson.stages) {
    if (!stage.activity.trim()) errors.push(`The ${stage.type} stage requires an activity.`);
    if (!stage.expectedEvidence.trim()) errors.push(`The ${stage.type} stage requires observable learning evidence.`);
  }

  if (!Number.isInteger(lesson.mastery.minimumAttempts) || lesson.mastery.minimumAttempts < 2) {
    errors.push("Mastery requires at least two attempts.");
  }
  if (
    !Number.isInteger(lesson.mastery.minimumScorePercent) ||
    lesson.mastery.minimumScorePercent < 70 ||
    lesson.mastery.minimumScorePercent > 100
  ) {
    errors.push("The mastery threshold must be an integer from 70 to 100.");
  }
  if (!lesson.mastery.requireDelayedRecall) {
    errors.push("Mastery must include delayed recall evidence.");
  }

  return { valid: errors.length === 0, errors };
}
