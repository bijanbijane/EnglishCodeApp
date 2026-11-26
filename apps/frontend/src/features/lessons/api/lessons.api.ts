import { apiGet } from "../../../shared/api/client";
import type { Lesson } from "../model/lesson.types";

function parseLesson(value: unknown): Lesson {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار یکی از درس‌ها معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || typeof row.title !== "string" ||
      typeof row.level !== "string" || typeof row.position !== "number" || !Number.isFinite(row.position)) {
    throw new Error("اطلاعات یکی از درس‌ها ناقص است.");
  }
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    position: row.position,
    description: typeof row.description === "string" ? row.description : null,
  };
}

export async function getLessons(): Promise<Lesson[]> {
  const payload = await apiGet<unknown>("/api/v1/lessons");
  if (!Array.isArray(payload)) throw new Error("پاسخ فهرست درس‌ها معتبر نیست.");
  return payload.map(parseLesson);
}
