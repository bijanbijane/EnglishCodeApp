# EnglishCodeApp Backend Architecture v3

**Status:** Target architecture and implementation contract. Planned modules are not represented as implemented.
**Runtime:** Cloudflare Workers + Hono + TypeScript + D1. R2, Queues, KV, Cron and external providers are opt-in, not baseline dependencies.

## 1. Product boundary

The backend is the system of record for identity, learning content, assessment, attempts, progress, vocabulary review, entitlements, media jobs and administrative actions. Telegram Mini App is an identity provider and client shell, not the owner of learning state.

All clients (Telegram Mini App, standalone web and future mobile) use the same versioned API and domain rules. A client never decides identity, ownership, correctness, entitlement or final score.

Constraints:
- Modular monolith first; no microservices until measured operational or team boundaries justify extraction.
- D1 is authoritative for relational state and transactional invariants.
- No hidden in-memory persistence. Cache only derived, public, versioned data with explicit invalidation.
- All schema changes are forward-only numbered migrations. Never edit an applied migration.
- Free-first Cloudflare usage. No paid provider, paid plan, resource provisioning, production migration or deployment without explicit owner approval.
- Every feature ships with contract, authorization, observability, tests and recovery notes.
- User data minimization, purpose limitation, retention and deletion are first-class requirements.

## 2. Logical architecture

Client apps -> HTTPS /api/v1 -> Cloudflare Worker (Hono) -> middleware -> application services -> domain modules -> repositories -> D1.

Optional async path: API -> durable outbox record in D1 -> Queue -> idempotent consumer -> private R2 / provider adapter -> job status in D1.

Middleware responsibilities: application request ID, security headers, body limits, origin policy, rate limits, authentication, stable error mapping. Long-running transcription, synthesis, AI generation, bulk imports and notifications must not execute in the main HTTP request.

## 3. Target code layout

apps/backend/src/
- index.ts, app.ts, env.ts
- middleware/: request-context, origin-policy, rate-limit, body-limits
- modules/identity: internal users and external provider identity mapping
- modules/auth: Telegram verification, sessions, credentials
- modules/profiles: preferences, locale, account lifecycle
- modules/content: courses, immutable lesson/question versions
- modules/assessment: policies, grading, attempts and results
- modules/progress: mastery and completion projections
- modules/vocabulary: lexicon and user vocabulary
- modules/review: spaced-repetition scheduling
- modules/skills: listening, speaking, reading, writing records
- modules/media: media metadata and private object references
- modules/jobs: async job state and idempotency
- modules/integrations: Telegram bot/webhook and provider adapters
- modules/entitlements: plan-independent permission checks
- modules/admin: RBAC, audit and publishing commands
- modules/analytics: minimal aggregated product events
- platform/: D1, R2, Queue, clock, IDs
- shared/: errors, validation, pagination, crypto, result
- contracts/: API v1 and events

Dependency rules:
1. HTTP routes parse and validate transport input, then call application services.
2. Application services orchestrate transactions and authorization.
3. Domain modules contain deterministic business rules and do not import Hono, D1 or provider SDKs.
4. Repositories own SQL and row-to-domain mapping.
5. Platform adapters implement D1/R2/Queue/clock/ID interfaces.
6. A domain module must not query another module's tables directly; use an application service or documented read model.
7. No circular imports, shared god-service or cross-module SQL.

## 4. Identity and authentication

Internal identity:
- users.id is an immutable internal UUID and owner of learning data.
- user_identities maps (provider, provider_subject) to users.id with a unique constraint.
- Telegram numeric user ID is a provider subject, not the internal primary key.
- Provider linking requires an authenticated session and fresh proof from the second provider. Never link based only on a client-supplied ID.
- Account merge is a privileged, audited workflow with conflict detection and explicit data migration.

Telegram login:
- Accept only raw Telegram.WebApp.initData; never trust initDataUnsafe.
- Enforce body and field limits, reject duplicate keys and malformed signatures.
- Follow Telegram's documented HMAC derivation exactly; maintain a fixed independent known-good test vector.
- Validate auth_date age and future skew using an injectable clock.
- Store only a canonical SHA-256 fingerprint for replay prevention; never persist raw initData.
- Claim replay fingerprint and issue a session atomically. Concurrent duplicate initData must create at most one session.
- Keep bot token in a Worker secret, never Git, D1, response or logs.

