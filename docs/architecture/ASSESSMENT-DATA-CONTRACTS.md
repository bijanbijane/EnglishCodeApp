# Cumulative Assessment — Data Model and API Contracts

**Status:** Design proposal only; no runtime implementation.  
**Target branch reviewed:** `feat/a1-foundations-curriculum` at `27e3126fefbba1f08f2b16d9a0500158b453dd27` (including migrations `0001`–`0015`).  
**Current branch migration history:** `0001`–`0015`.  
**Related documents:** `ASSESSMENT-IMPLEMENTATION-DESIGN.md`, `A1-CUMULATIVE-ASSESSMENT.md`.

## 1. Decisions and non-decisions

### Decisions recommended for v1

1. Cumulative assessment is a separate aggregate from lesson attempts.
2. Published assessment versions and attempt task snapshots are immutable.
3. A task has exactly one response mode and one skill.
4. Objective tasks are server-scored from private keys. Writing and Speaking are human-rated.
5. Each attempt can have at most one accepted final response per task in v1.
6. Results are pending until all required scoring components are complete.
7. A final result is immutable; correction is an explicit audited revision, not an update-in-place.
8. Listening stimuli are references to pre-published content only. No learner audio recording or media upload in v1.

### Deliberately unresolved

- Whether the first Speaking mode is live examiner interaction or a non-recorded structured prompt administered outside the app. A self-recorded monologue must not be labelled interactive speaking.
- Exact duration, skill weights, pass threshold, score rounding and interpretation.
- Rater assignment model and whether double-rating/moderation is mandatory in the pilot.
- Listening asset delivery, licensing and accessibility mechanism.
- Retention duration, deletion/export behavior for written responses and rating audit data.

Do not create a migration until these decisions are approved and the exact schema has been inspected in Local D1.

## 2. Conceptual ERD

```mermaid
erDiagram
  ASSESSMENTS ||--o{ ASSESSMENT_VERSIONS : versions
  ASSESSMENT_VERSIONS ||--o{ ASSESSMENT_SECTIONS : contains
  ASSESSMENT_SECTIONS ||--o{ ASSESSMENT_TASKS : contains
  ASSESSMENT_VERSIONS ||--o{ ASSESSMENT_RUBRICS : defines
  ASSESSMENT_ATTEMPTS }o--|| ASSESSMENT_VERSIONS : pins
  ASSESSMENT_ATTEMPTS ||--o{ ATTEMPT_TASKS : snapshots
  ASSESSMENT_TASKS ||--o{ ATTEMPT_TASKS : source
  ATTEMPT_TASKS ||--o| ASSESSMENT_RESPONSES : receives
  ASSESSMENT_RESPONSES ||--o{ ASSESSMENT_RATINGS : rated
  ASSESSMENT_ATTEMPTS ||--o| ASSESSMENT_RESULTS : produces
  ASSESSMENT_RESULTS ||--o{ ASSESSMENT_SECTION_RESULTS : breaks_down
  ASSESSMENT_SECTIONS ||--o{ ASSESSMENT_SECTION_RESULTS : reports
  ASSESSMENT_RUBRICS ||--o{ ASSESSMENT_RATINGS : governs
```

The ERD is conceptual. It intentionally does not specify a final physical schema or migration order.

## 3. Proposed relational contract

Use TEXT UUID/opaque IDs consistently with existing backend conventions. Timestamps should use the repository's established UTC ISO-8601 representation. Use CHECK constraints, unique constraints and composite foreign keys to enforce invariants in SQLite wherever possible.

### 3.1 Assessment catalogue

**assessments**
- `id` primary key
- `assessment_key` stable unique key, e.g. `a1-cumulative`
- `title`, `level`
- `created_at`

**assessment_versions**
- `id` primary key
- `assessment_id` FK RESTRICT
- `version` positive integer
- `status` constrained to draft/published/archived
- `duration_minutes` nullable positive integer (not fixed until pilot)
- `scoring_policy_json` or a normalized immutable policy-version FK; choose one, not both
- `created_by_user_id` FK SET NULL
- `created_at`, `published_at`
- UNIQUE(`assessment_id`, `version`)

Published versions must reject UPDATE and DELETE using triggers, consistent with existing lesson version protections. A new version is created as draft; publication is a guarded state transition after validation.

