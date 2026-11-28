# Backend Operations and Release Controls

## Verified baseline

This document is aligned to `main` commit `15b9b47c32e5f0a04542d946d61679f62b15f47c` (2026-11-28).

- Backend: Cloudflare Workers, TypeScript and Hono; versioned API under `/api/v1`.
- Data: Cloudflare D1/SQLite; forward-only migrations `0001`–`0016`.
- Learning: authenticated attempts, server-side grading, immutable snapshots, idempotent answer handling, conditional completion and progress projection.
- Content: published-content reads and author/reviewer/admin publication workflow.
- A1 content: nine units, 45 lessons and 180 deterministic MCQs; a partial recognition-focused foundation, not a complete four-skill A1 course.
- Validation evidence is commit-specific. Do not infer current-main CI success from a different PR head.

## Environment boundaries

- Local development uses Wrangler Local mode and isolated D1.
- Development resources documented for this project are `englishcode-backend-dev` and `englishcodeapp-dev`; verify bindings and target before any remote operation.
- Staging, if provisioned, must have separate Worker, D1, secrets and exact origin allowlist.
- Production bindings and secrets must never be copied into local or preview environments.

## Local validation

From `apps/backend`:

```bash
npm run typecheck
npm test
python3 ../../scripts/verify_backend_sqlite.py
npm run db:migrate:local
npm run db:seed:local
npm run test:d1-local
```

Use synthetic fixtures only. SQLite checks are compatibility evidence, not a substitute for Wrangler Local D1 or concurrency tests. Record the exact commit and command outcomes. Never report a test as passed unless its exact run completed successfully.

## Migration policy

1. Re-fetch the target branch head and migration directory.
2. Apply all existing migrations to a fresh isolated Local D1 database.
3. Test the supported upgrade path as well as fresh installation.
4. Verify foreign keys, triggers, indexes, constraints, transaction behavior and representative queries.
5. Preserve every migration already applied to a shared database; corrections require a new forward-only migration.
6. Remote migration requires explicit approval for that environment and a backup/recovery plan.

The current mainline migration sequence is `0001`–`0016`. Migration `0016_immutable_learning_events.sql` creates an append-only ledger of completed lesson attempts. It is not a cumulative-assessment result store. The existing SQLite-only progress rebuild script is not a D1-compatible operational procedure.

## CI evidence

The backend workflow validates dependency installation/audit, TypeScript, Vitest, SQLite invariants, Wrangler Local D1 integration and a Development API smoke test. Its triggers include backend code, learning-core, migrations, seeds, curriculum/assessment documentation, scripts and the workflow itself.

CI results must be tied to the exact commit SHA. The following PR-head runs were verified in this review:
- PR #26 exact head `1f821e690e5c90bd47c4b7db4eadc89b354d080a`: passed.
- PR #28 exact head `726d638f1209c46489e0f79e1bfe8bc09d5d942c`: passed.
- PR #30 exact head `1adc37f6a80ffca3795d72d7415b2b35bac1e4a2`: passed.

These runs do not establish a separate successful push-triggered workflow for the current main commit.

## Security and administration

- Telegram raw initData is verified server-side; do not persist it or bearer tokens.
- Session tokens are stored only as hashes.
- Authorization and role checks are server-side; there is no public role-grant endpoint.
- First-admin bootstrap and role grants/revocations remain owner-controlled and audited.
- Do not log credentials, raw initData, learner answer content or unnecessary personal data.
- Account export/deletion, backup deletion and restore drills remain release-readiness work.

## Free-first and release controls

- No paid plan, quota increase or billable fallback without explicit owner approval.
- Optional features must degrade before core learning data is put at risk.
- No production deployment, remote migration, production secret/config mutation or production data change without separate explicit approval for that exact action.
- A dry run is not a deployment.

## Remaining operational gates

- D1-compatible deterministic progress-projection rebuild.
- Owner-operated bootstrap/grant/revoke maintenance procedure and verification.
- Account export/deletion and backup deletion procedure.
- Cross-user, role-revocation, concurrency and idempotency security matrix.
- Backup/restore drill, observability and load baseline.
- End-to-end author → reviewer → admin publication integration coverage.
