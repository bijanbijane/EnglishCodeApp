# Backend — Cloudflare Worker

**Current state:** Worker foundation, Telegram authentication, versioned learning APIs, D1-backed admin content governance and audit reads are committed on `main`. Runtime validation is pending; this is not production-ready.

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
- D1 schema with versioned lesson/question content and assessment policy, plus synthetic local seed data
- Per-IP Telegram login rate limiting (30 requests/minute) with HMAC-derived pseudonymous keys
- Bounded daily cleanup of expired Telegram replay fingerprints, stale sessions, and rate-limit buckets (Worker Cron)
- Exact-origin CORS allowlist with no wildcard or credential support; CORS route tests
- D1-backed admin RBAC, content draft/review/publish workflow, append-only audit events and paginated admin audit feed
- Backend typecheck/test scripts and a dedicated GitHub Actions workflow

## Local setup

Run from this directory:

```bash
npm install
npm run typecheck
npm test
python3 ../../scripts/verify_backend_sqlite.py
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Wrangler uses a local D1 database for the `:local` commands. The development Worker is configured as `englishcode-backend-dev` and binds to the provisioned `englishcodeapp-dev` D1 database. The remote development database has migrations `0001`–`0010` applied. The versioned demo seed has been applied and verified: one published course, one published lesson version, and two question versions. Production resources are not configured here.

## Development Worker deployment

The repository configuration targets the existing development Worker and D1 database only.

```bash
npm run typecheck
npm test
npm run deploy:dry-run
npm run deploy:dev
```

Use `npm run db:migrate:dev` only when a new migration is pending, and `npm run db:seed:dev` only for the idempotent development demo seed. These commands target remote development D1; never substitute a production database name. Before deployment, configure the `TELEGRAM_BOT_TOKEN` Worker secret through a protected Cloudflare secret workflow. The secret value must never be committed or placed in a `VITE_` variable.

## API behavior

- Success: `{ "data": ..., "meta": { "requestId": "..." } }`
- Error: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`
- CORS uses an exact comma-separated `ALLOWED_ORIGINS` allowlist; wildcard origins and credentialed requests are not enabled. Keep the variable unset until approved client origins are known.
- Public content queries filter to published records only.
- The public pre-answer question DTO omits both `answer_key` and answer `explanation`.

See [API contract](../../docs/backend/API.md), [architecture](../../docs/backend/ARCHITECTURE.md), [data model](../../docs/backend/DATA-MODEL.md), [security](../../docs/backend/SECURITY.md), and [operations](../../docs/backend/OPERATIONS.md).

## Not implemented yet

D1 integration/concurrency verification for Telegram replay/session issuance and learning writes, setting the exact production `ALLOWED_ORIGINS` values, owner-controlled role bootstrap, R2, Queues, AI adapters, retention/export/delete, and operational observability.

These are explicit follow-up gates, not implied by the current scaffold.

## Safety

- Do not run remote migrations or deploy this Worker as part of local development.
- Development resources `englishcode-backend-dev` and `englishcodeapp-dev` are provisioned. No production database or production Worker is configured.
- `TELEGRAM_BOT_TOKEN` is not configured; Telegram login will return `503` until the secret is added through a protected Cloudflare workflow.
- `deploy:dev` targets the development Worker only. No production deployment command or production environment is configured.
- Never commit bot tokens, session tokens, real user data, or production environment files.
