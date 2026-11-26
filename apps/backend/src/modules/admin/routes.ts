import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireSession } from "../auth/middleware";
import { createAdminAuditStatement } from "./audit";
import { requireRole } from "./authorization";

export const adminRoutes = new Hono<AppEnv>();

const LEVELS = new Set(["Pre-A1", "A1", "A2", "B1", "B2", "C1", "C2"]);
const REVIEW_REASONS = new Set(["approved", "quality_issue", "factual_error", "format_error", "policy_violation"]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const OPTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

interface DraftOption { id: string; text: string; }

interface DraftQuestion {
  sourceQuestionId?: string;
  type: "multiple_choice";
  prompt: string;
  options: DraftOption[];
  answerKey: string;
  explanation: string;
  weight: number;
  position: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseQuestions(value: unknown): DraftQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const result: DraftQuestion[] = [];
  const sourceIds = new Set<string>();
  const positions = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) return null;
    const sourceQuestionId = item.sourceQuestionId;
    const questionType = item.type ?? "multiple_choice";
    const prompt = item.prompt;
    const options = item.options;
    const answerKey = item.answerKey;
    const explanation = item.explanation ?? "";
    const weight = item.weight ?? 1;
    const position = item.position ?? index + 1;
    if (sourceQuestionId !== undefined &&
        (typeof sourceQuestionId !== "string" || !ID_PATTERN.test(sourceQuestionId) || sourceIds.has(sourceQuestionId))) return null;
    if (questionType !== "multiple_choice" ||
        typeof prompt !== "string" || prompt.trim().length < 1 || prompt.length > 2000 ||
        !Array.isArray(options) || options.length < 2 || options.length > 10 ||
        !options.every((option) => isRecord(option) &&
          typeof option.id === "string" && OPTION_ID_PATTERN.test(option.id) &&
          typeof option.text === "string" && option.text.trim().length > 0 && option.text.length <= 256) ||
        new Set(options.map((option) => (option as { id: string }).id)).size !== options.length ||
        typeof answerKey !== "string" || !options.some((option) => (option as { id: string }).id === answerKey) ||
        typeof explanation !== "string" || explanation.length > 4000 ||
        typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0 || weight > 100 ||
        !Number.isInteger(position) || (position as number) < 0 || (position as number) > 10000 ||
        positions.has(position as number)) return null;
    if (typeof sourceQuestionId === "string") sourceIds.add(sourceQuestionId);
    positions.add(position as number);
    result.push({
      ...(typeof sourceQuestionId === "string" ? { sourceQuestionId } : {}),
      type: "multiple_choice", prompt: prompt.trim(), options: options as DraftOption[], answerKey,
      explanation, weight, position: position as number
    });
  }
  return result;
}

