import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(frontendRoot, "../..");
const sourceRoot = resolve(repositoryRoot, "packages/learning-core/data/vendor");
const outputRoot = resolve(frontendRoot, "src/features/learning-content/data");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCarryword(entries) {
  if (!Array.isArray(entries) || entries.length !== 2138) {
    throw new Error("Unexpected Carryword dataset shape or record count; refusing to overwrite generated content.");
  }
  const senseKeys = new Set();
  const allowedPartsOfSpeech = new Set(["n", "v", "adj", "adv", "prep", "conj", "other"]);
  for (const [index, entry] of entries.entries()) {
    const fail = (field) => { throw new Error(`Invalid Carryword record ${index + 1}: ${field}.`); };
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail("expected an object");
    for (const field of ["word", "sense", "definition"]) {
      if (!isNonEmptyString(entry[field])) fail(field);
    }
    if (!allowedPartsOfSpeech.has(entry.pos)) fail("pos");
    if (![1, 2, 3].includes(entry.level)) fail("level");
    if (!Array.isArray(entry.synonyms) || entry.synonyms.some((item) => !isNonEmptyString(item))) fail("synonyms");
    if (entry.related !== undefined && (!Array.isArray(entry.related) || entry.related.some((item) => !isNonEmptyString(item)))) fail("related");
    if (typeof entry.verified !== "boolean") fail("verified");
    const key = `${entry.word.trim().toLocaleLowerCase("en")}\u0000${entry.sense.trim().toLocaleLowerCase("en")}`;
    if (senseKeys.has(key)) fail("duplicate word/sense key");
    senseKeys.add(key);
  }
}

function validateMistakes(records) {
  if (records.length !== 40) {
    throw new Error("Unexpected Elispeak record count; refusing to overwrite generated content.");
  }
  const ids = new Set();
  const allowedCefr = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
  for (const [index, record] of records.entries()) {
    const fail = (field) => { throw new Error(`Invalid Elispeak record ${index + 1}: ${field}.`); };
    if (!record || typeof record !== "object" || Array.isArray(record)) fail("expected an object");
    for (const field of ["id", "category", "learner_sentence", "corrected_sentence", "explanation", "practice_prompt"]) {
      if (!isNonEmptyString(record[field])) fail(field);
    }
    if (!allowedCefr.has(record.cefr)) fail("cefr");
    if (!Array.isArray(record.tags) || record.tags.some((tag) => !isNonEmptyString(tag))) fail("tags");
    if (ids.has(record.id)) fail("duplicate id");
    ids.add(record.id);
  }
}

const carryword = JSON.parse(await readFile(resolve(sourceRoot, "carryword/en-synonym-thesaurus.json"), "utf8"));
validateCarryword(carryword.entries);
const vocabulary = carryword.entries.map(({ word, sense, pos, definition, level, synonyms, related }) => ({
  word, sense, pos, definition, level, synonyms, related: related ?? [],
}));
const mistakeLines = (await readFile(resolve(sourceRoot, "elispeak/common-english-mistakes.jsonl"), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line.trim());
const mistakes = mistakeLines.map((line, index) => {
  try { return JSON.parse(line); }
  catch { throw new Error(`Invalid Elispeak JSONL at line ${index + 1}.`); }
});
validateMistakes(mistakes);

const sampleLesson = JSON.parse(await readFile(resolve(repositoryRoot, "packages/learning-core/examples/a2-personal-goals.json"), "utf8"));
if (sampleLesson.id !== "a2-personal-goals-01" || sampleLesson.stages?.length !== 8) {
  throw new Error("Unexpected sample lesson blueprint; refusing to overwrite generated content.");
}
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "vocabulary.json"), JSON.stringify(vocabulary));
await writeFile(resolve(outputRoot, "common-mistakes.json"), JSON.stringify(mistakes));
await writeFile(resolve(outputRoot, "a2-personal-goals.json"), JSON.stringify(sampleLesson));
process.stdout.write(`Validated and synced ${vocabulary.length} vocabulary senses, ${mistakes.length} error-correction examples, and one A2 lesson.\n`);
