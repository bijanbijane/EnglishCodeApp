# Backend — Modular Worker foundation

## Implemented in this branch (source presence, not production readiness)
- Hono/TypeScript Worker-compatible modular monolith, versioned API, request IDs, structured errors, health/readiness.
- Telegram Mini App HMAC verification, duplicate-key/freshness checks, replay fingerprint and opaque hashed bearer sessions.
- Independent fixed Telegram HMAC test vector added, generated with Python stdlib; test execution remains pending.
- Provider-neutral user_identities mapping for verified Telegram identities.
- Basic learning routes with attempts pinned to immutable lesson and assessment policy versions.
- Conditional answer writes and weighted completion score against the pinned question version.
- Public question DTO preserves the question array shape and excludes answer keys.
- Vocabulary enrollment/list/due queue and idempotent spaced-repetition review API with optimistic concurrency.
- Deterministic scheduler v1, identity tests and public question DTO test added.
- Migration files 0001..0006.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/v1/health | No | Liveness |
| GET | /api/v1/ready | No | D1 readiness |
| POST | /api/v1/auth/telegram | No | Verify initData and issue session |
| POST | /api/v1/auth/logout | Bearer | Revoke session |
| GET | /api/v1/me | Bearer | Current profile |
| GET | /api/v1/me/progress | Bearer | Progress |
| GET | /api/v1/me/attempts | Bearer | Cursor-paginated attempt history |
| GET | /api/v1/attempts/:attemptId | Bearer | Owned attempt details |
| GET | /api/v1/attempts/:attemptId/result | Bearer | Owned completed result |
| GET | /api/v1/lessons | No | Published versioned lessons |
| GET | /api/v1/lessons/:lessonId/questions | No | Version-pinned question array; no answer keys |
| POST | /api/v1/lessons/:lessonId/attempts | Bearer | Start attempt pinned to content/policy versions |
| POST | /api/v1/attempts/:attemptId/answers | Bearer | Submit answer against pinned version |
| POST | /api/v1/attempts/:attemptId/complete | Bearer | Complete attempt and update progress |
| GET | /api/v1/me/vocabulary | Bearer | User vocabulary |
| POST | /api/v1/me/vocabulary/:itemId | Bearer | Enroll vocabulary item |
| GET | /api/v1/me/reviews/due | Bearer | Due review queue |
| POST | /api/v1/me/reviews/:itemId | Bearer | Submit review rating |

## Telegram identity
The client sends raw Telegram.WebApp.initData; never trust initDataUnsafe. The backend derives the Telegram secret using HMAC-SHA-256 with bot token as key and WebAppData as message. Duplicate keys and stale/future auth_date values are rejected. Replay fingerprint claim and session issuance are batched transactionally. The verified Telegram subject is mapped to stable internal users.id in user_identities. Raw initData is not persisted.

## Database
Apply in order to Local D1:
1. database/migrations/0001_initial.sql
2. database/migrations/0002_backend_foundation.sql
3. database/migrations/0003_telegram_auth_replay.sql
4. database/migrations/0004_provider_neutral_identity.sql
5. database/migrations/0005_vocabulary_review.sql
6. database/migrations/0006_versioned_learning_content.sql

Migration 0002 already creates replay table/index; 0003 repeats those IF NOT EXISTS definitions. 0004 backfills provider-neutral identities. 0005 adds vocabulary and review history. 0006 snapshots existing lesson/question content as version 1 and pins attempts to immutable content/policy versions.

Migrations have not been applied to Cloudflare remote or production. Seed data must be synthetic and local/test only.

## Verification boundary
Existing replay/identity route tests use mocked D1; scheduler and domain tests are pure unit tests. SQL migrations 0004..0006 and weighted scoring/review conditional statements received SQLite in-memory syntax/behavior smoke tests. This is not Cloudflare Local D1 verification. Full TypeScript typecheck, complete test suite and frontend build still need green evidence.

The hosted Actions jobs on this private repository currently terminate within seconds before exposing any step summaries or logs. The workflow was updated with named diagnostic steps; a local fallback is available via bash scripts/validate-workspace.sh. A committed package-lock.json and npm ci remain required for reproducible CI.

## Not yet implemented
Content authoring/review/publishing API, account linking/merge, four skill-specific assessment modules, media/R2, Queues/outbox, AI/STT/TTS, entitlements, RBAC/admin audit, analytics, retention/deletion/export and production deployment.
