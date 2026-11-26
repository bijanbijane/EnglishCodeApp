import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { requireSession } from "../auth/middleware";
import { AppError } from "../../shared/errors";

type QuestionForAnswer = {
  id: string;
  options_json: string;
  answer_key: string;
};

type ExistingAnswer = {
  submitted_answer: string;
  is_correct: number;
};

type CompletedAttempt = {
  status: string;
  score: number | null;
  completed_at: string | null;
};

const learning = new Hono<AppEnv>();

function parseAnswerBody(value: unknown): { questionId: string; answer: string } {
  if (typeof value !== "object" || value === null) {
    throw new AppError("VALIDATION_ERROR", "A valid answer payload is required.", 400);
  }
  const body = value as Record<string, unknown>;
  if (
    typeof body.questionId !== "string" ||
    body.questionId.length < 1 ||
    body.questionId.length > 128 ||
    typeof body.answer !== "string" ||
    body.answer.length < 1 ||
    body.answer.length > 128
  ) {
    throw new AppError("VALIDATION_ERROR", "A valid questionId and answer are required.", 400);
  }
  return { questionId: body.questionId, answer: body.answer };
}

function getOptionIds(optionsJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(optionsJson);
  } catch {
    throw new AppError("INTERNAL_ERROR", "Published lesson content is invalid.", 500);
  }
  if (!Array.isArray(parsed)) {
    throw new AppError("INTERNAL_ERROR", "Published lesson content is invalid.", 500);
  }
  return parsed.flatMap((option: unknown) => {
    if (
      typeof option === "object" &&
      option !== null &&
      "id" in option &&
      typeof option.id === "string"
    ) {
      return [option.id];
    }
    return [];
  });
}

