# Assessment Implementation Design

**Status:** Proposed engineering design; not implemented.  
**Baseline reviewed:** `main` at `f3671f2194e562fc194d23e9602b768455d8e483`.  
**Related specification:** `docs/curriculum/A1-CUMULATIVE-ASSESSMENT.md`.

## 1. Purpose and boundary

Extend the existing lesson-attempt engine into a versioned, four-skill cumulative assessment without replacing the current deterministic lesson quiz workflow.

The first delivery must support a single A1 cumulative form with Listening, Reading, Writing and Speaking sections. It must not imply that an automated speech evaluator, speech recognition provider, audio pipeline, rater marketplace, or CEFR certification system exists.

This document is a design proposal. It introduces no tables, endpoints, migrations, runtime bindings, storage products or UI behavior.

## 2. Existing implementation to reuse

The current backend already provides:

- `lesson_versions`, `question_versions` and immutable publication rules.
- `assessment_policy_versions` for versioned scoring policy.
- `lesson_attempts` pinning lesson and scoring-policy versions.
- `attempt_questions` preserving per-attempt prompt, options, answer key, order and weight.
- `attempt_answers` with a unique (attempt, question) key, server-side grading, same-answer idempotent retry and conflicting-answer rejection.
- Conditional attempt completion and a progress projection updated only by the winning completion transition.

The existing model is lesson-centric and question-centric. A cumulative assessment is a distinct aggregate: it has its own published form, ordered sections, heterogeneous tasks and a result that may remain pending until human ratings are complete. Do not overload `lesson_attempts` or represent productive responses as fake multiple-choice answers.

## 3. Proposed domain model

Keep stable identities separate from immutable published versions.

| Entity | Responsibility | Key invariants |
|---|---|---|
| `assessments` | Stable assessment identity, e.g. A1 cumulative | Stable key; lifecycle controlled by publication |
| `assessment_versions` | Published form metadata, level and duration | Draft-to-published transition; published rows immutable |
| `assessment_sections` | Versioned section membership/order and skill | Exactly one section per configured skill in the first A1 form; order is explicit |
| `assessment_tasks` | Versioned task content and response mode | Task belongs to one section; task content immutable after publish |
| `assessment_attempts` | Candidate-owned attempt and pinned form | Owner derived from session; form version pinned at start |
| `assessment_attempt_tasks` | Immutable task snapshot for one attempt | Prompt, instructions, stimulus reference, response schema, rubric version and order are frozen |
| `assessment_responses` | Candidate submission(s) | Unique idempotency key per attempt/task; submission state explicit |
| `assessment_ratings` | Human rating of productive responses | Rater authorization, rubric version, score bounds and audit metadata enforced |
| `assessment_results` | Final section and overall scores | Server-computed; final only after required objective scoring and ratings finish |

Names are conceptual. Before migration, map these proposals to existing conventions and decide whether section/task version rows can be normalized or safely represented by version-owned child rows. Avoid redundant version IDs where a strict foreign-key path already pins the parent version.

### Attempt and response state

- Attempt: `in_progress` → `submitted` → `completed`; optionally `abandoned` or `expired` through explicit guarded transitions.
- Task response: `not_started` → `submitted`; a submitted response is immutable in v1.
- Productive rating: `pending` → `rated`; any reassessment requires a separately audited revision workflow, not an overwrite.
- Overall result: `pending` until every required component is scored; then `final`.
- Do not expose partial overall scores as final. A candidate may see submission/processing status without seeing private rubric notes or answer keys.

## 4. Scoring contract

The blueprint's provisional 25% per-skill weighting is a product proposal, not a CEFR-mandated rule. Store weights and aggregation rules in an immutable scoring-policy version; never hard-code them in route handlers.

- Listening and Reading: deterministic server-side objective scoring against private answer keys.
- Writing and Speaking: human ratings against the published analytic rubric in the initial release.
- Each rubric dimension has a bounded integer scale; the rubric version and criterion-level ratings are snapshotted with the rating.
- Normalize section scores using explicit denominator and rounding rules. Reject zero/invalid denominators and out-of-range weights at publication time.
- Compute the final weighted score only on the server after all required component scores exist.
- Do not convert a percentage into a CEFR level or pass/fail claim until standard-setting, pilot evidence and an approved interpretation policy exist.
- Store raw criterion ratings and computed normalized scores so results can be audited and recomputed under a new policy without mutating old attempts.

## 5. API proposal

All endpoints are under `/api/v1`; route names are provisional and require contract review.

