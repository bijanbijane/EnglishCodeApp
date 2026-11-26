import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireAuth } from "../auth/middleware";
import { gradeAnswer } from "./domain";

export const learningRoutes = new Hono<AppBindings>();

learningRoutes.get("/lessons", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Lesson storage is unavailable.", c.get("requestId")), 503);
  const result = await c.env.DB.prepare(
    "SELECT l.id,lv.title,lv.level,lv.position,lv.version " +
    "FROM lessons l INNER JOIN lesson_versions lv ON lv.id=l.current_published_version_id " +
    "WHERE l.status='published' AND lv.status='published' ORDER BY lv.position ASC LIMIT 50"
  ).all<{ id: string; title: string; level: string; position: number; version: number }>();
  return c.json({ data: result.results ?? [] });
});

learningRoutes.get("/lessons/:lessonId/questions", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Lesson storage is unavailable.", c.get("requestId")), 503);
  const lesson = await c.env.DB.prepare(
    "SELECT lv.id,lv.version FROM lessons l " +
    "INNER JOIN lesson_versions lv ON lv.id=l.current_published_version_id " +
    "WHERE l.id=? AND l.status='published' AND lv.status='published' LIMIT 1"
  ).bind(c.req.param("lessonId")).first<{ id: string; version: number }>();
  if (!lesson) return c.json(errorBody("LESSON_NOT_FOUND", "Lesson was not found.", c.get("requestId")), 404);

  const result = await c.env.DB.prepare(
    "SELECT source_question_id,prompt,options_json,position FROM question_versions " +
    "WHERE lesson_version_id=? ORDER BY position ASC"
  ).bind(lesson.id).all<{ source_question_id: string; prompt: string; options_json: string; position: number }>();

  const data = (result.results ?? []).map((question) => {
    let options: unknown;
    try {
      options = JSON.parse(question.options_json);
      if (!Array.isArray(options)) options = [];
    } catch { options = []; }
    return { id: question.source_question_id, prompt: question.prompt, options, position: question.position };
  });
  return c.json({ data: { lessonVersion: lesson.version, questions: data } });
});

learningRoutes.post("/lessons/:lessonId/attempts", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  const lesson = await c.env.DB.prepare(
    "SELECT l.id,lv.id AS lesson_version_id," +
    "(SELECT id FROM assessment_policy_versions WHERE policy_key='percentage' ORDER BY version DESC LIMIT 1) AS policy_version_id " +
    "FROM lessons l INNER JOIN lesson_versions lv ON lv.id=l.current_published_version_id " +
    "WHERE l.id=? AND l.status='published' AND lv.status='published' LIMIT 1"
  ).bind(c.req.param("lessonId")).first<{
    id: string; lesson_version_id: string; policy_version_id: string | null;
  }>();
  if (!lesson) return c.json(errorBody("LESSON_NOT_FOUND", "Published lesson was not found.", c.get("requestId")), 404);
  if (!lesson.policy_version_id) {
    return c.json(errorBody("ASSESSMENT_POLICY_UNAVAILABLE", "No active assessment policy is configured.", c.get("requestId")), 503);
  }

  const attemptId = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO lesson_attempts (id,user_id,lesson_id,lesson_version_id,assessment_policy_version_id,status,score) " +
    "VALUES (?,?,?,?,?,'started',0)"
  ).bind(attemptId, c.get("user").id, lesson.id, lesson.lesson_version_id, lesson.policy_version_id).run();
  return c.json({
    data: { attemptId, status: "started", lessonVersionId: lesson.lesson_version_id, assessmentPolicyVersionId: lesson.policy_version_id }
  }, 201);
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
  const attempt = await c.env.DB.prepare(
    "SELECT id,lesson_id,lesson_version_id FROM lesson_attempts " +
    "WHERE id=? AND user_id=? AND status='started' LIMIT 1"
  ).bind(c.req.param("attemptId"), c.get("user").id)
    .first<{ id: string; lesson_id: string; lesson_version_id: string }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Active lesson attempt was not found.", c.get("requestId")), 404);

  const question = await c.env.DB.prepare(
    "SELECT source_question_id,answer_key,explanation FROM question_versions " +
    "WHERE source_question_id=? AND lesson_version_id=? LIMIT 1"
  ).bind(body.questionId, attempt.lesson_version_id)
    .first<{ source_question_id: string; answer_key: string; explanation: string }>();
  if (!question) return c.json(errorBody("QUESTION_NOT_FOUND", "Question was not found in this attempt's lesson version.", c.get("requestId")), 404);

  // The SQL status predicate closes the race with attempt completion. A retry
  // with the same answer is idempotent; a conflicting second answer is 409.
  await c.env.DB.prepare(
    "INSERT INTO attempt_answers (id,attempt_id,question_id,submitted_answer,is_correct) " +
    "SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM lesson_attempts WHERE id=? AND user_id=? AND status='started') " +
    "ON CONFLICT(attempt_id,question_id) DO NOTHING"
  ).bind(
    crypto.randomUUID(), attempt.id, question.source_question_id, body.answerId,
    gradeAnswer(body.answerId, question.answer_key) ? 1 : 0,
    attempt.id, c.get("user").id
  ).run();

  const saved = await c.env.DB.prepare(
    "SELECT submitted_answer,is_correct FROM attempt_answers WHERE attempt_id=? AND question_id=? LIMIT 1"
  ).bind(attempt.id, question.source_question_id)
    .first<{ submitted_answer: string; is_correct: number }>();
  if (!saved) {
    return c.json(errorBody("ATTEMPT_NOT_ACTIVE", "This attempt is no longer accepting answers.", c.get("requestId")), 409);
  }
  if (saved.submitted_answer !== body.answerId) {
    return c.json(errorBody("ANSWER_ALREADY_SUBMITTED", "A different answer has already been recorded for this question.", c.get("requestId")), 409);
  }
  return c.json({
    data: {
      questionId: question.source_question_id,
      answerId: saved.submitted_answer,
      isCorrect: Boolean(saved.is_correct),
      explanation: question.explanation
    }
  });
});

