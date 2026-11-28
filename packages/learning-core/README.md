# Learning Core — Open Content Module

A dependency-free TypeScript package for importing, validating, and querying small learning-content datasets. It is designed to remain compatible with the EnglishCode Cloudflare Workers architecture.

## Included source datasets

| Source | Imported records | Local file | License | Intended use |
|---|---:|---|---|---|
| Carryword English Vocabulary | 2,138 sense-level entries | `data/vendor/carryword/en-synonym-thesaurus.json` | MIT | Supplementary synonym and sense lookup |
| Elispeak Common English Mistakes | 40 records | `data/vendor/elispeak/common-english-mistakes.jsonl` | MIT | Small practice seed for noticing and correction |

Both upstream datasets and their license files are preserved without editing. See [data source and quality notes](data/SOURCES.md).

## Important quality limits

- Carryword explicitly describes its dataset as an AI-assisted draft pending verification. Its `verified` flag means it passed the publisher's automated/AI-assisted audit; it is not evidence of independent teacher review. Do not publish it as authoritative curriculum without human review.
- Elispeak is a small companion dataset. It is useful as a practice seed, not as a comprehensive grammar syllabus or a validated learner-error corpus.
- Neither dataset provides a complete, validated CEFR curriculum.
- Do not infer a learner's CEFR level from one vocabulary lookup or one corrected sentence.

## Runtime design

- No runtime dependencies, model downloads, GPU, external API, or persistent process.
- The package exposes pure parsing, filtering, lookup, and lesson-validation functions.
- Vendor data is deliberately not imported into the Worker bundle. The raw Carryword file is approximately 591 KB and the Elispeak file approximately 15 KB; use a controlled build/import process and D1 or static sharding before exposing large catalogs.
- Open English WordNet is documented as a candidate source but is not bundled here. Its 2025 JSON archive is about 9.5 MB compressed; do not load the full resource into a Worker request or bundle.
- Keep user attempts, mastery, review scheduling, and progress in the existing backend/D1 domain. This package owns reusable reference content and content-quality contracts only.

## Pedagogical integration

Use content in a lesson sequence rather than presenting isolated lists:

1. Context and communicative goal.
2. Comprehensible input.
3. Noticing: meaning, form, collocation, or learner error.
4. Guided retrieval and controlled practice.
5. Meaningful production.
6. Specific feedback.
7. Delayed recall and spaced review.
8. Mastery check with more than one item and more than one attempt.

The CEFR level is a curriculum and assessment design constraint, not a label to copy from a third-party dataset without evidence.

## Lesson quality contract

The lesson validator requires Context, Input, Noticing, Guided Practice, Production, Feedback, Spaced Recall, and Assessment in order. Each stage must declare an activity and observable evidence. A lesson also needs an original communicative outcome, a real-world task, and a mastery gate requiring at least two attempts plus delayed recall.

## Original sample lesson

- [A2: Talk About a Personal Goal](examples/a2-personal-goals.md) is an original eight-stage communicative lesson with model input, guided practice, production, selective feedback, delayed retrieval, and an assessment rubric.
- Its typed blueprint is in `examples/a2-personal-goals.ts` and is validated by the backend test suite.
- This sample is CEFR-informed, not a Council of Europe-certified assessment.

## Exercise contracts

`src/exercises.ts` defines typed authoring contracts and runtime validation for multiple-choice, gap-fill, reorder, transformation, error-spotting, matching, and flashcard content. These validators check content structure only; they do not implement learner answer submission or grading. Fields such as `correctOptionId`, `acceptedAnswers`, `correctOrder`, `correctedText`, matching pairs, and flashcard backs are answer-bearing authoring data and must remain server-side. Do not import answer-bearing exercise packs into frontend code. Any assessed exercise must use the authenticated backend attempt pipeline, immutable snapshots, private answer keys, and server-side grading.

## Development

The module has no runtime package dependencies. Backend tests import its pure functions directly.