| Method | Path | Purpose |
|---|---|---|
| GET | `/assessments` | List published assessment versions available to the authenticated learner |
| GET | `/assessments/:assessmentId` | Read candidate-safe form metadata and task instructions |
| POST | `/assessments/:assessmentId/attempts` | Start attempt and atomically snapshot the current published form |
| GET | `/assessment-attempts/:attemptId` | Read only the caller's attempt and candidate-safe task state |
| PUT | `/assessment-attempts/:attemptId/tasks/:taskId/response` | Submit a task response with an idempotency key |
| POST | `/assessment-attempts/:attemptId/submit` | Conditionally submit the whole attempt |
| GET | `/assessment-attempts/:attemptId/result` | Read pending/final result DTO for the owner |
| GET | `/admin/assessment-ratings` | Rater-only queue, with keyset pagination |
| POST | `/admin/assessment-ratings/:responseId` | Submit an authorized rubric rating |

Public/candidate DTOs must never include objective answer keys, hidden scoring rules, private rater notes, internal moderation metadata, or another user's response. Rater endpoints must enforce role and assignment scope server-side; client-supplied user IDs or roles are never trusted.

## 6. Transaction, concurrency and idempotency requirements

D1 is the transaction authority. Use conditional SQL and `DB.batch` boundaries consistent with the existing learning module.

1. Starting an attempt pins the published assessment version and snapshots all task data in one atomic operation; reject if the form is no longer published or has no valid tasks.
2. A response write is accepted only while the attempt is `in_progress`; validate response shape and size server-side.
3. Same idempotency key plus same canonical payload returns the stored receipt. Reuse of the key with a different payload returns 409.
4. A task cannot be submitted twice with conflicting content in v1. If draft-save is later required, design a separate versioned draft mechanism.
5. Final submit is a guarded state transition. Repeated identical submit requests return the existing state; they must not create duplicate results or ratings.
6. Objective scoring and result finalization must be deterministic and repeat-safe. A result row is inserted once under a unique attempt key.
7. Human rating writes require an authorized rater, a pending response, a valid rubric version and an idempotent decision key. Duplicate delivery must not create duplicate ratings.
8. Progress updates, if added, must be gated by the winning finalization transition. Do not reuse lesson progress fields for cumulative assessment scores without a separate product decision.

Tests must use real Wrangler Local D1 for unique-key races, competing submissions, submit-vs-response races, rater double-submit and exactly-once finalization. Mock-only tests are insufficient for these invariants.

## 7. Media, privacy and retention

- Do not persist raw audio/video by default.
- The first implementation may reference pre-published listening stimuli through an existing approved delivery mechanism only after its access controls are verified. No assumption is made that R2 is active.
- Candidate audio recording requires a separate privacy, consent, retention, deletion and cost review before implementation.
- Writing responses are personal learning data: enforce body limits, ownership checks, bounded retention and account deletion/export policy.
- Do not log response bodies, transcripts, audio URLs with credentials, answer keys or private rater notes.
- Avoid adding a paid speech-to-text, AI scoring or media provider. Any future provider requires explicit cost approval and quality evaluation.

## 8. Delivery sequence and gates

1. **Contract and schema review:** confirm task types, response formats, attempt lifecycle, result visibility, rater roles and retention policy. Produce ERD and forward-only migration plan.
2. **Objective assessment vertical slice:** publish one listening/reading form, start/snapshot, submit responses, deterministic scoring and owner-only result retrieval.
3. **Productive submission:** add writing and speaking response capture without automated scoring; keep media disabled until privacy/storage approval.
4. **Human rating workflow:** role-scoped queue, rubric snapshot, immutable rating, audit trail and pending-to-final result transition.
5. **Frontend integration:** accessible mobile-first section navigation, save/submit states, retry/conflict handling and pending-result presentation.
6. **Pilot and standard-setting:** validate task difficulty, timing, rubric reliability and score interpretation before claiming CEFR level or certification.

Each stage requires typecheck, unit tests, real Local D1 integration tests, SQL invariant checks, API contract/security tests and a fresh CI run on the exact head.

## 9. Explicit non-goals

This design does not implement or approve:

- A migration or schema change.
- Audio/video upload, R2 bucket creation or public media hosting.
- Speech recognition, AI scoring or third-party integrations.
- Automated CEFR placement, certification, pass thresholds or score interpretation.
- Rater recruitment, payment or external moderation.
- Production deployment, remote D1 operations, secret changes or paid resources.

## 10. Main baseline notes

The main-branch backend data model and API docs describe migrations `0001`–`0010` as the current baseline, while the current curriculum branch has additional curriculum seed files. Any implementation must start from the exact target branch's migration tree and current D1 schema; never port older branch migrations by number alone. The existing lesson attempt engine is the reference for ownership, snapshotting, server grading and idempotency, but cumulative assessment must remain a separate aggregate.