learningRoutes.post("/attempts/:attemptId/complete", requireAuth, async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Learning storage is unavailable.", c.get("requestId")), 503);
  const attempt = await c.env.DB.prepare(
    "SELECT id,lesson_id,lesson_version_id,assessment_policy_version_id,status,score " +
    "FROM lesson_attempts WHERE id=? AND user_id=? LIMIT 1"
  ).bind(c.req.param("attemptId"), c.get("user").id)
    .first<{
      id: string; lesson_id: string; lesson_version_id: string;
      assessment_policy_version_id: string; status: string; score: number;
    }>();
  if (!attempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Lesson attempt was not found.", c.get("requestId")), 404);
  if (attempt.status === "completed") {
    return c.json({
      data: {
        attemptId: attempt.id, status: "completed", score: attempt.score,
        lessonVersionId: attempt.lesson_version_id,
        assessmentPolicyVersionId: attempt.assessment_policy_version_id
      }
    });
  }

  const completedAt = new Date().toISOString();
  await c.env.DB.batch([
    // The score is calculated against the immutable question set pinned when
    // the attempt began, not whichever content version is current today.
    c.env.DB.prepare(
      "UPDATE lesson_attempts SET status='completed', " +
      "score=CAST(ROUND(100.0 * COALESCE((" +
      "SELECT SUM(qv.weight) FROM attempt_answers aa " +
      "INNER JOIN question_versions qv ON qv.source_question_id=aa.question_id " +
      "AND qv.lesson_version_id=lesson_attempts.lesson_version_id " +
      "WHERE aa.attempt_id=lesson_attempts.id AND aa.is_correct=1),0) / " +
      "NULLIF((SELECT SUM(weight) FROM question_versions WHERE lesson_version_id=lesson_attempts.lesson_version_id),0)) AS INTEGER), " +
      "completed_at=? WHERE id=? AND user_id=? AND status='started' " +
      "AND EXISTS (SELECT 1 FROM question_versions WHERE lesson_version_id=lesson_attempts.lesson_version_id)"
    ).bind(completedAt, attempt.id, c.get("user").id),
    // Only the request that wins the conditional state transition increments progress.
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

  const finalAttempt = await c.env.DB.prepare(
    "SELECT status,score,lesson_version_id,assessment_policy_version_id FROM lesson_attempts WHERE id=? AND user_id=?"
  ).bind(attempt.id, c.get("user").id).first<{
    status: string; score: number; lesson_version_id: string; assessment_policy_version_id: string;
  }>();
  if (!finalAttempt) return c.json(errorBody("ATTEMPT_NOT_FOUND", "Lesson attempt was not found.", c.get("requestId")), 404);
  if (finalAttempt.status !== "completed") {
    return c.json(errorBody("LESSON_HAS_NO_QUESTIONS", "This lesson version has no questions yet.", c.get("requestId")), 409);
  }
  return c.json({
    data: {
      attemptId: attempt.id, status: finalAttempt.status, score: finalAttempt.score,
      lessonVersionId: finalAttempt.lesson_version_id,
      assessmentPolicyVersionId: finalAttempt.assessment_policy_version_id
    }
  });
});
