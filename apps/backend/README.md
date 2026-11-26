# Backend foundation
Cloudflare Worker API using Hono, TypeScript and D1. Local-first foundation; not deployed.

## Requirements
Node.js 22+ and npm.

## Local setup
Run from this directory:
```sh
npm install
npm run typecheck
npm test
npm run dev
```
Apply the SQL migration and demo seed:
```sh
npx wrangler d1 migrations apply englishcodeapp-local --local
npx wrangler d1 execute englishcodeapp-local --local --file=../../database/seeds/0001_demo.sql
```
The local config contains a placeholder D1 ID. Replace it only after an explicitly approved database-creation step. No production database should be created during local setup.

## Runtime secrets
Telegram login requires `TELEGRAM_BOT_TOKEN` and `SESSION_SECRET`. Configure runtime/local secrets; never commit `.dev.vars`. Optional `TELEGRAM_MAX_AUTH_AGE_SECONDS` defaults to 86400.

## API
- `GET /health/live` — liveness.
- `GET /health/ready` — D1 readiness.
- `POST /api/v1/auth/telegram` — validates raw Mini App initData and returns a one-hour bearer session.
- `GET /api/v1/me` — authenticated identity.
- `GET /api/v1/lessons?limit=20&cursor=...` — published lessons.
- `GET /api/v1/lessons/:lessonId` — published lesson and questions; answer keys are omitted.

## Security boundaries
Identity comes only from server-validated Telegram initData. Client-supplied user IDs are not trusted. Sessions are HMAC-SHA-256 signed and expire after one hour. Secrets are runtime-only; errors do not return stack traces or database details.

## Not implemented yet
Attempt creation/submission, deterministic scoring, progress aggregation, Telegram webhook delivery, replay protection, rate limiting, content administration, R2, Queues and AI adapters. No Cloudflare resources were created and no deployment was performed.