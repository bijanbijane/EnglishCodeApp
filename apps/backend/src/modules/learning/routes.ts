import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireAuth } from "../auth/middleware";
import { calculateLessonScore, gradeAnswer } from "./domain";

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
  let parsed: unknown;
  try { parsed = await c.req.json(); }
  catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return c.json(errorBody("INVALID_REQUEST", "Request body must be a JSON object.", c.get("requestId")), 400);
  }
  const body = parsed as { questionId?: unknown; answerId?: unknown };
  if (typeof body.questionId !== "string" || body.questionId.length < 1 || body.questionId.length > 128 ||
      typeof body.answerId !== "string" || body.answerId.length < 1 || body.answerId.length > 128) {
    return c.json(errorBody("INVALID_REQUEST", "questionId and answerId are required.", c.get("requestId")), 400);
  }
  const attempt = await c.env.DB.prepare("SELECT id,lesson_id FROM lesson_attempts WHERE id=? AND user_id=? AND status='started' LIMIT 1")
    .bind(c.req.param("attemptId"), c.get("user").id).first<{ id: string; lesson_id: string }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Active lesson attempt was not found.", c.get("requestId")), 404);
  const question = await c.env.DB.prepare("SELECT id,answer_key,explanation FROM questions WHERE id=? AND lesson_id=? LIMIT 1")
    .bind(body.questionId, attempt.lesson_id).first<{ id: string; answer_key: string; explanation: string }>();
  if (!question) return c.json(errorBody("QUESTION_NOT_FOUND", "Question was not found in this lesson.", c.get("requestId")), 404);

  // Insert only while the attempt is still started. The unique constraint makes
  // a retry idempotent; a different second answer is explicitly rejected.
  await c.env.DB.prepare(
    "INSERT INTO attempt_answers (id,attempt_id,question_id,submitted_answer,is_correct) " +
    "SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM lesson_attempts WHERE id=? AND user_id=? AND status='started') " +
    "ON CONFLICT(attempt_id,question_id) DO NOTHING"
  ).bind(
    crypto.randomUUID(), attempt.id, question.id, body.answerId,
    gradeAnswer(body.answerId, question.answer_key) ? 1 : 0,
    attempt.id, c.get("user").id
  ).run();

  const saved = await c.env.DB.prepare("SELECT submitted_answer,is_correct FROM attempt_answers WHERE attempt_id=? AND question_id=? LIMIT 1")
    .bind(attempt.id, question.id).first<{ submitted_answer: string; is_correct: number }>();
  if (!saved) {
    return c.json(errorBody("ATTEMPT_NOT_ACTIVE", "This attempt is no longer accepting answers.", c.get("requestId")), 409);
  }
  if (saved.submitted_answer !== body.answerId) {
    return c.json(errorBody("ANSWER_ALREADY_SUBMITTED", "A different answer has already been recorded for this question.", c.get("requestId")), 409);
  }
  return c.json({ data: {
    questionId: question.id,
    answerId: saved.submitted_answer,
    isCorrect: Boolean(saved.is_correct),
    explanation: question.explanation
  } });
});

learningRoutes.post("/attempts/:attemptId/complete", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  const attempt = await c.env.DB.prepare("SELECT id,lesson_id,status,score FROM lesson_attempts WHERE id=? AND user_id=? LIMIT 1")
    .bind(c.req.param("attemptId"), c.get("user").id).first<{ id: string; lesson_id: string; status: string; score: number }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Lesson attempt was not found.", c.get("requestId")), 404);
  if (attempt.status === "completed") {
    return c.json({ data: { attemptId: attempt.id, status: "completed", score: attempt.score } });
  }

  const completedAt = new Date().toISOString();
  await c.env.DB.batch([
    // Score and state transition are computed in one conditional UPDATE. An
    // answer racing this write is either committed before the score snapshot
    // or rejected by its own status predicate after completion.
    c.env.DB.prepare(
      "UPDATE lesson_attempts SET status='completed', " +
      "score=CAST(ROUND(100.0 * (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id=lesson_attempts.id AND is_correct=1) " +
      "/ (SELECT COUNT(*) FROM questions WHERE lesson_id=lesson_attempts.lesson_id)), AS INTEGER), " +
      "completed_at=? WHERE id=? AND user_id=? AND status='started' " +
      "AND EXISTS (SELECT 1 FROM questions WHERE lesson_id=lesson_attempts.lesson_id)"
    ).bind(completedAt, attempt.id, c.get("user").id),
    // changes() is the affected-row count from the immediately preceding UPDATE.
    // Therefore only the request that won the state transition increments progress.
    c.env.DB.prepare(
      "INSERT INTO user_progress (user_id,lesson_id,best_score,completed_count,last_completed_at) " +
      "SELECT user_id,lesson_id,score,1,completed_at FROM lesson_attempts " +
      "WHERE id=? AND user_id=? AND status='completed' AND completed_at=? AND changes()=1 " +
      "ON CONFLICT(user_id,lesson_id) DO UPDATE SET " +
      "best_score=MAX(user_progress.best_score,excluded.best_score), " +
      "completed_count=user_progress.completed_count+1, " +
      "last_completed_at=excluded.last_completed_at"
    ).bind(attempt.id, c.get("user").id, completedAt)
  ]);

  const finalAttempt = await c.env.DB.prepare("SELECT status,score FROM lesson_attempts WHERE id=? AND user_id=?")
    .bind(attempt.id, c.get("user").id).first<{ status: string; score: number }>();
  if (!finalAttempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Lesson attempt was not found.", c.get("requestId")), 404);
  if (finalAttempt.status !== "completed") {
    return c.json(errorBody("LESSON_HAS_NO_QUESTIONS", "This lesson has no questions yet.", c.get("requestId")), 409);
  }
  return c.json({ data: { attemptId: attempt.id, status: finalAttempt.status, score: finalAttempt.score } });
});