adminRoutes.post(
  "/content/lessons/:lessonId/versions",
  requireSession,
  requireRole("content_author"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content storage is unavailable.", c.get("requestId")), 503);
    let parsed: unknown;
    try { parsed = await c.req.json(); }
    catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
    if (!isRecord(parsed)) return c.json(errorBody("INVALID_REQUEST", "Request body must be an object.", c.get("requestId")), 400);
    const questions = parseQuestions(parsed.questions);
    const title = parsed.title;
    const level = parsed.level;
    if (!questions || (title !== undefined && (typeof title !== "string" || title.trim().length < 1 || title.length > 200)) ||
        (level !== undefined && (typeof level !== "string" || !LEVELS.has(level)))) {
      return c.json(errorBody("INVALID_CONTENT_VERSION", "Lesson title, level or question payload is invalid.", c.get("requestId")), 400);
    }

    const lessonId = c.req.param("lessonId");
    const current = await c.env.DB.prepare(
      "SELECT lv.title,lv.level,lv.position FROM lessons l " +
      "INNER JOIN lesson_versions lv ON lv.id=l.current_published_version_id " +
      "WHERE l.id=? AND l.status='published' AND lv.status='published' LIMIT 1"
    ).bind(lessonId).first<{ title: string; level: string; position: number }>();
    if (!current) return c.json(errorBody("LESSON_NOT_FOUND", "Published lesson was not found.", c.get("requestId")), 404);

    const next = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(version),0)+1 AS version FROM lesson_versions WHERE lesson_id=?"
    ).bind(lessonId).first<{ version: number }>();
    const version = next?.version ?? 2;
    const versionId = crypto.randomUUID();
    const actor = c.get("userId");
    const statements = [
      c.env.DB.prepare(
        "INSERT INTO lesson_versions (id,lesson_id,version,title,level,position,status,created_by_user_id) " +
        "VALUES (?,?,?,?,?,?,'draft',?)"
      ).bind(versionId, lessonId, version, typeof title === "string" ? title.trim() : current.title,
        typeof level === "string" ? level : current.level, current.position, actor)
    ];

    const suppliedIds = questions.flatMap((question) => question.sourceQuestionId ? [question.sourceQuestionId] : []);
    if (suppliedIds.length) {
      const placeholders = suppliedIds.map(() => "?").join(",");
      const existing = await c.env.DB.prepare(
        "SELECT id FROM questions WHERE lesson_id=? AND id IN (" + placeholders + ")"
      ).bind(lessonId, ...suppliedIds).all<{ id: string }>();
      if ((existing.results ?? []).length !== suppliedIds.length) {
        return c.json(errorBody("QUESTION_SOURCE_NOT_FOUND", "A source question does not belong to this lesson.", c.get("requestId")), 400);
      }
    }

    for (const question of questions) {
      const questionId = question.sourceQuestionId ?? crypto.randomUUID();
      const optionsJson = JSON.stringify(question.options);
      if (!question.sourceQuestionId) {
        statements.push(c.env.DB.prepare(
          "INSERT INTO questions (id,lesson_id,type,prompt,options_json,answer_key,explanation,position) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(questionId, lessonId, question.type, question.prompt, optionsJson, question.answerKey, question.explanation, question.position));
      }
      statements.push(c.env.DB.prepare(
        "INSERT INTO question_versions (id,lesson_version_id,source_question_id,question_type,prompt,options_json,answer_key,explanation,weight,position) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(crypto.randomUUID(), versionId, questionId, question.type, question.prompt, optionsJson,
        question.answerKey, question.explanation, question.weight, question.position));
    }

    statements.push(createAdminAuditStatement(c.env.DB, {
      actorUserId: actor, action: "content.version.created", resourceType: "lesson_version",
      resourceId: versionId, requestId: c.get("requestId"),
      metadata: { version, status: "draft", source: "admin_api" }
    }));
    try {
      await c.env.DB.batch(statements);
    } catch (error) {
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
        return c.json(errorBody("CONTENT_VERSION_CONFLICT", "A concurrent content version write conflicted. Refresh and retry.", c.get("requestId")), 409);
      }
      throw error;
    }
    return c.json({ data: { lessonId, lessonVersionId: versionId, version, status: "draft", questionCount: questions.length } }, 201);
  }
);

