import { AppError } from "../../shared/errors";

export function gradeAnswer(answerId: string, answerKey: string): boolean {
  return answerId === answerKey;
}

export function calculateLessonScore(correctAnswers: number, totalQuestions: number): number {
  if (!Number.isInteger(correctAnswers) || !Number.isInteger(totalQuestions) ||
      totalQuestions < 1 || correctAnswers < 0 || correctAnswers > totalQuestions) {
    throw new AppError("INVALID_ASSESSMENT_STATE", "Lesson assessment data is invalid.", 409);
  }
  return Math.round((correctAnswers / totalQuestions) * 100);
}
