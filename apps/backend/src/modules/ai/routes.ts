import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";
import { requireSession } from "../auth/middleware";
import { getWebmOpusDurationSeconds } from "./webm";
const ai = new Hono<AppEnv>();
const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 1024 * 1024;
const MAX_DURATION_SECONDS = 60;
const GLOBAL_DAILY_LIMIT = 60;
const USER_DAILY_LIMIT = 2;
const PRE_PARSE_WINDOW_MS = 60 * 1000;
const PRE_PARSE_REQUEST_LIMIT = 10;
type Result = { text?: string; word_count?: number; transcription_info?: { language?: string } };

async function consumePreParseRateLimit(db: D1Database, userId: string, now = new Date()): Promise<number> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ai-transcription:${userId}`),
  );
  const bucketKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const windowStart = new Date(
    Math.floor(now.getTime() / PRE_PARSE_WINDOW_MS) * PRE_PARSE_WINDOW_MS,
  ).toISOString();
  const updatedAt = now.toISOString();

  try {
    const result = await db.prepare(
      `INSERT INTO auth_rate_limits (bucket_key, window_start, request_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET
         request_count = CASE
           WHEN auth_rate_limits.window_start = excluded.window_start
             THEN auth_rate_limits.request_count + 1
           ELSE 1
         END,
         window_start = excluded.window_start,
         updated_at = excluded.updated_at
       RETURNING request_count`,
    ).bind(bucketKey, windowStart, updatedAt).first<{ request_count: number }>();

    if (!result || !Number.isSafeInteger(result.request_count) || result.request_count < 1) {
      throw new Error("Rate limit storage returned an invalid result.");
    }
    return result.request_count;
  } catch {
    throw new AppError("SERVICE_UNAVAILABLE", "Transcription request protection is temporarily unavailable.", 503);
  }
}
type Result = { text?: string; word_count?: number; transcription_info?: { language?: string } };

function parsePayload(value: unknown): { audioBase64: string; durationSeconds: number } {
  if (typeof value !== "object" || value === null) {
    throw new AppError("VALIDATION_ERROR", "A valid audio payload is required.", 400);
  }
  const body = value as Record<string, unknown>;
  const declaredMime = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
  const mimeType = declaredMime.split(";")[0]?.trim() ?? "";
  const codecParameter = declaredMime
    .split(";")
    .slice(1)
    .map((parameter) => parameter.trim())
    .find((parameter) => parameter.toLowerCase().startsWith("codecs="))
    ?.slice("codecs=".length)
    .replaceAll('"', "")
    .trim()
    .toLowerCase();

  if (
    typeof body.audioBase64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audioBase64) ||
    body.audioBase64.length === 0 ||
    body.audioBase64.length > 4 * Math.ceil(MAX_AUDIO_BYTES / 3) ||
    mimeType !== "audio/webm" ||
    (codecParameter !== undefined && codecParameter !== "opus")
  ) {
    throw new AppError("VALIDATION_ERROR", "Only WebM audio encoded with Opus is supported.", 400);
  }

  let decoded: string;
  try {
    decoded = atob(body.audioBase64);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Audio data is not valid base64.", 400);
  }
  if (decoded.length === 0 || decoded.length > MAX_AUDIO_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Audio payload exceeds 1 MiB.", 413);
  }

  const audioBytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  let durationSeconds: number;
  try {
    durationSeconds = getWebmOpusDurationSeconds(audioBytes);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Audio file is invalid or its duration cannot be verified.", 400);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    throw new AppError("VALIDATION_ERROR", "Audio recording must be longer than zero and no longer than 60 seconds.", 400);
  }

  return { audioBase64: body.audioBase64, durationSeconds };
}
ai.post("/ai/transcriptions", requireSession, async (c, next) => {
  const count = await consumePreParseRateLimit(c.env.DB, c.get("userId"));
  if (count > PRE_PARSE_REQUEST_LIMIT) {
    throw new AppError("RATE_LIMITED", "Too many transcription requests. Try again in a minute.", 429);
  }
  await next();
}, bodyLimit({ maxSize: 1536 * 1024, onError: (c) => c.json({
  error: { code: "PAYLOAD_TOO_LARGE", message: "Audio request exceeds the allowed size.", requestId: c.get("requestId") },
}, 413) }), async (c) => {
  if (!c.req.header("content-type")?.toLowerCase().includes("application/json")) throw new AppError("VALIDATION_ERROR", "Content-Type must be application/json.", 400);
  let raw: unknown;
  try { raw = await c.req.json(); } catch { throw new AppError("VALIDATION_ERROR", "A valid JSON audio payload is required.", 400); }
  const body = parsePayload(raw);
  const userId = c.get("userId");
  const day = new Date().toISOString().slice(0, 10);
  const requestId = crypto.randomUUID();
  const globalId = `global:${requestId}`, userIdReservation = `user:${requestId}`;
  const reservations = await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO ai_transcription_reservations (id, day_utc, user_id)
      SELECT ?, ?, '*' WHERE (SELECT COUNT(*) FROM ai_transcription_reservations WHERE day_utc = ? AND user_id = '*') < ?`)
      .bind(globalId, day, day, GLOBAL_DAILY_LIMIT),
    c.env.DB.prepare(`INSERT INTO ai_transcription_reservations (id, day_utc, user_id)
      SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM ai_transcription_reservations WHERE id = ?)
      AND (SELECT COUNT(*) FROM ai_transcription_reservations WHERE day_utc = ? AND user_id = ?) < ?`)
      .bind(userIdReservation, day, userId, globalId, day, userId, USER_DAILY_LIMIT),
    c.env.DB.prepare(`DELETE FROM ai_transcription_reservations WHERE id = ?
      AND NOT EXISTS (SELECT 1 FROM ai_transcription_reservations WHERE id = ?)`)
      .bind(globalId, userIdReservation),
  ]);
  if (reservations[1]?.meta.changes !== 1) throw new AppError("RATE_LIMITED", "The free daily transcription allowance has been reached.", 429);
  try {
    const result = await c.env.AI.run(MODEL, { audio: body.audioBase64, task: "transcribe", language: "en", vad_filter: true }) as Result;
    if (typeof result.text !== "string" || result.text.trim().length === 0) throw new AppError("INTERNAL_ERROR", "Speech could not be transcribed.", 502);
    return c.json({
      data: { transcription: result.text, wordCount: result.word_count ?? result.text.trim().split(/\s+/).length, language: result.transcription_info?.language ?? "en", durationSeconds: body.durationSeconds, model: MODEL },
      meta: { requestId: c.get("requestId"), quota: { userDailyLimit: USER_DAILY_LIMIT, globalDailyLimit: GLOBAL_DAILY_LIMIT, resetsAt: "00:00 UTC" } },
    });
  } catch (error) {
    // Keep the reservation after an inference attempt, including upstream failures.
    // Releasing it here would let repeated failed calls bypass the daily free-tier cap.
    if (error instanceof AppError) throw error;
    throw new AppError("SERVICE_UNAVAILABLE", "Speech transcription is temporarily unavailable.", 503);
  }
});
export default ai;
