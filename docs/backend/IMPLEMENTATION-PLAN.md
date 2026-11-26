# Backend Implementation Plan

**Baseline commit:** `main`; see current GitHub history.  
**Delivery rule:** a feature is complete only after tests and acceptance evidence pass on the exact commit.

## B0 — Runtime and content foundation

- [x] Worker entrypoint, Hono app, typed bindings.
- [x] Health and D1 readiness endpoints.
- [x] Structured error envelope, server-generated request ID, baseline headers.
- [x] Public published-course and lesson read endpoints.
- [x] D1 repository adapter for content queries.
- [x] Initial relational migration and synthetic seed.
- [x] API contract and local runbook.
- [x] Basic Vitest suite and GitHub Actions workflow.
- [ ] Run typecheck and tests on CI.
- [ ] Apply migrations and seed against fresh Local D1.
- [ ] Add Local D1 integration test for answer-key non-disclosure and published-only visibility.

## B1 — Identity and session security

- [x] Telegram initData HMAC verifier with timestamp validation.
- [x] Reject duplicate initData parameters and malformed signatures.
- [x] Static HMAC test vector, tampering, age, and future-skew tests.
- [x] Opaque session token generation and SHA-256 hashing.
- [x] Active-session middleware, logout, and authenticated profile endpoint.
- [x] Replay fingerprint table migration and ADR design.
- [ ] Implement login endpoint and atomic replay/session D1 batch.
- [ ] Prove exactly one winner under concurrent identical initData.
- [ ] Test session expiry, revocation, and malformed bearer tokens against Local D1.
- [ ] Add rate limiting, body-size enforcement, and origin policy.

## B2 — Learning write path

- [ ] Define attempt state machine and assessment policy version.
- [ ] Start attempt with server-derived owner and pinned content version.
- [ ] Submit answer with strict owner/state checks and deterministic idempotency semantics.
- [ ] Grade on the server; never trust client correctness or score.
- [ ] Complete attempt with single-winner conditional update.
- [ ] Update progress atomically with completion; prove no double increments.
- [ ] Add D1 concurrency and cross-user integration tests.

## B3 — Content lifecycle and administration

- [ ] Version published content; published versions remain immutable for historical attempts.
- [ ] Add content authoring/publishing only when an operational editor workflow is defined.
- [ ] Add staff roles/capabilities, controlled role bootstrap/revocation, and audit trail.
- [ ] Add cursor pagination and bounded query contracts for growing collections.

## B4 — Privacy, reliability, and operations

- [ ] Account export, deletion, retention, and backup deletion behavior.
- [ ] Structured non-sensitive logs, metrics, alerting, and request correlation.
- [ ] Backup/restore drill and incident runbook.
- [ ] Security tests for every user-owned resource and every admin action.
- [ ] Load test D1 query patterns and record latency/error baselines.

## B5 — Conditional integrations

- [ ] Private R2 media only when real media content is ready.
- [ ] Queues only for jobs that need asynchronous execution, with D1 outbox and idempotent consumers.
- [ ] AI/STT/TTS only after quality, privacy, quota, and cost review.
- [ ] No paid services, production migration, or deployment without explicit owner approval.

## Current blockers

1. Remote desktop test environment is offline; no local shell execution was available during the current work session.
2. GitHub returned no visible status checks for the current commits; the workflow is configured but not verified green.
3. Login is intentionally incomplete until D1 replay/session atomicity is proven.
4. The initial migration history on main must be reconciled before any shared database is attached.
