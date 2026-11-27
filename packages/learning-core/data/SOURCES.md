# Third-Party Learning Content Sources

This file records provenance, license, size, and quality constraints for vendored or proposed external content.

## Vendored datasets

### Carryword English Vocabulary

- Repository: https://github.com/carryword/english-vocabulary
- File: `data/en-synonym-thesaurus.json`
- Upstream version: `0.5.2`
- Imported entries: 2,138
- Upstream file size: 591,072 bytes
- License: MIT; license text is preserved beside the data.
- Intended use: supplementary, sense-aware synonym lookup.
- Quality caveat: upstream metadata says the data is an AI-assisted draft pending verification. The upstream `verified` field reflects its own automated/AI-assisted audit, not independent pedagogical or lexicographic certification. Human review is required before a record becomes authoritative lesson content.
- Retrieved: 2026-11-27.

### Elispeak Common English Mistakes

- Repository: https://github.com/elispeak/elispeak-common-english-mistakes
- File: `data/common-english-mistakes.jsonl`
- Imported records: 40
- Upstream file size: 14,943 bytes
- License: MIT; license text is preserved beside the data.
- Intended use: optional practice seeds for noticing, correction, and production.
- Quality caveat: the repository is a small companion dataset, not a comprehensive grammar corpus or a validated CEFR assessment instrument. Review examples before publication.
- Retrieved: 2026-11-27.

## Candidate sources — not vendored

### Open English WordNet 2025

- Repository: https://github.com/globalwordnet/english-wordnet
- Release: 2025; release date 2025-12-31.
- License: CC BY 4.0, with attribution to Princeton WordNet and the Open English WordNet team; retain and review the upstream WordNet license notice.
- Published core resource: 135,969 words, 107,519 synsets, 355,064 relations.
- JSON archive: approximately 9.5 MB compressed.
- Intended use: lexical sense and semantic-relation enrichment.
- Runtime constraint: do not bundle the complete archive into the Worker or parse it per request. Import selected records offline into compact D1 rows or versioned static shards.
- Status: candidate only; not yet ingested or tested.

### Tatoeba sentence corpus

- Official downloads: https://tatoeba.org/en/downloads
- Text exports: CC BY 2.0 FR; a subset is separately available under CC0 1.0.
- Exports are updated weekly.
- Intended use: candidate source of sentence examples and translation pairs.
- Quality caveat: community-contributed sentences are not a CEFR-graded syllabus and quality varies. Keep sentence IDs and required attribution; curate and review every sentence used in published lessons. Audio has contributor-specific licenses and must be assessed separately.
- Status: candidate only; no Tatoeba records are copied into this repository.

## Educational standard and copyright boundary

The Council of Europe's CEFR Companion Volume (2020) and the official searchable CEFR descriptors are the recommended curriculum and assessment reference:
- https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- https://www.coe.int/en/web/common-european-framework-reference-languages/practical-resources

The framework is freely accessible for consultation, but Council of Europe publication material is not automatically open-licensed for commercial redistribution. Prior written permission is generally required to reproduce or republish publication material. EnglishCode must create original lesson text, tasks, explanations, and assessment items aligned to CEFR outcomes rather than copying the Companion Volume or third-party course content.

## Excluded for the current commercial/free-first requirement

- CEFR-J: its official download page says commercial use may incur separately consulted expenses; do not vendor until the commercial terms are clarified.
- EFCAMDAT: access to the second release requires an academic affiliation and approval; it is not a dependable, unrestricted production dependency.
- UniversalCEFR compilation: the listed CEFR corpora are for non-commercial research and preserve upstream non-commercial restrictions; do not use in the commercial product.

## Update policy

Every imported source must have a pinned upstream revision or release, checksum, retrieval date, license copy, record count, and validation report. Updates must be reviewed as a content change, not silently pulled at runtime.


## Vendored course samples

### The Complete English Course — From Zero to Fluent

