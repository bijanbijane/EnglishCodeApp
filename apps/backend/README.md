# Backend — Modular Worker foundation

## Implemented in this branch (source presence, not production readiness)
- Hono/TypeScript Worker-compatible modular monolith, versioned API, request IDs, structured errors, health/readiness.
- Telegram Mini App HMAC verification, duplicate-key/freshness checks, replay fingerprint and opaque hashed bearer sessions.
- Provider-neutral `user_identities` mapping for verified Telegram identities.
- Basic learning routes with attempts pinned to immutable lesson and assessment policy versions.
- Conditional answer writes and weighted completion score against the pinned question version.
- Immutable `attempt_results` snapshots and append-only `progress_events`; rebuildable per-user progress projection.
- RBAC role-check middleware and append-only minimal audit writer.
- Protected content authoring, review queue/detail, reviewer decision and admin publish routes with transactional audit.
- Public question DTO preserves the question array shape and excludes answer keys.
- Owned attempt history, attempt metadata and completed result endpoints with keyset cursor.
- Vocabulary enrollment/list/due queue and idempotent spaced-repetition review API with optimistic concurrency.
- Deterministic scheduler v1 and unit tests.
- Migration files 0001..0009, including RBAC/audit, immutable result/progress facts and content review workflow.
- Wrangler local D1 configuration and reproducible root lockfile.

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
| POST | /api/v1/admin/content/lessons/:lessonId/versions | content_author | Create draft content version |
| GET | /api/v1/admin/content/lessons/:lessonId/versions | content_author | List own content versions |
| POST | /api/v1/admin/content/lessons/:lessonId/versions/:versionId/submit-review | content_author | Submit draft for review |
| GET | /api/v1/admin/content/reviews | content_reviewer | Review queue |
| GET | /api/v1/admin/content/reviews/:requestId | content_reviewer | Review detail, including private answer keys |
| POST | /api/v1/admin/content/reviews/:requestId/decision | content_reviewer | Approve/reject with reason code |
| POST | /api/v1/admin/content/reviews/:requestId/publish | admin | Publish approved version |
| GET | /api/v1/me/vocabulary | Bearer | User vocabulary |
| POST | /api/v1/me/vocabulary/:itemId | Bearer | Enroll vocabulary item |
| GET | /api/v1/me/reviews/due | Bearer | Due review queue |
| POST | /api/v1/me/reviews/:itemId | Bearer | Submit review rating |

## Telegram identity
The client sends raw Telegram.WebApp.initData; never trust initDataUnsafe. The backend derives the Telegram secret using HMAC-SHA-256 with bot token as key and WebAppData as message. Duplicate keys and stale/future auth_date values are rejected. Replay fingerprint claim and session issuance are batched transactionally. The verified Telegram subject is mapped to stable internal users.id in user_identities. Raw initData is not persisted.

## Local D1

The root `wrangler.toml` binds DB to a local D1 database named `englishcode-local`. Its database ID is a placeholder and is only for local tooling. Commands:

```bash
npm ci
npm run db:migrate:local
npm run db:migrations:local
npm run dev:worker
```

Local secrets belong in ignored `.dev.vars`; use a dummy bot token for integration tests. Local state lives under ignored `.wrangler/`. Never add `--remote` to these development commands.

## Verification evidence (2026-11-26)
- `npm ci`: passed.
- `npm run typecheck`: passed (frontend + backend).
- `npm test`: 13 test files, 49 tests passed.
- `npm run build:frontend`: passed.
- All nine migrations applied in order to a fresh isolated Wrangler Local D1 database.
- Migration 0008 upgrade/backfill verified on a second Local D1 database with a synthetic completed attempt and deliberately stale progress row; result, event and rebuilt count were all correct.
- Upgrade path tested from 0001 with synthetic legacy user, published lesson/question and completed attempt through 0008; provider identity, v1 content, assessment policy, immutable result and progress facts were backfilled.
- Actual Worker + Local D1: readiness and health returned 200.
- Concurrent duplicate Telegram initData: one 200 session and one 409 replay rejection.
- Answer/completion race: completion wins or answer wins according to execution order; answer after completion returns 409. Concurrent duplicate completion returns 200 to both callers but increments progress once.
- Weighted immutable result snapshot verified on actual Worker + Local D1: 2/3 weight produced score 67 with earnedWeight=2, totalWeight=3; result facts and progress event counts each matched completed attempts.
- Result immutability trigger rejected an UPDATE with `SQLITE_CONSTRAINT_TRIGGER`.
- Vocabulary enrollment, same-key replay and different-payload idempotency-key rejection verified on Local D1. Two distinct concurrent review submissions were serialized and both accepted in this run.
- Content workflow verified on Worker + Local D1: author draft (201), submit review (201), self-review blocked (403), reviewer decision (200), admin publish (200), published version visible to learners, answer key omitted from public DTO, reviewer-only queue/detail access enforced.

This is local evidence, not remote/production D1 verification or a security certification. Hosted GitHub Actions still has an unexplained runner/job startup failure with no step logs; local CI-equivalent commands are green.

## Not yet implemented
Account linking/merge, four skill-specific assessment modules, media/R2, Queues/outbox, AI/STT/TTS, entitlements, role bootstrap/management, analytics, retention/deletion/export and production deployment.