**assessment_sections**
- `id` primary key
- `assessment_version_id` FK RESTRICT
- `skill` CHECK in listening/reading/writing/speaking
- `title`, `instructions`, `position`
- `required` boolean integer
- UNIQUE(`assessment_version_id`, `skill`)
- UNIQUE(`assessment_version_id`, `position`)

**assessment_tasks**
- `id` primary key
- `section_id` FK RESTRICT
- `task_key` stable within section
- `task_type` constrained by supported v1 registry
- `response_mode` constrained to selected v1 modes
- `prompt`, `instructions`, `stimulus_json`
- `response_schema_json` validated by application code and JSON validity constraint
- `answer_key_json` private; objective task types only
- `max_score` positive integer/real
- `position`
- UNIQUE(`section_id`, `task_key`)
- UNIQUE(`section_id`, `position`)

Do not store answer keys inside candidate-readable JSON blobs. A candidate query must explicitly select safe columns and map to a DTO; never serialize raw rows.

### 3.2 Rubrics

**assessment_rubrics**
- `id` primary key
- `assessment_version_id` FK RESTRICT
- `skill` constrained to writing/speaking for initial v1
- `rubric_key`, `version`, `criteria_json`
- `created_at`
- UNIQUE(`assessment_version_id`, `skill`, `rubric_key`)

Each criterion has a stable key, label, bounded integer minimum/maximum, level descriptors and a positive maximum weight. Validate that weights sum to the policy-defined denominator. Snapshot the exact rubric ID and criterion definition into each productive task attempt. Do not let an edit to a later draft alter an in-progress attempt.

### 3.3 Attempts and snapshots

**assessment_attempts**
- `id` primary key
- `user_id` FK RESTRICT (or match the existing account-deletion strategy after inspection)
- `assessment_version_id` FK RESTRICT
- `status` CHECK in in_progress/submitted/completed/abandoned/expired
- `started_at`, `submitted_at`, `completed_at`
- `created_at`
- index (`user_id`, `created_at` DESC)
- index (`assessment_version_id`, `status`)

**attempt_tasks**
- `id` primary key
- `attempt_id` FK RESTRICT
- `source_task_id` FK RESTRICT
- `section_skill`, `section_position`, `task_position`
- `task_type`, `response_mode`
- `prompt_snapshot`, `instructions_snapshot`, `stimulus_snapshot_json`
- `response_schema_snapshot_json`
- `private_answer_key_snapshot_json` nullable
- `max_score_snapshot`
- `rubric_id_snapshot` nullable
- UNIQUE(`attempt_id`, `source_task_id`)
- UNIQUE(`attempt_id`, `section_position`, `task_position`)

The attempt snapshot is the authority after start. Keep the source FK for traceability, but candidate task rendering and scoring must read snapshot fields only. Protect snapshots against update/delete with triggers. Consider whether storing a private answer-key snapshot in this table is appropriate; if so, all learner-facing queries must exclude it explicitly.

### 3.4 Responses and idempotency

**assessment_responses**
- `id` primary key
- `attempt_task_id` FK RESTRICT UNIQUE (one final submission per task in v1)
- `payload_json` JSON-valid, size-limited by application code
- `payload_hash` fixed-length canonical digest
- `idempotency_key` bounded opaque value
- `status` CHECK submitted/invalidated only if invalidation is an audited state
- `submitted_at`
- UNIQUE(`attempt_task_id`, `idempotency_key`)

Canonicalize and validate the typed payload before hashing. The same key and same hash returns the original receipt; same key with a different hash returns 409. A different key after a final response returns 409 in v1. Never include raw payloads in logs.

Proposed typed payload examples:

```json
{
  "responseType": "choice",
  "selectedOptionId": "opt-b"
}
```

```json
{
  "responseType": "text",
  "text": "Hello Sam, I can meet at..."
}
```

For a non-recorded speaking pilot, a structured examiner outcome is not a learner response and should be submitted only through the authorized rater workflow. Do not accept arbitrary media URLs from the client.

### 3.5 Ratings and results

**assessment_ratings**
- `id` primary key
- `response_id` FK RESTRICT
- `rater_user_id` FK RESTRICT
- `rubric_id` FK RESTRICT
- `criterion_scores_json` JSON-valid
- `total_score`, `max_score`
- `decision_key` bounded
- `rated_at`
- UNIQUE(`response_id`, `rater_user_id`, `decision_key`)

