# EnglishCodeApp Backend Architecture Specification

**Status:** Draft — normative target architecture, not a claim of production readiness  
**Applies to:** Telegram Mini App MVP and future non-Telegram clients  
**Current implementation baseline:** `feat/backend-domain-foundation`  
**Architecture decision:** Cloudflare Workers + Hono + D1, Modular Monolith  
**Release policy:** No merge, production migration, deployment, paid service, or usage upgrade without explicit approval.

## 1. Executive decision

EnglishCodeApp should be built as a **modular monolith** deployed to Cloudflare Workers. Telegram is the first identity provider and launch surface; it is not the owner of the application account, learning history, content model, scoring rules, or entitlements.

The backend has five primary responsibilities:

1. Establish a trustworthy application identity from Telegram-signed launch data.
2. Enforce authorization and protect user-owned learning records.
3. Serve versioned learning content without exposing answer keys.
4. Record attempts, answers, assessments, and progress consistently.
5. Integrate Telegram Bot API and optional media/AI processing without coupling those providers to core learning logic.

Do not start with microservices, Kubernetes, multiple databases, or paid infrastructure. Split a module into a separate service only after measured scale, security isolation, independent deployment, or team ownership justifies the operational cost.

## 2. Product and platform assumptions

### 2.1 Primary client

- Telegram Mini App opened inside Telegram on iOS, Android, Desktop, and supported web clients.
- React + TypeScript frontend.
- Telegram WebApp SDK supplies raw `Telegram.WebApp.initData`.
- `initDataUnsafe` is display convenience only and is never authentication evidence.
- The backend must remain usable by a future web client; Telegram-specific code stays behind an identity adapter.

### 2.2 Runtime and data

| Concern | Target | Rule |
|---|---|---|
| HTTP runtime | Cloudflare Workers | Stateless request handlers |
| HTTP framework | Hono + TypeScript | Versioned REST API |
| Primary database | Cloudflare D1 | Source of truth for relational and transactional application data |
| Object storage | R2, when needed | Audio, images, exports; not required for the first auth/learning slice |
| Cache | KV, only when justified | Never authoritative for scores, sessions, entitlements, or progress |
| Background work | Queues, when justified | Idempotent jobs; no long work in request lifecycle |
| Scheduling | Cron Triggers, when justified | Retention, due reviews, cleanup; no per-request cleanup loops |
| Secrets | Worker Secrets | Bot token and provider credentials never enter Git |

The selected Cloudflare project configuration and generated binding types must be established before production integration. Do not invent a `wrangler.toml` or mix deployment CLIs without an explicit project decision. The current structural D1 interface is scaffolding and must be replaced/augmented with generated runtime binding types.

### 2.3 Cost policy

Free-first is a product constraint. Do not activate paid plans, enable paid services, increase usage limits, or accept usage-based charges without explicit approval. When quotas are exhausted, disable or defer noncritical work and return controlled errors rather than silently increasing spend.

## 3. System context and request boundaries

```text
Telegram Client
  └─ Telegram Mini App (React)
       ├─ Telegram WebApp SDK: raw initData
       └─ HTTPS / same-origin API
            └─ Cloudflare Worker (Hono)
                 ├─ request ID, body limits, security headers
                 ├─ origin/CORS policy and rate-limit boundary
                 ├─ authentication + authorization
                 ├─ application modules
                 ├─ D1 repositories
                 ├─ R2 object adapter (optional)
                 └─ Queue producer (optional)
                      └─ Queue consumer / external providers
Telegram Bot API ── webhook adapter ── Worker
```

### 3.1 Trust boundaries

- The browser is untrusted. Never accept user ID, role, score, correctness, entitlement, or ownership from the client as authoritative.
- Telegram-signed `initData` is trusted only after server-side validation.
- D1 is the authoritative store for account state and learning outcomes.
- R2 objects are private by default; access is mediated by authorization and short-lived signed URLs where appropriate.
- Queue messages are untrusted inputs too: validate schema, version, ownership context, and idempotency key.
- External AI/STT/TTS providers are optional dependencies. Provider output is untrusted and must be validated before persistence or display.

