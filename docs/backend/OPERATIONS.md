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
npm run test:d1-local
npm run dev
```

The Python script exercises migrations and core SQLite transaction/trigger invariants, including immutable learning events and parent-user cascade behavior. It is compatibility evidence, not a substitute for Wrangler Local D1 or concurrent Worker tests. Use synthetic records only. The progress rebuild SQL is SQLite-only; no D1 rebuild procedure is provided.

## Migration policy

1. Review SQL, foreign keys, triggers, indexes, and compatibility with the current schema.
2. On the inspected `main` commit `15b9b47c32e5f0a04542d946d61679f62b15f47c`, the migration sequence is `0001`–`0016`, including `0016_immutable_learning_events.sql`. Re-read the actual files on the target commit before applying or documenting a newer range.
3. Apply the full sequence to a fresh Local D1 and verify migrations, synthetic seed data, constraints, and representative query behavior.
4. Test upgrades from the previous supported schema when a migration changes existing data or constraints.
5. Record the exact commit, migration range, command, and result.
6. Treat any remote migration as a separate operation requiring explicit owner approval, backup, and recovery plan.

Never edit a migration applied to a shared database. Prefer forward-only migrations. Old feature branches have incompatible migration histories; do not copy their old numbered migrations onto main.

## CI requirements

- Node.js 22 and dependency installation.
- Backend TypeScript typecheck and Vitest.
- Python SQLite migration/transaction invariant script.
- Local D1 migration and synthetic seed.
- Later: Worker integration tests, security tests, frontend contract compatibility and migration-upgrade tests.

The GitHub Actions run [#46132304990](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/46132304990) passed on PR #30 head `1adc37f6a80ffca3795d72d7415b2b35bac1e4a2`, which is a documentation-only change based on the inspected main commit. Dependency audit, typecheck, Vitest, SQLite migration/transaction checks, Wrangler Local D1 integration, and Development API smoke all passed on that exact PR head. This is not a separately triggered run on the `main` SHA; always report the exact tested commit.

## Migration 0016 — immutable learning events

The mainline migration `0016_immutable_learning_events.sql` adds an append-only ledger for completed lesson attempts, backfills events for historical completed attempts, and adds user/lesson read indexes and uniqueness constraints. Update and direct-delete guards preserve event immutability; deleting the parent user follows the existing cascade policy. This event ledger is not a cumulative assessment-result store.

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
