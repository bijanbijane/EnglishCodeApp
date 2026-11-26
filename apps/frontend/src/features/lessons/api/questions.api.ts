import { apiGet } from "../../../shared/api/client";
import type { LessonQuestion, LessonQuestionOption } from "../model/question.types";

function parseOption(value: unknown): LessonQuestionOption {
  if (typeof value === "string") { if (!value.trim()) throw new Error("متن یکی از گزینه‌ها خالی است."); return value; }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار یکی از گزینه‌ها معتبر نیست.");
  const option = value as Record<string, unknown>;
  const id = typeof option.id === "string" ? option.id : undefined;
  const label = typeof option.label === "string" ? option.label : undefined;
  const text = typeof option.text === "string" ? option.text : undefined;
  const optionValue = typeof option.value === "string" ? option.value : undefined;
  if ((!id && !optionValue) || (!label && !text && !optionValue)) throw new Error("شناسه یا متن یکی از گزینه‌ها ناقص است.");
  return { id, label, text, value: optionValue };
}

function parseQuestion(value: unknown): LessonQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار یکی از تمرین‌ها معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || typeof row.prompt !== "string" || !row.prompt.trim() ||
      typeof row.position !== "number" || !Number.isSafeInteger(row.position) || row.position < 0 || !Array.isArray(row.options) || row.options.length < 2) {
    throw new Error("اطلاعات یکی از تمرین‌ها ناقص است.");
  }
  const options = row.options.map(parseOption);\n  const optionIds = options.map((option) => typeof option === "string" ? option : option.id ?? option.value);\n  if (optionIds.some((id) => !id) || new Set(optionIds).size !== optionIds.length) throw new Error("شناسهٔ گزینه‌های یکی از تمرین‌ها تکراری یا ناقص است.");\n  return { id: row.id, prompt: row.prompt, position: row.position, options };
}

export async function getLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  const payload = await apiGet<unknown>("/api/v1/lessons/" + encodeURIComponent(lessonId) + "/questions");
  if (!Array.isArray(payload)) throw new Error("پاسخ تمرین‌های درس معتبر نیست.");
  return payload.map(parseQuestion);
}