## 4. Architectural style and module boundaries

### 4.1 Modular monolith

Use one Worker deployment and one D1 database initially, with explicit module ownership. Modules may call exported application services or shared contracts; they must not import another module's repository implementation or write its tables directly.

Each module follows this dependency direction:

```text
routes / transport
       ↓
application services / use cases
       ↓
domain rules and contracts
       ↓
repositories (interfaces)
       ↓
infrastructure adapters (D1, Telegram, R2, Queue)
```

Keep domain rules pure where practical. Hono route handlers should parse/validate input, call a use case, and map its result to HTTP. SQL belongs in repositories, not scattered across route handlers.

### 4.2 Module ownership

| Module | Owns | MVP status |
|---|---|---|
| Identity | internal users, external identities, sessions, login/logout | Required |
| Telegram integration | initData validation, bot webhook adapter, Telegram API client | Required for Mini App login; webhook later |
| User profile | user-visible profile and preferences | Minimal |
| Catalog/content | courses, levels, published lessons, content versions | Minimal |
| Learning | attempts, answers, completion lifecycle | Required |
| Assessment | scoring policy, grading, result snapshots | Minimal and explicit |
| Progress | per-user lesson/skill progress | Required |
| Vocabulary/review | vocabulary and spaced repetition schedule | Later |
| Audio/media | media metadata and processing jobs | Later |
| Subscription/entitlements | plans, access grants, provider-neutral entitlement checks | Later |
| Administration | staff roles, content publishing, moderation, audit | Before staff CMS |
| Analytics | minimized aggregate events and product metrics | Later |

Do not create empty runtime modules for every future feature. Create module folders and tables when the feature has an agreed use case and acceptance criteria.

### 4.3 Proposed repository layout

```text
apps/backend/src/
  index.ts
  app.ts
  env.ts
  core/
    errors/
    http/
    security/
    validation/
    observability/
  modules/
    identity/
      domain/
      application/
      infrastructure/
      http/
    telegram/
      application/
      infrastructure/
      http/
    users/
    catalog/
    learning/
    assessment/
    progress/
    vocabulary/       # when scheduled
    media/            # when scheduled
    entitlements/     # when scheduled
    administration/   # when scheduled
    analytics/        # when scheduled
  shared/
    contracts/
    types/
database/
  migrations/
  seeds/
  tests/
docs/backend/
  ARCHITECTURE.md
  API.md
  SECURITY.md
  DATA-MODEL.md
  OPERATIONS.md
  IMPLEMENTATION-PLAN.md
```

## 5. Telegram Mini App authentication

### 5.1 Login protocol

1. The Mini App waits until Telegram WebApp is initialized and reads the raw `initData` string.
2. The client sends it once to `POST /api/v1/auth/telegram` over HTTPS. Do not send a parsed `initDataUnsafe` object as proof.
3. Worker enforces content type, request-body size, maximum initData length, duplicate-parameter rejection, required fields, and allowed age/future clock skew.
4. Worker constructs Telegram's data-check-string exactly as specified in the official Telegram documentation and validates the HMAC-SHA-256 signature using the bot token-derived secret.
5. Only after signature validation does the server parse and normalize the Telegram user object.
6. The Telegram subject is resolved to an internal user through `user_identities`.
7. The server creates a new application session and records replay protection atomically or with a rigorously tested conditional-write protocol.
8. The response returns the selected session mechanism and minimal user profile. Never return bot credentials or raw initData.

Official algorithm reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

**Known current-code blocker:** the current `telegram.ts` calls `hmacSha256(key, value)` with `WebAppData` as the key and the bot token as the message. The official construction requires the bot token as the HMAC key and `WebAppData` as the message. This must be corrected and verified against an independently generated official test vector before any real login is accepted.

### 5.2 Canonicalization and replay protection

