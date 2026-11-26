# Local verification record — 2026-11-26

**Repository branch:** `feat/backend-architecture-v3`
**Target:** Local macOS Node 26 + Wrangler 4.168.0 + Local D1.
**Data:** Synthetic test users/content only.
**Remote/production:** Not accessed or modified.

## Reproducible workspace gates

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Passed |
| `npm run typecheck` | Passed; frontend and backend |
| `npm test` | Passed; 13 files / 49 tests on latest run |
| `npm run build:frontend` | Passed |
| `git diff --check` | Passed |

An initial typecheck found missing Node type declarations and a WebCrypto `BufferSource` typing incompatibility. Added `@types/node` and copied HMAC key bytes into an ArrayBuffer-backed view. The first unit run then found incomplete test doubles for provider identity persistence and an Hono test that omitted the empty env object; both test fixtures were corrected. The complete suite then passed.

## Fresh Local D1 install

Using Wrangler with the explicit `--local` flag:
- `npm run db:migrate:local`
- Applied migrations 0001 through 0009 successfully.
- D1 migration registry reported no pending migrations.

## Upgrade/backfill path

A second isolated Local D1 database was initialized with migration 0001 only. Synthetic legacy rows were inserted:
- user `legacy-user-1`, Telegram subject `legacy-telegram-1`;
- published lesson `legacy-lesson-1`;
- one question;
- one completed attempt `legacy-attempt-1`.

Migrations 0002 through 0008 then applied successfully. A join query confirmed:
- provider mapping `telegram / legacy-telegram-1` belongs to the original internal user ID;
- lesson content version 1 exists;
- old attempt references `legacy-lesson-1:v1`;
- assessment policy reference is `percentage-v1`.

## Actual Worker + Local D1 request tests

Wrangler Worker ran at localhost with a dummy local bot token and Local D1 binding. `/api/v1/ready` and `/api/v1/health` both returned 200.

| Scenario | Observed result |
|---|---|
| Two simultaneous login requests with identical signed initData | 200 + 409; exactly one session issued |
| Published lesson read and public question DTO | 200; no answer_key field |
| Attempt start | 201 |
| Correct answer | 200; server returned isCorrect=true |
| Weighted score with one correct of two questions | 50 |
| Repeat completed attempt request | 200; progress completion count did not increment again |
| Answer racing completion | one request won according to transaction order; completion returned 200 |
| New answer after completion | 409 ATTEMPT_NOT_ACTIVE |
| Retry of the same previously stored answer after completion | 200; stored answer returned idempotently |
| Retry with a different answer after completion | 409 ANSWER_ALREADY_SUBMITTED |
| Concurrent completion calls for same attempt | both callers received 200; progress incremented once |
| Vocabulary enrollment | 200/201 depending on pre-existing enrollment |
| Same review idempotency key and same payload | 200 replay of existing event |
| Same idempotency key with different rating | 409 IDEMPOTENCY_KEY_REUSED |
| Two distinct review requests | both accepted sequentially by local D1 in this run |

The review race was serialized in this local runtime; this does not prove the stale-revision conflict branch under every distributed timing. That branch still needs a deliberately synchronized concurrency test.

## Important limits

- Wrangler Local D1 is a local emulator/runtime path, not Cloudflare remote D1.
- No production migration, secret, deployment or Cloudflare resource mutation was performed.
- Initial cross-user checks now cover attempt metadata/result/answer/completion/history and author ownership of drafts; the full endpoint/role matrix, load/abuse test, browser Telegram WebView matrix and backup/restore drill remain incomplete.
- GitHub Actions jobs still fail before exposing step details/logs. The same checks have been run locally; hosted runner failure remains separately unresolved.
- The temporary local seed and request scripts are under ignored `tmp/`; they are not part of the application source.

## Next gates

1. Obtain hosted GitHub Actions evidence; the lockfile and `npm ci` workflow are already committed on the feature branch.
2. Add a deterministic test for stale review revision and same-key concurrent replay.
3. Expand the initial ownership suite to every content, review, vocabulary and admin endpoint.
4. Implement content authoring/review/publish only after admin RBAC and append-only audit.
5. Add account deletion/export and retention rules before media collection.

## G3 result facts and rebuildable progress — 2026-11-26

### Code and migration
- Added migration `0008_immutable_results_progress_events.sql` after the existing RBAC/audit migration 0007.
- `attempt_results` stores immutable score, earned/total weight, correct/question counts, lesson version, policy version and completion timestamp.
- `progress_events` stores one append-only completion event per attempt.
- Migration backfills completed attempts, creates corresponding events, then rebuilds `user_progress` from events.
- Completion now writes the result fact, event and projection in one D1 batch. Repeated completion does not duplicate either fact.
- Added `rebuildUserProgress` service. Its delete/reinsert projection work is one D1 batch scoped to a single user.
- Added role-check middleware and constrained audit writer; protected content author/reviewer/admin routes now exist. No public role-grant endpoint exists.
- Migration 0009 and the complete content draft/review/publish flow were exercised on Worker + Local D1. Review events and audit facts were verified; public DTO remained answer-key free.

