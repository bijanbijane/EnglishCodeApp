# Branch consolidation audit — 2026-11-27

## Scope and checkpoint

- Repository: `bijanbijane/EnglishCodeApp`
- Baseline branch: `main`
- Baseline SHA: `f3671f2194e562fc194d23e9602b768455d8e483`
- Audit branch: `integration/complete-branch-consolidation-2026-11`
- Audit branch was created from the baseline SHA; this checkpoint does not modify `main` or any source branch.
- Branch comparisons use GitHub's compare API (base `main`, head branch tip). `ahead` is a commit-ancestry count, not a count of unique behavioral changes. Squash/cherry-pick equivalence requires tree/patch/behavior review.
- The branch-list API returned 29 branches including `main`; a second search page was empty.

## Branch inventory

| Branch | Tip SHA | Ahead of main | Preliminary disposition |
|---|---|---:|---|
| `backend/dev-live-smoke` | `87bc70a7fb17c88073d73c7e01fe2f8a9f969cea` | 1 | B — smoke script candidate; old version, default target needs correction |
| `backend/dev-live-smoke-v2` | `61202451cb7033a5c600d0cf4c96de598a5b27f3` | 1 | D — superseded smoke-script revision |
| `backend/dev-live-smoke-v3` | `33128a6495cbaa35895df59bb301c89f258f8508` | 1 | B — latest smoke-script candidate; default target still needs correction |
| `docs/backend-architecture-v2` | `2f3ebb4149d95503680b348955624b159e233b3e` | 1 | D — superseded by Architecture V3 and current main documentation |
| `docs/backend-status-refresh-2026-11-27` | `382ce02677c304df2ba1720c61b5a992c4675cd9` | 16 | A — documentation-only PR #23; awaiting successful validation |
| `feat/admin-author-version-pagination` | `7f3b064d43f2d6a8552f22971379044043e285e6` | 4 | E — overlaps a separately reviewed pagination implementation; PR #18 is draft |
| `feat/backend-admin-reads` | `1b77a8f4c1ca57dec34558a67d02a1a1ac538d73` | 2 | C/D — admin audit and reviewer pagination behavior exists on main with adapted route layout |
| `feat/backend-architecture-v3` | `1f75d5a47409744ee503be209d829cb57943c842` | 0 | C — branch tip is an ancestor of main |
| `feat/backend-domain-foundation` | `60b0e22c04667e148f64e631ae9bd5ff09b1f084` | 0 | C — branch tip is an ancestor of main |
| `feat/backend-foundation` | `963ed19ea2453f5ba6e14b185e62222804b1fe8d` | 36 | D/E — legacy implementation; do not merge wholesale over current modular architecture |
| `feat/backend-review-pagination-main` | `8cf8afc3f3a307939421ae858963ba3ba57ca436` | 20 | C/D/E — core pagination/audit behavior is present in main; branch also has stale deployment/configuration and migration assumptions |
| `feat/curated-course-source-integration` | `88613a8d6f08e37430e579daada63689f34d0df8` | 73 | B/E — stacked on PR #21; licensed content and grammar feature need successful checks plus editorial/licensing review |
| `feat/frontend-architecture-audit` | `6fe1c7ff45c3d9bbb28eac38fb63f0234a6fcf25` | 10 | C/D — architecture documents were carried into the consolidated baseline; verify individual wording only if needed |
| `feat/frontend-modular-foundation` | `8b97a1e8fcd2496c898480c62eda1466872f92c8` | 56 | D/E — older frontend structure; current React/Vite application has since evolved |
| `feat/immutable-learning-events` | `30fded8726f936f7a8c3ce89703f696e52c093e5` | 16 | D/E — overlaps PR #25; contains additional author-pagination work intentionally excluded from #25 |
| `feat/immutable-learning-events-mainline` | `dc9db06f23e3d1b90a02698e586e18ef845c1c6c` | 15 | A/B — additive migration 0016 and completion-event write path; PR #25, checks currently fail before runner allocation |
| `feat/minimal-app-foundation` | `661effff51d1582db197b46639c1bb768fd75de1` | 1 | D — obsolete initial vertical slice; replaced by current implementation |
| `feat/open-learning-content-module` | `e1564cf4a89e4600d91744afe4e80acf7d1a9231` | 56 | B/E — PR #21; code is potentially compatible, but CI and content quality gates are open |
| `feat/telegram-learning-experience` | `6fe1c7ff45c3d9bbb28eac38fb63f0234a6fcf25` | 10 | C/D — same tip as frontend architecture audit; documentation baseline is represented |
| `feat/telegram-start-mini-app-launch` | `84389d31ab1217b1bb1ee7dbd46f581a167d11e1` | 3 | D — old hard-coded Development URL approach superseded by PR #24 |
| `feat/telegram-webhook-dev` | `dbaf2c6e6d5c5ddc048d9e81067b9e9afd8a1b49` | 0 | C — merged PR #15; tip is an ancestor of main |
| `fix/backend-p0-correctness` | `d9734f916712b81719f822c8356ac3e7aa7f734a` | 0 | C — branch tip is an ancestor of main |
| `fix/telegram-mini-app-url-config` | `10ccf3721aa37ae6e2b7d551b854064bc9ff1839` | 6 | A/B — PR #24; environment-bound URL and validation are useful, checks currently fail before runner allocation |
| `fix/telegram-webhook-reapply-secret` | `742ff205d87fab34590b01ef95da8e2280ceb465` | 2 | C/D — behavior is present in main's setup flow; branch is older and closed unmerged |
| `fix/telegram-webhook-reapply-secret-v2` | `3c627147a94e6999b68d9a9e5d9c2af56000c3a3` | 0 | C — branch tip is an ancestor of main |
| `infra/cloudflare-dev-wrangler` | `392ef400701cdd751c77c0030fcf67a822449412` | 2 | D/E — stale environment/binding proposal; current config is authoritative |
| `infra/cloudflare-free-tier-foundation` | `fec521220772e66e2796bc49022311843d212154` | 101 | E — AI transcription feature; separate product/security/cost/device-validation gates remain open |
| `integration/branch-consolidation` | `f07d50fa92c1f0af94a595aabe592ecb2513e3ce` | 0 | C — prior consolidation PR #8 is merged; its tip is an ancestor of main |
| `main` | `f3671f2194e562fc194d23e9602b768455d8e483` | 0 | Baseline |

