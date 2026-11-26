import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";
import { contentRepository } from "./repository";

const content = new Hono<AppEnv>();

content.get("/courses", async (c) => {
  const courses = await contentRepository.listPublishedCourses(c.env.DB);
  return c.json({
    data: courses,
    meta: { requestId: c.get("requestId") },
  });
});

content.get("/courses/:courseId/lessons", async (c) => {
  const lessons = await contentRepository.listPublishedLessons(
    c.env.DB,
    c.req.param("courseId"),
  );
  return c.json({
    data: lessons,
    meta: { requestId: c.get("requestId") },
  });
});

content.get("/lessons/:lessonId", async (c) => {
  const lesson = await contentRepository.getPublishedLesson(
    c.env.DB,
    c.req.param("lessonId"),
  );
  if (!lesson) throw new AppError("NOT_FOUND", "Lesson was not found.", 404);

  const rows = await contentRepository.listLessonQuestions(c.env.DB, lesson.id);
  const questions = rows.map((question) => {
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
      position: question.position,
    };
  });

  return c.json({
    data: { ...lesson, questions },
    meta: { requestId: c.get("requestId") },
  });
});

export default content;
