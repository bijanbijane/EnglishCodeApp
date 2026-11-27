# Backend Operations and Release Controls

## Environments
- Local development uses Wrangler local mode and an isolated D1 database with synthetic data.
- Development resources are separate from Local and Production. Verify the exact Worker, D1 binding, origin allowlist, and secrets before any Development remote operation.
- Production bindings, databases, and secrets must never be copied into Local or Development environments.
- A successful validation build or dry-run is not a deployment and does not authorize a remote migration.

## Local workflow
From apps/backend:

    npm install
    npm run typecheck
    npm test
    python3 ../../scripts/verify_backend_sqlite.py
    npm run db:migrate:local
    npm run db:seed:local
    npm run test:d1-local

The Python verifier checks SQLite migration and transaction invariants. It is complementary to, not a replacement for, Wrangler Local D1 integration tests. Use synthetic records only. Run the commands against a fresh Local D1 when validating the full migration chain.

## Migration policy
1. Review SQL, foreign keys, triggers, indexes, and compatibility with the current schema.
2. On main, the current migration sequence is 0001–0015. Confirm the actual files on the target commit before applying or documenting a newer range.
3. Apply the full sequence to a fresh Local D1 and verify migrations, seed data, constraints, and representative query behavior.
4. Test upgrades from the previous supported schema when a migration changes existing data or constraints.
5. Record the exact commit, migration range, command, and result.
6. Treat any remote migration as a separate operation requiring explicit owner approval, backup, and recovery plan.

Never edit a migration applied to a shared database. Use forward-only migrations. Feature-branch migrations are not part of main until their PRs are merged; do not assume that an open PR's migration has been applied.

## CI requirements and current status
- Backend: Node.js 22, dependency installation, TypeScript typecheck, Vitest, SQLite migration/transaction verification, and Wrangler Local D1 integration.
- Frontend: TypeScript typecheck, Vitest, and Vite production build.
- Run checks against the exact commit proposed for merge.
- GitHub Actions runs inspected on 2026-11-27 failed before a runner was assigned (runner_id=0, no executed steps). This is an infrastructure/runner-allocation failure, not evidence that code tests failed or passed.
- Cloudflare validation builds reported by feature PRs are evidence only for the exact code commit and checks listed in those PRs. They do not establish that the current main commit passed the same checks.

## Observability
- Generate a request ID for every request.
- Keep Cloudflare Ray ID separate when available.
- Log route, duration, outcome, and error code without credentials or private content.
- Monitor error rate, latency, D1 query duration, quota consumption, and scheduled cleanup failures.
- Do not claim an SLA before load testing.

## Scheduled auth cleanup
- The Worker Cron is configured for 03:17 UTC; configuration does not prove that the schedule is deployed or running.
- Cleanup is bounded per run for expired replay fingerprints, old rate-limit buckets, and stale sessions.
- Preserve the documented retention windows for expired and revoked sessions.
- Verify cleanup behavior with synthetic Local D1 data before changing retention or batch limits.

## Admin operations
- Roles are stored in D1 and enforced server-side.
- First-admin bootstrap and subsequent role grants/revocations remain owner-controlled; there is no public role-grant endpoint.
- Follow ADMIN-BOOTSTRAP.md and verify the internal user ID through the approved identity process.
- Every role grant/revocation must include an audit event in the same D1 batch.
- Do not seed Production roles or store a Production administrator ID in source control.

## Release gate
Before beta:
- Required CI checks are green on the exact release commit.
- Fresh Local D1 migration/seed and upgrade tests pass.
- Auth, role, ownership, answer-key privacy, idempotency, and concurrency tests pass.
- Account export/deletion and backup/restore paths are tested.
- Threat model and privacy/retention policy are reviewed.
- Development smoke tests and rollback/recovery procedures are documented.

Production deployment, Production migration, Production secret mutation, and paid-resource activation each require separate explicit owner approval.