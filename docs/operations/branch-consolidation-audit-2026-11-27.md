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
- Initial GitHub Actions checks for PR #21–#25 completed as failures in approximately 1–2 seconds. The failed-job rerun was then requested for all five PRs. On the latest recheck, all five PRs (#21–#25) had failed again within 2–3 seconds, including the reruns for PR #24 and #25. Job objects return `steps: null`, `runner_id: 0`/no runner evidence in prior records, and initial log retrieval returns `BlobNotFound`. This is an infrastructure/runner-observability blocker, not evidence that source tests passed or failed.
- No checks were bypassed and no PR was merged during this audit.

## Current integration disposition

No source changes have been merged to main during this checkpoint. The audit branch exists as an isolated working branch. The highest-value candidates remain PR #24 (Telegram launch URL configuration), PR #25 (immutable completion events), PR #23 (documentation alignment), and PR #21/#22 (learning content and exercises). They remain unmerged until their exact-head checks and applicable content/security acceptance gates are satisfied.

## Safety

- Original remote branches were preserved.
- No force-push, branch deletion, production deployment, remote migration, secret mutation, or paid infrastructure activation was performed.
- Main remained at the recorded baseline SHA at the time of this checkpoint.

## Addendum — 2026-11-28 refresh

### Repository and branch checkpoint

- Repository identity rechecked: `bijanbijane/EnglishCodeApp`.
- `main` remains at `f3671f2194e562fc194d23e9602b768455d8e483`; no source changes were merged to main in this refresh.
- The latest branch-list response contains 33 branches including main (32 non-main).
- Latest compare summary: 26 non-main branches are ahead of main; 6 have no commits exclusive to their tips; 16 are diverged (ahead and behind); 10 are ahead-only; 6 are behind-only. Ahead counts overlap across branches and are not unique-change counts.
- The full per-branch ahead/behind table was reported separately in the 2026-11-28 branch-distance review. Branch tips are moving; refresh comparisons before any future write or integration.

### New curriculum and CI work

- PR #28, `feat/a1-foundations-curriculum`, targets main and is open/non-draft. Its current head at review was `a62bcc5820e2252ddf967d0159a00b6bd2712ead`, 23 commits ahead and 0 behind main.
- PR #28 adds nine original A1 units, 45 lessons and 180 deterministic multiple-choice questions, plus seed idempotency checks, SQLite verification, Local D1 smoke coverage and curriculum source/rights documentation.
- Exact-head GitHub Actions check for `a62bcc5` completed successfully. All 11 substantive steps passed: npm 10.9.2 pin, dependency audit, typecheck, Vitest, SQLite SQL verification, Wrangler Local D1 integration and Development API smoke test (plus setup/checkout).
- The branch uses the existing D1 binding name `englishcodeapp-dev` for local seed commands. No remote seed, remote migration or deployment was run.
- Editorial scope remains partial: the 180 items are multiple-choice recognition checks. Balanced listening, reading, productive speaking/writing, rubrics and cumulative assessment are not yet delivered. The reference register was corrected in a follow-up commit to enumerate all nine units and state these gaps explicitly; that follow-up requires its own exact-head CI run.
- All content is declared original, with CEFR, Oxford, Cambridge, Longman and British Council resources used as editorial references only. The rights register explicitly prohibits copying protected publisher materials or scraping external sites.

### CI consolidation candidate

- PR #27, `fix/backend-npm10-vitest-install`, is open Draft, 5 commits ahead and 0 behind main. Its exact-head backend CI check completed successfully.
- PR #27 and PR #28 both update the backend CI npm installation/audit path and Workers types. PR #28 already includes the npm 10.9.2 pin, legacy peer resolution, explicit moderate-level audit, and the Workers types update. Treat PR #27 as overlapping/redundant with PR #28 unless a later diff demonstrates unique required behavior; do not merge both blindly.
- PR #28 is not merged. Its green check is evidence for that exact checked head only; any subsequent commit must receive fresh validation.

### Updated disposition

- PR #28 is the strongest current content candidate and has passed its exact-head automated validation. It still requires human review of pedagogical quality and content breadth; it must not be represented as a complete A1 course.
- PR #27 is a focused CI fix, but its implementation overlaps the CI work now present in PR #28.
- No branch was deleted, no shared history was rewritten, and no production or remote data operation was performed.

## Addendum — PR validation and code-review findings (2026-11-28)

### Exact-head CI refresh

