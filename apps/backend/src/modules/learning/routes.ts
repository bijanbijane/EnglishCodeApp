import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireAuth } from "../auth/middleware";

export const learningRoutes = new Hono<AppBindings>();

learningRoutes.get("/lessons", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Lesson storage is unavailable.", c.get("requestId")), 503);
  const result = await c.env.DB.prepare("SELECT id,title,level,position FROM lessons WHERE status='published' ORDER BY position ASC LIMIT 50")
    .all<{ id: string; title: string; level: string; position: number }>();
  return c.json({ data: result.results ?? [] });
});

learningRoutes.get("/lessons/:lessonId/questions", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Lesson storage is unavailable.", c.get("requestId")), 503);
  const lesson = await c.env.DB.prepare("SELECT id FROM lessons WHERE id=? AND status='published' LIMIT 1")
    .bind(c.req.param("lessonId")).first<{ id: string }>();
  if (!lesson) return c.json(errorBody("LESSON_NOT_FOUND", "Lesson was not found.", c.get("requestId")), 404);
  const result = await c.env.DB.prepare("SELECT id,prompt,options_json,position FROM questions WHERE lesson_id=? ORDER BY position ASC")
    .bind(lesson.id).all<{ id: string; prompt: string; options_json: string; position: number }>();
  const data = (result.results ?? []).map((question) => {
    let options: unknown = [];
    try { options = JSON.parse(question.options_json); } catch { /* malformed content fails closed */ }
    return { id: question.id, prompt: question.prompt, options, position: question.position };
  });
  return c.json({ data });
});

learningRoutes.post("/lessons/:lessonId/attempts", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  const lesson = await c.env.DB.prepare("SELECT id FROM lessons WHERE id=? AND status='published' LIMIT 1")
    .bind(c.req.param("lessonId")).first<{ id: string }>();
  if (!lesson) return c.json(errorBody("LESSON_NOT_FOUND", "Lesson was not found.", c.get("requestId")), 404);
  const attemptId = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO lesson_attempts (id,user_id,lesson_id,status,score) VALUES (?,?,?,'started',0)")
    .bind(attemptId, c.get("user").id, lesson.id).run();
  return c.json({ data: { attemptId, status: "started" } }, 201);
});

learningRoutes.post("/attempts/:attemptId/answers", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  let body: { questionId?: unknown; answerId?: unknown };
  try { body = await c.req.json<{ questionId?: unknown; answerId?: unknown }>(); }
  catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
  if (typeof body.questionId !== "string" || body.questionId.length > 128 ||
      typeof body.answerId !== "string" || body.answerId.length > 128) {
    return c.json(errorBody("INVALID_REQUEST", "questionId and answerId are required.", c.get("requestId")), 400);
  }
  const attempt = await c.env.DB.prepare("SELECT id,lesson_id FROM lesson_attempts WHERE id=? AND user_id=? AND status='started' LIMIT 1")
    .bind(c.req.param("attemptId"), c.get("user").id).first<{ id: string; lesson_id: string }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Active lesson attempt was not found.", c.get("requestId")), 404);
  const question = await c.env.DB.prepare("SELECT id,answer_key,explanation FROM questions WHERE id=? AND lesson_id=? LIMIT 1")
    .bind(body.questionId, attempt.lesson_id).first<{ id: string; answer_key: string; explanation: string }>();
  if (!question) return c.json(errorBody("QUESTION_NOT_FOUND", "Question was not found in this lesson.", c.get("requestId")), 404);

  await c.env.DB.prepare(`INSERT OR IGNORE INTO attempt_answers (id,attempt_id,question_id,submitted_answer,is_correct)
    VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), attempt.id, question.id, body.answerId,
      body.answerId === question.answer_key ? 1 : 0).run();
  const saved = await c.env.DB.prepare("SELECT submitted_answer,is_correct FROM attempt_answers WHERE attempt_id=? AND question_id=? LIMIT 1")
    .bind(attempt.id, question.id).first<{ submitted_answer: string; is_correct: number }>();
  return c.json({ data: {
    questionId: question.id,
    answerId: saved?.submitted_answer ?? body.answerId,
    isCorrect: Boolean(saved?.is_correct),
    explanation: question.explanation
  } });
});

learningRoutes.post("/attempts/:attemptId/complete", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  const attempt = await c.env.DB.prepare("SELECT id,lesson_id,status,score FROM lesson_attempts WHERE id=? AND user_id=? LIMIT 1")
    .bind(c.req.param("attemptId"), c.get("user").id).first<{ id: string; lesson_id: string; status: string; score: number }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Lesson attempt was not found.", c.get("requestId")), 404);
  if (attempt.status === "completed") return c.json({ data: { attemptId: attempt.id, status: "completed", score: attempt.score } });

  const [questionCount, correctCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM questions WHERE lesson_id=?").bind(attempt.lesson_id).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM attempt_answers WHERE attempt_id=? AND is_correct=1").bind(attempt.id).first<{ count: number }>()
  ]);
  const total = Number(questionCount?.count ?? 0);
  if (total < 1) return c.json(errorBody("LESSON_HAS_NO_QUESTIONS", "This lesson has no questions yet.", c.get("requestId")), 409);
  const score = Math.round((Number(correctCount?.count ?? 0) / total) * 100);
  const completedAt = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE lesson_attempts SET status='completed',score=?,completed_at=? WHERE id=? AND user_id=? AND status='started'")
      .bind(score, completedAt, attempt.id, c.get("user").id),
    c.env.DB.prepare(`INSERT INTO user_progress (user_id,lesson_id,best_score,completed_count,last_completed_at)
      SELECT ?,?,?,1,? WHERE changes()>0
      ON CONFLICT(user_id,lesson_id) DO UPDATE SET
        best_score=MAX(user_progress.best_score,excluded.best_score),
        completed_count=user_progress.completed_count+1,
        last_completed_at=excluded.last_completed_at`)
      .bind(c.get("user").id, attempt.lesson_id, score, completedAt)
  ]);
  const finalAttempt = await c.env.DB.prepare("SELECT status,score FROM lesson_attempts WHERE id=?")
    .bind(attempt.id).first<{ status: string; score: number }>();
  return c.json({ data: { attemptId: attempt.id, status: finalAttempt?.status ?? "started", score: finalAttempt?.score ?? 0 } });
});
