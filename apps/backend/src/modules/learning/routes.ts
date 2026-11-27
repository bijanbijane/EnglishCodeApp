import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { requireSession } from "../auth/middleware";
import { AppError } from "../../shared/errors";
import { decodePageCursor, encodePageCursor } from "../../shared/pagination";

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
      `INSERT INTO lesson_attempts
         (id, user_id, lesson_id, lesson_version, lesson_version_id, assessment_policy_version_id, status)
       SELECT ?, ?, l.id, lv.version, lv.id, ap.id, 'in_progress'
       FROM lessons l
       JOIN lesson_versions lv ON lv.id = l.current_published_version_id
       JOIN assessment_policy_versions ap ON ap.id = 'percentage-v1'
       WHERE l.id = ? AND l.status = 'published' AND lv.status = 'published'
         AND EXISTS (SELECT 1 FROM question_versions WHERE lesson_version_id = lv.id)`,
    ).bind(attemptId, c.get("userId"), c.req.param("lessonId")),
    c.env.DB.prepare(
      `INSERT INTO attempt_questions
         (attempt_id, question_id, question_version_id, question_type, prompt, options_json, answer_key, position, question_weight)
       SELECT ?, q.source_question_id, q.id, q.question_type, q.prompt, q.options_json, q.answer_key, q.position, q.weight
       FROM question_versions q
       JOIN lesson_attempts a ON a.lesson_version_id = q.lesson_version_id
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

learning.get("/attempts/:attemptId", requireSession, async (c) => {
  const attemptId = c.req.param("attemptId");
  const attempt = await c.env.DB.prepare(
    `SELECT id, lesson_id, lesson_version, lesson_version_id, assessment_policy_version_id, status, score, started_at, completed_at
     FROM lesson_attempts
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
  ).bind(attemptId, c.get("userId")).first<{
    id: string;
    lesson_id: string;
    lesson_version: number;
    lesson_version_id: string;
    assessment_policy_version_id: string;
    status: string;
    score: number | null;
    started_at: string;
    completed_at: string | null;
  }>();

  if (!attempt) throw new AppError("NOT_FOUND", "Attempt was not found.", 404);

  const result = await c.env.DB.prepare(
    `SELECT q.question_id, q.question_type, q.prompt, q.options_json, q.position,
            aa.submitted_answer, aa.is_correct
     FROM attempt_questions q
     LEFT JOIN attempt_answers aa
       ON aa.attempt_id = q.attempt_id AND aa.question_id = q.question_id
     WHERE q.attempt_id = ?
     ORDER BY q.position ASC`,
  ).bind(attemptId).all<{
    question_id: string;
    question_type: string;
    prompt: string;
    options_json: string;
    position: number;
    submitted_answer: string | null;
    is_correct: number | null;
  }>();

  const questions = result.results.map((question) => {
    let options: unknown;
    try {
      options = JSON.parse(question.options_json);
    } catch {
      throw new AppError("INTERNAL_ERROR", "Attempt content is invalid.", 500);
    }
    return {
      id: question.question_id,
      type: question.question_type,
      prompt: question.prompt,
      options,
      position: question.position,
      submittedAnswer: question.submitted_answer,
      isCorrect: attempt.status === "completed" && question.is_correct !== null
        ? question.is_correct === 1
        : null,
    };
  });

  return c.json({
    data: { ...attempt, questions },
    meta: { requestId: c.get("requestId") },
  });
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
               100.0 * SUM(CASE WHEN aa.is_correct = 1 THEN q.question_weight ELSE 0 END) /
               NULLIF(SUM(q.question_weight), 0)
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
      `INSERT INTO learning_events
         (event_id, user_id, event_type, aggregate_id, lesson_id, score, occurred_at, payload_json)
       SELECT
         'attempt-completed:' || a.id,
         a.user_id,
         'lesson_attempt_completed',
         a.id,
         a.lesson_id,
         a.score,
         a.completed_at,
         json_object(
           'attemptId', a.id,
           'lessonId', a.lesson_id,
           'lessonVersion', a.lesson_version,
           'lessonVersionId', a.lesson_version_id,
           'assessmentPolicyVersionId', a.assessment_policy_version_id,
           'score', a.score,
           'completedAt', a.completed_at
         )
       FROM lesson_attempts a
       WHERE a.id = ? AND a.user_id = ? AND a.status = 'completed'
         AND a.completed_at = ? AND a.score IS NOT NULL
       ON CONFLICT(event_type, aggregate_id) DO NOTHING`,
    ).bind(attemptId, userId, completedAt),
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

  const attempt = results[3].results[0] as CompletedAttempt | undefined;
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
            COALESCE(lv.title, l.title) AS lesson_title, l.course_id
     FROM user_progress p
     JOIN lessons l ON l.id = p.lesson_id
     LEFT JOIN lesson_versions lv ON lv.id = l.current_published_version_id
     WHERE p.user_id = ?
     ORDER BY p.last_completed_at DESC, p.lesson_id ASC`,
  ).bind(c.get("userId")).all();

  return c.json({
    data: result.results,
    meta: { requestId: c.get("requestId") },
  });
});

learning.get("/me/history", requireSession, async (c) => {
  const rawLimit = c.req.query("limit");
  const limit = rawLimit === undefined ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError("VALIDATION_ERROR", "limit must be an integer between 1 and 50.", 400);
  }

  const rawCursor = c.req.query("cursor");
  const cursor = rawCursor === undefined ? null : decodePageCursor(rawCursor);
  if (rawCursor !== undefined && !cursor) {
    throw new AppError("VALIDATION_ERROR", "The history cursor is invalid.", 400);
  }

  const result = await c.env.DB.prepare(
    `SELECT a.id AS attempt_id, a.lesson_id, a.lesson_version,
            COALESCE(lv.title, l.title) AS lesson_title,
            l.course_id, c.title AS course_title,
            a.score, a.started_at, a.completed_at,
            (SELECT COUNT(*) FROM attempt_questions aq WHERE aq.attempt_id = a.id) AS question_count,
            (SELECT COUNT(*) FROM attempt_answers aa
             WHERE aa.attempt_id = a.id AND aa.is_correct = 1) AS correct_answer_count
     FROM lesson_attempts a
     JOIN lessons l ON l.id = a.lesson_id
     JOIN courses c ON c.id = l.course_id
     LEFT JOIN lesson_versions lv ON lv.id = a.lesson_version_id
     WHERE a.user_id = ? AND a.status = 'completed' AND a.completed_at IS NOT NULL
       AND (? IS NULL OR a.completed_at < ?
            OR (a.completed_at = ? AND a.id < ?))
     ORDER BY a.completed_at DESC, a.id DESC
     LIMIT ?`,
  ).bind(
    c.get("userId"),
    cursor?.timestamp ?? null,
    cursor?.timestamp ?? null,
    cursor?.timestamp ?? null,
    cursor?.id ?? null,
    limit + 1,
  ).all<{
    attempt_id: string;
    lesson_id: string;
    lesson_version: number;
    lesson_title: string;
    course_id: string;
    course_title: string;
    score: number | null;
    started_at: string;
    completed_at: string;
    question_count: number;
    correct_answer_count: number;
  }>();

  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return c.json({
    data: page.map((row) => ({
      attemptId: row.attempt_id,
      lessonId: row.lesson_id,
      lessonVersion: row.lesson_version,
      lessonTitle: row.lesson_title,
      courseId: row.course_id,
      courseTitle: row.course_title,
      status: "completed" as const,
      score: row.score,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      questionCount: row.question_count,
      correctAnswerCount: row.correct_answer_count,
    })),
    meta: {
      requestId: c.get("requestId"),
      nextCursor: hasMore && last
        ? encodePageCursor(last.completed_at, last.attempt_id)
        : null,
    },
  });
});

export default learning;