If policy allows exactly one rating, add a unique response constraint. If independent double-rating is required, model rating slots/assignments explicitly; do not use accidental duplicate rows as moderation.

**assessment_results**
- `id` primary key
- `attempt_id` FK RESTRICT UNIQUE
- `status` CHECK pending/final
- `overall_score`, `max_score`
- `scoring_policy_snapshot_json`
- `finalized_at`
- `created_at`

**assessment_section_results**
- `id` primary key
- `result_id` FK RESTRICT
- `skill`
- `raw_score`, `max_score`, `normalized_score`, `weight`
- `scoring_evidence_json` limited to safe, auditable references
- UNIQUE(`result_id`, `skill`)

Result rows are server-owned. Store the exact scoring policy snapshot and unrounded component values needed to explain the final calculation. No CEFR level, pass/fail or certification label until a separately approved interpretation policy exists.

## 4. API request and response contracts

All paths are provisional under `/api/v1`. Existing API envelope and error conventions take precedence; inspect and reuse them rather than introducing a second envelope.

### GET /assessments

Candidate-safe response:
```json
{
  "data": [{
    "id": "assessment-id",
    "key": "a1-cumulative",
    "title": "A1 Cumulative Assessment",
    "level": "A1",
    "version": 1,
    "durationMinutes": null,
    "skills": ["listening", "reading", "writing", "speaking"]
  }]
}
```

Only published versions are eligible. Do not return draft metadata.

### POST /assessments/:assessmentId/attempts

Request: empty body in v1; the server chooses the current published version.

Response:
```json
{
  "data": {
    "attemptId": "opaque-id",
    "status": "in_progress",
    "assessmentVersion": 1,
    "startedAt": "UTC timestamp"
  }
}
```

The insert and all task snapshots must commit atomically. If no valid published form exists, return 404/409 per existing API conventions and create no partial attempt.

### GET /assessment-attempts/:attemptId

Returns only the authenticated owner's attempt. Candidate task DTO:
```json
{
  "id": "attempt-task-id",
  "skill": "reading",
  "taskType": "multiple_choice",
  "responseMode": "choice",
  "prompt": "Read the notice...",
  "instructions": "Choose one answer.",
  "stimulus": {"kind": "text", "content": "Library open..."},
  "responseSchema": {"type": "choice", "optionIds": ["opt-a", "opt-b"]},
  "position": 1,
  "responseStatus": "not_started"
}
```

Do not expose `answer_key_snapshot_json`, expected answers, hidden transcripts, rater notes or private rubric guidance.

### PUT /assessment-attempts/:attemptId/tasks/:taskId/response

Request:
```json
{
  "idempotencyKey": "client-generated-opaque-key",
  "response": {
    "responseType": "text",
    "text": "A short learner response."
  }
}
```

Response:
```json
{
  "data": {
    "accepted": true,
    "duplicate": false,
    "responseStatus": "submitted"
  }
}
```

The authenticated user must own the attempt; the task must belong to it; the attempt must be in progress; payload type/size must match the snapshotted response schema. Do not return correctness for objective tasks until the whole assessment/section's disclosure policy permits it.

### POST /assessment-attempts/:attemptId/submit

Request: empty body. The server atomically checks required tasks and changes the state once. Decide before implementation whether unanswered tasks are allowed and treated as zero; the policy must be explicit and snapshotted.

Response:
```json
{
  "data": {
    "status": "submitted",
    "resultStatus": "pending"
  }
}
```

Same repeated request returns the stored state. Concurrent response submission versus attempt submission must have a single deterministic winner based on conditional writes/transaction semantics.

### GET /assessment-attempts/:attemptId/result

Pending:
```json
{"data":{"status":"pending","sections":[],"overallScore":null}}
```

Final:
```json
{
  "data": {
    "status": "final",
    "sections": [
      {"skill": "reading", "score": 8, "maxScore": 10, "normalizedScore": 80, "weight": 0.25}
    ],
    "overallScore": 76,
    "interpretation": null,
    "finalizedAt": "UTC timestamp"
  }
}
```

The sample values are illustrative, not a recommended cut score. A result endpoint must never disclose another learner's result or private examiner notes.

## 5. State transitions and concurrency

