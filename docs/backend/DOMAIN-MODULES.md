# Backend Domain Modules and API Boundaries

This is the module-level implementation contract for Architecture v3. Planned means not implemented.

## Status snapshot

| Module | Current state | Target responsibility |
|---|---|---|
| Auth | Telegram initData verification, replay-safe session issue/revoke | Provider verification and session lifecycle |
| Identity | Provider-neutral user_identities mapping and legacy backfill | Internal users and secure provider linking |
| Profiles | Minimal /me | Preferences, locale, account lifecycle |
| Content | Immutable versioned snapshots, draft authoring and protected review/publish workflow | Rich content types, bulk authoring, ETag/If-Match and localization |
| Assessment | Pinned lesson/policy attempts, weighted grading and immutable attempt_results | Rich item types, policy governance and manual review |
| Progress | Append-only completion facts and atomic per-user projection rebuild | Rebuildable skill/mastery projections |
| Vocabulary | User enrollment, list and due queue | Curated lexicon and user vocabulary |
| Review | Deterministic scheduler v1 and idempotent review API | Scheduler policies and mastery state |
| Skills | Missing | Listening/speaking/reading/writing evidence |
| Media | Missing | Private assets, upload lifecycle and retention |
| Jobs | Missing | Outbox, async job state and idempotent consumers |
| Integrations | Telegram login only | Bot webhook and external adapters |
| Entitlements | Missing | Central action-level access policy |
| Administration | RBAC middleware, audit writer, content draft/review/publish routes and review queue/detail | Role bootstrap/management, audit queries and broader admin console |
| Analytics | Missing | Purpose-limited aggregate product metrics |

## Route conventions

All routes use /api/v1. New route groups are registered from app.ts; domain modules do not import the global app.

Identity/profile:
- GET /me — current principal, minimal profile.
- PATCH /me — allowlisted profile fields only; no provider subject changes.
- GET /me/sessions — current user's active sessions, without token material.
- DELETE /me/sessions/:sessionId — revoke an owned session.
- DELETE /me — request account deletion; asynchronous workflow after retention/legal policy is approved.

Content:
- GET /courses
- GET /courses/:courseId
- GET /lessons/:lessonId
- GET /lessons/:lessonId/questions
- GET /admin/content/drafts
- POST /admin/content/.../versions
- POST /admin/content/.../submit-review
- POST /admin/content/.../publish
Publication requires reviewer/publisher permission, immutable version creation and audit record. Author cannot approve own content unless policy explicitly allows it.

Assessment:
- POST /lessons/:lessonId/attempts
- GET /attempts/:attemptId
- POST /attempts/:attemptId/answers
- POST /attempts/:attemptId/complete
- GET /attempts/:attemptId/result — reads immutable attempt_results facts (score, earned/total weight, counts and pinned versions).
- GET /me/attempts?cursor=...
All routes enforce ownership and pinned content/policy versions. Result DTO is immutable after completion except explicitly versioned manual review.

Progress:
- GET /me/progress
- GET /me/skills
- GET /me/learning-history?cursor=...
Progress is a projection from immutable progress_events and can be rebuilt per user with modules/progress/rebuild.ts.

Vocabulary/review:
- GET /vocabulary?languagePair=...&cursor=...
- POST /me/vocabulary
- GET /me/reviews/due?limit=...
- POST /me/reviews/:itemId
- GET /me/vocabulary/:itemId
Review submissions require idempotency key; schedule computation is deterministic and stores scheduler version.

Four skills:
- Listening: read lesson audio/transcript version and submit comprehension attempts.
- Speaking: request upload authorization, complete upload, create feedback job, retrieve feedback.
- Reading: version-pinned text and comprehension attempts.
- Writing: submit text, retrieve rubric-based feedback job.
AI-generated feedback is advisory by default and cannot silently alter formal scores.

Media/jobs:
- POST /media/upload-intents
- POST /media/:assetId/complete
- GET /media/:assetId
- GET /jobs/:jobId
- POST /jobs/:jobId/cancel
Only private R2 objects. Upload intent binds owner, max bytes, MIME/codec allowlist and expiry. Job creation writes durable outbox record before queue delivery.

Entitlements: internal application service authorize(userId, action, context). Do not trust client-provided plan. Unknown state denies paid/restricted operations but must not block free learning.

Administration/audit:
- GET /admin/audit (planned)
- GET /admin/users/:userId (planned; minimum necessary data)
- POST /admin/content/lessons/:lessonId/versions (content_author)
- GET /admin/content/reviews (content_reviewer)
- POST /admin/content/reviews/:requestId/decision (content_reviewer)
- POST /admin/content/reviews/:requestId/publish (admin)
Every implemented privileged mutation requires explicit permission and writes an audit event in the same D1 batch. Support role does not grant content or account mutation.

Analytics:
- POST /events only for allowlisted event types, bounded payload schemas and purpose tags.
- Aggregation jobs write aggregate tables; raw event retention is short and defined.
- No raw audio, auth material, full free-text answers or precise location in analytics.

## Module implementation order

1. Obtain hosted GitHub Actions runner evidence; local typecheck, 49 tests, build and Local D1 gates are green.
2. Complete deterministic stale-review concurrency and cross-user ownership matrices.
3. Implement role bootstrap/revocation as a controlled owner-only operation and wire audit writer into privileged service commands.
4. Extend the implemented content draft/review/publish API with ETag/If-Match, bulk authoring, rejection revision workflow and stronger concurrency tests.
5. Add explicit assessment policy lifecycle, pass/retry/manual-review rules and reconciliation runbook.
6. Add listening/reading/writing/speaking records with versioned rubrics.
7. Add media/R2 and Queue/outbox only after consent, retention and deletion policy.
8. Add entitlements and privacy-minimal analytics after product rules are approved.

## Cross-module invariants

- Every user-owned row has ownership predicate and foreign key.
- Every write endpoint validates body and has replay/idempotency semantics.
- Every public content response is allowlisted and excludes secrets/answer keys.
- Every result pins content and policy versions.
- Every privileged mutation is audited.
- Every async job has owner, purpose, status, expiry, retry policy and idempotency key.
- Every personal-data class has purpose, retention, deletion and access policy.
