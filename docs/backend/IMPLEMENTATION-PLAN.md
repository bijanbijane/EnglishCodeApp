# Backend Implementation Plan

**Target:** production-capable backend for EnglishCodeApp.  
**Rule:** implementation status and validation status are separate. A feature is not release-ready until tests pass on the exact commit.

## B0 — Runtime and content foundation

- [x] Worker entrypoint, Hono app and typed bindings.
- [x] Health/readiness endpoints, request IDs, error envelope and baseline headers.
- [x] D1 migrations and synthetic seed.
- [x] Public published course/lesson/question read API.
- [x] API, architecture, data-model and operations docs.
- [ ] Typecheck and Vitest pass on CI.
- [ ] Fresh Local D1 migration/seed pass.

## B1 — Identity and session security

- [x] Telegram initData HMAC verifier, freshness checks and duplicate-parameter rejection.
- [x] Opaque 256-bit session tokens; SHA-256 hashes stored only.
- [x] Telegram login route with replay fingerprint and conditional session insert in one D1 batch.
- [x] Session middleware, logout and authenticated profile.
- [x] Per-IP 30/minute login rate limit using HMAC-derived pseudonymous key.
- [x] 20 KiB login body limit and 256 KiB global API body limit.
- [x] Exact-origin CORS allowlist; no wildcard or credentials.
- [x] Bounded daily cleanup for expired replay, rate-limit and stale session rows.
- [ ] Verify duplicate login race and `changes()` behavior using real Local D1.
- [ ] Verify expiry/revocation and malformed token cases on Local D1.
- [ ] Set the approved production `ALLOWED_ORIGINS` values.

## B2 — Learning and assessment

- [x] Immutable lesson/question versions and current published pointer.
- [x] Versioned weighted-percentage assessment policy.
- [x] Attempt creation pins lesson/policy versions and snapshots question content and weights.
- [x] Owner-scoped attempt retrieval without answer-key disclosure.
- [x] Server-side answer validation and grading; idempotent same-answer retry.
- [x] Conditional completion, immutable completion-event append, and derived progress upsert in one D1 batch.
- [x] Current-user progress endpoint.
- [ ] Verify answer/complete races, event immutability, parent-user cascade, and exactly-once progress against Wrangler Local D1.
- [ ] Provide a D1-compatible deterministic progress projection rebuild; current rebuild SQL is explicitly SQLite-only.
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
- [ ] Add cursor pagination to review queue and author version history.
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

1. GitHub Actions jobs currently fail before runner allocation (`runner_id=0`, no steps); typecheck, Vitest and CI SQL script have not run.
2. The connected Mac is offline, so no local npm/Wrangler execution is available.
3. Migrations `0001`–`0010` have not been applied to a fresh Cloudflare Local D1 in this session.
4. D1 `batch()` and SQLite `changes()` invariants are covered by a committed SQLite compatibility script but still need real Local D1/concurrency verification.
5. Production origin values and first-admin bootstrap remain owner-controlled and unset.

No deployment, remote migration, production secret change, paid resource or production role grant has been performed.
