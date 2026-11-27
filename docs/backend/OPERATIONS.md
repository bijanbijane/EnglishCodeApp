# Backend Operations and Release Controls

## Environments

- Local development uses Wrangler local mode and an isolated D1 database.
- Staging must have its own Worker name, D1 database, secrets and exact origin allowlist.
- Production bindings and secrets must never be copied into local or preview environments.
- Development backend and frontend Workers and a dedicated Development D1 database are provisioned. Production resources and bindings are not provisioned or authorized by this workflow.

## Local workflow

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

The Python SQLite verifier exercises migrations and core transaction/trigger invariants. `npm run test:d1-local` starts Wrangler with a fresh local D1 database, applies migrations and synthetic seeds, and exercises authenticated flows, concurrent completion, exactly-once learning-event persistence, and admin/reviewer workflows. These are local-only tests; use synthetic records only.

## Migration policy

1. Review SQL, foreign keys, triggers and indexes.
2. Apply migrations `0001`–`0016` to fresh Wrangler Local D1.
3. Apply migrations to a copy of the previous supported schema.
4. Verify indexes, constraints and representative query plans.
5. Record exact migration version and evidence.
6. Remote migration is a separate, explicitly approved operation with backup and recovery plan.

Never edit a migration applied to a shared database. Prefer forward-only migrations. Old feature branches have incompatible migration histories; do not copy their old numbered migrations onto main.

## CI requirements

- Node.js 22 and dependency installation.
- Backend TypeScript typecheck and Vitest.
- Python SQLite migration/transaction invariant script.
- Local D1 migration and synthetic seed.
- Later: Worker integration tests, security tests, frontend contract compatibility and migration-upgrade tests.

GitHub Actions has intermittently failed before runner allocation (`runner_id=0`, no steps); this is an infrastructure/runner failure, not a code-test result. The equivalent backend validation suite has passed through Cloudflare Build Runner on exact feature commits. The validation-only build trigger must retain its echo-only deploy command and must not be repurposed for deployment.

## Observability

- Server-generated request ID on every request.
- Keep Cloudflare Ray ID separate when available.
- Log route, duration, outcome and error code without credentials or private content.
- Monitor error rate, latency, D1 query duration, quota consumption and scheduled cleanup failures.
- Do not claim an SLA before load testing.

## Scheduled auth cleanup

- Daily Worker Cron configured for 03:17 UTC; inactive until deployment.
- At most 500 expired replay fingerprints, 500 rate-limit buckets older than 48 hours and 500 stale sessions are deleted per run.
- Expired unrevoked sessions are retained at least seven days after expiry; revoked sessions at least 30 days after revocation.

## Admin operations

- First admin and subsequent role grants/revocations are owner-controlled D1 batches; no public grant endpoint exists.
- Follow `ADMIN-BOOTSTRAP.md`; verify internal user ID from the confirmed Telegram identity.
- Every role grant/revocation must include an audit event in the same D1 batch.
- Do not seed production roles or store a production administrator ID in source control.

## Release gate

Before beta:
- CI green on exact release commit.
- Local D1 migration-from-empty and upgrade tests pass.
- Auth, role, ownership, answer-key, idempotency and concurrency tests pass.
- Account export/deletion and backup/restore paths are tested.
- Threat model and privacy/retention policy are reviewed.
- Staging smoke test and rollback procedure are documented.

Production deployment and production migration require separate explicit owner approval.
