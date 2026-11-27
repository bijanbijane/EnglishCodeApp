import type { CefrLevel, ErrorCorrectionFilter, ErrorCorrectionRecord } from "./types";

const CEFR_LEVELS = new Set<CefrLevel>(["PRE_A1", "A1", "A2", "B1", "B2", "C1", "C2"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorCorrectionRecord(value: unknown): value is ErrorCorrectionRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.category === "string" &&
    typeof value.cefr === "string" &&
    CEFR_LEVELS.has(value.cefr as CefrLevel) &&
    typeof value.learner_sentence === "string" &&
    typeof value.corrected_sentence === "string" &&
    typeof value.explanation === "string" &&
    typeof value.practice_prompt === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string")
  );
}

export function parseErrorCorrectionJsonl(source: string): ErrorCorrectionRecord[] {
  const records: ErrorCorrectionRecord[] = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new SyntaxError(`Invalid JSONL at line ${index + 1}.`);
    }
    if (!isErrorCorrectionRecord(value)) {
      throw new TypeError(`Invalid error-correction record at line ${index + 1}.`);
    }
    records.push({
      ...value,
      tags: [...value.tags],
    });
  }
  return records;
}

export function filterErrorCorrections(
  records: readonly ErrorCorrectionRecord[],
  filter: ErrorCorrectionFilter = {},
): ErrorCorrectionRecord[] {
  const limit = Math.max(1, Math.min(filter.limit ?? 20, 50));
  const category = filter.category?.trim().toLocaleLowerCase("en");
  const tag = filter.tag?.trim().toLocaleLowerCase("en");

  return records
    .filter((record) => {
      if (filter.cefr && record.cefr !== filter.cefr) return false;
      if (category && record.category.toLocaleLowerCase("en") !== category) return false;
      if (tag && !record.tags.some((item) => item.toLocaleLowerCase("en") === tag)) return false;
      return true;
    })
    .slice(0, limit);
}
