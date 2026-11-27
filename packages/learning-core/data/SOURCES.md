# Third-Party Learning Content Sources

This file records provenance, license, size, and quality constraints for vendored or proposed external content.

## Vendored datasets

### Carryword English Vocabulary

- Repository: https://github.com/carryword/english-vocabulary
- File: `data/en-synonym-thesaurus.json`
- Upstream version: `0.5.2`
- Immutable upstream commit: `9ed91160134bda530534f082364b0b26ebc73f7c`
- Upstream Git blob SHA-1: `43df6d926b21ace926205c62bfdde934d4c5f14d`
- SHA-256: `f9d97aa55587a6b94fe6699034456c727348b5f1a115ec596803d35095c99618`
- Imported entries: 2,138
- Upstream file size: 591,077 UTF-8 bytes
- License: MIT; license text is preserved beside the data.
- Intended use: supplementary, sense-aware synonym lookup.
- Quality caveat: upstream metadata says the data is an AI-assisted draft pending verification. The upstream `verified` field reflects its own automated/AI-assisted audit, not independent pedagogical or lexicographic certification. Human review is required before a record becomes authoritative lesson content.
- Retrieved: 2026-11-27.
- Exact source file at pinned revision: https://github.com/carryword/english-vocabulary/blob/9ed91160134bda530534f082364b0b26ebc73f7c/data/en-synonym-thesaurus.json

### Elispeak Common English Mistakes

- Repository: https://github.com/elispeak/elispeak-common-english-mistakes
- File: `data/common-english-mistakes.jsonl`
- Immutable upstream commit: `1552b3216ad47f15f64e36f4b38d8fcd9dd8e123`
- Upstream Git blob SHA-1: `d3a84c88e0dced5f393eff3a37f9840f304c8976`
- SHA-256: `7b73eb42ac98eac0e96932ef9c3aec4cd9acc55f575ea248b99bc76884c5f789`
- Imported records: 40
- Upstream file size: 14,943 UTF-8 bytes
- License: MIT; license text is preserved beside the data.
- Intended use: optional practice seeds for noticing, correction, and production.
- Quality caveat: the repository is a small companion dataset, not a comprehensive grammar corpus or a validated CEFR assessment instrument. Review examples before publication.
- Retrieved: 2026-11-27.
- Exact source file at pinned revision: https://github.com/elispeak/elispeak-common-english-mistakes/blob/1552b3216ad47f15f64e36f4b38d8fcd9dd8e123/data/common-english-mistakes.jsonl

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
