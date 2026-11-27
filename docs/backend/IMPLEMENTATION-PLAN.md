# Backend Implementation Plan

**Target:** production-capable backend for EnglishCodeApp.  
**Rule:** implementation status and validation status are separate. A feature is not release-ready until its tests pass on the exact commit.

## B0 — Runtime and content foundation
- [x] Worker entrypoint, Hono app, and typed bindings.
- [x] Health/readiness endpoints, request IDs, error envelope, and baseline headers.
- [x] D1 migrations and synthetic seed.
- [x] Public published course/lesson/question read API with answer-key omission.
- [x] API, architecture, data-model, and operations documentation.
- [ ] Typecheck and Vitest pass on GitHub Actions for the exact current main commit.
- [ ] Fresh Wrangler Local D1 migration/seed pass recorded for the exact current main commit.

## B1 — Identity and session security
- [x] Telegram initData HMAC verification, freshness checks, and duplicate-parameter rejection.
- [x] Opaque 256-bit session tokens; SHA-256 token hashes stored only.
- [x] Telegram login with replay fingerprint and conditional session creation.
- [x] Session middleware, logout, and authenticated profile.
- [x] Per-IP login rate limiting using an HMAC-derived pseudonymous key.
- [x] Login/global body limits and exact-origin CORS policy.
- [x] Bounded scheduled cleanup for expired authentication state.
- [ ] Reconfirm duplicate-login race, D1 changes(), expiry/revocation, and malformed-token behavior on Local D1 at the current main commit.
- [ ] Set and verify the owner-approved Production ALLOWED_ORIGINS values.

## B2 — Learning and assessment
- [x] Immutable lesson/question versions and current published pointer.
- [x] Versioned weighted-percentage assessment policy.
- [x] Attempt creation pins lesson/policy versions and snapshots question content and weights.
- [x] Owner-scoped attempt retrieval without answer-key disclosure.
- [x] Server-side answer validation/grading and idempotent same-answer retry.
- [x] Conditional completion and derived progress update in a D1 batch.
- [x] Current-user progress endpoint.
- [ ] Verify answer/complete races and exactly-once progress against Wrangler Local D1 on the current main commit.
- [ ] Finalize pass thresholds, retry policy, and future question types.
- [ ] Immutable completion-event ledger and deterministic progress rebuild are proposed in open PR #19; they are not part of main until merged.

## B3 — Content governance and administration
- [x] D1-backed roles: admin, content_author, content_reviewer, and support.
- [x] Author-owned draft lesson version creation and submission.
- [x] Reviewer approve/reject workflow with self-review prevention and immutable review events.
- [x] Admin-only publication of approved versions.
- [x] Append-only audit events with metadata allowlist and admin-only audit feed.
- [ ] Owner-operated bootstrap/grant/revoke maintenance procedure.
- [ ] Validate reviewer-queue pagination and add/validate author-owned lesson version history pagination on main.
- [ ] Local D1 integration tests for the full author → reviewer → admin publication lifecycle.

## B4 — Privacy, reliability, and operations
- [x] Bounded scheduled cleanup and authentication-state retention windows.
- [ ] Account export/deletion and backup-deletion procedure.
- [ ] Structured non-sensitive logs, metrics, and alerting.
- [ ] Backup/restore drill and incident runbook.
- [ ] Cross-user and role-revocation security test matrix.
- [ ] Load-test D1 query patterns and record latency/error baselines.

## B5 — Conditional integrations
- [ ] Private R2 media only when a demonstrated media-storage use case is approved.
- [ ] D1 outbox + Queues only for jobs requiring durable asynchronous execution.
- [ ] AI/STT/TTS only after quality, privacy, quota, and current-cost review.
- [ ] No paid service, paid fallback, or Production deployment without explicit owner approval.

## Current blockers and scope boundaries
1. GitHub Actions runs inspected on 2026-11-27 fail before runner allocation (runner_id=0, no executed steps). This does not establish code-test failure or success.
2. No current-main test result is claimed in this document. Feature-branch validation evidence applies only to its exact commit and stated checks.
3. The current main migration sequence is 0001–0015. Migration 0016 in open PR #19 and migration 0017 in open PR #20 are not part of main.
4. PR #20's speech transcription feature remains an unmerged proposal and has outstanding real-device/browser validation gates.
5. PRs #21 and #22 contain content/library proposals; their datasets and course samples are not authoritative published curriculum merely because they are present in an open PR.
6. Production origin values, first-admin bootstrap, remote migrations, secret changes, and deployments remain owner-controlled.

No Production deployment, Production remote migration, Production secret change, paid resource activation, or Production role grant is authorized by this plan.