- Repository: https://github.com/sazardev/english-from-zero-to-fluent
- Pinned upstream commit: `714b2212b9ab1d95eb220eca0033d681ca7c9212` (2026-09-29).
- License: MIT; the original license is preserved at `data/vendor/english-from-zero-to-fluent/LICENSE`.
- Imported samples: `book/01-02-the-sentence.mdx` and `book/02-01-the-present.mdx`.
- Upstream describes 118 documents and a 12-week/84-day self-study track. Its own plan records unfinished areas, including some reading extracts and exercises; treat it as a useful reference/course source, not a complete independently certified curriculum.
- Intended use: grammar explanations and reference material for adaptation into original, interactive EnglishCode lessons.
- Content is preserved as upstream MDX. It is not rendered directly in the app; custom MDX components and pedagogical level claims require review before conversion.

### Read English — research-backed reading course

- Repository: https://github.com/oyekamal/english-reading-course
- Pinned upstream commit: `b80948b69135c9de7cbb1cd778deecf0b05463e8` (2026-09-28).
- License: course content, research, and documentation are CC BY 4.0; tools are MIT. The complete upstream license notice is preserved at `data/vendor/english-reading-course/LICENSE`.
- Imported samples: one lesson each from Level 5 (A2–B1), Level 6 (B1–B2), and Level 7 (C1–C2).
- Attribution: “Read English — oyekamal, https://github.com/oyekamal/english-reading-course, CC BY 4.0.” Any future adaptations must identify changes and retain attribution and the license link.
- Intended use: reading fluency, morphology, comprehension, text structure, and critical-reading lesson references. The course includes phonics and literacy instruction as well as L2 reading; it is not a general-purpose speaking/listening curriculum.
- Quality gate: independently review research claims, factual content, answer keys, adult suitability, and CEFR mapping before exposing lessons to learners.

## Exercise-format reference — not vendored

### Grammar Drill Yard / Polyglot Grammar Forge

- Repository: https://github.com/galvarezz09/Grammar-Drill-Yard
- Pinned upstream commit inspected: `7740040bdcdc3cf22fb32d1dbf4af1c94cf60fcc` (2026-11-27).
- Its README declares MIT, but the repository tree inspected for this integration does not contain a standalone `LICENSE` file. The root `index.html` is an obfuscated/encoded shell rather than an auditable exercise implementation; no reusable lesson pack was found.
- No upstream code or lesson content has been copied. EnglishCode implements its own validated exercise contract for multiple choice, gap fill, reorder, transformation, error spotting, matching, and flashcards, based on common exercise formats described in the README.
- Reuse gate: request a canonical license file and readable source before considering direct code reuse.

## Additional repositories found during the second search

### English Pathway

- Repository: https://github.com/Eljethao/english-pathway
- Public README reports 144 lessons across 12 B1–C1 skill courses, 12 timed practice sets, a placement test, 14 grammar topics, and 195 vocabulary items. Its content-review report describes 3,727 checked items and 512 fixes.
- No LICENSE file was found in the repository. Do not copy its code or content. Use as a quality and product-architecture benchmark only.

### FreeLingo

- Repository: https://github.com/ArtCC/freelingo
- License: AGPL-3.0. Active project with CEFR A1–C2 study plans, competencies, flashcards, grammar/vocabulary references, reading/listening practice, and speaking/tutor workflows.
- The full app includes a Python/Next.js stack and optional local/cloud LLM infrastructure. It is not a drop-in fit for the EnglishCode Cloudflare Workers/free-tier architecture. Do not copy its code unless the AGPL network-source obligations and product licensing strategy are explicitly accepted; use its curriculum and progression ideas as a reference.

### LibreLingo

- Repository: https://github.com/kantord/LibreLingo
- License: AGPL-3.0; repository is archived. Despite its substantial community history, it is not a preferred implementation base for an actively maintained, Cloudflare-first product.

