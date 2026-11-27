import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";
import { requireSession } from "../auth/middleware";
import { getWebmOpusDurationSeconds } from "./webm";
const ai = new Hono<AppEnv>();
const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 96 * 1024;
const MAX_DURATION_SECONDS = 60;
const GLOBAL_DAILY_LIMIT = 60;
const USER_DAILY_LIMIT = 2;
type Result = { text?: string; word_count?: number; transcription_info?: { language?: string } };

function parsePayload(value: unknown): { audioBase64: string; durationSeconds: number } {
  if (typeof value !== "object" || value === null) {
    throw new AppError("VALIDATION_ERROR", "A valid audio payload is required.", 400);
  }
  const body = value as Record<string, unknown>;
  const declaredMime = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
  const mimeType = declaredMime.split(";")[0]?.trim() ?? "";
  const codecParameter = declaredMime.match(/(?:^|;)\\s*codecs\\s*=\\s*"?([^";\\s]+)"?/i)?.[1];

  if (
    typeof body.audioBase64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audioBase64) ||
    body.audioBase64.length === 0 ||
    body.audioBase64.length > 132000 ||
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
    throw new AppError("VALIDATION_ERROR", "Audio payload exceeds 96 KiB.", 413);
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
ai.post("/ai/transcriptions", bodyLimit({ maxSize: 192 * 1024, onError: (c) => c.json({
  error: { code: "PAYLOAD_TOO_LARGE", message: "Audio request exceeds the allowed size.", requestId: c.get("requestId") },
}, 413) }), requireSession, async (c) => {
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
