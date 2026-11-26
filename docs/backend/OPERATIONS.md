# Backend Operations and Release Controls

## Environments

- Local development uses Wrangler local mode and an isolated D1 database.
- Staging must have its own Worker name, D1 database, secrets and exact origin allowlist.
- Production bindings and secrets must never be copied into local or preview environments.
- Current Wrangler config contains a local placeholder D1 ID; no deploy target or production resource is provisioned.

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

The Python script exercises migrations and core SQLite transaction/trigger invariants. It is compatibility evidence, not a substitute for Local D1 or concurrent Worker tests. Use synthetic records only.

## Migration policy

1. Review SQL, foreign keys, triggers and indexes.
2. Apply migrations `0001`–`0010` to fresh Local D1.
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

Current GitHub Actions runs fail before runner allocation (`runner_id=0`, no steps). This is not a code-test failure or a passing result. The connected Mac was also offline during the latest work session.

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
