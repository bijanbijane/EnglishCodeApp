import type { Lesson } from "./lesson.types.ts";

export function filterLessons(lessons: readonly Lesson[], query: string, level = ""): Lesson[] {
  const term = query.trim().normalize("NFKC").toLocaleLowerCase();
  const selectedLevel = level.trim().toLocaleUpperCase();
  return lessons.filter((lesson) => {
    const matchesLevel = !selectedLevel || lesson.level.trim().toLocaleUpperCase() === selectedLevel;
    if (!matchesLevel) return false;
    if (!term) return true;
    const searchable = (lesson.title + " " + lesson.level + " " + (lesson.description ?? ""))
      .normalize("NFKC")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .toLocaleLowerCase();
    const normalizedTerm = term.replace(/[يى]/g, "ی").replace(/ك/g, "ک");
    return searchable.includes(normalizedTerm);
  });
}
