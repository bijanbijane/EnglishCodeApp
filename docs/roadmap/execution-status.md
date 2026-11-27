# Execution Status — 2026-11-27

This checkpoint records repository-observed state only. It is not a claim that the project is release-ready.

## Repository checkpoint

- Repository: `bijanbijane/EnglishCodeApp`
- Default branch: `main`
- Main commit inspected: `f3671f2194e562fc194d23e9602b768455d8e483`
- Documentation branch: `docs/backend-status-refresh-2026-11-27`
- Documentation branch starting point: `f3671f2194e562fc194d23e9602b768455d8e483`
- Documentation PR: #23 (open, Draft; do not merge without required review and approval)
- Last source commits reviewed: main `f3671f2194e562fc194d23e9602b768455d8e483`; PR #25 latest `4f54396c42e04e9b994f8cdc55adcc1fb425a9e4`; PR #24 `10ccf3721aa37ae6e2b7d551b854064bc9ff1839`
- Last test-verified commit: **none established in this execution session**

## Baseline verified from main

- React 19 / TypeScript / Vite frontend under `apps/frontend`.
- Cloudflare Workers / Hono / TypeScript backend under `apps/backend`.
- Versioned API under `/api/v1`.
- D1 SQL migration sequence present on main: `0001`–`0015`.
- Backend code includes Telegram initData verification, session lifecycle, rate limiting, attempt creation, server-side answer grading, completion/progress writes, RBAC, content review/publish workflow, and audit reads.
- Frontend code includes Telegram bootstrap/auth integration, course/lesson navigation, attempt/answer flow, and retry-oriented states.
- Backend and frontend package scripts were inspected. No local commands were run.

## Open pull-request topology

- PRs #17–#25 are open Draft proposals (individual state was refreshed during this session).
- PR #24 is the main-based Telegram Mini App launch URL configuration proposal.
- PRs #19 and #25 both propose migration `0016` for completion events. They are alternatives; do not merge both. PR #25 is the focused main-based port.
- PR #20 proposes migration `0017` and depends on the completion-event migration being resolved first. It also has outstanding real-device/browser validation.
- PR #22 is stacked on PR #21. Its client-side exercise evaluation and answer-key exposure concern remains a release blocker until the grading boundary is corrected.
- PR #17 overlaps with the newer environment-aware work in PR #24.
- PR #18 overlaps with author-version pagination work in PR #19; pagination ordering concerns remain recorded on PR #19.
- PR #21 content datasets remain supplementary and require source pinning/checksum plus editorial review.

## Validation evidence

- The current main commit `f3671f2194e562fc194d23e9602b768455d8e483` returned no PR-triggered workflow runs through the available commit-runs query.
- GitHub Actions runs inspected for PR #20 and PR #25 ended with failure before job execution/runner allocation in the earlier recorded evidence. This is not a code-test failure and is not a passing result.
- No local typecheck, unit tests, SQLite verifier, Wrangler Local D1 test, frontend build, or E2E test was run in this session.
- Static source review was performed on the Telegram initData verifier, login route/tests, learning routes, frontend app, package scripts, and migration files.
- Static review identified a coupling in PR #25: the progress upsert used `changes() = 1` after an event INSERT. This has been corrected on the PR branch by reordering the batch to UPDATE → progress → event INSERT → SELECT. A Local D1 regression fixture now pre-inserts the deterministic event key for an in-progress attempt; the existing progress-count assertion covers the event-insert conflict path. The change is read-back verified but runtime remains unverified.

## Latest review actions — 2026-11-27

- Added PR #25 conversation comment `7222284886` documenting the `changes()` ordering concern and requesting Local D1 coverage for first completion, repeated completion, and a pre-existing-event edge case.
- Updated `docs/backend/OPERATIONS.md` with the same checkpoint and exact resume constraints.
- PR #25 review-thread listing was empty before the comment; no code was changed on that PR branch.
- PR #24's webhook handler was checked: non-private chats are ignored before a Mini App Web App button can be sent. No defect was confirmed in that path by this limited review.

## Latest PR #25 implementation checkpoint — 2026-11-27

- Updated PR #25 head to `4f54396c42e04e9b994f8cdc55adcc1fb425a9e4` (14 commits ahead, 0 behind main at last compare).
- Changed `apps/backend/src/modules/learning/routes.ts` so the conditional attempt UPDATE is immediately followed by the progress upsert gated by `changes() = 1`; event append follows in the same D1 batch.
- Changed `scripts/verify_backend_d1_local.py` to seed a deterministic event-key conflict for a still-in-progress attempt before completing it. The existing `completed_count == 2` assertion checks that progress is still updated when event insertion is a no-op.
- Read-back verified both changes and their ordering.
- Added PR #25 comment `7222361872` documenting the implementation and validation status.
- Exact-head Backend CI run #325 (`46027047367`) concluded failure before job steps; steps array is empty, logs return `404 BlobNotFound`. This is not a code-test result.
- No local commands or D1 tests were executed. PR #25 remains Draft and unmerged.

