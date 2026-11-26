import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireAuth } from "../auth/middleware";
import { scheduleNextReview, type ReviewRating } from "../review/scheduler";

export const vocabularyRoutes = new Hono<AppBindings>();
vocabularyRoutes.use("/me/*", requireAuth);

interface VocabularyRow {
  id: string;
  lemma: string;
  definition: string;
  example: string | null;
  source_language: string;
  target_language: string;
  state: string;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  lapses: number;
  scheduler_version: number;
  revision: number;
}

vocabularyRoutes.get("/me/vocabulary", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Vocabulary storage is unavailable.", c.get("requestId")), 503);
  const rawLimit = Number(c.req.query("limit") ?? 50);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    return c.json(errorBody("INVALID_LIMIT", "limit must be an integer from 1 to 100.", c.get("requestId")), 400);
  }
  const rows = await c.env.DB.prepare(
    "SELECT i.id,i.lemma,i.definition,i.example,i.source_language,i.target_language," +
    "uv.state,uv.due_at,uv.interval_days,uv.ease_factor,uv.repetitions,uv.lapses,uv.scheduler_version,uv.revision " +
    "FROM user_vocabulary uv INNER JOIN vocabulary_items i ON i.id=uv.item_id " +
    "WHERE uv.user_id=? AND i.status='published' ORDER BY uv.due_at ASC LIMIT ?"
  ).bind(c.get("user").id, rawLimit).all<VocabularyRow>();
  return c.json({ data: rows.results ?? [] });
});

vocabularyRoutes.get("/me/reviews/due", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Review storage is unavailable.", c.get("requestId")), 503);
  const rawLimit = Number(c.req.query("limit") ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    return c.json(errorBody("INVALID_LIMIT", "limit must be an integer from 1 to 100.", c.get("requestId")), 400);
  }
  const rows = await c.env.DB.prepare(
    "SELECT i.id,i.lemma,i.definition,i.example,i.source_language,i.target_language," +
    "uv.state,uv.due_at,uv.interval_days,uv.ease_factor,uv.repetitions,uv.lapses " +
    "FROM user_vocabulary uv INNER JOIN vocabulary_items i ON i.id=uv.item_id " +
    "WHERE uv.user_id=? AND uv.state!='suspended' AND uv.due_at<=? AND i.status='published' " +
    "ORDER BY uv.due_at ASC LIMIT ?"
  ).bind(c.get("user").id, new Date().toISOString(), rawLimit).all();
  return c.json({ data: rows.results ?? [] });
});

vocabularyRoutes.post("/me/vocabulary/:itemId", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Vocabulary storage is unavailable.", c.get("requestId")), 503);
  const userId = c.get("user").id;
  const itemId = c.req.param("itemId");
  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO user_vocabulary " +
    "(user_id,item_id,state,due_at,interval_days,ease_factor,repetitions,lapses,scheduler_version,revision,created_at,updated_at) " +
    "SELECT ?,id,'learning',?,0,2.5,0,0,1,0,?,? FROM vocabulary_items WHERE id=? AND status='published'"
  ).bind(userId, now, now, now, itemId).run();
  const saved = await c.env.DB.prepare(
    "SELECT item_id,state,due_at FROM user_vocabulary WHERE user_id=? AND item_id=? LIMIT 1"
  ).bind(userId, itemId).first<{ item_id: string; state: string; due_at: string }>();
  if (!saved) return c.json(errorBody("VOCABULARY_ITEM_NOT_FOUND", "Published vocabulary item was not found.", c.get("requestId")), 404);
  return c.json({ data: saved }, result.meta?.changes === 1 ? 201 : 200);
});

vocabularyRoutes.post("/me/reviews/:itemId", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Review storage is unavailable.", c.get("requestId")), 503);
  let parsed: unknown;
  try { parsed = await c.req.json(); }
  catch { return c.json(errorBody("INVALID_REQUEST", "Request body must be valid JSON.", c.get("requestId")), 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return c.json(errorBody("INVALID_REQUEST", "Request body must be a JSON object.", c.get("requestId")), 400);
  }
  const body = parsed as { rating?: unknown; idempotencyKey?: unknown };
  if (!Number.isInteger(body.rating) || (body.rating as number) < 0 || (body.rating as number) > 3 ||
      typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(body.idempotencyKey)) {
    return c.json(errorBody("INVALID_REVIEW", "rating must be 0..3 and idempotencyKey must be 8..128 safe characters.", c.get("requestId")), 400);
  }

  const userId = c.get("user").id;
  const itemId = c.req.param("itemId");
  const rating = body.rating as ReviewRating;
  const reviewedAt = new Date();
  const reviewedAtIso = reviewedAt.toISOString();
  const current = await c.env.DB.prepare(
    "SELECT due_at,interval_days,ease_factor,repetitions,lapses,revision FROM user_vocabulary " +
    "WHERE user_id=? AND item_id=? LIMIT 1"
  ).bind(userId, itemId).first<{
    due_at: string; interval_days: number; ease_factor: number;
    repetitions: number; lapses: number; revision: number;
  }>();

  if (!current) return c.json(errorBody("VOCABULARY_NOT_ENROLLED", "This item is not in the user's vocabulary.", c.get("requestId")), 404);
  const next = scheduleNextReview({
    intervalDays: current.interval_days,
    easeFactor: current.ease_factor,
    repetitions: current.repetitions,
    lapses: current.lapses
  }, rating, reviewedAt);

  // Optimistic revision prevents two distinct simultaneous reviews from
  // overwriting each other's schedule. The event is inserted only if UPDATE won.
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE user_vocabulary SET state=?,due_at=?,interval_days=?,ease_factor=?,repetitions=?,lapses=?," +
      "last_reviewed_at=?,scheduler_version=?,updated_at=?,revision=revision+1 " +
      "WHERE user_id=? AND item_id=? AND revision=? " +
      "AND NOT EXISTS (SELECT 1 FROM vocabulary_review_events WHERE user_id=? AND idempotency_key=?)"
    ).bind(
      next.state, next.dueAt, next.intervalDays, next.easeFactor, next.repetitions, next.lapses,
      reviewedAtIso, next.schedulerVersion, reviewedAtIso, userId, itemId, current.revision,
      userId, body.idempotencyKey
    ),
    c.env.DB.prepare(
      "INSERT INTO vocabulary_review_events " +
      "(id,user_id,item_id,idempotency_key,rating,scheduler_version,reviewed_at,previous_due_at,next_due_at,interval_days) " +
      "SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=1"
    ).bind(
      crypto.randomUUID(), userId, itemId, body.idempotencyKey, rating, next.schedulerVersion,
      reviewedAtIso, current.due_at, next.dueAt, next.intervalDays
    )
  ]);

  const event = await c.env.DB.prepare(
    "SELECT item_id,rating,next_due_at,interval_days,scheduler_version FROM vocabulary_review_events " +
    "WHERE user_id=? AND idempotency_key=? LIMIT 1"
  ).bind(userId, body.idempotencyKey).first<{
    item_id: string; rating: number; next_due_at: string; interval_days: number; scheduler_version: number;
  }>();

  if (event) {
    if (event.item_id !== itemId || event.rating !== rating) {
      return c.json(errorBody("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different review.", c.get("requestId")), 409);
    }
    return c.json({ data: {
      itemId: event.item_id, rating: event.rating, dueAt: event.next_due_at,
      intervalDays: event.interval_days, schedulerVersion: event.scheduler_version
    } });
  }

  return c.json(errorBody("REVIEW_CONFLICT", "Review state changed concurrently. Retry with a new idempotency key.", c.get("requestId")), 409);
});
