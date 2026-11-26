import { apiGet } from "../../../shared/api/client";
import type { Lesson } from "../model/lesson.types";

export function getLessons(): Promise<Lesson[]> {
  return apiGet<Lesson[]>("/api/v1/lessons");
}