adminRoutes.post(
  "/content/lessons/:lessonId/versions/:versionId/submit-review",
  requireSession,
  requireRole("content_author"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content review storage is unavailable.", c.get("requestId")), 503);
    const actor = c.get("userId");
    const version = await c.env.DB.prepare(
      "SELECT id,status,created_by_user_id FROM lesson_versions WHERE id=? AND lesson_id=? LIMIT 1"
    ).bind(c.req.param("versionId"), c.req.param("lessonId"))
      .first<{ id: string; status: string; created_by_user_id: string | null }>();
    if (!version) return c.json(errorBody("CONTENT_VERSION_NOT_FOUND", "Content version was not found.", c.get("requestId")), 404);
    if (version.created_by_user_id !== actor) {
      return c.json(errorBody("FORBIDDEN", "Only the author may submit this draft for review.", c.get("requestId")), 403);
    }
    if (version.status !== "draft") {
      return c.json(errorBody("CONTENT_VERSION_NOT_DRAFT", "Only a draft version can be submitted.", c.get("requestId")), 409);
    }
    const requestId = crypto.randomUUID();
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO content_review_requests (id,lesson_version_id,author_user_id,status) VALUES (?,?,?,'pending')"
        ).bind(requestId, version.id, actor),
        c.env.DB.prepare(
          "INSERT INTO content_review_events (id,request_id,actor_user_id,event_type) " +
          "SELECT ?,?,?,'submitted' WHERE changes()=1"
        ).bind(crypto.randomUUID(), requestId, actor),
        createAdminAuditStatement(c.env.DB, {
          actorUserId: actor, action: "content.review.submitted", resourceType: "content_review",
          resourceId: requestId, requestId: c.get("requestId"),
          metadata: { status: "pending", source: "admin_api" }
        }, true)
      ]);
    } catch (error) {
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
        return c.json(errorBody("REVIEW_ALREADY_SUBMITTED", "This content version already has a review request.", c.get("requestId")), 409);
      }
      throw error;
    }
    return c.json({ data: { reviewRequestId: requestId, status: "pending" } }, 201);
  }
);

adminRoutes.post(
  "/content/reviews/:requestId/decision",
  requireSession,
  requireRole("content_reviewer"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content review storage is unavailable.", c.get("requestId")), 503);
    let parsed: unknown;
    try { parsed = await c.req.json(); }
    catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
    if (!isRecord(parsed) || (parsed.decision !== "approve" && parsed.decision !== "reject")) {
      return c.json(errorBody("INVALID_REVIEW_DECISION", "decision must be approve or reject.", c.get("requestId")), 400);
    }
    const decision = parsed.decision;
    const reasonCode = parsed.reasonCode ?? (decision === "approve" ? "approved" : undefined);
    if (typeof reasonCode !== "string" || !REVIEW_REASONS.has(reasonCode) ||
        (decision === "reject" && reasonCode === "approved")) {
      return c.json(errorBody("INVALID_REVIEW_REASON", "A valid reasonCode is required.", c.get("requestId")), 400);
    }
    const actor = c.get("userId");
    const requestId = c.req.param("requestId");
    const review = await c.env.DB.prepare(
      "SELECT id,author_user_id,status FROM content_review_requests WHERE id=? LIMIT 1"
    ).bind(requestId).first<{ id: string; author_user_id: string; status: string }>();
    if (!review) return c.json(errorBody("REVIEW_NOT_FOUND", "Review request was not found.", c.get("requestId")), 404);
    if (review.author_user_id === actor) {
      return c.json(errorBody("SELF_REVIEW_FORBIDDEN", "Authors cannot review their own content.", c.get("requestId")), 403);
    }
    if (review.status !== "pending") {
      return c.json(errorBody("REVIEW_NOT_PENDING", "This review request is no longer pending.", c.get("requestId")), 409);
    }
    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const eventType = decision === "approve" ? "approved" : "rejected";
    const reviewedAt = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE content_review_requests SET status=?,reviewed_by_user_id=?,reviewed_at=?,reason_code=? " +
        "WHERE id=? AND status='pending' AND author_user_id<>?"
      ).bind(nextStatus, actor, reviewedAt, reasonCode, requestId, actor),
      c.env.DB.prepare(
        "INSERT INTO content_review_events (id,request_id,actor_user_id,event_type,reason_code) " +
        "SELECT ?,?,?,?,? WHERE changes()=1"
      ).bind(crypto.randomUUID(), requestId, actor, eventType, reasonCode),
      createAdminAuditStatement(c.env.DB, {
        actorUserId: actor, action: "content.review." + eventType, resourceType: "content_review",
        resourceId: requestId, requestId: c.get("requestId"),
        metadata: { status: nextStatus, reasonCode, source: "admin_api" }
      }, true)
    ]);
    const saved = await c.env.DB.prepare(
      "SELECT status,reviewed_by_user_id FROM content_review_requests WHERE id=? LIMIT 1"
    ).bind(requestId).first<{ status: string; reviewed_by_user_id: string | null }>();
    if (!saved || saved.status !== nextStatus || saved.reviewed_by_user_id !== actor) {
      return c.json(errorBody("REVIEW_CONFLICT", "The review request changed concurrently.", c.get("requestId")), 409);
    }
    return c.json({ data: { reviewRequestId: requestId, status: saved.status, reasonCode } });
  }
);

