import { apiGet } from "../../../shared/api/client";
import type { LessonQuestion } from "../model/question.types";
import { parseLessonQuestions } from "./questions.contract";

export { parseLessonQuestions } from "./questions.contract";

export async function getLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  return parseLessonQuestions(await apiGet<unknown>("/api/v1/lessons/" + encodeURIComponent(lessonId) + "/questions"));
}
