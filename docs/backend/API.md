# Backend API contract — v1

Base path: /api/v1. All payloads are JSON. Errors use { "error": { "code", "message", "requestId" } }. Success uses { "data": ... } and may include meta.

## Authentication and identity
- POST /auth/telegram — accepts raw Telegram.WebApp.initData, verifies HMAC/freshness, claims replay fingerprint and issues opaque bearer session.
- POST /auth/logout — revokes current bearer session.
- GET /me — authenticated minimal profile.
- GET /me/progress — up to 100 recent progress rows.

Verified Telegram login ensures a provider-neutral identity row (provider=telegram, provider_subject=Telegram user ID) maps to immutable internal users.id. Account linking and account merge are not implemented.

## Learning and versioned assessment
- GET /lessons — published lesson list from current immutable lesson versions.
- GET /me/attempts?limit=20&cursor=... — authenticated keyset-paginated history for the current user.
- GET /attempts/:attemptId — owned attempt metadata; cross-user IDs return 404.
- GET /attempts/:attemptId/result — reads the immutable result fact for the owner; returns score, earned/total weight, correct/question counts and pinned policy/content version; returns 409 until a result fact exists.
- GET /lessons/:lessonId/questions — public question array; response retains the existing data array and adds meta.lessonVersion. answer_key is never returned.
- POST /lessons/:lessonId/attempts — authenticated; creates attempt pinned to current lesson_version_id and assessment_policy_version_id.
- POST /attempts/:attemptId/answers — body { "questionId": "...", "answerId": "..." }. Server grades against the question version pinned to the attempt. Same answer retry returns stored result; a different second answer returns 409.
- POST /attempts/:attemptId/complete — computes weighted percentage against the pinned question version, writes one immutable result and one append-only progress event, then updates the rebuildable progress projection in the same D1 batch.

Migration 0006 backfills version 1 from existing lessons/questions and installs immutability triggers for published content. Migration 0008 backfills immutable result facts and progress events for existing completed attempts, rebuilds user_progress from those facts, and blocks UPDATE/DELETE of result/event rows. Migration 0009 adds the protected draft/review/publish workflow, records authorship and review events, and blocks self-review; new versions must not be inserted into a published version.

## Vocabulary and spaced repetition
- GET /me/vocabulary?limit=50 — current user's vocabulary state; limit 1..100.
- POST /me/vocabulary/:itemId — enrolls authenticated user in a published vocabulary item; idempotent.
- GET /me/reviews/due?limit=20 — returns due learning/review/mastered items; limit 1..100.
- POST /me/reviews/:itemId — body { "rating": 0|1|2|3, "idempotencyKey": "..." }. Rating 0=again, 1=hard, 2=good, 3=easy. Scheduler v1 is deterministic and SM-2-inspired, not a scientific optimality claim. Optimistic revision prevents stale concurrent writes; a distinct concurrent review may return 409 REVIEW_CONFLICT.

Vocabulary content is currently seeded/managed outside the public API.

## Content administration and review

All endpoints below are under `/api/v1/admin` and require an authenticated session plus the listed server-side role. No public role-grant endpoint exists.

- POST /content/lessons/:lessonId/versions — `content_author`; creates a draft version with 1..100 questions. Each question accepts an existing `sourceQuestionId` from the same lesson or creates a new canonical question. The answer key is accepted only on this protected route.
- GET /content/lessons/:lessonId/versions — `content_author`; lists the current author's versions for that lesson and their review status.
- POST /content/lessons/:lessonId/versions/:versionId/submit-review — `content_author`; submits an authored draft for review.
- GET /content/reviews?status=pending&limit=20 — `content_reviewer`; lists the review queue.
- GET /content/reviews/:requestId — `content_reviewer`; reads review details, including private answer keys.
- POST /content/reviews/:requestId/decision — `content_reviewer`; body `{ "decision": "approve"|"reject", "reasonCode": "..." }`. The author cannot review their own content.
- POST /content/reviews/:requestId/publish — `admin`; publishes only a reviewer-approved version and updates the lesson's published pointer.

Review decisions, publication, draft creation and audit writes are executed in transactional D1 batches. Review events and admin audit events are append-only. A rejected version is not resubmitted; create a new draft version. Published lesson/question versions remain immutable.

## Health
- GET /health — process liveness; does not prove database connectivity.
- GET /ready — lightweight D1 query, 503 if unavailable.

## Status codes
- 200 success or idempotent replay
- 201 new attempt or first vocabulary enrollment
- 400 invalid body/query
- 401 missing/invalid/expired session or Telegram data
- 403 authenticated user lacks role or attempts self-review
- 404 route/resource/not-enrolled item
- 409 replay, answer after completion, conflicting answer, review/publish state conflict or idempotency-key reuse
- 503 required storage/auth configuration unavailable

## Not implemented
No public role-grant/bootstrap API, audit query API, account linking/merge, payments, subscriptions, AI tutor, media upload, Queue consumer, account deletion workflow or production deployment. Protected content author/reviewer/admin routes exist, but the workflow still needs idempotent command keys and a role-management process.


## Admin read APIs — backend continuation

### Reviewer queue

`GET /api/v1/admin/content/reviews?status=pending&limit=20&cursor=...`

- Authentication: Bearer session + `content_reviewer` role.
- Supported statuses: `pending`, `approved`, `rejected`, `published`.
- Page size: 1–50; default 20.
- Stable keyset order: `submitted_at ASC, id ASC`.
- Response includes `data` and `meta.nextCursor`; pass the cursor unchanged to continue the same filtered query.
- Invalid cursor, status or limit returns `400 INVALID_REVIEW_QUERY`.

### Audit event feed

`GET /api/v1/admin/audit?limit=25&action=content.version.published&resourceType=lesson_version&cursor=...`

- Authentication: Bearer session + `admin` role. Reviewers and authors do not receive audit access.
- Page size: 1–50; default 25.
- Optional exact-match filters: `action` and `resourceType`.
- Stable keyset order: `created_at DESC, id DESC`.
- Only minimal audit identifiers and allowlisted metadata are returned; user submissions, credentials, network addresses and free-form content are not part of this API.
- Response includes `data` and `meta.nextCursor`.
- Invalid filters, cursor or limit returns `400 INVALID_AUDIT_QUERY`.