adminRoutes.post(
  "/content/reviews/:requestId/publish",
  requireSession,
  requireRole("admin"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content publishing storage is unavailable.", c.get("requestId")), 503);
    const requestId = c.req.param("requestId");
    const review = await c.env.DB.prepare(
      "SELECT r.id,r.status,r.lesson_version_id,lv.lesson_id,lv.version " +
      "FROM content_review_requests r INNER JOIN lesson_versions lv ON lv.id=r.lesson_version_id " +
      "WHERE r.id=? LIMIT 1"
    ).bind(requestId).first<{
      id: string; status: string; lesson_version_id: string; lesson_id: string; version: number;
    }>();
    if (!review) return c.json(errorBody("REVIEW_NOT_FOUND", "Review request was not found.", c.get("requestId")), 404);
    if (review.status !== "approved") {
      return c.json(errorBody("CONTENT_NOT_APPROVED", "Only approved content can be published.", c.get("requestId")), 409);
    }
    const questionCount = await c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM question_versions WHERE lesson_version_id=?"
    ).bind(review.lesson_version_id).first<{ count: number }>();
    if (!questionCount || questionCount.count < 1) {
      return c.json(errorBody("CONTENT_EMPTY", "A lesson version must contain at least one question.", c.get("requestId")), 409);
    }

    const publishedAt = new Date().toISOString();
    const actor = c.get("userId");
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE lesson_versions SET status='published',published_at=? " +
        "WHERE id=? AND lesson_id=? AND status='draft' " +
        "AND EXISTS (SELECT 1 FROM content_review_requests WHERE id=? AND status='approved')"
      ).bind(publishedAt, review.lesson_version_id, review.lesson_id, requestId),
      c.env.DB.prepare(
        "UPDATE lessons SET status='published',current_published_version_id=? " +
        "WHERE id=? AND changes()=1 AND EXISTS (SELECT 1 FROM lesson_versions WHERE id=? AND status='published')"
      ).bind(review.lesson_version_id, review.lesson_id, review.lesson_version_id),
      c.env.DB.prepare(
        "UPDATE content_review_requests SET status='published' WHERE id=? AND status='approved' AND changes()=1"
      ).bind(requestId),
      c.env.DB.prepare(
        "INSERT INTO content_review_events (id,request_id,actor_user_id,event_type) " +
        "SELECT ?,?,?,'published' WHERE changes()=1"
      ).bind(crypto.randomUUID(), requestId, actor),
      createAdminAuditStatement(c.env.DB, {
        actorUserId: actor, action: "content.version.published", resourceType: "lesson_version",
        resourceId: review.lesson_version_id, requestId: c.get("requestId"),
        metadata: { version: review.version, status: "published", source: "admin_api" }
      }, true)
    ]);
    const saved = await c.env.DB.prepare(
      "SELECT status FROM content_review_requests WHERE id=? LIMIT 1"
    ).bind(requestId).first<{ status: string }>();
    if (!saved || saved.status !== "published") {
      return c.json(errorBody("PUBLISH_CONFLICT", "The content version could not be published atomically.", c.get("requestId")), 409);
    }
    return c.json({ data: { reviewRequestId: requestId, lessonId: review.lesson_id, lessonVersionId: review.lesson_version_id, version: review.version, status: "published" } });
  }
);

