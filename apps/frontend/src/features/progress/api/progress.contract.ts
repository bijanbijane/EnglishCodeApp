export type LessonProgress = {
  lesson_id: string;
  best_score: number;
  completed_count: number;
  last_completed_at: string | null;
};

function parseProgressRow(value: unknown): LessonProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار یکی از سوابق پیشرفت معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.lesson_id !== "string" || !row.lesson_id.trim() || typeof row.best_score !== "number" ||
      typeof row.completed_count !== "number" || !Number.isSafeInteger(row.completed_count) || row.completed_count < 0 ||
      !Number.isSafeInteger(row.best_score) || row.best_score < 0 || row.best_score > 100 ||
      !(row.last_completed_at === null || (typeof row.last_completed_at === "string" && Number.isFinite(Date.parse(row.last_completed_at))))) {
    throw new Error("اطلاعات یکی از سوابق پیشرفت ناقص است.");
  }
  return {
    lesson_id: row.lesson_id,
    best_score: row.best_score,
    completed_count: row.completed_count,
    last_completed_at: row.last_completed_at,
  };
}

export function parseLessonProgressList(value: unknown): LessonProgress[] {
  if (!Array.isArray(value)) throw new Error("پاسخ سوابق پیشرفت معتبر نیست.");
  const rows = value.map(parseProgressRow);
  const ids = rows.map((row) => row.lesson_id);
  if (new Set(ids).size !== ids.length) throw new Error("شناسهٔ درس‌ها در سوابق پیشرفت تکراری است.");
  return rows;
}