- PR #21: backend and frontend checks are green on its current head.
- PR #22: backend and frontend checks are green on its current head. It remains stacked on PR #21.
- PR #24: backend CI is green on its current head.
- PR #25: backend CI is green on its current head.
- PR #26: code review found that its cursor decoder rejected colon-delimited lesson-version IDs such as `a1-u01-l01:v1`; the original tests only used hyphenated IDs. The branch was updated to accept the actual ID shape and add a round-trip regression test. Updated head `4f1a775` passed all 11 substantive backend CI steps, including Local D1 and Development API smoke checks.
- PR #27: backend CI is green on its current head; its npm/Workers-types changes substantially overlap PR #28.
- PR #28: all checks passed on head `a62bcc5`. The documentation correction in `e882329` also passed all 11 substantive backend CI steps, including dependency audit, typecheck, Vitest, SQLite, Local D1 and Development API smoke.
- PR #23: its check failed at `npm install`, not at test execution. Logs show Node 22.23.5 with npm 10.9.9 and the exact error `Cannot read properties of null (reading 'edgesOut')`. Typecheck, tests, SQLite, Local D1 and API smoke steps were skipped. This is consistent with the npm installation issue addressed by PRs #27/#28; rerun PR #23 after the CI fix is adopted or update its workflow.

### PR #22 licensing and architecture review

- The vendored course samples include adjacent MIT and CC BY 4.0 license notices. `packages/learning-core/data/SOURCES.md` records pinned upstream commits, attribution requirements, imported paths and editorial quality gates. This is a stronger provenance basis than an unlicensed scrape; preserve the attribution and CC BY change notices for any future adaptation.
- The grammar practice pack stores correct answers/accepted answers in JSON imported by the frontend, and `LearningContentModule.tsx` compares learner input in the browser. This makes answer keys and grading logic client-visible. It conflicts with the project's server-authoritative grading invariant if treated as an assessed learning activity. Do not merge this behavior as authoritative assessment; move answer keys/checking to a backend endpoint or redesign the frontend content as ungraded study material without asserting correctness. CI success does not resolve this architecture issue.
- Carryword data is MIT-licensed but explicitly described as an AI-assisted draft requiring human verification. It may be used as supplementary lookup data, not authoritative published vocabulary without editorial review.

### PR #24 and #25 review

- PR #24 reads `TELEGRAM_MINI_APP_URL` from the Worker environment, validates HTTPS and rejects credentials/fragments/whitespace-padded values. Missing or invalid configuration omits the Web App button. This is a safe default; no remote Worker variable was configured in this audit.
- PR #25 appends one immutable completion event per completed attempt in the same D1 batch as the progress projection. Migration 0016 backfills completed attempts, uses an aggregate uniqueness constraint, guards direct update/delete, and allows user-deletion cascade. Its Local D1 and SQLite checks passed on the exact reviewed head. It remains a separate additive schema change and is not in main.

### Current disposition

- No PR was merged. Main remains at the baseline SHA recorded above.
- PR #24 and PR #25 are technically validated candidates, subject to review/approval and their separate operational requirements.
- PR #21/#22 are validated at CI level; #22 still has the client-side grading blocker and must remain unmerged until corrected.
- PR #26 received a targeted cursor fix and requires fresh CI.
- PR #23 requires rerun after npm workflow correction.
- No remote D1 write, remote seed, secret/config mutation, production deployment, or production migration was performed.

## Complete branch-distance snapshot — 2026-11-28

The branch-list API was refreshed after the latest candidate commits. The following compares every non-main branch against the unchanged main baseline `f3671f2194e562fc194d23e9602b768455d8e483`.

| Branch | Ahead | Behind |
|---|---:|---:|
| `backend/dev-live-smoke` | 1 | 73 |
| `backend/dev-live-smoke-v2` | 1 | 69 |
| `backend/dev-live-smoke-v3` | 1 | 68 |
| `docs/backend-architecture-v2` | 1 | 721 |
| `docs/backend-status-refresh-2026-11-27` | 19 | 0 |
| `feat/a1-foundations-curriculum` | 25 | 0 |
| `feat/admin-author-version-pagination` | 4 | 20 |
| `feat/backend-admin-reads` | 2 | 653 |
| `feat/backend-architecture-v3` | 0 | 653 |
| `feat/backend-domain-foundation` | 0 | 721 |
| `feat/backend-foundation` | 36 | 779 |
| `feat/backend-review-pagination-main` | 20 | 154 |
| `feat/curated-course-source-integration` | 77 | 0 |
| `feat/frontend-architecture-audit` | 10 | 721 |
| `feat/frontend-modular-foundation` | 56 | 445 |
| `feat/immutable-learning-events` | 16 | 19 |
| `feat/immutable-learning-events-mainline` | 18 | 0 |
| `feat/minimal-app-foundation` | 1 | 777 |
| `feat/open-learning-content-module` | 65 | 0 |
| `feat/telegram-learning-experience` | 10 | 721 |
| `feat/telegram-start-mini-app-launch` | 3 | 28 |
| `feat/telegram-webhook-dev` | 0 | 34 |
| `fix/author-version-pagination-order` | 9 | 0 |
| `fix/backend-npm10-vitest-install` | 5 | 0 |
| `fix/backend-p0-correctness` | 0 | 707 |
| `fix/telegram-mini-app-url-config` | 14 | 0 |
| `fix/telegram-webhook-reapply-secret` | 2 | 33 |
| `fix/telegram-webhook-reapply-secret-v2` | 0 | 31 |
| `infra/cloudflare-dev-wrangler` | 2 | 154 |
| `infra/cloudflare-free-tier-foundation` | 117 | 0 |
| `integration/branch-consolidation` | 0 | 558 |
| `integration/complete-branch-consolidation-2026-11` | 6 | 0 |