### Local D1 evidence
A fresh isolated Local D1 database applied migrations 0001..0009 in order. A second isolated database applied 0001..0007, then received a synthetic completed attempt and an intentionally stale progress projection before 0008 was applied. The post-migration query returned:
- result score 100, earned weight 1, total weight 1;
- correct count 1, question count 1;
- exactly one progress event for the attempt;
- rebuilt completion count 1, replacing the seeded stale count 99.

### Worker integration evidence
On a separate Local D1 Worker with a weighted two-question lesson:
- two correct answers with weights 2 and 1 produced score 100, earnedWeight 3, totalWeight 3, correctCount 2, questionCount 2;
- repeated completion returned 200 and the projection count remained one for that attempt;
- a second attempt with only the weight-2 question correct produced score 67 and earnedWeight 2 / totalWeight 3;
- two simultaneous completion requests returned 200; one result row and one event were stored;
- answer submission after completion returned 409;
- a direct UPDATE against `attempt_results` was rejected by the immutability trigger with `SQLITE_CONSTRAINT_TRIGGER`.

### Current workspace gate
- Typecheck: passed (frontend and backend).
- Backend tests: 12 files / 45 tests passed.
- Frontend production build: passed.
- `git diff --check`: passed.
- Remote D1, GitHub-hosted Actions, production deployment and production migrations were not run.

### Design constraint to resolve before account deletion
The immutable result/event facts use restrictive user references. Account deletion must be designed as an explicit retention-aware tombstone/pseudonymization process, or an approved erasure strategy that preserves integrity. Do not add a physical user-delete endpoint until legal/product retention rules and the treatment of result facts are decided.

## G2 content author/review/publish workflow — 2026-11-26

### Implemented
- Migration `0009_content_review_workflow.sql` adds lesson-version authorship, one review lifecycle per version and append-only review events.
- `content_author` creates a draft version with validated question payloads, lists their own versions and submits a draft for review.
- `content_reviewer` reads the review queue and private review detail (including answer keys), then approves/rejects with a constrained reason code.
- `admin` alone publishes approved versions and updates the lesson's published-version pointer.
- Authors cannot review their own versions (route guard and D1 trigger). Reviewers cannot publish. No public role-grant route exists.
- Draft creation, submit, reviewer decision and publish each include the corresponding admin audit insert in the same D1 batch.

### Actual Worker + Local D1 flow
Using synthetic Telegram users with distinct author-only, reviewer-only and admin roles (plus a deliberate author+reviewer combination to test self-review):
1. An ordinary authenticated user without content role attempted draft creation — 403.
2. Author created lesson version 2 with two weighted questions — 201.
3. Author submitted the draft for review — 201.
4. The same author, even when also holding reviewer role, attempted to approve their own draft — 403 SELF_REVIEW_FORBIDDEN.
5. Separate reviewer approved the draft — 200.
6. Admin published the approved version — 200; public lesson list switched to version 2 and public question DTO omitted answer_key.
7. Author version list returned the author's draft/version history — 200.
8. Reviewer queue and review detail returned 200; reviewer detail included private answer keys as required for assessment.
9. Author-only account was denied queue and detail access — 403; reviewer and author-only accounts were denied the admin publish route — 403.
10. Review history contained submitted/approved/published events; audit log contained content.version.created, content.review.submitted, content.review.approved and content.version.published.
11. Direct UPDATE of the published question version was rejected by the published-content immutability trigger.

### Current workspace gate
- Typecheck: passed (frontend + backend).
- Backend tests: 12 files / 45 tests passed.
- Frontend production build: passed.
- `git diff --check`: passed.
- Local D1 migrations 0001..0009 applied sequentially in the isolated test database.
- No remote/production migration or deployment was run.

### Remaining content administration work
- Role bootstrap/revocation and owner recovery procedure; no role-grant API is exposed.
- Admin audit query/export and retention controls.
- Content authoring update/edit endpoints for existing rejected drafts; current policy is to create a new version after rejection.
- Cross-role permission matrix and adversarial tests beyond the core happy path.

### Additional answer retry semantics
After a completed attempt, an identical retry for an answer already stored returns the original answer result (200); a conflicting answer for that question returns 409; a previously unanswered question returns 409. This was exercised on the actual Worker + Local D1 after the content v2 publication.