## PR #22 follow-up review — 2026-11-27

- Refreshed PR #22: still open/Draft, head `88613a8d6f08e37430e579daada63689f34d0df8`, based on PR #21 branch, mergeable flag true (metadata only).
- Re-read the full PR patch and the learner-facing exercise UI test.
- Confirmed existing architecture concern remains: the browser imports the pack containing answer keys and performs local correctness evaluation. Existing comment `7221651318` remains unresolved; no backend grading endpoint is present in this PR's diff.
- New UX finding: the `matching` exercise type only masks/shows the supplied right-hand answers; it provides no learner matching input or submitted response. Added PR comment `7222402332`. Treat as a worked-example card or implement accessible matching interaction without client-authoritative scoring.
- The shipped-pack validator test requested earlier is now present in the PR patch. This closes that specific test-coverage request at source level; CI has not provided executable evidence.
- PR #21 remains open/Draft at `e1564cf4a89e4600d91744afe4e80acf7d1a9231`. Strict record validation was added, but immutable upstream revision + SHA-256 pinning and sync-time checksum verification remain unresolved. Existing review comments remain unanswered.
- No tests were executed in this session; no PR bases, branch histories, or merge states were changed.

## PR #25 follow-up — verifier ordering alignment — 2026-11-27

- Re-read migration `0016_immutable_learning_events.sql`, Worker completion batch, SQLite verifier, and Wrangler Local D1 regression fixture at PR head `4f54396c42e04e9b994f8cdc55adcc1fb425a9e4`.
- Migration defines immutable UPDATE/DELETE guards and a user FK with `ON DELETE CASCADE`. The delete guard is conditional on the parent user row still existing; SQLite's documented delete sequence removes the parent row before executing FK actions, so the cascade path is designed to pass while direct child deletes are rejected. The verifier contains explicit direct-delete rejection and parent-delete cascade assertions. Actual D1 execution is still required to establish parity.
- Found a test/implementation ordering mismatch in `scripts/verify_backend_sqlite.py`: its progress upsert followed the event INSERT, unlike the Worker/D1 path. Updated both first-completion and repeated-completion batches to match: conditional attempt UPDATE → progress upsert gated by `changes() = 1` → event INSERT.
- Commit: `dc9db06f23e3d1b90a02698e586e18ef845c1c6c`. Read-back confirmed both SQLite batch sequences. PR comment `7222448678` records the change and its unverified status.
- No local tests, Wrangler Local D1 commands, remote migrations, or deployments were run. GitHub Actions runner allocation remains an external blocker; do not interpret pre-step job failures as test outcomes.

## Security and data implications

- No application source code or SQL migration was changed in this documentation batch.
- No database was modified.
- No secret, Worker binding, Cloudflare resource, or deployment was changed.
- No production operation was attempted.
- Main's migration chain remains `0001`–`0015`; PR migrations `0016` and `0017` are not part of main.

## Current blockers

1. GitHub Actions runner allocation/visibility remains unresolved; exact code-level CI status is unverified.
2. Fresh Local D1 migration/seed and transaction/concurrency checks have not been evidenced on the current main commit.
3. Owner-operated first-admin bootstrap, export/deletion, backup/restore, and operational observability remain incomplete.
4. PR review topology needs deliberate consolidation; avoid branch-history rewrites and duplicate migrations.
5. PR #20 needs latest frontend validation and physical-device/browser recording checks.
6. PR #22 must not expose authoritative answer keys or grading in the frontend bundle.

## Next eligible execution queue

1. Obtain runner-allocation evidence from repository/account Actions settings; do not edit workflows merely to hide the failure.
2. Once a real runner is available, run backend typecheck, Vitest, SQLite verifier, fresh Local D1 migration/seed and D1 integration tests on the exact main/PR head.
3. Run PR #25's exact-head typecheck, Vitest, SQLite verifier and Wrangler Local D1 integration tests when GitHub Actions can allocate a runner. The statement-ordering correction is implemented but unverified. Keep #19 and #25 as alternative migration-0016 paths.
4. Review PR #24's complete diff and exact-head checks; retain Draft until tests pass.
5. Resolve the server-side grading/answer-key boundary in the PR #22 proposal before any learner-facing release.
6. Complete cross-user/role-revocation tests and owner-operated admin bootstrap.
7. Add export/deletion and backup/restore procedures before beta readiness.

## Resume point

Resume by refreshing main, PR #17–#25, PR comments/reviews, and exact-head workflow runs. The next PR #25 item is executable validation of head `4f54396c42e04e9b994f8cdc55adcc1fb425a9e4`; the next infrastructure item is owner inspection of GitHub Actions runner settings. Continue independent GitHub-only review while CI is blocked. Keep all changes on focused branches in this repository; no merge, deployment, remote migration, secret mutation, or paid resource action is authorized by this checkpoint.