Session lifecycle:
- Opaque cryptographically random bearer tokens; persist only token hashes.
- Explicit TTL, revoke, rotate and revoke-all sessions.
- Never place tokens in URLs, analytics, crash logs or browser localStorage by default.
- Telegram WebView cookie behavior must be tested across iOS/Android/Desktop before choosing cookie auth. Until then, bearer tokens are short-lived and held in memory where possible.
- Authentication failures must not reveal whether a Telegram account exists.

## 5. Content and assessment

Published learning material is immutable. Editing published content creates a new version; it never mutates a version used by an existing attempt.

Core concepts: course/course_version, lesson/lesson_version, question/question_version, assessment_policy/assessment_policy_version, attempt, attempt_answer and attempt_result.

Each attempt pins exact lesson_version_id and assessment_policy_version_id. The server grades against that pinned version. Public DTOs omit answer keys, scoring rubrics that reveal answers and private author notes.

Attempt state machine:
- created -> in_progress
- in_progress -> completed | expired | abandoned
- terminal states never transition back.
- Answer writes require in_progress and are atomic with respect to completion.
- Completion is idempotent and exactly one transition may update progress.
- Retries with same idempotency key return same result; conflicting payload reuse returns 409.

Assessment policy must define question types, accepted answer representations, required/optional questions, unanswered-question behavior, weights, rounding, negative marking, pass threshold, retry policy, partial credit, manual review, policy version and effective date.

## 6. Learning domains

Progress and mastery: store immutable attempt results as facts; derive per-user progress as a projection. Projection updates must be transactionally idempotent and rebuildable from append-only progress events. A result fact snapshots earned/total weight, correct/question counts, score, pinned lesson version, assessment policy version and completion timestamp. Account erasure must reconcile immutable fact retention through an explicit tombstone/pseudonymization and retention policy; do not add physical-delete routes that violate fact integrity. Distinguish completion, accuracy, streak and mastery.

Vocabulary and spaced repetition: separate canonical vocabulary items from per-user state. Store language pair, lemma, normalized form, senses, examples, tags and source/version. User state stores familiarity, due_at, interval, ease/difficulty, last_reviewed_at and review count. Scheduler logic is pure and versioned. Review events are append-only; due queues are indexed by user and due_at. Do not claim a scientifically optimal schedule without validation.

Four skills:
- Listening: audio asset, transcript/version and comprehension items.
- Speaking: consented audio submission, transcription/feedback job and rubric version.
- Reading: text version, comprehension/annotation activity.
- Writing: text submission, rubric version and optional AI feedback.
AI feedback is advisory unless a separately validated policy authorizes score impact.

Media and async processing:
- R2 buckets private by default; object keys random and non-guessable.
- Validate MIME by file signature, size, duration and allowed codecs; quarantine before processing.
- Short-lived signed URLs; never expose bucket credentials.
- Job states: queued, running, succeeded, failed, cancelled, expired.
- Persist job intent before enqueue (outbox pattern) to avoid lost jobs.
- Every consumer is idempotent; retries bounded with backoff and dead-letter handling.
- Audio consent, purpose, retention, deletion and access logs are mandatory before accepting real user audio.

Entitlements: one service answers whether a user can perform an action. Never trust client-provided plan. Unknown state denies restricted operations but must not block free learning. No payment provider or paid feature activates without explicit approval.

Administration: server-enforced RBAC and least privilege. Current schema roles: content_author, content_reviewer, admin and support. The admin role owns publishing authority until a finer-grained publisher capability is justified. Role grants are server-side only; there is no public grant endpoint. Implemented v1 operations include draft creation/listing, reviewer queue/detail, reviewer decision and admin-only publishing. Authors cannot review their own versions. Every privileged mutation writes an append-only audit event with actor, action, target, timestamp, request ID and allowlisted metadata in the same D1 batch.

