# Backend — Modular Worker foundation

## Implemented in this branch (source presence, not production readiness)
- TypeScript Modular Monolith using Hono and a Cloudflare Worker-compatible entrypoint.
- Versioned API, application-generated request IDs, structured errors, liveness and D1 readiness.
- Telegram Mini App initData HMAC-SHA-256 verification, duplicate-key rejection, freshness checks and one-time replay fingerprints.
- Opaque bearer sessions; only SHA-256 token hashes are stored.
- Provider-neutral identity table and verified Telegram identity mapping (migration 0004).
- Authenticated profile/progress reads and lesson/attempt/answer/complete endpoints.
- Conditional answer insert, conflict response for different duplicate answers, conditional completion/progress writes.
- Vocabulary enrollment/listing, due-review listing and idempotent review submission with optimistic concurrency.
- Deterministic spaced-repetition scheduler v1 with unit tests.
- Migration files 0001..0005.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/v1/health | No | Liveness |
| GET | /api/v1/ready | No | D1 readiness |
| POST | /api/v1/auth/telegram | No | Verify initData and issue session |
| POST | /api/v1/auth/logout | Bearer | Revoke session |
| GET | /api/v1/me | Bearer | Current profile |
| GET | /api/v1/me/progress | Bearer | Progress |
| GET | /api/v1/lessons | No | Published lessons |
| GET | /api/v1/lessons/:lessonId/questions | No | Questions without answer keys |
| POST | /api/v1/lessons/:lessonId/attempts | Bearer | Start attempt |
| POST | /api/v1/attempts/:attemptId/answers | Bearer | Submit answer |
| POST | /api/v1/attempts/:attemptId/complete | Bearer | Complete attempt |
| GET | /api/v1/me/vocabulary | Bearer | User vocabulary |
| POST | /api/v1/me/vocabulary/:itemId | Bearer | Enroll vocabulary item |
| GET | /api/v1/me/reviews/due | Bearer | Due review queue |
| POST | /api/v1/me/reviews/:itemId | Bearer | Submit review rating |

## Telegram identity
The client sends raw Telegram.WebApp.initData; never trust initDataUnsafe. The backend derives the Telegram secret using HMAC-SHA-256 with bot token as key and WebAppData as message, then validates data-check-string. Duplicate keys and stale/future auth_date values are rejected. Replay fingerprint claim and session issuance are batched transactionally. The verified Telegram subject is also mapped to the stable internal users.id in user_identities. Raw initData is not persisted.

The bot token must be configured as a Worker secret and must never be committed. Session token is opaque; only its SHA-256 hash is stored.

## Database
Apply in order to Local D1:
1. database/migrations/0001_initial.sql
2. database/migrations/0002_backend_foundation.sql
3. database/migrations/0003_telegram_auth_replay.sql
4. database/migrations/0004_provider_neutral_identity.sql
5. database/migrations/0005_vocabulary_review.sql

Migration 0002 already creates replay table/index; 0003 repeats those IF NOT EXISTS definitions. Historical files are retained. 0004 backfills provider-neutral Telegram identity without changing users.id. 0005 adds vocabulary and review history.

Migrations have not been applied to Cloudflare remote or production. Seed data must be synthetic and local/test only.

## Verification boundary
The Node adapter is a UI preview fixture, not a D1 emulator. Existing replay route tests use mocked D1; scheduler tests are pure unit tests. Local D1 integration, full typecheck, full test suite and frontend build still need verified green evidence. No Cloudflare resources, secrets, deployments or paid services are created by this branch.

## Security and remaining pre-beta work
- Session tokens are opaque, expiring, revocable; only hashes are persisted.
- Public question responses omit answer keys.
- User-owned operations derive user ID from session.
- Answer retries with same value are idempotent; conflicting answers are rejected.
- Review submissions require idempotency key and optimistic revision.
- Before beta: Local D1 concurrency tests, rate limiting, origin policy, account retention/deletion/export, abuse monitoring, backup/restore, Telegram client matrix and security review.
- Content versioning, admin/RBAC, media/R2, Queues, AI and payments remain planned, not implemented.
