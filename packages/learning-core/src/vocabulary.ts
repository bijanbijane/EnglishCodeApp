import type { VocabularyDataset, VocabularyEntry, VocabularyDifficulty } from "./types";

const PARTS_OF_SPEECH = new Set(["n", "v", "adj", "adv", "prep", "conj", "other"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function isVocabularyEntry(value: unknown): value is VocabularyEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.word === "string" && value.word.trim().length > 0 &&
    typeof value.sense === "string" && value.sense.trim().length > 0 &&
    typeof value.definition === "string" && value.definition.trim().length > 0 &&
    typeof value.pos === "string" && PARTS_OF_SPEECH.has(value.pos) &&
    (value.level === 1 || value.level === 2 || value.level === 3) &&
    Array.isArray(value.synonyms) &&
    value.synonyms.every((item) => typeof item === "string" && item.trim().length > 0) &&
    typeof value.verified === "boolean" &&
    (value.related === undefined || (Array.isArray(value.related) && value.related.every((item) => typeof item === "string" && item.trim().length > 0)))
  );
}

export function parseVocabularyDataset(input: unknown): VocabularyDataset {
  if (!isRecord(input) || !isRecord(input.meta) || !Array.isArray(input.entries)) {
    throw new TypeError("Invalid vocabulary dataset envelope.");
  }

  const { meta } = input;
  if (
    typeof meta.title !== "string" || meta.title.trim().length === 0 ||
    typeof meta.version !== "string" || meta.version.trim().length === 0 ||
    typeof meta.license !== "string" || meta.license.trim().length === 0 ||
    meta.language !== "en"
  ) {
    throw new TypeError("Invalid vocabulary dataset metadata.");
  }

  const entries: VocabularyEntry[] = [];
  const senseKeys = new Set<string>();
  for (const [index, value] of input.entries.entries()) {
    if (!isVocabularyEntry(value)) {
      throw new TypeError(`Invalid vocabulary entry at index ${index}: one or more required fields are invalid.`);
    }
    const key = `${normalize(value.word)}\u0000${normalize(value.sense)}`;
    if (senseKeys.has(key)) {
      throw new TypeError(`Duplicate vocabulary word/sense key at index ${index}.`);
    }
    senseKeys.add(key);
    entries.push({
      ...value,
      synonyms: [...value.synonyms],
      ...(value.related ? { related: [...value.related] } : {}),
    });
  }

  return {
    meta: {
      title: meta.title,
      version: meta.version,
      license: meta.license,
      language: "en",
    },
    entries,
  };
}

export function searchVocabulary(
  entries: readonly VocabularyEntry[],
  query: string,
  options: { level?: VocabularyDifficulty; limit?: number } = {},
): VocabularyEntry[] {
  const term = normalize(query);
  if (!term) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
  return entries
    .filter((entry) => {
      if (options.level !== undefined && entry.level !== options.level) return false;
      return normalize(entry.word) === term;
    })
    .slice(0, limit);
}

export function getSenseSynonyms(entry: VocabularyEntry): string[] {
  const headword = normalize(entry.word);
  return [...new Set(entry.synonyms.map(normalize).filter((value) => value && value !== headword))];
}