Analytics: collect only events with defined product purpose. Prefer aggregate counts and coarse time buckets. Do not collect keystrokes, mouse movements, passwords, raw audio, exact continuous location or inferred psychological profiles. Apply retention and deletion rules. Analytics cannot make consequential decisions about an individual user.

## 7. API contract

- Prefix /api/v1; breaking changes require new version or explicit compatibility window.
- Stable error envelope: { error: { code, message, requestId, details? } }.
- Stable success envelope: { data, meta? }.
- Validate path, query and body at boundary; reject unknown fields for sensitive commands.
- Use cursor pagination for growing collections.
- Use idempotency keys for attempt writes, job creation and admin commands where retries can duplicate effects.
- Use ETags/If-Match for content editing and publication to prevent lost updates.
- Never expose database rows directly; map to explicit DTOs.
- Generate OpenAPI from route contracts or maintain contract tests against runtime responses.

## 8. D1 consistency

D1 is the transactional source of truth for MVP. Use foreign keys, unique constraints, check constraints and indexes matching observed queries. Never depend on in-memory locks across Worker isolates.

For every multi-write invariant: express it in SQL constraints where possible; use D1 batch/transactional operations with conditional writes; verify affected-row counts; add real Local D1 concurrency tests; prove behavior under duplicate/reordered requests.

Do not assume SQLite in-memory smoke tests prove D1 runtime semantics. Avoid large unbounded transactions. Add indexes from EXPLAIN QUERY PLAN and measured query paths.

## 9. Security

- Threat model auth, account linking, attempts, content publishing, uploads, jobs and admin APIs.
- Rate limits at edge and application boundaries; per-IP and per-user policies with abuse-safe fallbacks.
- Exact Origin allowlist; CORS is not authentication. Same-origin preferred.
- Strict content type, body size, schema and identifier validation.
- Secrets only as platform bindings; rotate and document incident response.
- PII minimization, retention schedule, export and account deletion.
- Cross-user authorization tests on every user-owned route.
- Admin MFA/provider assurance where supported, RBAC and audit.
- Dependency scanning, lockfile integrity and reproducible builds.
- Security events are redacted and never include auth tokens or raw user content.

## 10. Reliability and observability

Every request log includes application requestId, route template, method, status, latency and Cloudflare Ray ID separately. Never log raw URL query strings by default. Correlate async jobs to originating request ID without copying private payloads.

Minimum metrics: request count, p50/p95 latency, 4xx/5xx by route template, D1 latency/errors/conflicts, auth success/failure/replay counts without identifiers, queue age/retries/dead-letter count, media processing duration/failure class, cost/usage and quota headroom.

Runbooks: D1 unavailable, auth key rotation, replay spike, queue backlog, R2 upload abuse, data deletion, backup restore and incident response. Backups must be tested by restore, not just configured.

## 11. Environments and release

- local: isolated local D1, deterministic fixtures, no production secrets.
- preview: isolated resources and synthetic data only.
- production: separate bindings, secrets, access and deployment approval.
- CI: install from committed lockfile with npm ci; typecheck, unit, integration (local D1), contract/security tests, frontend build and migration validation.
- Release gate: all checks green on same commit, migration tested from empty and previous schema, rollback/recovery documented, owner approval.
- No production migration/deployment is authorized by this document.

## 12. ADR register

ADR-0001 Modular monolith on Workers/Hono/D1.
ADR-0002 Bearer session for Telegram WebView pending client matrix; do not assume cookie compatibility.
ADR-0003 D1 is source of truth; caches are disposable derived data.
ADR-0004 Immutable published content and attempt version pinning.
ADR-0005 Async media/AI jobs with outbox and idempotent consumers.
ADR-0006 Privacy-minimal analytics and explicit retention.
ADR-0007 Free-first platform policy; no paid resources without approval.

## 13. Non-goals until evidence/approval

No microservices, Kubernetes, multiple databases, global event bus, payment integration, paid AI/STT/TTS, public media bucket, automated production deploy or speculative caching. Add only after a documented need and cost/security review.
