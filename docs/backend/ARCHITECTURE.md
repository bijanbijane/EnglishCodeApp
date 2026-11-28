# EnglishCodeApp Backend Architecture

**Baseline:** `main` at `15b9b47c32e5f0a04542d946d61679f62b15f47c` (2026-11-28).  
**Release status:** substantial backend modules are committed; no Production deployment is claimed.

## Runtime

- Cloudflare Workers, TypeScript and Hono.
- Cloudflare D1/SQLite is the authoritative transactional store.
- Modular monolith under `apps/backend/src/modules`.
- Versioned HTTP API under `/api/v1`.
- Telegram Mini App is an authentication/channel adapter, not the owner of identity or learning state.
- R2, Queues, KV, Durable Objects and Workers AI are not active baseline dependencies.

## Implemented modules

| Module | Responsibility |
|---|---|
| `auth` | Telegram HMAC verification, replay gate, opaque sessions, rate limiting and logout |
| `users` | Authenticated current-user profile |
| `content` | Published course/lesson reads from immutable versions |
| `learning` | Attempt creation, question snapshots, server grading, completion, immutable completion events and progress projection |
| `admin` | D1-backed roles, draft authoring, review/publish workflow and append-only audit |
| `maintenance` | Bounded scheduled cleanup of replay, rate-limit and stale session rows |
| `shared` | Stable errors and shared request/runtime contracts |

Keep route handlers focused on transport and orchestration. Extract use cases as complexity warrants; repositories own SQL and row mapping. Do not introduce generic frameworks prematurely.

## Request pipeline

`Client → request ID/security headers → API body limit → exact-origin CORS → route auth/role checks → use-case logic → D1 batch/repository → explicit DTO`

- Global request body limit: 256 KiB; Telegram login: 20 KiB.
- CORS allows only exact configured origins; no wildcard or credentialed CORS.
- Telegram login rate limit: 30 requests per client IP per fixed UTC minute, using an HMAC-derived bucket key; raw IP is not persisted.
- Request IDs and security headers are added by the Worker.

## Identity and sessions

- Telegram initData is verified server-side with HMAC-SHA-256, freshness checks and duplicate-parameter rejection.
- A unique fingerprint of validated initData and session creation are coordinated in a D1 batch; session insertion is gated by the replay insert result.
- Session tokens are cryptographically random opaque bearer credentials; only SHA-256 hashes are stored.
- Sessions support expiry and revocation.
- Role checks read active grants from D1. Client-supplied role claims are never trusted.

## Content governance

- Stable `lessons` and `questions` are source identities.
- `lesson_versions` and `question_versions` are immutable after publication.
- Public DTOs expose published content without answer keys or private explanations.
- Authors create drafts and submit their own drafts.
- Reviewers cannot approve their own submissions.
- Only admins publish approved versions.
- Privileged mutations write allowlisted audit events in the same D1 batch.
- There is no public role-grant endpoint. Initial admin bootstrap is owner-controlled; see `ADMIN-BOOTSTRAP.md`.

## Learning and progress

- An attempt pins a published lesson version and assessment-policy version.
- The attempt snapshots question IDs, type, prompt, options, answer key, ordering and weight.
- Answer submission checks authenticated ownership and in-progress state, validates answer shape and grades on the server.
- Identical answer retries return the stored result; conflicting second answers return 409.
- Completion is a conditional state transition; progress projection updates are gated by the winning transition.
- Migration `0016_immutable_learning_events.sql` adds an append-only `learning_events` ledger for completed lesson attempts, including a backfill of qualifying historical completed attempts. Unique `(event_type, aggregate_id)` enforces event idempotency.
- The ledger records lesson-attempt completion facts; it is not a cumulative-assessment result store.
- `user_progress` remains a mutable read projection. The existing deterministic rebuild SQL is SQLite-only; a D1-compatible rebuild procedure remains outstanding.
- Exact-head PR CI provides evidence for the commits it ran on; do not infer a separate green push workflow on main without checking that SHA.

## Maintenance

A daily Worker Cron is configured for 03:17 UTC. Each run deletes at most 500 expired replay fingerprints, 500 rate-limit buckets older than 48 hours and 500 stale sessions. This schedule is configuration only until deployment.

## Module dependency rules

1. Routes validate transport input and call use cases.
2. Domain logic remains deterministic and independent of Hono/D1.
3. Repositories own SQL and row mapping.
4. Cross-module writes use explicit use cases and documented D1 batch boundaries.
5. Avoid circular imports, shared god-services and cross-module SQL.
6. Future asynchronous jobs must persist intent in D1 before enqueue; consumers must be idempotent.

## Migration history and branch policy

- Main uses migrations `0001` through `0016`.
- Older feature branches may contain incompatible initial schemas and migration histories. Their numbered migrations are not drop-in compatible with main.
- Port domain behavior only after mapping every table/constraint and creating forward-only migrations.
- Never apply two incompatible migration histories to the same D1 database.
- Never edit a migration already applied to a shared database.

## Remaining release gates

- D1-compatible deterministic progress projection rebuild.
- Complete Local D1 coverage for cross-user access, role revocation, auth races, answer/complete races and publication transactions.
- Owner-operated admin bootstrap/grant/revoke procedure.
- Account export/deletion and backup-deletion process.
- Monitoring, backup/restore drill and load testing.
- Staging smoke test and rollback plan.
- Production origin/secrets and release configuration only through separately approved owner operations.

No Production database, secret, deployment, paid resource or remote migration is provisioned or authorized by this architecture document.
