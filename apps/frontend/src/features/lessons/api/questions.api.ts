import { apiGet } from "../../../shared/api/client";
import type { LessonQuestion } from "../model/question.types";

export function getLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  return apiGet<LessonQuestion[]>(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}/questions`,
  );
}