learning.post("/lessons/:lessonId/attempts", requireSession, async (c) => {
  const attemptId = crypto.randomUUID();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO lesson_attempts (id, user_id, lesson_id, lesson_version, status)
       SELECT ?, ?, id, version, 'in_progress'
       FROM lessons
       WHERE id = ? AND status = 'published'
         AND EXISTS (SELECT 1 FROM questions WHERE lesson_id = lessons.id)`,
    ).bind(attemptId, c.get("userId"), c.req.param("lessonId")),
    c.env.DB.prepare(
      `INSERT INTO attempt_questions
         (attempt_id, question_id, question_type, prompt, options_json, answer_key, position)
       SELECT ?, q.id, q.type, q.prompt, q.options_json, q.answer_key, q.position
       FROM questions q
       JOIN lesson_attempts a ON a.lesson_id = q.lesson_id
       WHERE a.id = ? AND a.user_id = ? AND a.status = 'in_progress'
         AND changes() = 1`,
    ).bind(attemptId, attemptId, c.get("userId")),
  ]);

  if (results[0]?.meta.changes !== 1 || (results[1]?.meta.changes ?? 0) < 1) {
    throw new AppError("NOT_FOUND", "Published lesson was not found.", 404);
  }

  return c.json({
    data: { attemptId, status: "in_progress" },
    meta: { requestId: c.get("requestId") },
  }, 201);
});

learning.post("/attempts/:attemptId/answers", requireSession, async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "A valid JSON payload is required.", 400);
  }
  const { questionId, answer } = parseAnswerBody(rawBody);
  const userId = c.get("userId");
  const attemptId = c.req.param("attemptId");

  const question = await c.env.DB.prepare(
    `SELECT q.question_id AS id, q.options_json, q.answer_key
     FROM attempt_questions q
     JOIN lesson_attempts a ON a.id = q.attempt_id
     WHERE a.id = ? AND a.user_id = ? AND a.status = 'in_progress' AND q.question_id = ?
     LIMIT 1`,
  ).bind(attemptId, userId, questionId).first<QuestionForAnswer>();

  if (!question) {
    throw new AppError("NOT_FOUND", "An active attempt question was not found.", 404);
  }

  const optionIds = getOptionIds(question.options_json);
  if (!optionIds.includes(answer)) {
    throw new AppError("VALIDATION_ERROR", "The submitted answer is not a valid option.", 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT submitted_answer, is_correct
     FROM attempt_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1`,
  ).bind(attemptId, questionId).first<ExistingAnswer>();

  if (existing) {
    if (existing.submitted_answer !== answer) {
      throw new AppError("CONFLICT", "A different answer was already accepted for this question.", 409);
    }
    return c.json({
      data: { accepted: true, isCorrect: existing.is_correct === 1, duplicate: true },
      meta: { requestId: c.get("requestId") },
    });
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO attempt_answers
       (id, attempt_id, question_id, submitted_answer, is_correct)
     SELECT ?, a.id, q.question_id, ?, ?
     FROM lesson_attempts a
     JOIN attempt_questions q ON q.attempt_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.status = 'in_progress' AND q.question_id = ?
     ON CONFLICT(attempt_id, question_id) DO NOTHING`,
  ).bind(
    crypto.randomUUID(),
    answer,
    answer === question.answer_key ? 1 : 0,
    attemptId,
    userId,
    questionId,
  ).run();

  if (inserted.meta.changes === 1) {
    return c.json({
      data: { accepted: true, isCorrect: answer === question.answer_key, duplicate: false },
      meta: { requestId: c.get("requestId") },
    }, 201);
  }

  // A concurrent request may have won the unique (attempt_id, question_id) race.
  const raced = await c.env.DB.prepare(
    `SELECT submitted_answer, is_correct
     FROM attempt_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1`,
  ).bind(attemptId, questionId).first<ExistingAnswer>();

  if (raced?.submitted_answer === answer) {
    return c.json({
      data: { accepted: true, isCorrect: raced.is_correct === 1, duplicate: true },
      meta: { requestId: c.get("requestId") },
    });
  }
  if (raced) {
    throw new AppError("CONFLICT", "A different answer was already accepted for this question.", 409);
  }
  throw new AppError("CONFLICT", "The attempt is no longer accepting answers.", 409);
});

learning.post("/attempts/:attemptId/complete", requireSession, async (c) => {
  const attemptId = c.req.param("attemptId");
  const userId = c.get("userId");
  const completedAt = new Date().toISOString();

  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE lesson_attempts
       SET status = 'completed',
           score = COALESCE((
             SELECT CAST(ROUND(
               100.0 * SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) /
               NULLIF(COUNT(q.question_id), 0)
             ) AS INTEGER)
             FROM attempt_questions q
             LEFT JOIN attempt_answers aa
               ON aa.attempt_id = lesson_attempts.id AND aa.question_id = q.question_id
             WHERE q.attempt_id = lesson_attempts.id
           ), 0),
           completed_at = ?
       WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    ).bind(completedAt, attemptId, userId),
    c.env.DB.prepare(
      `INSERT INTO user_progress
         (user_id, lesson_id, best_score, completed_count, last_completed_at)
       SELECT user_id, lesson_id, score, 1, completed_at
       FROM lesson_attempts
       WHERE id = ? AND status = 'completed' AND completed_at = ? AND changes() = 1
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         best_score = MAX(user_progress.best_score, excluded.best_score),
         completed_count = user_progress.completed_count + 1,
         last_completed_at = excluded.last_completed_at`,
    ).bind(attemptId, completedAt),
    c.env.DB.prepare(
      `SELECT status, score, completed_at
       FROM lesson_attempts WHERE id = ? AND user_id = ? LIMIT 1`,
    ).bind(attemptId, userId),
  ]);

  const attempt = results[2].results[0] as CompletedAttempt | undefined;
  if (!attempt) throw new AppError("NOT_FOUND", "Attempt was not found.", 404);
  if (attempt.status !== "completed") {
    throw new AppError("CONFLICT", "The attempt cannot be completed in its current state.", 409);
  }

  return c.json({
    data: {
      status: attempt.status,
      score: attempt.score,
      completedAt: attempt.completed_at,
    },
    meta: { requestId: c.get("requestId") },
  });
});

learning.get("/me/progress", requireSession, async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT p.lesson_id, p.best_score, p.completed_count, p.last_completed_at,
            l.title AS lesson_title, l.course_id
     FROM user_progress p
     JOIN lessons l ON l.id = p.lesson_id
     WHERE p.user_id = ?
     ORDER BY p.last_completed_at DESC`,
  ).bind(c.get("userId")).all();

  return c.json({
    data: result.results,
    meta: { requestId: c.get("requestId") },
  });
});

export default learning;
