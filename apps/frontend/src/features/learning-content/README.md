# EnglishCode Learning Library UI

This React feature is the learner-facing interface for generated projections of the canonical vendored datasets in `packages/learning-core/data/vendor` and the original sample lesson in `packages/learning-core/examples`.

- Vocabulary: 2,138 sense-level records from Carryword.
- Error clinic: 40 synthetic correction examples from Elispeak.
- Lesson preview: original eight-stage A2 communicative lesson.
- Grammar practice: seven original self-checking exercise examples using the new validated learning-core contract.
- The frontend JSON files are generated projections, not independently maintained source data.
- Run `npm run sync:content` from `apps/frontend` to regenerate all three projections from the pinned source files.
- The feature is lazy-loaded, so its dataset and styles are not part of the initial home-screen route.
- Pronunciation uses the device/browser Web Speech API when available; it does not call a paid service.

See `packages/learning-core/README.md` and `packages/learning-core/data/SOURCES.md` for licensing, provenance, limitations, and the separate Open English WordNet ingestion decision.
