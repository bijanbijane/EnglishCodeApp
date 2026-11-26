# Backend — Cloudflare Worker

**Current state:** executable foundation and public content-read API are committed on `main`. This is not production-ready.

## Runtime

- Cloudflare Workers + TypeScript
- Hono HTTP routing
- D1 as the initial relational source of truth
- One modular monolith; no microservices
- API prefix: `/api/v1`

## Implemented in this baseline

- Worker entrypoint and typed runtime bindings
- Telegram initData HMAC verifier with timestamp, duplicate-parameter, and signature checks
- Telegram login endpoint with D1 replay gate and conditional session issuance (Local D1 concurrency verification pending)
- Opaque bearer-token generation/hash, active-session lookup, expiry, revocation middleware, logout, and authenticated `/me` profile route
- Authenticated attempt creation with immutable question snapshots, owner-scoped attempt reads, server-side answer grading, completion/progress batch, and `/me/progress` routes (D1 transaction behavior not yet integration-tested)
- Request correlation and baseline security response headers
- Structured error envelope and not-found handling
- `GET /api/v1/health` (liveness; no dependency call)
- `GET /api/v1/ready` (D1 readiness probe)
- `GET /api/v1/courses`
- `GET /api/v1/courses/:courseId/lessons`
- `GET /api/v1/lessons/:lessonId` (never selects or returns `answer_key`)
- Initial D1 schema and synthetic local seed data
- Per-IP Telegram login rate limiting (30 requests/minute) with HMAC-derived pseudonymous keys\n- Bounded daily cleanup of expired Telegram replay fingerprints, stale sessions, and rate-limit buckets (Worker Cron)
- Backend typecheck/test scripts and a dedicated GitHub Actions workflow

## Local setup

Run from this directory:

```bash
npm install
npm run typecheck
npm test
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Wrangler uses a local D1 database for these commands. The configured database ID is a local placeholder, not a provisioned remote database.

## API behavior

- Success: `{ "data": ..., "meta": { "requestId": "..." } }`
- Error: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`
- CORS uses an exact comma-separated `ALLOWED_ORIGINS` allowlist; wildcard origins and credentialed requests are not enabled. Keep the variable unset until approved client origins are known.
- Public content queries filter to published records only.
- The public pre-answer question DTO omits both `answer_key` and answer `explanation`.

See [API contract](../../docs/backend/API.md), [architecture](../../docs/backend/ARCHITECTURE.md), [data model](../../docs/backend/DATA-MODEL.md), [security](../../docs/backend/SECURITY.md), and [operations](../../docs/backend/OPERATIONS.md).

## Not implemented yet

D1 integration/concurrency verification for Telegram replay/session issuance and learning writes, production origin policy, content authoring, admin RBAC, R2, Queues, AI adapters, retention/export/delete, and operational observability.

These are explicit follow-up gates, not implied by the current scaffold.

## Safety

- Do not run remote migrations or deploy this Worker as part of local development.
- No production database, Worker secret, paid service, or Cloudflare resource has been provisioned.
- The `deploy` command is intentionally absent until a separately approved staging configuration exists.
- Never commit bot tokens, session tokens, real user data, or production environment files.
