import type { Lesson } from "./lesson.types.ts";

export function filterLessons(lessons: readonly Lesson[], query: string): Lesson[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [...lessons];
  return lessons.filter((lesson) =>
    (lesson.title + " " + lesson.level + " " + (lesson.description ?? "")).toLocaleLowerCase().includes(term)
  );
}
