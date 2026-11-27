# Third-party learning content licenses

This directory contains adapted, locally bundled learning datasets. The original datasets remain subject to their respective licenses.

## Carryword English Learner Synonym Thesaurus
- Source: https://github.com/carryword/english-vocabulary
- Source file: `data/en-synonym-thesaurus.json`
- Source version: 0.5.2
- License: MIT
- Bundled records: 2,138 sense-level entries
- Original dataset metadata says the entries are AI-assisted drafts pending verification. The source's automated audit is not equivalent to expert editorial review. EnglishCode must not present these records as an authoritative CEFR curriculum. Human editorial review is required before using them for scored or mastery-gated assessment.
- Attribution and MIT license text are preserved in `CARRYWORD-LICENSE.txt`.

## Elispeak Common English Mistakes
- Source: https://github.com/elispeak/elispeak-common-english-mistakes
- Source file: `data/common-english-mistakes.jsonl`
- License: MIT
- Bundled records: 40 synthetic learner-error examples
- The source describes the examples as synthetic. CEFR labels are retained as source metadata and should be independently checked before high-stakes placement or mastery decisions.
- Attribution and MIT license text are preserved in `ELISPEAK-LICENSE.txt`.

## Runtime and privacy
- Both datasets are bundled as static JSON and require no runtime third-party API calls.
- Search and filtering run in the learner's browser.
- Speech playback uses the browser's built-in Web Speech API when available; no audio is uploaded by this module.
- No learner answers or personal data are sent to either dataset publisher.

## Review policy
These are supplementary reference and practice records, not a complete course. The learning path, mastery criteria, progress tracking, and authoritative grading remain owned by EnglishCode. Review data before publishing it as assessed curriculum.
