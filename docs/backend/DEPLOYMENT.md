# Backend Deployment Runbook

## Current target

The first Cloudflare target is the isolated development Worker:

- Worker: `englishcode-backend-dev`
- Wrangler environment: `dev`
- D1 database: `englishcodeapp-dev`
- D1 database ID: `0e36d435-fcfa-48a9-bc2c-8b14894a39f3`
- Public hostname: the Worker `workers.dev` subdomain, if enabled for the account.
- Production: not configured and not authorized by this runbook.

The development D1 database was inspected on 2026-11-26 and contained no application tables (only Cloudflare's internal `_cf_KV` table). No remote migration or seed was run. The existing Worker resource currently contains only a bootstrap health/readiness handler; it is not the application backend and must not be treated as a completed deployment.

## Local validation gate

From `apps/backend`:

```bash
npm install
npm run typecheck
npm test
python3 ../../scripts/verify_backend_sqlite.py
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Run the migration and seed against a fresh local D1 first. Confirm `/api/v1/health` and `/api/v1/ready`, then test authentication, ownership boundaries, learning writes and admin permissions.

## Development deployment

1. Confirm the authenticated Wrangler account is the intended Cloudflare account.
2. Add the Telegram bot token interactively; do not put it in Git, chat, config vars or command history:

   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN --env dev
   ```

3. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the approved Mini App frontend. Do not use a wildcard. Keep it unset until the real origin is confirmed.
4. Inspect the selected environment before any remote data operation:

   ```bash
   npx wrangler d1 list
   ```

5. Apply migrations to the development D1 only after local validation and an explicit review of the migration list:

   ```bash
   npm run db:migrate:dev
   ```

6. Check the deployment bundle without publishing:

   ```bash
   npm run deploy:dev:dry-run
   ```

7. Deploy only to the development Worker:

   ```bash
   npm run deploy:dev
   ```

8. Smoke-test `/api/v1/health`, `/api/v1/ready`, Telegram login, logout, profile, learning attempt/answer/complete and protected admin routes. Confirm CORS from the exact frontend origin and inspect Worker logs/traces.

## Production gate

A production environment must not reuse the development database. Before defining it:

- Provision a separate production D1 database and record its verified ID.
- Confirm the production API hostname and frontend origin.
- Define production-specific bindings, variables, cron triggers and secrets; Wrangler environment bindings and vars are explicitly configured per environment.
- Complete data retention, export/deletion, backup/restore, rate-limit and security review.
- Obtain explicit owner approval for production resource creation, remote migrations and production deployment.

Do not add a production deploy command until the production D1 ID, domain/origin, secret handling and release approval are in place.

## Rollback

Worker code rollback does not roll back D1 schema or data. For every schema change, record the applied migration version and recovery plan. Never assume a Worker version rollback reverses a migration. Prefer forward-fix migrations; use D1 time travel/restore only after reviewing the impact and taking the required backup.

## Known blockers at the current checkpoint

- GitHub Actions jobs for PR #10 previously failed before runner allocation (`runner_id=0`, no steps/logs). This is not a passing CI result.
- The local Mac execution environment was offline in the last work session; typecheck, Vitest, SQLite verifier and Local D1 checks remain unverified.
- Telegram bot token and approved frontend origin are not configured in the development Worker.
- The existing Cloudflare Worker is still a bootstrap placeholder; the source application has not been uploaded through Wrangler.
