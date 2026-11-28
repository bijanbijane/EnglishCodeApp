# Backend Implementation Plan

**Baseline:** `main` at `[current main HEAD](https://github.com/bijanbijane/EnglishCodeApp/tree/main)` (2026-11-28).  
**Rule:** implementation, exact-commit validation and release readiness are separate states.

## B0 — Runtime and content foundation

- [x] Cloudflare Worker entrypoint, Hono application and typed bindings.
- [x] Health/readiness endpoints, request IDs, error envelope and baseline response headers.
- [x] Versioned API under `/api/v1`.
- [x] Published course/lesson/question reads without public answer-key disclosure.
- [x] Forward-only D1 migrations and synthetic seed scripts.
- [x] React 19 / TypeScript / Vite frontend baseline.

## B1 — Identity and session security

- [x] Telegram initData HMAC verification, freshness validation and duplicate-parameter rejection.
- [x] Opaque session tokens; SHA-256 hashes stored instead of bearer tokens.
- [x] Replay fingerprint and conditional session creation in D1 batch.
- [x] Session middleware, logout and authenticated profile.
- [x] Bounded login rate limit and request-body limits.
- [x] Exact-origin CORS policy; no wildcard credentialed CORS.
- [x] Bounded scheduled cleanup for expired auth-state records.
- [ ] Complete cross-user, role-revocation and adversarial auth test matrix.
- [ ] Set production origins and secrets only through owner-approved operations.

## B2 — Learning and assessment

- [x] Immutable lesson/question versions and published-version pointer.
- [x] Versioned weighted-percentage assessment policy.
- [x] Attempt snapshots pin lesson and assessment policy versions.
- [x] Authenticated, owner-scoped attempt and answer APIs.
- [x] Server-side answer validation and grading; answer keys omitted from public DTOs.
- [x] Idempotent same-answer retry and conditional attempt completion.
- [x] Append-only lesson completion event and progress projection update in one D1 batch.
- [x] Current-user progress endpoint.
- [ ] Complete and verify a D1-compatible progress projection rebuild. An internal D1-batched helper now exists, but Local D1 execution/rollback verification and an owner-controlled invocation procedure remain outstanding.
- [ ] Expand concurrent completion, cross-user isolation and retry-race coverage on Local D1.
- [ ] Finalize pass thresholds, retry policy and future question types as explicit product decisions.

## B3 — Content governance and administration

- [x] D1-backed roles: admin, content_author, content_reviewer and support.
- [x] Author-owned draft lesson versions and structured question options/weights.
- [x] Reviewer approve/reject workflow with self-review prevention and immutable review events.
- [x] Admin-only publication of approved versions.
- [x] Append-only privileged-action audit events with metadata allowlist.
- [x] Admin audit feed pagination.
- [ ] Owner-operated bootstrap/grant/revoke maintenance procedure; no public role-grant endpoint.
- [ ] Add integration coverage for complete author → reviewer → admin publication lifecycle on Local D1.
- [ ] Add cursor pagination to remaining review/author queues where needed.

## B4 — Curriculum and learning content

- [x] Mainline A1 foundation: 9 units, 45 lessons and 180 deterministic MCQs.
- [ ] Extend A1 beyond recognition-focused MCQs to balanced listening, speaking, reading and writing practice.
- [ ] Complete progression, spaced review, vocabulary and grammar coverage with pedagogical review.
- [ ] Keep answer keys and grading authority server-side for all newly integrated content.
- [ ] Verify provenance and license obligations for every external dataset or adapted source before integration.

## B5 — Privacy, reliability and operations

- [ ] Account export/deletion and backup-deletion procedure.
- [ ] D1-compatible recovery/rebuild procedures and backup/restore drill.
- [ ] Structured non-sensitive logs, metrics and alerting.
- [ ] Cross-user, role-revocation, concurrency and idempotency security matrix.
- [ ] Load test D1 query patterns and record latency/error baselines.
- [ ] End-to-end Local D1 migration, seed and publication workflow evidence on the current main head.

## B6 — Conditional integrations

- [ ] Private R2 media only when real media content and access requirements justify it.
- [ ] D1 outbox + Queues only for proven asynchronous workloads.
- [ ] AI/STT/TTS only after separate quality, privacy, quota and cost review.
- [ ] No paid service, quota increase or production deployment without explicit owner approval.

## Validation evidence and limits

The following GitHub Actions runs were verified against exact PR heads during the 2026-11-28 review:

- PR #26 head `1f821e690e5c90bd47c4b7db4eadc89b354d080a`, run #46129880194: passed.
- PR #28 head `726d638f1209c46489e0f79e1bfe8bc09d5d942c`, run #46129940982: passed.
- PR #30 head `1adc37f6a80ffca3795d72d7415b2b35bac1e4a2`, run #46132304990: passed.

These runs validate their respective PR commits, not a separate push-triggered run on current `main`. No local test result is claimed by this document.

## Current mainline data baseline

- Migrations `0001`–`0016` are present on main.
- Migration `0016_immutable_learning_events.sql` stores immutable lesson-completion facts. It is not a cumulative-assessment result store.
- The current A1 curriculum seed contains 9 units, 45 lessons and 180 MCQs; this is not a complete four-skill A1 course.
- Never edit an applied migration. Future schema changes must be forward-only and tested on fresh and upgrade Local D1 paths.

No production deployment, remote migration, production secret/config mutation or paid resource action is authorized by this plan.