adminRoutes.get(
  "/content/lessons/:lessonId/versions",
  requireSession,
  requireRole("content_author"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content storage is unavailable.", c.get("requestId")), 503);
    const rows = await c.env.DB.prepare(
      "SELECT lv.id,lv.version,lv.title,lv.level,lv.status,lv.created_at,cr.status AS review_status " +
      "FROM lesson_versions lv LEFT JOIN content_review_requests cr ON cr.lesson_version_id=lv.id " +
      "WHERE lv.lesson_id=? AND lv.created_by_user_id=? ORDER BY lv.version DESC LIMIT 50"
    ).bind(c.req.param("lessonId"), c.get("userId")).all<{
      id: string; version: number; title: string; level: string; status: string;
      created_at: string; review_status: string | null;
    }>();
    return c.json({ data: rows.results ?? [] });
  }
);

adminRoutes.get(
  "/content/reviews",
  requireSession,
  requireRole("content_reviewer"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content review storage is unavailable.", c.get("requestId")), 503);
    const status = c.req.query("status") ?? "pending";
    const limit = Number(c.req.query("limit") ?? 20);
    if (!["pending", "approved", "rejected", "published"].includes(status) ||
        !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return c.json(errorBody("INVALID_REVIEW_QUERY", "status or limit is invalid.", c.get("requestId")), 400);
    }
    const rows = await c.env.DB.prepare(
      "SELECT r.id AS review_request_id,r.status,r.submitted_at,r.reviewed_at,r.reason_code," +
      "lv.id AS lesson_version_id,lv.version,lv.title,lv.level,lv.lesson_id " +
      "FROM content_review_requests r INNER JOIN lesson_versions lv ON lv.id=r.lesson_version_id " +
      "WHERE r.status=? ORDER BY r.submitted_at ASC LIMIT ?"
    ).bind(status, limit).all();
    return c.json({ data: rows.results ?? [] });
  }
);

adminRoutes.get(
  "/content/reviews/:requestId",
  requireSession,
  requireRole("content_reviewer"),
  async (c) => {
    if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Content review storage is unavailable.", c.get("requestId")), 503);
    const review = await c.env.DB.prepare(
      "SELECT r.id,r.status,r.author_user_id,r.reviewed_by_user_id,r.reason_code,r.submitted_at,r.reviewed_at," +
      "lv.id AS lesson_version_id,lv.lesson_id,lv.version,lv.title,lv.level " +
      "FROM content_review_requests r INNER JOIN lesson_versions lv ON lv.id=r.lesson_version_id " +
      "WHERE r.id=? LIMIT 1"
    ).bind(c.req.param("requestId")).first<{
      id: string; status: string; author_user_id: string; reviewed_by_user_id: string | null;
      reason_code: string | null; submitted_at: string; reviewed_at: string | null;
      lesson_version_id: string; lesson_id: string; version: number; title: string; level: string;
    }>();
    if (!review) return c.json(errorBody("REVIEW_NOT_FOUND", "Review request was not found.", c.get("requestId")), 404);
    const questions = await c.env.DB.prepare(
      "SELECT source_question_id,prompt,options_json,answer_key,explanation,weight,position " +
      "FROM question_versions WHERE lesson_version_id=? ORDER BY position ASC"
    ).bind(review.lesson_version_id).all<{
      source_question_id: string; prompt: string; options_json: string; answer_key: string;
      explanation: string; weight: number; position: number;
    }>();
    const data = (questions.results ?? []).map((question) => {
      let options: unknown;
      try { options = JSON.parse(question.options_json); }
      catch { options = []; }
      return {
        sourceQuestionId: question.source_question_id, prompt: question.prompt,
        options: Array.isArray(options) ? options : [], answerKey: question.answer_key,
        explanation: question.explanation, weight: question.weight, position: question.position
      };
    });
    return c.json({ data: {
      reviewRequestId: review.id, status: review.status, authorUserId: review.author_user_id,
      reviewedByUserId: review.reviewed_by_user_id, reasonCode: review.reason_code,
      submittedAt: review.submitted_at, reviewedAt: review.reviewed_at,
      lesson: { id: review.lesson_id, versionId: review.lesson_version_id, version: review.version, title: review.title, level: review.level },
      questions: data
    } });
  }
);