| Aggregate | Allowed transition | Guard |
|---|---|---|
| Assessment version | draft → published | Complete validation; authorized publisher |
| Assessment version | published → archived | New attempts blocked; existing attempts remain readable |
| Attempt | in_progress → submitted | Owner; required-task policy satisfied |
| Attempt | in_progress → abandoned | Owner or explicit expiry process; conditional update |
| Attempt | submitted → completed | Every required scoring component exists; finalization wins once |
| Response | absent → submitted | Attempt in_progress; unique task response |
| Rating | absent → rated | Authorized assigned rater; valid rubric; idempotency |
| Result | pending → final | All required skill scores exist; unique attempt result |

Do not allow direct submitted → in_progress, completed → in_progress or final → pending transitions.

### Required Local D1 integration tests

- Start attempt racing against assessment publication/archive.
- Start retry cannot create duplicate attempts unless explicit retake policy permits it.
- Snapshot is complete or absent; no partially populated attempt after a failed batch.
- Candidate cannot read or mutate another user's attempt/task/response/result.
- Published source edits do not change an existing attempt's prompt, task order, answer key or rubric.
- Same idempotency key/same payload returns same receipt.
- Same key/different payload returns 409.
- Different key after accepted final response returns 409.
- Two concurrent final responses for one task yield exactly one accepted payload.
- Response write racing with attempt submit has deterministic outcome.
- Two concurrent finalizers create one result and one section-result set.
- Unauthorized/unassigned rater cannot rate; duplicate rater decision is idempotent.
- Invalid score bounds, missing criteria, malformed JSON and oversized text are rejected.
- Final result cannot be changed by subsequent draft publication or policy changes.

## 6. SQLite implementation cautions

- SQLite JSON validity checks are useful but do not replace typed application validation.
- Avoid relying on `changes()` across statements without understanding D1 batch execution semantics; test the exact transaction behavior.
- Use composite unique constraints to enforce scope, not only application-side lookups.
- Keep FK actions restrictive for published forms, attempts, responses, ratings and results; do not cascade-delete evidence needed for audit.
- Use explicit SELECT lists for learner DTOs; never use `SELECT *` on tables containing private keys.
- Use indexes for owner history, pending rating queues and attempt task retrieval only after query-plan evidence.
- New migrations are forward-only and must be tested from an empty DB and an upgrade DB at this exact branch head.

## 7. Migration planning gate

Do not assign a migration number or write SQL until:
1. The target branch head and current migration directory are re-fetched.
2. Existing `0001`–`0015` are applied to isolated Local D1 and the resulting schema is inspected.
3. Product decisions in section 1 are resolved.
4. A physical ERD is reconciled with the actual user deletion/retention model and RBAC tables.
5. Constraints and triggers are reviewed for SQLite/D1 compatibility.
6. A rollback/recovery note is written (forward repair only; no destructive down migration).
7. Tests cover empty install and upgrade from current branch schema.

## 8. Implementation order

1. Finalize response modes and non-recorded speaking pilot semantics.
2. Finalize assessment version publication and scoring-policy shape.
3. Build objective Listening/Reading vertical slice.
4. Add Writing submission and human rating.
5. Add Speaking only after the interaction mode and privacy model are approved.
6. Pilot and standard-set score interpretation before displaying a proficiency claim.

No production deployment, remote D1 migration, secret mutation, paid service, audio upload or R2 resource is authorized by this design.


## 9. Verified integration points in the current branch

The following facts were checked against the branch's actual migrations and API documentation, not inferred from the conceptual model:

- The branch contains migrations `0001`–`0015`; the main-branch data-model document still describes the earlier `0001`–`0010` sequence. New work must use the feature branch's full schema history.
- `users` is the internal principal. `sessions` cascade on user deletion. `lesson_attempts` also currently cascade on user deletion, while lesson references are restrictive. The proposed assessment retention behavior must explicitly choose whether candidate deletion cascades, anonymizes, or retains legally required scoring evidence; do not silently choose RESTRICT or copy the lesson behavior.
- Current `user_roles.role` CHECK permits only `admin`, `content_author`, `content_reviewer`, and `support`. There is no `assessment_rater` role or rater-assignment table. Do not reuse `content_reviewer` as a rater implicitly: content review and learner assessment rating are different privileges. A dedicated role and assignment scope require a reviewed forward-only migration and owner-controlled grants.
- `admin_audit_events` already provides append-only privileged-action history with actor anonymization on deletion. Rating decisions and any reassignment/re-rating should emit allowlisted audit events, while criterion scores and learner response content should not be copied into general audit metadata.
- `assessment_policy_versions` already exists but is currently linked to lesson attempts and stores the existing weighted-percentage lesson quiz policy. A cumulative assessment scoring policy needs a distinct typed contract and immutable version identity; do not overload `percentage-v1` or change its meaning.
- The existing API success envelope is `{data, meta:{requestId}}`; errors use the repository's error envelope. Proposed examples in this document are illustrative and must be adapted to these exact conventions before OpenAPI/route implementation.
- Current timestamps use UTC ISO-8601, often generated with `strftime('%Y-%m-%dT%H:%M:%fZ','now')`. New tables should match the established representation.
- The backend's existing role middleware and admin audit patterns should be reused, but only after checking exact middleware exports and route registration on the target head.