- Reject duplicate query parameter names before canonicalization.
- Exclude only the `hash` field from the data-check-string; sort remaining key/value pairs lexicographically and join with newline as specified by Telegram.
- Compare signature bytes in constant time.
- Fingerprint the complete validated payload in a deterministic canonical representation. Do not store raw initData.
- Store a unique fingerprint with expiry. Two concurrent requests with the same payload must produce at most one valid session.
- Do not create a session and then rely only on best-effort revocation after a replay conflict.
- Expired replay records should be cleaned by bounded batch/retention work, not an unbounded full-table delete on every login.
- A replay response must not reveal whether a Telegram account exists.

### 5.3 Identity model

Use an internal immutable user ID. Telegram is one linked identity provider, not the primary database key.

Conceptual tables:

- `users(id, status, display_name, locale, created_at, updated_at, deleted_at)`
- `user_identities(id, user_id, provider, provider_subject, linked_at, last_seen_at)`
- Unique constraint: `(provider, provider_subject)`
- `sessions(id, user_id, token_hash, created_at, expires_at, revoked_at, last_seen_at)`

Provider names are controlled values (initially `telegram`). Never use mutable Telegram username as identity key. Store only profile fields the product needs.

### 5.4 Session policy

- Generate opaque tokens using a cryptographically secure random generator.
- Store only a one-way hash of the token; never log or persist the raw token.
- Enforce expiry and revocation on every authenticated request.
- Revoke the current session on logout; add revoke-all-devices when account settings require it.
- Set explicit idle and absolute lifetime policies; document renewal and reauthentication.
- Preferred deployment: same-origin API and a Secure, HttpOnly cookie with a deliberate SameSite/CSRF design, after verifying Telegram WebView behavior. If cross-origin cookies are unreliable, use a short-lived Bearer token held in memory; avoid localStorage for long-lived bearer credentials.
- Do not enable credentialed CORS with wildcard origins.
- Session storage choice is an ADR and must be tested on Telegram iOS, Android, Desktop, and browser clients before release.

## 6. API conventions

### 6.1 Versioning and response envelope

Base path: `/api/v1`. JSON only unless an endpoint explicitly streams a file.

Success:

```json
{ "data": {}, "meta": {} }
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "requestId": "..."
  }
}
```

Rules:
- Stable machine-readable error codes; messages must not leak SQL, secrets, stack traces, or account enumeration details.
- Use correct HTTP status codes consistently.
- Add pagination for growing collections; use cursor pagination for content/event feeds.
- Validate path, query, and body schemas at the boundary.
- Set explicit request-body limits and timeouts.
- Mutating endpoints should accept an idempotency key where retries could duplicate a charge, attempt, job, or external side effect.
- Do not use GET for mutations.
- Publish OpenAPI or an equivalent machine-readable contract from source schemas.

### 6.2 Initial route map

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness only |
| GET | `/ready` | Public/internal | D1 binding/readiness |
| POST | `/auth/telegram` | Public + rate limit | Verify initData and create session |
| POST | `/auth/logout` | Session | Revoke current session |
| GET | `/me` | Session | Current profile |
| GET | `/me/progress` | Session | Current user's progress |
| GET | `/courses` | Public | Published course catalog |
| GET | `/lessons` | Public | Published lessons, paginated |
| GET | `/lessons/:id` | Public | Lesson metadata/content |
| GET | `/lessons/:id/questions` | Public | Safe question DTO; no answer key |
| POST | `/lessons/:id/attempts` | Session | Start an attempt |
| POST | `/attempts/:id/answers` | Session | Submit one answer |
| POST | `/attempts/:id/complete` | Session | Finalize and snapshot result |

Telegram webhook, admin authoring, subscriptions, audio jobs, vocabulary review, and analytics routes are not MVP prerequisites.

### 6.3 Authorization

- Derive user ID exclusively from the authenticated principal.
- Every user-owned query includes owner scope in SQL, e.g. `WHERE id = ? AND user_id = ?`.
- Return 404 for resources outside the caller's scope where this avoids object enumeration.
- Admin permissions are explicit capabilities, not a boolean supplied by the client.
- Separate content read permissions from content publish permissions.
- Protect webhook routes with Telegram's configured secret token and strict request validation; do not treat webhook payload as an authenticated user session.

## 7. Learning and assessment domain

### 7.1 Content lifecycle

