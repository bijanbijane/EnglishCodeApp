import type { LessonProgress } from "../api/progress.api";

export type ProgressState =
  | { status: "loading" }
  | { status: "ready"; rows: LessonProgress[] }
  | { status: "error"; message: string };
