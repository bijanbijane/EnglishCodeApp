# Execution Status — 2026-11-27

This checkpoint records repository-observed state only. It is not a claim that the project is release-ready.

## Repository checkpoint

- Repository: `bijanbijane/EnglishCodeApp`
- Default branch: `main`
- Main commit inspected: `f3671f2194e562fc194d23e9602b768455d8e483`
- Documentation branch: `docs/backend-status-refresh-2026-11-27`
- Documentation branch starting point: `f3671f2194e562fc194d23e9602b768455d8e483`
- Documentation PR: #23 (open, Draft; do not merge without required review and approval)
- Last source commits reviewed: main `f3671f2194e562fc194d23e9602b768455d8e483`; PR #25 `d079b201b9ba95fff7b9d23355a8d3e9d34d52d9`; PR #24 `10ccf3721aa37ae6e2b7d551b854064bc9ff1839`
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
- Static review identified a maintainability/correctness coupling in PR #25: the progress upsert uses `changes() = 1`, but an event INSERT now sits between the attempt UPDATE and progress upsert. The gate therefore observes the event INSERT's row count rather than the attempt transition. A review comment recommends reordering the batch to UPDATE → progress → event INSERT → SELECT; runtime behavior remains unverified.

## Latest review actions — 2026-11-27

- Added PR #25 conversation comment `7222284886` documenting the `changes()` ordering concern and requesting Local D1 coverage for first completion, repeated completion, and a pre-existing-event edge case.
- Updated `docs/backend/OPERATIONS.md` with the same checkpoint and exact resume constraints.
- PR #25 review-thread listing was empty before the comment; no code was changed on that PR branch.
- PR #24's webhook handler was checked: non-private chats are ignored before a Mini App Web App button can be sent. No defect was confirmed in that path by this limited review.

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
3. Resolve PR #25's completion-batch statement ordering concern; then run exact-head CI and Wrangler Local D1 tests when a runner is available. Keep #19 and #25 as alternative migration-0016 paths.
4. Review PR #24's complete diff and exact-head checks; retain Draft until tests pass.
5. Resolve the server-side grading/answer-key boundary in the PR #22 proposal before any learner-facing release.
6. Complete cross-user/role-revocation tests and owner-operated admin bootstrap.
7. Add export/deletion and backup/restore procedures before beta readiness.

## Resume point

Resume by refreshing main, PR #17–#25, PR comments/reviews, and exact-head workflow runs. The next code-review item is PR #25's `changes()`/event ordering finding; the next infrastructure item is owner inspection of GitHub Actions runner settings. Continue independent GitHub-only review while CI is blocked. Keep all changes on focused branches in this repository; no merge, deployment, remote migration, secret mutation, or paid resource action is authorized by this checkpoint.
