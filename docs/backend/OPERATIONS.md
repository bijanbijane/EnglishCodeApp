# Backend Operations and Release Controls

## Environments

- Local development uses Wrangler local mode and an isolated local D1 database.
- Staging must have its own Worker name, D1 database, secrets, and origin allowlist.
- Production bindings and secrets must never be copied into local or preview environments.
- The current Wrangler file intentionally contains a local placeholder D1 ID and no deploy target.

## Local workflow

From `apps/backend`:

```bash
npm install
npm run typecheck
npm test
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Use synthetic records only. Reset local D1 when testing migration-from-empty behavior; preserve a separate fixture when testing upgrades.

## Migration policy

1. Review SQL and foreign-key behavior.
2. Apply all migrations to a fresh local D1.
3. Apply migrations to a copy of the previous supported schema.
4. Verify indexes, constraints, and representative query plans.
5. Record the exact migration version and evidence.
6. Remote migration is a separate, explicitly approved operation with backup and recovery plan.

Never edit a migration that has been applied to a shared database. Prefer forward fixes.

## CI requirements

- Node.js 22.
- Dependency installation.
- Backend TypeScript typecheck.
- Backend unit/API tests.
- Local D1 migration and synthetic seed application.
- Later gates: Worker integration tests, security tests, frontend contract compatibility, and migration-upgrade tests.

A missing workflow result is not a passing result. Record the exact commit and job output.

## Observability

- Generate a server-side request ID for each request.
- Preserve Cloudflare Ray ID separately when available.
- Log route, duration, outcome, and error code without credentials or user-private content.
- Monitor error rate, latency, D1 query duration, quota consumption, and failed background jobs.
- Define alert thresholds only after a baseline exists; do not claim an SLA before load testing.

## Cost and quota controls

- Free-first is mandatory until explicitly changed.
- Do not provision R2, Queues, KV, Durable Objects, Workers AI, or paid providers without a concrete use case and approval.
- Degrade optional AI/media/background features before compromising durable learning records.
- Review current Cloudflare limits and pricing before any resource activation.

## Release gate

Before beta:
- CI green on exact release commit.
- Local D1 migration-from-empty and upgrade tests pass.
- Auth, ownership, answer-key, idempotency, and concurrency tests pass.
- Backup/restore and deletion/export paths are tested.
- Threat model and privacy/retention policy are reviewed.
- Staging smoke test and rollback procedure are documented.

Production deployment and production migration require separate explicit owner approval.


## Scheduled authentication-state cleanup

- A daily Worker Cron is configured for 03:17 UTC. Each execution deletes at most 500 expired Telegram replay fingerprints, 500 rate-limit buckets older than 48 hours, and 500 stale sessions.
- Expired unrevoked sessions are retained for at least seven days after expiry; revoked sessions are retained for at least 30 days after revocation.
- Cleanup is code/configuration only until a Worker is deployed. No production schedule is active.
