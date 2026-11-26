# EnglishCodeApp Backend Architecture

**Status:** modular Worker backend implemented on `main`; runtime and D1 integration verification remain open. Not production-ready.

## 1. Runtime and system boundary

- Cloudflare Workers + TypeScript + Hono.
- D1/SQLite is the sole authoritative store for identity, sessions, content, attempts and progress.
- One modular monolith; do not split services without measured scaling or team-boundary evidence.
- API prefix: `/api/v1`.
- Telegram Mini App is an authentication provider/client shell, not the owner of learning state.
- No in-memory persistence or client-authoritative identity, ownership, correctness, scoring or progress.

Request path:

`Client → Worker/Hono → request context/security middleware → module route → repository/D1 → explicit DTO`

## 2. Implemented modules

| Module | Responsibility |
|---|---|
| `auth` | Telegram initData verification, replay protection, opaque sessions, login rate limiting, logout |
| `users` | Authenticated current-user profile |
| `content` | Published courses, lessons and versioned question read models |
| `learning` | Attempt creation, immutable question snapshots, answer grading, completion and progress |
| `maintenance` | Bounded scheduled cleanup of expired replay/session/rate-limit records |
| `shared` | Stable errors and shared request/runtime contracts |

The current route files still contain some orchestration. As the codebase grows, move multi-step use cases into application services and keep SQL in repositories. Do not introduce a generic repository framework prematurely.

## 3. Data and transaction model

D1 is authoritative. Use foreign keys, unique constraints, CHECK constraints, conditional writes and bounded indexes.

Current entities:
- Identity: `users`, `external_identities`, `sessions`, `telegram_auth_replays`, `auth_rate_limits`.
- Catalog: `courses`, `lessons`, `lesson_versions`, `questions`, `question_versions`, `assessment_policy_versions`.
- Assessment: `lesson_attempts`, `attempt_questions`, `attempt_answers`.
- Progress: `user_progress`.

Attempt creation pins the published lesson version and assessment policy, then snapshots question versions and weights in one D1 batch. Answer grading reads only the attempt snapshot. Completion is a conditional state transition; progress increments only when the transition wins.

Published lesson/question versions are immutable. A future content editor must create a new draft version and publish it through an authorized workflow; it must never mutate a version referenced by an attempt.

## 4. Identity and authentication

- Verify Telegram's two-stage HMAC-SHA-256 signature and `auth_date`; reject duplicate parameters.
- Hash the complete validated initData into a replay fingerprint; never persist raw initData.
- Claim replay and create the session in one D1 batch. Session insert is gated by the replay insert's affected-row count.
- Generate a cryptographically random 256-bit opaque bearer token; persist only SHA-256 hash.
- Session TTL is 30 days; revoked and expired sessions are rejected by middleware.
- Login is limited to 30 attempts per IP per fixed UTC minute. IP is transformed with HMAC before persistence; raw IP is not stored in this limiter.
- The exact-origin CORS allowlist is read from `ALLOWED_ORIGINS`. Wildcards and credentialed requests are not supported. Leave the variable unset until the real client origins are approved.

## 5. Assessment and progress invariants

- Public DTOs select explicit fields; no answer key or pre-answer explanation.
- Each attempt is owner-bound and pinned to one published lesson version and one assessment policy version.
- Question text, options, answer key, order and weight are snapshotted per attempt.
- Only `in_progress` attempts accept answers.
- A unique attempt/question constraint prevents duplicate writes. Identical retry returns the prior result; a different second answer returns 409.
- Score is a weighted percentage; unanswered questions contribute zero earned weight.
- Completion and progress update share one D1 batch. Local D1 race tests are still required before relying on the transaction behavior in production.

## 6. Middleware and platform controls

- Server-generated request ID and baseline security headers.
- Exact-origin CORS configuration.
- Content-Type and request-body bounds on Telegram login.
- HMAC-keyed per-IP login rate limiting.
- Daily Worker Cron at 03:17 UTC; bounded cleanup removes at most 500 expired replay fingerprints, 500 rate-limit buckets older than 48 hours and 500 stale sessions per run.
- No R2, Queues, KV, Durable Objects, Workers AI, payments or paid providers are required or activated.

## 7. Target module boundaries

Next domain modules, only when their product workflows are specified:
- `admin`: RBAC, content authoring/review/publishing and append-only audit.
- `progress`: immutable result/event facts and rebuildable progress projections.
- `vocabulary` and `review`: canonical vocabulary and versioned spaced-repetition scheduler.
- `profiles`: preferences, locale and account lifecycle.
- `skills`: listening, speaking, reading and writing records.
- `media` and `jobs`: private R2 objects, durable D1 outbox, Queue consumers.
- `entitlements`: server-side feature permissions.
- `analytics`: purpose-limited aggregate product events.

Dependency rules:
1. Routes validate transport input and call application/domain services.
2. Domain logic stays deterministic and independent of Hono/D1.
3. Repositories own SQL and row mapping.
4. Cross-module writes use explicit application services and a documented D1 transaction boundary.
5. No circular imports, shared god-service or cross-module SQL.
6. Async jobs must persist intent in D1 before enqueue; consumers must be idempotent.

## 8. Migration and branch policy

- Current main migration sequence is `0001` through `0008`.
- Older backend feature branches contain a different schema history and cannot be merged by copying their migration numbers or applying their migrations on top of current main.
- Port domain behavior only after schema mapping and migration review. Never run two incompatible `0001` histories against the same database.
- Migrations are forward-only after any shared database has applied them.

## 9. Release gates and current evidence

Still required:
- Typecheck and Vitest on the exact current commit.
- Apply migrations `0001`–`0008` and seed to a fresh Cloudflare Local D1.
- Real Local D1 tests for concurrent duplicate login, answer/completion races, replay and exactly-once progress.
- Verify session expiry/revocation and cross-user access.
- Configure the exact frontend origins.
- Define account export/deletion/retention and operational metrics.
- Staging smoke test and rollback plan.

GitHub Actions currently terminates before runner allocation (`runner_id=0`, no steps); the Mac test environment is offline. Tests and a SQLite compatibility script are committed, but no passing execution is claimed.

No production database, secret, deployment, paid resource or remote migration has been provisioned.
