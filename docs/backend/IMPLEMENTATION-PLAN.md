# Backend Implementation Plan

**Target:** production-capable backend for EnglishCodeApp.  
**Rule:** implementation status and validation status are separate. A feature is not release-ready until tests pass on the exact commit.

## B0 — Runtime and content foundation

- [x] Worker entrypoint, Hono app and typed bindings.
- [x] Health/readiness endpoints, request IDs, error envelope and baseline headers.
- [x] D1 migrations and synthetic seed.
- [x] Public published course/lesson/question read API.
- [x] API, architecture, data-model and operations docs.
- [x] Typecheck and Vitest pass on Cloudflare validation Build (21 files / 84 tests on code commit cb31ff26fab4e6c38f717014e5eddab0a0faedc0); GitHub Actions runner allocation remains separately unresolved.
- [x] Fresh Wrangler Local D1 migrations 0001–0016 and synthetic seed pass.

## B1 — Identity and session security

- [x] Telegram initData HMAC verifier, freshness checks and duplicate-parameter rejection.
- [x] Opaque 256-bit session tokens; SHA-256 hashes stored only.
- [x] Telegram login route with replay fingerprint and conditional session insert in one D1 batch.
- [x] Session middleware, logout and authenticated profile.
- [x] Per-IP 30/minute login rate limit using HMAC-derived pseudonymous key.
- [x] 20 KiB login body limit and 256 KiB global API body limit.
- [x] Exact-origin CORS allowlist; no wildcard or credentials.
- [x] Bounded daily cleanup for expired replay, rate-limit and stale session rows.
- [x] Verify duplicate login race and `changes()` behavior using Wrangler Local D1.
- [x] Verify expiry/revocation and malformed token cases on Wrangler Local D1.
- [ ] Set the approved production `ALLOWED_ORIGINS` values.

## B2 — Learning and assessment

- [x] Immutable lesson/question versions and current published pointer.
- [x] Versioned weighted-percentage assessment policy.
- [x] Attempt creation pins lesson/policy versions and snapshots question content and weights.
- [x] Owner-scoped attempt retrieval without answer-key disclosure.
- [x] Server-side answer validation and grading; idempotent same-answer retry.
- [x] Conditional completion and progress upsert in one D1 batch.
- [x] Current-user progress endpoint.
- [x] Verify answer/complete races and exactly-once progress against Local D1 (Wrangler Local D1 integration now asserts one completion event for concurrent duplicate completion and two events for two distinct attempts).
- [x] Add immutable attempt-result/progress-event facts and deterministic projection rebuild (migration 0016, completion write path, maintenance SQL; validated by Cloudflare validation-only Build c9f28ecf-361d-47b0-9126-f07294e267f1 on code commit 5dc565e72b54639c0f72067dacd780c10d4e7ce0).
- [ ] Finalize pass thresholds, retry policy and future question types.

## B3 — Content governance and administration

- [x] D1-backed roles: admin, content_author, content_reviewer, support.
- [x] Author-owned draft lesson version creation with structured option IDs and weights.
- [x] Author-only draft submission.
- [x] Reviewer approve/reject workflow with self-review prevention and immutable review events.
- [x] Admin-only publication of approved versions.
- [x] Append-only audit events with metadata allowlist.
- [x] Admin-only keyset-paginated audit feed.
- [ ] Implement owner-operated bootstrap/grant/revoke maintenance script; no public role grant endpoint.
- [x] Keyset cursor pagination for review queue and author-owned lesson version history.
- [ ] Add integration tests for full author → reviewer → admin publish lifecycle on Local D1.

## B4 — Privacy, reliability and operations

- [x] Bounded scheduled cleanup and retention windows for auth state.
- [ ] Account export/deletion and backup deletion procedure.
- [ ] Structured non-sensitive logs, metrics and alerting.
- [ ] Backup/restore drill and incident runbook.
- [ ] Cross-user and role-revocation security test matrix.
- [ ] Load test D1 query patterns and record latency/error baselines.

## B5 — Conditional integrations

- [ ] Private R2 media only when real media content is ready.
- [ ] D1 outbox + Queues only for jobs requiring asynchronous execution.
- [ ] AI/STT/TTS only after quality, privacy, quota and cost review.
- [ ] No paid services or production deployment without explicit owner approval.

## Current blockers

1. GitHub Actions still fails before runner allocation (`runner_id=0`, no steps). Equivalent backend checks have passed on Cloudflare Build Runner; repair GitHub Actions separately.
2. No connected Mac is required for current validation; Wrangler Local D1 is exercised on Cloudflare Build Runner.
3. Fresh Wrangler Local D1 migration and seed verification for migrations `0001`–`0016` has passed.
4. D1 `batch()` and SQLite `changes()` invariants are covered by SQLite compatibility verification and Wrangler Local D1 concurrency tests, including exactly-once event persistence.
5. Production origin values and first-admin bootstrap remain owner-controlled and unset.

No Production deployment, Production remote migration, Production secret change, paid resource or Production role grant has been performed. Development validation builds used echo-only deploy commands; no remote database was mutated. Migration 0016 adds an append-only completion-event ledger, backfills historical completed attempts, and the completion transaction appends one idempotent event before updating the derived progress projection. A transactional maintenance SQL script rebuilds user_progress from events. Exact-code-commit typecheck, 80-test Vitest suite, SQLite verifier, Wrangler Local D1 integration, and deploy dry-run passed in Cloudflare validation-only Build c9f28ecf-361d-47b0-9126-f07294e267f1. No deployment or remote migration was run.