The GitHub branch-list response did not include per-branch commit timestamps. The tip SHAs above are authoritative; per-branch last-update timestamps remain to be collected if a timestamp-level inventory is required.

## Confirmed migration reconciliation

The current main migration sequence is:
- `0001` through `0015`, including `0011_learning_history_indexes.sql` and `0012_admin_read_indexes.sql`.
- PR #9's historical `0010_admin_read_indexes.sql` collides by number with main's `0010_content_review_workflow.sql`.
- PR #10's historical `0011_admin_read_indexes.sql` collides by number with main's `0011_learning_history_indexes.sql`.
- Main already has the reviewer pagination and admin audit read behavior in adapted modules/routes, with later index migrations `0012` and `0014`. Do not transplant the old 0010/0011 migrations.
- PR #25 adds migration `0016_immutable_learning_events.sql`, which is the next available number on the observed main baseline. It is additive, but must pass the exact-head Local D1 and SQL verification gates before merge.
- PR #20's migration `0017` depends on 0016 and belongs to a separately gated AI transcription feature; do not integrate it as part of this consolidation without its feature gates.

No remote or production migration was run.

## Pull request and validation findings

- PR #8 is merged; its consolidation branch is an ancestor of main.
- PR #15 is merged; the Telegram webhook development branch is an ancestor of main.
- PRs #21, #22, #23, #24 and #25 are open Draft PRs.
- PR #22 is stacked on PR #21.
- PR #24 is the clean main-based replacement for the older hard-coded launch-button PR #17.
- PR #25 is the main-based replacement for the overlapping event-ledger work in PR #19; it explicitly excludes the separately reviewed author-version pagination work.
- Latest inspected GitHub Actions checks for PR #21–#25 completed as failures in approximately 1–2 seconds. Job objects return `steps: null`, `runner_id: 0`/no runner evidence in prior records, and log retrieval returns `BlobNotFound`. This is an infrastructure/runner-observability blocker, not evidence that source tests passed or failed.
- No checks were bypassed and no PR was merged during this audit.

## Current integration disposition

No source changes have been merged to main during this checkpoint. The audit branch exists as an isolated working branch. The highest-value candidates remain PR #24 (Telegram launch URL configuration), PR #25 (immutable completion events), PR #23 (documentation alignment), and PR #21/#22 (learning content and exercises). They remain unmerged until their exact-head checks and applicable content/security acceptance gates are satisfied.

## Safety

- Original remote branches were preserved.
- No force-push, branch deletion, production deployment, remote migration, secret mutation, or paid infrastructure activation was performed.
- Main remained at the recorded baseline SHA at the time of this checkpoint.