Content has draft, published, and archived states. Published content is immutable from the perspective of an active or completed attempt. Editing a published lesson creates a new content version.

Each attempt references a fixed lesson/content version and assessment policy version. This prevents later edits to questions or scoring rules from changing historical results.

### 7.2 Attempt state machine

Allowed transitions:

```text
created → in_progress → completed
                     ↘ expired
                     ↘ abandoned
```

- Only the owner can read or mutate an attempt.
- Only `in_progress` attempts accept answers.
- Completion is terminal and idempotent.
- A completed attempt cannot accept new answers or be re-scored by changed content.
- Expiration is enforced server-side.
- Define retry policy and maximum active attempts per user/lesson.

### 7.3 Answer submission

- Validate the question belongs to the attempt's pinned content version.
- Validate the answer shape and allowed option IDs server-side.
- Compute correctness on the server.
- Never include answer keys in public DTOs, cache entries, client bundles, or analytics.
- Duplicate submission semantics must be explicit: same idempotency key returns the same result; a conflicting second answer returns a stable conflict response.
- Do not silently accept `INSERT OR IGNORE` and then return the previously saved answer as if the new submission succeeded.

### 7.4 Completion and concurrency

Completion must be one atomic state transition. A conditional update such as `UPDATE ... WHERE status='in_progress'` determines the single winning completion. The result snapshot and progress update must be in the same D1 transaction/batch with a condition that prevents a second completion from incrementing progress twice.

Answer submission and completion must be race-tested. If completion wins, later answer writes fail. If answer submission wins, completion includes that answer according to the defined transaction order. Do not rely on application-level SELECT-then-UPDATE alone.

### 7.5 Scoring policy

Store a versioned scoring policy. The first MVP may use a simple percentage score, but explicitly define:
- denominator (required questions only or all questions);
- unanswered-question behavior;
- question weighting;
- accepted answer normalization;
- negative marking (default none);
- rounding;
- pass threshold (if any);
- retry and best-score semantics.

The frontend may display the result but never calculate the authoritative score.

## 8. Data ownership and conceptual schema

The following is the target domain model, not a command to create every table immediately.

| Domain | Core entities | Ownership |
|---|---|---|
| Identity | users, user_identities, sessions, auth_replays | Identity |
| Catalog | courses, course_versions, lessons, lesson_versions, content_blocks | Catalog |
| Assessment | questions, question_versions, assessment_policies, attempts, answers, results | Assessment/Learning |
| Progress | user_progress, skill_progress, learning_events | Progress |
| Vocabulary | vocabulary_items, user_vocabulary, review_schedules, review_events | Vocabulary |
| Media | media_assets, media_jobs, media_job_events | Media |
| Entitlements | plans, subscriptions, entitlements, entitlement_events | Entitlements |
| Administration | roles, permissions, role_permissions, user_roles, audit_logs | Administration |
| Analytics | analytics_events (minimized/aggregated) | Analytics |

### 8.1 Data rules

- Use stable internal IDs and foreign keys.
- Add indexes for actual access patterns and owner-scoped queries.
- Use UTC ISO-8601 timestamps consistently.
- Define deletion behavior explicitly for every foreign key.
- Use CHECK constraints for enumerations and bounded numeric values where appropriate.
- Use unique constraints for identity provider subjects, idempotency keys, and one-answer-per-question-per-attempt where that is the chosen rule.
- Avoid duplicating mutable profile fields across tables.
- Keep sensitive/auth data separate from analytics.
- Use migrations as the only schema change path. Never rewrite an already-applied migration; add a new migration.
- Seed only synthetic demo content, never real user data or production secrets.

### 8.2 Current migration discrepancy to resolve

Current `0002_backend_foundation.sql` already creates `telegram_auth_replays`; `0003_telegram_auth_replay.sql` creates the same table/index again with `IF NOT EXISTS`. This is redundant and the Notion document's previous claim that replay was introduced only in 0003 is inaccurate. Decide the canonical history before any database has consumed these migrations. If any shared database has applied them, do not edit historical migrations; add a forward migration and document the transition.

## 9. Telegram bot and notifications

Keep Mini App authentication and Bot API messaging separate.