Summary: 32 non-main branches; 26 ahead of main; 6 with zero ahead; 16 diverged; 10 ahead-only; 6 behind-only. The sum of ahead counts is 521 and double-counts shared commits across branches, so it is not a unique-change count. Branch distances are ancestry metrics, not merge-readiness assessments.

## Addendum — exact-head refresh (2026-11-28 10:57 +03:30)

This section supersedes earlier status statements above where they refer to old branch tips, old CI attempts, or pre-refresh dispositions. It is a snapshot, not a claim that later branch movement cannot occur.

### Main and active pull requests

- Repository identity and write permission were rechecked for `bijanbijane/EnglishCodeApp`.
- `main` remains at `f3671f2194e562fc194d23e9602b768455d8e483`.
- PR #28 is open, non-Draft, mergeable, targets main, and is 25 commits ahead / 0 behind. Its current head is `e8823293853fb08876b4cc2df8dc8c2f0af93f9c`.
- PR #28 exact-head Backend CI run [#46120470480](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/46120470480) completed successfully. npm 10.9.2 install, dependency audit, TypeScript, Vitest, SQLite verification, Wrangler Local D1 integration and Development API smoke all passed. No human review is recorded. The curriculum remains a partial A1 foundation: 45 lessons / 180 MCQ recognition items, not complete four-skill A1.
- PR #24 is open Draft at `c9c4c87a9c481e311d9ab72f16908f47f8bc7c59`; Backend CI #46115550576 passed on that exact head.
- PR #25 is open Draft at `64f0b4c63d56a92d4ee4cedceed5a856949c9aef`; Backend CI #46115705935 passed on that exact head. It remains the selected candidate for migration `0016`; no remote migration was run.
- PR #26 is open Draft at `4f1a775e02a2a38f1ed80e16aa6947358ccfd703`; its refreshed Backend CI #46120645652 passed on that exact head, including the colon-delimited lesson-version cursor regression.
- PR #20 remains open Draft at `dd5976a47ef680af8a2ba5a242939827b5ffde93`. Backend and Frontend CI passed on that exact head (runs #46119415319 and #46119415305); device testing and account-level Workers AI usage/billing review remain blockers. Its migration `0017` depends on #25's `0016`.
- PR #21 remains open Draft at `13a8984639555b7f2b0f05a447b8f4b83d51f319`; Backend #46116867108 and Frontend #46116867112 passed. Carryword remains an AI-assisted draft requiring human editorial verification.
- PR #22 remains open Draft at `d5099790751b51497b1e2f314a1a91b526cff11c`, stacked on PR #21's older base. Its recorded Backend #46116791489 and Frontend #46116791486 checks passed on its head, but client-imported answer keys/client-side grading remain a hard architecture blocker. Do not merge as assessed learning content.
- PR #23 remains open Draft at `c85e0dac6c5fb9701bfaed5d35afbfc4b7badff4`; Backend CI #46065261063 failed during npm install with npm 10 Arborist `edgesOut` resolver error. Test steps did not run. Its workflow still needs the validated npm 10.9.2 / legacy-peer workaround and a fresh exact-head CI run.
- PR #27 remains open Draft at `a15a662d06ad62bbd44097d8a9d44a9681c5abd2`; Backend CI #46115736975 passed. Its dependency/CI changes overlap #24 and #28; avoid integrating duplicate fixes.
- PR #29 is this documentation-only audit, open Draft at `a4e2e8eadff2707f7f234909aa9c1c137e38c299`, 7 commits ahead / 0 behind main. Its single changed file is this audit document. No source branch is merged by this PR.

### Integration sequence and approval gates

1. PR #24 (Telegram URL configuration) and PR #26 (author-version pagination) are main-based, no-migration candidates with green exact-head CI. They still require human review and owner approval before integration.
2. PR #25 is the sole selected migration `0016` candidate. It must be reviewed as an additive schema/data change; PR #19 is the competing implementation and must not be combined with it.
3. PR #20 migration `0017` can only be considered after #25's `0016` path is selected and the resulting chain is revalidated. Device and Cloudflare account usage/billing gates remain open.
4. PR #28 is a separate content/seed candidate; its seeds assume migrations `0001`–`0015` and the demo seed, and its local checks passed. It does not require a new schema migration. Human pedagogical review remains necessary.
5. PR #21/#22 require editorial/license review; #22 additionally requires server-authoritative grading redesign.
6. PR #23 needs the npm CI workaround and rerun. PR #27 is redundant if the equivalent dependency fix is integrated through #24 or #28.

