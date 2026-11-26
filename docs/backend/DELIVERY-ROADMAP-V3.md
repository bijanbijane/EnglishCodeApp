# Backend Delivery Roadmap v3

A checkmark means only the stated evidence exists; a feature is not production-ready merely because source files exist.

## Gate G0 — Reproducible build and P0 correctness
- [ ] Repair GitHub Actions so the job exposes logs and steps.
- [ ] Replace package-lock mutation/install with deterministic npm ci after confirming workspace lockfile.
- [ ] Green root typecheck, backend unit tests and frontend build on one commit.
- [ ] Independent Telegram HMAC known-good vector.
- [ ] Local D1 migrations from empty database.
- [ ] Local D1 duplicate-login race: at most one valid session.
- [ ] Local D1 conflicting answer and completion race tests.
- [ ] Verify D1 batch changes()/conditional write behavior.
- [ ] Verify all SQL statements and foreign keys on D1 runtime.

## Gate G1 — Identity decoupling
- [ ] Add provider-neutral user_identities table with unique(provider, provider_subject).
- [ ] Backfill Telegram identities from users.telegram_user_id using forward-only migration.
- [ ] Keep compatibility reads/writes until migration is verified.
- [ ] Add identity repository and tests for duplicate provider linking.
- [ ] Account linking only with fresh proof of both identities; audited merge workflow later.

## Gate G2 — Versioned learning content
- [ ] Add lesson/question immutable version tables and publication pointer.
- [ ] Existing lesson/question data migrated to version 1.
- [ ] Attempts pin lesson_version and assessment_policy_version.
- [ ] Published version cannot be edited; new version required.
- [ ] DTO allowlists and version consistency contract tests.

## Gate G3 — Assessment and progress integrity
- [ ] Explicit assessment policy version and deterministic scoring.
- [ ] Attempt state machine: created, in_progress, completed, expired, abandoned.
- [ ] Transactional answer/complete behavior with idempotency keys.
- [ ] Immutable attempt result and progress event facts.
- [ ] Rebuildable per-user progress projection and reconciliation command.

## Gate G4 — Vocabulary and spaced repetition
- [ ] Canonical vocabulary item and language-pair model.
- [ ] Per-user vocabulary state and append-only review events.
- [ ] Pure scheduler module with versioned algorithm and injected clock.
- [ ] Due review query indexed by user/due_at.
- [ ] Idempotent review submission and tests for timezone/day boundaries.

## Gate G5 — Four skills and content production
- [ ] Listening and reading content version references.
- [ ] Writing submissions and rubric version.
- [ ] Speaking flow only after consent and media policy.
- [ ] Admin content draft/review/publish with RBAC and audit.
- [ ] No public admin route before permission matrix and security tests.

## Gate G6 — Media, audio and AI
- [ ] Private R2 and upload-intent policy.
- [ ] Magic-byte, file size, duration and codec checks.
- [ ] Durable outbox and Queue consumer idempotency.
- [ ] Job state, retries, cancellation and dead-letter behavior.
- [ ] Consent, retention, deletion and provider data-processing review.
- [ ] AI/STT/TTS adapters behind interfaces; no paid provider without owner approval.

## Gate G7 — Operations and beta
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
1. Work on a feature branch from latest approved code head.
2. Keep PRs Draft until the associated gate passes.
3. No speculative paid services, production mutations, merge or deployment without approval.
4. When a tool limitation blocks a task, use a lower-risk alternative (e.g. local deterministic harness, SQLite syntax smoke test) but label its evidentiary limits.
5. Never report a test as passed unless command output or CI result is available.
6. Fix root causes, not only symptoms; add regression tests for every defect.
