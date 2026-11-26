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
- Opaque bearer-token generation/hash, active-session lookup, revocation middleware, logout, and authenticated `/me` profile route (session issuance/login is not yet implemented)
- Authenticated attempt creation, server-side answer grading, completion/progress batch, and `/me/progress` routes (D1 transaction behavior not yet integration-tested)
- Request correlation and baseline security response headers
- Structured error envelope and not-found handling
- `GET /api/v1/health` (liveness; no dependency call)
- `GET /api/v1/ready` (D1 readiness probe)
- `GET /api/v1/courses`
- `GET /api/v1/courses/:courseId/lessons`
- `GET /api/v1/lessons/:lessonId` (never selects or returns `answer_key`)
- Initial D1 schema and synthetic local seed data
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
- CORS is intentionally not enabled until exact client origins and deployment topology are agreed.
- Public content queries filter to published records only.
- The public pre-answer question DTO omits both `answer_key` and answer `explanation`.

See [API contract](../../docs/backend/API.md), [architecture](../../docs/backend/ARCHITECTURE.md), [data model](../../docs/backend/DATA-MODEL.md), [security](../../docs/backend/SECURITY.md), and [operations](../../docs/backend/OPERATIONS.md).

## Not implemented yet

Telegram login endpoint, replay persistence and atomic session issuance, Telegram login endpoint and atomic replay/session issuance, D1 integration/concurrency verification for learning writes, rate limiting, content authoring, admin RBAC, R2, Queues, AI adapters, retention/export/delete, and operational observability. The session middleware, logout, and `/me` route are present but cannot be used until the login/replay flow is implemented.

These are explicit follow-up gates, not implied by the current scaffold.

## Safety

- Do not run remote migrations or deploy this Worker as part of local development.
- No production database, Worker secret, paid service, or Cloudflare resource has been provisioned.
- The `deploy` command is intentionally absent until a separately approved staging configuration exists.
- Never commit bot tokens, session tokens, real user data, or production environment files.