### Required design changes before a migration

1. Decide account deletion and retention semantics for attempts, written responses, ratings and final results.
2. Define a separate `assessment_rater` privilege (or an explicitly narrower equivalent) and assignment model; do not grant it through public APIs.
3. Define whether one rater or two independent raters are required per productive response, and how disagreements are resolved.
4. Separate cumulative scoring policy versioning from lesson `assessment_policy_versions`.
5. Reconcile response DTOs with the existing API envelope and error codes.


## 10. Account deletion and rater authorization — physical schema impact

This section records implementation consequences discovered by tracing the actual migrations. It does not silently select a product retention policy.

### 10.1 Existing account-deletion graph

The current schema has these relevant FK actions:

| Relation | Current FK action on user deletion | Consequence |
|---|---|---|
| `external_identities.user_id` | CASCADE | Telegram identity is deleted with the account |
| `sessions.user_id` | CASCADE | Sessions are revoked by row deletion |
| `user_roles.user_id` | CASCADE | Role grants disappear |
| `lesson_attempts.user_id` | CASCADE | Lesson attempts and their cascading answers/snapshots disappear |
| `user_progress.user_id` | CASCADE | Learner progress disappears |
| `admin_audit_events.actor_user_id` | SET NULL | Audit event remains, actor identity is detached |
| `content_review_requests.author_user_id` / `reviewed_by_user_id` | SET NULL | Review record remains, user attribution is detached |
| `content_review_events.actor_user_id` | SET NULL | Event remains, actor identity is detached |

There is currently no account-deletion API or workflow in `apps/backend/src/modules/users/routes.ts`; it exposes only the authenticated profile read. The cascade behavior above is database behavior, not evidence that a complete deletion request workflow exists.

### 10.2 Consequence for cumulative assessment

A blanket `ON DELETE RESTRICT` on `assessment_attempts.user_id` would prevent deleting an account that has assessment history. A blanket cascade would delete written responses, ratings and final results as well. Both are material product/privacy decisions.

Three viable policies need explicit owner selection:

1. **Full erasure:** assessment attempts, responses, ratings and results are deleted with the learner. This is simplest and aligns with existing lesson-attempt cascade semantics, but no learner assessment history remains.
2. **Pseudonymized assessment evidence:** delete direct account identity and credentials while retaining a minimized assessment record under a non-reversible/de-linked subject key for a documented, limited retention period. This needs a defined re-identification threat model, retention schedule, export behavior and legal review; merely replacing `user_id` with a random UUID is not automatically anonymization.
3. **Selective retention:** erase free-text responses and other directly identifying material while retaining only narrowly defined score/audit evidence. Each retained field needs a purpose, access policy, retention period and deletion trigger.

No assessment migration should encode one of these policies by accident. In particular, do not copy `lesson_attempts.user_id ON DELETE CASCADE` or the conceptual model's provisional `RESTRICT` without an approved decision.

### 10.3 Rater role migration impact

Migration `0009_admin_rbac_audit.sql` defines `user_roles.role` with a SQLite CHECK constraint limited to `admin`, `content_author`, `content_reviewer` and `support`. Adding `assessment_rater` cannot be accomplished by inserting a role row; the CHECK rejects it.

The migration plan must therefore include a reviewed SQLite-compatible table rebuild (create replacement table with the expanded CHECK, copy existing grants, replace the original table, and recreate both active-unique and lookup indexes). Validate foreign-key behavior and preserve existing grant IDs, grantors, timestamps and revocation state. Do not edit migration 0009 after application.

