# EnglishCodeApp Backend Architecture

**Implementation status:** substantial backend modules are committed on `main`; no production deployment. Runtime validation is blocked because GitHub Actions has no allocated runner and the connected Mac is offline.

## Runtime

- Cloudflare Workers, TypeScript and Hono.
- Cloudflare D1/SQLite is the authoritative store.
- Modular monolith under `apps/backend/src/modules`.
- Versioned HTTP API under `/api/v1`.
- Telegram Mini App is an authentication adapter; it does not own learning state.
- No R2, Queues, KV, Durable Objects, Workers AI or paid providers are activated.

## Implemented modules

| Module | Responsibility |
|---|---|
| `auth` | Telegram HMAC verification, replay gate, opaque sessions, per-IP rate limiting, logout |
| `users` | Authenticated current-user profile |
| `content` | Public published course/lesson reads from immutable versions |
| `learning` | Attempt creation, question snapshots, server grading, completion, progress |
| `admin` | D1-backed roles, draft authoring, content review/publish, append-only audit writing and audit reads |
| `maintenance` | Bounded scheduled cleanup of replay, rate-limit and stale session rows |
| `shared` | Stable errors and shared request/runtime contracts |

Route handlers currently contain some orchestration. As complexity grows, extract use cases into application services; keep SQL and row mapping behind repository functions. Do not introduce a generic repository framework prematurely.

## Request pipeline

`Client → request ID/security headers → API body limit → exact-origin CORS → route auth/role checks → use-case logic → D1 batch/repository → explicit DTO`

- Request bodies are capped at 256 KiB globally; Telegram login additionally enforces a 20 KiB limit.
- CORS reflects only exact origins in `ALLOWED_ORIGINS`; wildcard and credentialed CORS are not supported.
- Telegram login is limited to 30 attempts per client IP per fixed UTC minute using an HMAC-derived bucket key; raw IP is not persisted.
- Request IDs and security headers are added by the Worker.

## Identity and sessions

- Telegram initData uses server-side two-stage HMAC-SHA-256 verification, freshness checks and duplicate-parameter rejection.
- A fingerprint of validated initData is unique in D1. Session creation is gated by `changes()=1` from the replay insert in the same D1 batch.
- Session tokens are cryptographically random 256-bit opaque bearer credentials; only SHA-256 hashes are stored.
- Sessions expire after 30 days and support revocation.
- Role checks read active grants from D1. No client-supplied role or profile flag is trusted.

## Content governance

- Stable `lessons` and `questions` are source identities.
- `lesson_versions` and `question_versions` are immutable after publication.
- A lesson's current published pointer must reference a published version belonging to that lesson.
- Authors create drafts and submit only their own drafts.
- Reviewers cannot approve their own submissions.
- Only admins can publish approved versions.
- Every privileged content mutation writes an allowlisted audit event in the same D1 batch.
- Admin audit reads are role-protected and keyset-paginated.
- There is no public role-grant endpoint. Initial admin bootstrap is owner-controlled; see `ADMIN-BOOTSTRAP.md`.

## Learning and progress

- An attempt pins a published lesson version and assessment policy version.
- The attempt snapshots question IDs, type, prompt, options, answer key, ordering and weight.
- Answer submission checks ownership and in-progress state, validates option IDs and grades on the server.
- Identical answer retries return the stored result; conflicting second answers return 409.
- Completion is a conditional state transition; the progress upsert is gated by the preceding update's affected-row count.
- The initial policy is weighted percentage with unanswered questions scoring zero.
- The mutable `user_progress` table is currently a projection; immutable result/event facts and deterministic rebuild are not implemented yet.

## Maintenance

A daily Worker Cron is configured for 03:17 UTC. Each run deletes at most 500 expired replay fingerprints, 500 rate-limit buckets older than 48 hours and 500 stale sessions. Expired unrevoked sessions are retained at least seven days after expiry; revoked sessions at least 30 days after revocation. The schedule is configuration only until deployment.

## Module dependency rules

1. Routes validate transport input and call use cases.
2. Domain logic must remain deterministic and independent of Hono/D1.
3. Repositories own SQL and row mapping.
4. Cross-module writes use explicit use cases and documented D1 batch boundaries.
5. No circular imports, shared god-service or cross-module SQL.
6. Future asynchronous jobs must persist intent in D1 before enqueue; consumers must be idempotent.

## Current migration history and branch policy

- Main uses migrations `0001` through `0010`.
- Older backend feature branches contain a different initial schema and migration sequence. Their numbered migrations are not drop-in compatible with current main.
- Port domain behavior only after mapping every table/constraint and creating forward-only migrations.
- Never apply two incompatible `0001` histories to the same D1 database.
- Never edit a migration after it has been applied to a shared database.

## Remaining release gates

- Run TypeScript typecheck and Vitest on the exact current commit.
- Apply migrations `0001`–`0010` and seed to fresh Cloudflare Local D1.
- Run real Local D1 tests for duplicate login races, answer/complete races, progress exactly-once, RBAC and publish transactions.
- Verify session expiry/revocation and cross-user access.
- Set exact approved frontend origins.
- Complete account export/deletion/retention, immutable progress facts, monitoring, backup/restore and load testing.
- Staging smoke test and rollback plan.

GitHub Actions currently fails before allocating a runner (`runner_id=0`, no steps). The committed tests and SQLite compatibility script have not yet been executed in CI. No production database, secret, deployment, paid resource or remote migration has been provisioned.
