# Backend Delivery Roadmap v3

Status labels: implemented in source, SQL-smoke-tested, Local D1 verified, CI verified, production approved. These are separate evidence levels.

## G0 — Reproducible build and P0 correctness
- [ ] Hosted GitHub Actions exposes logs/steps; current jobs fail before steps are reported.
- [x] Root lockfile committed locally and `npm ci` passes; push/hosted CI evidence pending.
- [x] Typecheck, backend tests (32/32) and frontend build pass on the same local checkout.
- [x] Independent fixed Telegram HMAC vector included and Telegram tests pass locally.
- [x] Local D1 migrations from empty database (0001..0006).
- [x] Local D1 upgrade/backfill path from 0001 legacy data through 0006.
- [x] Local D1 duplicate-login race: one 200 session and one 409 replay rejection.
- [x] Local D1 answer/completion race, post-completion answer rejection and duplicate completion/progress idempotency.
- [x] D1 batch conditional-write behavior verified on Wrangler Local D1; remote D1 remains unverified.

## G1 — Identity decoupling
- [x] Provider-neutral user_identities table and uniqueness constraints added in migration 0004.
- [x] Existing Telegram identities backfilled without changing users.id.
- [x] Verified Telegram login writes provider mapping; identity service and unit tests added.
- [x] Local D1 migration/backfill verification on isolated upgrade database.
- [ ] Account linking only with fresh proof of both identities; audited merge workflow later.

## G2 — Versioned learning content
- [x] lesson_versions and question_versions tables added; existing content backfilled as v1.
- [x] Attempts pin lesson_version and assessment_policy_version.
- [x] Published version immutability triggers and publication pointer validation added.
- [x] Public question DTO preserves the array shape and omits answer keys.
- [x] Local D1 migration and Worker route verification.
- [ ] Content authoring/review/publish API with RBAC and audit.

## G3 — Assessment and progress integrity
- [x] Fixed percentage assessment policy version seeded.
- [x] Score query uses weights from pinned question version.
- [x] Conditional completion/progress write implemented in source.
- [x] Local D1 completion race and progress idempotency verified.
- [ ] Immutable result facts, progress event facts and rebuild/reconciliation command.
- [ ] Explicit pass/retry/manual-review policy beyond the initial percentage policy.

## G4 — Vocabulary and spaced repetition
- [x] Canonical vocabulary and language-pair model.
- [x] Per-user vocabulary state and append-only review events.
- [x] Pure scheduler v1 with deterministic unit tests.
- [x] Due review query indexed by user/state/due_at.
- [x] Idempotent review submission and optimistic revision.
- [x] Local D1 enrollment, same-key replay and changed-payload idempotency rejection.
- [x] Unit tests passed as part of the 32-test backend suite.
- [ ] Deterministically force stale review revision conflict and add review time-boundary tests.
- [ ] Vocabulary authoring/import and curated content pipeline.

## G5 — Four skills and content production
- [ ] Listening and reading content references.
- [ ] Writing submissions and rubric version.
- [ ] Speaking flow only after consent and media policy.
- [ ] Admin content draft/review/publish with RBAC and audit.

## G6 — Media, audio and AI
- [ ] Private R2 and upload-intent policy.
- [ ] Magic-byte, file size, duration and codec checks.
- [ ] Durable outbox and Queue consumer idempotency.
- [ ] Job state, retries, cancellation and dead-letter behavior.
- [ ] Consent, retention, deletion and provider data-processing review.
- [ ] AI/STT/TTS adapters behind interfaces; no paid provider without owner approval.

## G7 — Operations and beta
- [ ] Exact origin allowlist and rate limits.
- [ ] Structured redacted logs and metrics.
- [ ] Backup and restore drill.
- [ ] Account export/deletion workflow.
- [ ] Abuse, concurrency and load tests.
- [ ] Telegram client matrix for session behavior.
- [ ] Cost/quota review and documented kill switches.
- [ ] All CI gates green on same commit.
- [ ] Explicit owner approval for production migration/deployment.

## Execution rules
1. Work on feature branch from latest approved code head.
2. Keep PR Draft until associated gate passes.
3. No speculative paid services, production mutations, merge or deployment without approval.
4. If a tool limitation blocks a task, use a lower-risk alternative and label its evidentiary limits.
5. Never report a test as passed unless command output or CI result is available.
6. Fix root causes, not symptoms; add regression tests for every defect.