- Bot token is a Worker Secret, never frontend configuration.
- Outbound messages are sent through a Telegram adapter with timeouts, retry classification, and rate handling.
- Webhook route validates Telegram's configured secret token and rejects malformed or oversized updates.
- Persist notification intent before asynchronous delivery when delivery must be reliable.
- Use an outbox/job table or equivalent transactional handoff to avoid losing messages between D1 commit and queue publish.
- Store Telegram message identifiers only when required for edits/deletions.
- Respect user notification preferences and Telegram blocking/unavailable states.
- Do not put secrets or private lesson answers in logs or notifications by default.

## 10. Audio, AI, and asynchronous work

Audio and AI are later capabilities, not a prerequisite for the first secure login/learning release.

When introduced:
1. API validates and creates a job record.
2. Media is uploaded to private R2 using bounded upload policy and content-type/magic-byte checks.
3. Job is queued with a stable job ID and idempotency key.
4. Consumer validates message schema and ownership; it calls the provider through an adapter.
5. Provider output is normalized, checked, and stored.
6. Client polls a job-status endpoint or receives a notification.

Requirements:
- No long-running transcription or synthesis inside the user-facing request.
- Enforce file size, duration, format, retention, and per-user quotas.
- Do not assume AI output is correct; store provider/model/version metadata and confidence where available.
- Keep provider credentials in Worker Secrets.
- Define user consent and retention for voice recordings before collecting them.
- Do not activate paid AI/STT/TTS providers without explicit approval and cost limits.

## 11. Security baseline

### P0 before any real user authentication
- Correct Telegram HMAC construction and test it against an independent official vector.
- Enforce strict initData age, future skew, duplicate parameter, size, and signature checks.
- Make replay protection concurrency-safe and atomic with session issuance.
- Ensure no secret, raw initData, bearer token, answer key, or private content is logged.
- Fix request ID semantics: `cf-ray` is a Cloudflare Ray ID, not the application's own request ID. Generate an application request ID and record Ray ID separately.
- Validate all body/query/path input.
- Enforce owner-scoped data access.

### P1 before public beta
- Rate limiting for login, answer writes, attempt creation, and sensitive routes.
- Explicit origin allowlist and CORS policy; same-origin preferred.
- Session expiry/revocation tests and secure storage policy.
- CSRF protection if cookie-based auth is used.
- Admin RBAC and audit trail before staff tools.
- Account export/deletion and data retention rules.
- Abuse controls for attempt creation and guessing.
- Dependency and supply-chain checks.
- Backup/restore and incident runbook.
- Security review and cross-user authorization tests.

### Logging and privacy
Log request ID, route template, status, duration, and non-sensitive error code. Never log authorization headers, raw initData, bot token, full request bodies, answer keys, voice recordings, or unnecessary Telegram profile data. Analytics must be minimized and preferably aggregated; do not infer sensitive personal attributes.

## 12. Reliability and observability

- Separate liveness (`/health`) from readiness (`/ready`).
- Readiness verifies required bindings and a bounded D1 query; do not expose secrets or detailed infrastructure errors.
- Every request receives an application-generated request ID; preserve a validated upstream trace ID separately.
- Use structured logs with stable event names.
- Track latency percentiles, error rates, D1 errors, queue backlog, provider failures, and authentication rejection reasons in aggregate.
- Add bounded retries only for transient failures; never blindly retry non-idempotent writes.
- Define graceful degradation for optional R2/Queue/AI dependencies.
- Add rate and size limits before public exposure.
- Document backup, restore, migration rollback/forward-fix, and incident procedures.

## 13. Testing strategy and release gates

### Unit tests
- Telegram canonicalization and signature vectors, including malformed and duplicate parameters.
- Session token generation/hash/expiry/revocation.
- Domain scoring and answer normalization.
- Attempt state transitions and idempotency behavior.

### D1 integration tests
- Apply all migrations from an empty local D1 database.
- Apply migrations from the previous supported schema.
- User identity uniqueness and account mapping.
- Concurrent identical initData requests: exactly one session succeeds.
- Cross-user access is denied for attempts, answers, progress, and profile.
- Answer write racing with completion.
- Double completion does not increment progress twice.
- Completed attempts reject writes.
- Public question DTO never contains answer_key.
- Foreign key and deletion behavior.

