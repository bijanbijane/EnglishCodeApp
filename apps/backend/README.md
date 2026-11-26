# Backend — Modular Worker foundation

## Current implementation

TypeScript Modular Monolith using Hono and a Cloudflare Worker-compatible entrypoint.

- Versioned API, request IDs, structured errors, liveness and D1 readiness endpoints.
- D1-backed lesson and question reads.
- Telegram Mini App initData HMAC-SHA-256 verification, duplicate-key rejection and auth_date freshness checks.
- Opaque bearer sessions; only SHA-256 token hashes are stored.
- Authenticated profile and progress reads.
- Lesson attempts, server-side answer grading, completion scoring and progress aggregation.
- Migration for sessions, progress and one-answer-per-question uniqueness.
- Unit tests for Telegram signature verification.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/v1/health | No | Liveness |
| GET | /api/v1/ready | No | D1 readiness |
| POST | /api/v1/auth/telegram | No | Verify initData and issue session |
| POST | /api/v1/auth/logout | Bearer | Revoke current session |
| GET | /api/v1/me | Bearer | Current user |
| GET | /api/v1/me/progress | Bearer | Current user's progress |
| GET | /api/v1/lessons | No | Published lessons |
| GET | /api/v1/lessons/:lessonId/questions | No | Questions without answer keys |
| POST | /api/v1/lessons/:lessonId/attempts | Bearer | Start attempt |
| POST | /api/v1/attempts/:attemptId/answers | Bearer | Submit answer |
| POST | /api/v1/attempts/:attemptId/complete | Bearer | Finalize score and progress |

## Telegram authentication

The client sends the raw Telegram.WebApp.initData string. Never trust initDataUnsafe. The backend verifies the signature with the bot token and rejects stale auth_date values. The bot token must be configured as a Worker secret and must never be committed.

The response returns an opaque bearer token. Only its SHA-256 hash is stored in D1. The current token transport is JSON; keep it in memory where practical and never log it or place it in URLs.

## Database

Apply in order to a local/test D1 database:
1. database/migrations/0001_initial.sql
2. database/migrations/0002_backend_foundation.sql

Seed only local/test:
- database/seeds/0001_demo.sql

Migrations have not been applied to a Cloudflare account or production database.

## Local development and deployment boundary

The current Node adapter is a UI preview fixture, not a D1 emulator. It does not provide persistent auth or learning writes. A local D1 test harness is still required for end-to-end verification.

No Wrangler config is added. This new Cloudflare project follows the cf CLI direction. No Cloudflare resources, secrets, deployments, or paid services are created by this branch.

## Security and remaining pre-beta work

- Browser never supplies user ownership or answer correctness.
- Session tokens are random, opaque, expiring and revocable; only hashes are persisted.
- Public question responses omit answer keys.
- Attempts are scoped to the authenticated user.
- A unique index enforces one answer per question per attempt.
- Before public beta: add and test platform-level rate limiting for login/write endpoints, origin policy, retention/deletion/export policy, abuse monitoring, and end-to-end tests against local D1.
- Queue, R2, AI, payments, admin console and production deployment are outside this foundation.
