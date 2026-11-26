import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  source_language: string;
  target_language: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  position: number;
  version: number;
};

type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  options_json: string;
  explanation: string | null;
  position: number;
};

const content = new Hono<AppEnv>();

content.get("/courses", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, slug, title, description, source_language, target_language
     FROM courses WHERE status = 'published' ORDER BY title ASC`,
  ).all<CourseRow>();

  return c.json({
    data: result.results,
    meta: { requestId: c.get("requestId") },
  });
});

content.get("/courses/:courseId/lessons", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, course_id, slug, title, description, level, position, version
     FROM lessons
     WHERE course_id = ? AND status = 'published'
     ORDER BY position ASC`,
  ).bind(c.req.param("courseId")).all<LessonRow>();

  return c.json({
    data: result.results,
    meta: { requestId: c.get("requestId") },
  });
});

content.get("/lessons/:lessonId", async (c) => {
  const lesson = await c.env.DB.prepare(
    `SELECT id, course_id, slug, title, description, level, position, version
     FROM lessons WHERE id = ? AND status = 'published' LIMIT 1`,
  ).bind(c.req.param("lessonId")).first<LessonRow>();

  if (!lesson) throw new AppError("NOT_FOUND", "Lesson was not found.", 404);

  const result = await c.env.DB.prepare(
    `SELECT id, type, prompt, options_json, explanation, position
     FROM questions WHERE lesson_id = ? ORDER BY position ASC`,
  ).bind(lesson.id).all<QuestionRow>();

  const questions = result.results.map((question) => {
    let options: unknown;
    try {
      options = JSON.parse(question.options_json);
    } catch {
      throw new AppError("INTERNAL_ERROR", "Published lesson content is invalid.", 500);
    }
    if (!Array.isArray(options)) {
      throw new AppError("INTERNAL_ERROR", "Published lesson content is invalid.", 500);
    }
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options,
      explanation: question.explanation,
      position: question.position,
    };
  });

  return c.json({
    data: { ...lesson, questions },
    meta: { requestId: c.get("requestId") },
  });
});

export default content;