### End-to-end tests
- Telegram WebView bootstrap through login, lesson selection, attempt, answer, completion, logout.
- Test Telegram iOS, Android, Desktop, and supported browser behavior for session persistence and navigation.
- Test network retry, reload, background/resume, expired initData, expired session, and bot token misconfiguration.

### Required release gates
A release candidate is blocked unless:
- typecheck, unit tests, D1 integration tests, and frontend build pass;
- migration tests pass from empty and previous schema;
- security and ownership tests pass;
- no unresolved P0 issue remains;
- cost/quotas are reviewed;
- an operator runbook exists.

No production deployment or migration is authorized by this document.

## 14. Operational environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development and D1 integration | Synthetic only |
| Preview | PR verification | Isolated non-production database and secrets |
| Production | Real users | Explicitly approved and protected |

Never point preview or local tests at production D1. Secrets are provisioned per environment. Production migrations require backup/restore strategy, reviewed migration plan, explicit approval, and post-migration verification.

## 15. Architecture decisions (ADRs required)

Create and maintain ADRs for:
1. Modular monolith and Worker deployment.
2. Internal identity and external identity linking.
3. Cookie vs in-memory Bearer session for Telegram WebViews.
4. Replay prevention and atomic session issuance.
5. Content immutability/versioning.
6. Attempt state machine and scoring policy.
7. D1 transaction/batch semantics for completion.
8. Queue/outbox pattern for notifications and media jobs.
9. Data retention, export, and account deletion.
10. Free-first infrastructure and provider selection.

Each ADR records context, decision, alternatives, consequences, and status. Unresolved decisions must remain visibly unresolved; do not silently invent product policy.

## 16. Explicitly out of scope for the first backend foundation

- Microservices and Kubernetes.
- Paid AI/STT/TTS provider activation.
- Subscription payment processing.
- Full CMS and staff workflow.
- Full spaced-repetition engine.
- Analytics based on invasive tracking.
- Production deployment, production migration, or public release.
- Any collection of voice or personal data without defined consent and retention.

## 17. Current implementation assessment (2026-11-26)

The current branch contains a useful scaffold: Hono Worker entrypoint, Telegram auth/session routes, learning routes, D1 migrations, and basic tests. It is not production-ready.

Verified issues from source inspection:
- Telegram HMAC argument order is reversed in `telegram.ts`; this is a P0 blocker.
- `0002_backend_foundation.sql` and `0003_telegram_auth_replay.sql` both define the replay table/index; migration history is redundant.
- Login creates the session before replay insert and compensates with best-effort revocation; replace with atomic/conditional issuance.
- Answer write uses `INSERT OR IGNORE` then returns the pre-existing saved answer, which can make a conflicting second submission look successful.
- Attempt completion reads counts before the conditional state update; progress increment must be proven single-winner and transactional under concurrency.
- `cf-ray` is used as application request ID; separate app request ID from Cloudflare Ray ID.
- CI for current head SHA `60b0e22c04667e148f64e631ae9bd5ff09b1f084` has a failed run. Job logs were not retrievable during this documentation pass, so exact failure cause remains unknown.
- Current tests have not been demonstrated green in this review.
- No real D1 integration, Cloudflare secret provisioning, production migration, or deployment is verified.

The earlier conversational claim that the HMAC order was correct was wrong. This specification reflects the actual source and official Telegram algorithm.

## 18. Definition of done

The backend foundation is accepted only when:
- this architecture is reflected in implementation and ADRs;
- P0 defects are fixed;
- all migrations are unambiguous and tested against local D1;
- Telegram auth and replay concurrency tests pass;
- session lifecycle is tested on supported Telegram clients;
- attempt/answer/complete concurrency and idempotency tests pass;
- user ownership and answer-key secrecy tests pass;
- CI is green on the exact proposed commit;
- Notion and GitHub docs agree;
- PR remains unmerged until all acceptance evidence is reviewed.
