# Branch consolidation plan

Status: IN PROGRESS — no merge into `main` has been performed.

## Integration base

The integration branch `integration/branch-consolidation` was created from
`feat/frontend-modular-foundation`. This is a staging base only; it is not
evidence that all other branch changes have been integrated.

## Branch inventory

| Branch | Commits ahead of main | Integration decision |
|---|---:|---|
| `docs/backend-architecture-v2` | 59 | Review its two backend architecture documents against the current architecture; selectively port only still-valid decisions. |
| `feat/backend-architecture-v3` | 97 | High-priority backend review; compare auth, sessions, Telegram, identity and learning modules before porting. |
| `feat/backend-domain-foundation` | 58 | Already contained in the selected integration base according to the previous compare; verify again before treating as redundant. |
| `feat/backend-foundation` | 36 | Review backend foundation and workflow changes; do not merge wholesale. |
| `feat/frontend-architecture-audit` | 68 | Review its frontend documentation changes and compare with Telegram experience branch. |
| `feat/frontend-modular-foundation` | 172 | Selected staging base. |
| `feat/minimal-app-foundation` | 3 | Review the small divergent delta; do not merge blindly. |
| `feat/telegram-learning-experience` | 68 | Review user-facing Telegram learning flow; compare overlapping files with frontend audit. |
| `fix/backend-p0-correctness` | 72 | Critical correctness review; reconcile backend and tests before any acceptance. |

The ahead counts are from the prior branch comparison and must be refreshed
before final integration.

## Ported P0 correctness changes

The following files have been ported from `fix/backend-p0-correctness` into this
integration branch as new commits:

- `apps/backend/src/modules/auth/telegram.ts`: corrected Telegram Mini App
  HMAC derivation to use the bot token as the HMAC key and `WebAppData` as data;
  tightened the maximum-age boundary.
- `apps/backend/src/modules/auth/session.ts` and
  `apps/backend/src/modules/auth/routes.ts`: moved replay claiming and session
  issuance into a transactional D1 batch, avoiding the prior two-step session /
  replay write sequence.
- `apps/backend/src/modules/learning/routes.ts`: ported the P0 correctness
  implementation.
- `apps/backend/test/auth.test.ts`,
  `apps/backend/test/telegram.test.ts`, and
  `apps/backend/test/app.test.ts`: ported the corresponding regression tests,
  including explicit coverage for Telegram's HMAC key/data order.

These are source-level ports only. They have not been executed in this session;
compatibility and runtime behavior remain unverified until the full workspace
checks pass.

## Validation gates

- [ ] Refresh all branch heads and compare each branch with this integration branch.
- [ ] Inspect full diffs for every non-contained branch; resolve overlapping edits semantically.
- [ ] Confirm Telegram initData validation, freshness/replay protection, session lifecycle and authorization boundaries.
- [ ] Confirm learning attempt lifecycle, server-side grading, idempotency and progress persistence.
- [ ] Review SQL migrations for ordering, constraints, rollback/compatibility and local D1 behavior.
- [ ] Review frontend route/state boundaries, Telegram WebApp integration, loading/error/empty states and accessibility.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build:frontend` in a clean Node.js 22+ environment.
- [ ] Add or verify CI workflows and ensure required checks pass on the final candidate.
- [ ] Create a Draft PR to `main` only after the integration candidate contains the reviewed changes and evidence is attached.

## Safety constraints

- Do not merge to `main` while any validation gate is open.
- Do not deploy, run production migrations, or publish production reference data.
- Preserve all source branches until the final integration is accepted.
- Do not treat a clean GitHub compare or a mergeable PR as proof that the application works.

## Current evidence and limitations

The selected branch README documents React/Vite/TypeScript frontend, Hono backend,
Telegram Mini App authentication, learning flows and three SQL migrations. It
also explicitly states that D1-backed write flows, Telegram bot secrets,
rate limiting, end-to-end D1 tests and production deployment are not configured.
The root scripts expose typecheck, backend tests and frontend build commands.

This work session has inspected repository metadata and selected files through
GitHub. It has not run the project locally, so no test result is claimed.