A role alone is insufficient authorization for rating. The future rating write must also verify an explicit assignment or queue scope, the response's pending state, the allowed rubric version and the rater's separation from the candidate. Content-review permission must not imply assessment-rating permission. Role grants remain owner-controlled; there must be no public role-grant endpoint.

### 10.4 Audit and privacy boundary

Use append-only audit events for rating assignment, rating submission, reassignment, moderation and correction. Store allowlisted identifiers and action metadata only. Do not copy candidate free text, transcripts, answer keys, criterion-level sensitive notes or full response payloads into general admin audit JSON. Define whether rating rows survive candidate deletion independently from whether response text survives; a retained rating without its response may still be personal data when linkable to a learner.

### 10.5 Required decisions before physical migration

- Select one of the retention policies above, including field-level retention periods and deletion/export behavior.
- Decide whether raters are employees/trusted staff with owner-granted role plus per-response assignment, and define who can assign/revoke those assignments.
- Decide single rating versus independent double rating, including disagreement resolution and correction history.
- Define whether ratings and final scores are erased, retained or pseudonymized when either candidate or rater account is deleted.
- Specify the account-deletion request lifecycle, authorization/re-authentication, audit behavior and completion guarantees.

Until these decisions are recorded, implementation remains blocked at the schema gate. The objective Listening/Reading vertical slice can be designed independently, but it must use the same approved attempt retention policy before its first migration.

## 11. Existing lesson-attempt behavior — verified compatibility baseline

The following describes the currently implemented lesson quiz API in `apps/backend/src/modules/learning/routes.ts`. It is not a cumulative-assessment implementation and must not be assumed to be the correct disclosure or lifecycle policy for the four-skill assessment.

### 11.1 Start and snapshot

- `POST /api/v1/lessons/:lessonId/attempts` requires an authenticated session.
- The server selects the lesson's current published version and the existing `percentage-v1` lesson assessment policy; callers cannot choose a version or policy.
- The D1 batch creates the attempt and copies its published question versions, prompts, options, private answer keys, positions and weights into `attempt_questions`.
- Attempt reads are scoped by both attempt ID and authenticated user ID. The learner DTO selects snapshot fields explicitly and does not serialize the private answer key.
- Every start request currently creates a new attempt; a cumulative assessment must define its own retake/resume policy rather than inheriting this behavior accidentally.

### 11.2 Answer submission and disclosure

- `POST /api/v1/attempts/:attemptId/answers` checks ownership, active state and membership of the selected option in the snapshotted options.
- A unique `(attempt_id, question_id)` answer is accepted once. An identical retry returns the stored outcome; a different answer for the same question returns HTTP 409.
- The current lesson quiz response includes `isCorrect` immediately, including on an identical retry. The attempt-read endpoint withholds correctness while the attempt is in progress and includes it after completion.
- This immediate-feedback contract is a deliberate compatibility fact, not a safe default for a cumulative assessment. Cumulative objective-task feedback timing must be explicitly decided and snapshotted as part of its disclosure policy.

### 11.3 Completion and progress

- `POST /api/v1/attempts/:attemptId/complete` conditionally transitions only an owned `in_progress` attempt to `completed`.
- The score is computed server-side from snapshotted question weights: correct-answer weights form the numerator and all question weights form the denominator. Unanswered questions therefore contribute zero to the numerator and remain in the denominator.
- The completion transition and progress upsert execute in one D1 batch. The progress upsert is gated on the winning state transition, so a repeated completion does not increment `completed_count` again.
- Progress retains the maximum score and increments completion count once per successfully completed attempt. The history endpoint exposes completed attempts only and uses a bounded, timestamp-plus-ID cursor.
- The current completion endpoint permits completion without every question being answered. A cumulative assessment must make its unanswered-task submission policy explicit instead of copying this quiz behavior by default.

### 11.4 Required separation for cumulative assessment

Reuse only the proven infrastructure patterns where they fit: authenticated ownership, immutable snapshots, server-side scoring, conditional state transitions, unique response constraints, bounded DTOs and Local D1 concurrency tests. Do not reuse the lesson quiz's `percentage-v1` policy, immediate correctness disclosure, weighted-percentage aggregation, permissive unanswered-question completion or progress semantics as implicit cumulative-assessment requirements.

