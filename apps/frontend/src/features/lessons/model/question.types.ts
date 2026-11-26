export type LessonQuestionOption = string | { id?: string; label?: string; text?: string; value?: string };

export type LessonQuestion = {
  id: string;
  prompt: string;
  options: LessonQuestionOption[];
  position: number;
};

export type LessonQuestionsState =
  | { status: "loading" }
  | { status: "ready"; questions: LessonQuestion[] }
  | { status: "error"; message: string };
