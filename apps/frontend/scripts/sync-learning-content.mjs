import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(frontendRoot, "../..");
const sourceRoot = resolve(repositoryRoot, "packages/learning-core/data/vendor");
const outputRoot = resolve(frontendRoot, "src/features/learning-content/data");

const carryword = JSON.parse(await readFile(resolve(sourceRoot, "carryword/en-synonym-thesaurus.json"), "utf8"));
if (!Array.isArray(carryword.entries) || carryword.entries.length !== 2138) {
  throw new Error("Unexpected Carryword dataset shape or record count; refusing to overwrite generated content.");
}
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
if (mistakes.length !== 40) {
  throw new Error("Unexpected Elispeak record count; refusing to overwrite generated content.");
}
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "vocabulary.json"), JSON.stringify(vocabulary));
await writeFile(resolve(outputRoot, "common-mistakes.json"), JSON.stringify(mistakes));
process.stdout.write(`Synced ${vocabulary.length} vocabulary senses and ${mistakes.length} error-correction examples.\n`);
