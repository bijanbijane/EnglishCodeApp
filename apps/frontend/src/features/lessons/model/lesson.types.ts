export type Lesson = {
  id: string;
  title: string;
  level: string;
  position: number;
  description?: string | null;
};

export type LessonListState =
  | { status: "loading" }
  | { status: "ready"; lessons: Lesson[] }
  | { status: "error"; message: string };