### Safety and unperformed actions

- No PR was merged or closed; no branch was deleted or force-pushed.
- No remote D1 migration, remote seed, Worker secret/config mutation, Production deployment, billing change or paid-resource activation was performed.
- All CI evidence above is exact-head evidence for the named SHA only. Recheck after any branch update.


## Addendum — exact-head refresh (2026-11-28, after 11:00 +03:30)

This addendum supersedes the earlier PR #23 and PR #28 head/check statements above where they conflict.

### PR #28 — A1 Foundations

- Refreshed PR head: `b460c2434af8e88461c0c2f4da2afbd3d0a2dbc2`, branch `feat/a1-foundations-curriculum`.
- Current comparison against main `f3671f2194e562fc194d23e9602b768455d8e483`: 26 commits ahead, 0 behind.
- Exact-head Backend CI run [#46121390869](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/46121390869) completed successfully. All substantive steps passed: npm 10.9.2 installation, legacy-peer dependency installation, moderate-level npm audit, TypeScript typecheck, Vitest, SQLite migration/seed verification, Wrangler Local D1 integration and Development API smoke test.
- The PR contains nine original A1 units, 45 lessons and 180 deterministic multiple-choice items. Seed idempotency and public answer-key omission are included in automated checks.
- Pedagogical review confirms that the lesson guides describe communicative tasks, but the committed executable assessment data is multiple-choice recognition only. Listening, integrated reading, productive speaking/writing, rubrics and cumulative assessment remain unimplemented. Keep the scope described as a partial A1 foundation, not a complete A1 course.
- No human review, merge, remote seed, remote migration or deployment was performed.

### PR #23 — backend documentation and CI

- Refreshed PR head: `108985dbde2a25e942116938396d79d0e85abb50`, branch `docs/backend-status-refresh-2026-11-27`.
- Current comparison against main: 20 commits ahead, 0 behind.
- Exact-head Backend CI run [#46121421772](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/46121421772) completed successfully. npm 10.9.2 install, legacy-peer install, moderate-level audit, typecheck, Vitest, SQLite verification, Wrangler Local D1 integration and Development API smoke all passed.
- The previous npm Arborist `edgesOut` install failure was addressed on this branch with the pinned npm 10.9.2 / `--legacy-peer-deps` workflow path. This is a CI workaround; it bypasses npm's automatic peer-dependency resolution and should remain documented as such.
- PR #23 remains Draft and unmerged. No main documentation or runtime code was changed by this refresh.

### Audit safety

- Main remains at `f3671f2194e562fc194d23e9602b768455d8e483`.
- PR #29 remains a documentation-only Draft candidate. This addendum does not authorize merging PR #23, PR #28 or any other branch.
- No remote D1 write, Worker configuration/secret mutation, Production deployment, branch deletion or history rewrite was performed.


## Addendum — PR #25 exact-head review and backfill verification (2026-11-28)

- PR #25 current code head: `c6af8eef95788eb4a199eb1dc5f388d9e473d6ad`; 20 commits ahead / 0 behind main. A subsequent documentation-only commit `facb4e2882caa030aa9a00b9653bd8650ae9afd0` reconciles the implementation plan and PR description.
- Exact-head Backend CI run [#46122389777](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/46122389777) passed all substantive steps: npm 10.9.2 install, dependency audit (0 vulnerabilities), typecheck, Vitest (20 files / 80 tests), SQLite verification, Wrangler Local D1 integration, and Development API smoke.
- The SQLite verifier now creates a synthetic completed attempt before applying migration 0016 and asserts the migrated event ID, user, type, lesson, score, completion timestamp and lesson-version payload. This closes the previously identified migration-backfill test gap for SQLite compatibility.
- Local D1 integration separately verifies concurrent completion, exactly-once progress, event count/idempotency, pre-existing-event conflict behavior, direct-delete rejection and user-delete cascade.
- Static review confirms the D1 batch order is conditional attempt update → progress projection gated by the immediately preceding `changes() = 1` → immutable event append → final read. This avoids coupling progress correctness to event-insert row count.
- Remaining limitation: `database/maintenance/rebuild_user_progress_from_events.sql` is explicitly SQLite-only. A D1-compatible deterministic progress rebuild procedure remains unimplemented.
- PR #25 remains Draft, open and unmerged; no human review is recorded. Migration 0016 has not been applied to any remote database. No deployment, remote seed, Worker secret/config mutation, production data change, or merge was performed.
