import { Hono } from "hono";
import type { Env } from "./env";

type LessonRow = { id: string; title: string; level: string; position: number };
type QuestionRow = {
  id: string;
  prompt: string;
  options_json: string;
  answer_key: string;
  explanation: string;
};

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/v1/health", (c) => {
  return c.json({
    ok: true,
    service: "englishcode-backend",
    version: "v1"
  });
});

app.get("/api/v1/lessons", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Lesson storage is not configured." } }, 503);
  }

  try {
    const result = await c.env.DB.prepare(
      "SELECT id, title, level, position FROM lessons WHERE status = 'published' ORDER BY position ASC LIMIT 50"
    ).all<LessonRow>();

    return c.json({ data: result.results ?? [] });
  } catch {
    return c.json({ error: { code: "LESSONS_UNAVAILABLE", message: "Lessons could not be loaded." } }, 503);
  }
});

app.get("/api/v1/lessons/:lessonId", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Lesson storage is not configured." } }, 503);
  }

  try {
    const lessonId = c.req.param("lessonId");
    const lessonResult = await c.env.DB.prepare(
      "SELECT id, title, level, position FROM lessons WHERE id = ? AND status = 'published' LIMIT 1"
    ).bind(lessonId).all<LessonRow>();
    const lesson = lessonResult.results?.[0];

    if (!lesson) {
      return c.json({ error: { code: "LESSON_NOT_FOUND", message: "Lesson not found." } }, 404);
    }

    const questionResult = await c.env.DB.prepare(
      "SELECT id, prompt, options_json, answer_key, explanation FROM questions WHERE lesson_id = ? ORDER BY position ASC"
    ).bind(lessonId).all<QuestionRow>();

    const questions = (questionResult.results ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: JSON.parse(question.options_json) as Array<{ id: string; text: string }>
    }));

    return c.json({ data: { ...lesson, questions } });
  } catch {
    return c.json({ error: { code: "LESSON_UNAVAILABLE", message: "Lesson could not be loaded." } }, 503);
  }
});

app.post("/api/v1/lessons/:lessonId/check", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Lesson storage is not configured." } }, 503);
  }

  const body = await c.req.json<{ questionId?: unknown; answerId?: unknown }>().catch(() => null);
  if (!body || typeof body.questionId !== "string" || typeof body.answerId !== "string") {
    return c.json({ error: { code: "INVALID_ANSWER", message: "questionId and answerId are required." } }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      "SELECT id, answer_key, explanation FROM questions WHERE id = ? AND lesson_id = ? LIMIT 1"
    ).bind(body.questionId, c.req.param("lessonId")).all<Pick<QuestionRow, "id" | "answer_key" | "explanation">>();
    const question = result.results?.[0];

    if (!question) {
      return c.json({ error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } }, 404);
    }

    return c.json({
      data: {
        correct: question.answer_key === body.answerId,
        explanation: question.explanation
      }
    });
  } catch {
    return c.json({ error: { code: "ANSWER_CHECK_UNAVAILABLE", message: "Answer could not be checked." } }, 503);
  }
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404));

app.onError((error, c) => {
  console.error(JSON.stringify({ level: "error", message: error.message }));
  return c.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, 500);
});
