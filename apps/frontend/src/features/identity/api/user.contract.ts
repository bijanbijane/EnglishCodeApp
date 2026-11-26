export type LearnerProfile = { id: string; displayName: string | null };

export function parseLearnerProfile(value: unknown): LearnerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار اطلاعات حساب معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim() ||
      !(row.displayName === null || typeof row.displayName === "string")) {
    throw new Error("اطلاعات شناسه یا نام نمایشی حساب ناقص است.");
  }
  return { id: row.id, displayName: row.displayName };
}
