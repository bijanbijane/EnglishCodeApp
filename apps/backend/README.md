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
- The public question DTO omits `answer_key`.

See [API contract](../../docs/backend/API.md) and [architecture](../../docs/backend/ARCHITECTURE.md).

## Not implemented yet

Telegram initData authentication, session lifecycle, authenticated profile, attempts, answer submission, server-side grading, progress writes, rate limiting, content authoring, admin RBAC, R2, Queues, AI adapters, retention/export/delete, and operational observability.

These are explicit follow-up gates, not implied by the current scaffold.

## Safety

- Do not run remote migrations or deploy this Worker as part of local development.
- No production database, Worker secret, paid service, or Cloudflare resource has been provisioned.
- The `deploy` command is intentionally absent until a separately approved staging configuration exists.
- Never commit bot tokens, session tokens, real user data, or production environment files.
