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
- GET /attempts/:attemptId/result — owned completed result; returns 409 until completion.
- GET /lessons/:lessonId/questions — public question array; response retains the existing data array and adds meta.lessonVersion. answer_key is never returned.
- POST /lessons/:lessonId/attempts — authenticated; creates attempt pinned to current lesson_version_id and assessment_policy_version_id.
- POST /attempts/:attemptId/answers — body { "questionId": "...", "answerId": "..." }. Server grades against the question version pinned to the attempt. Same answer retry returns stored result; a different second answer returns 409.
- POST /attempts/:attemptId/complete — computes weighted percentage against the attempt's pinned question version and updates progress conditionally.

Migration 0006 backfills version 1 from existing lessons/questions and installs immutability triggers for published content. There is not yet a public authoring/review/publish API; new versions must not be inserted into a published version.

## Vocabulary and spaced repetition
- GET /me/vocabulary?limit=50 — current user's vocabulary state; limit 1..100.
- POST /me/vocabulary/:itemId — enrolls authenticated user in a published vocabulary item; idempotent.
- GET /me/reviews/due?limit=20 — returns due learning/review/mastered items; limit 1..100.
- POST /me/reviews/:itemId — body { "rating": 0|1|2|3, "idempotencyKey": "..." }. Rating 0=again, 1=hard, 2=good, 3=easy. Scheduler v1 is deterministic and SM-2-inspired, not a scientific optimality claim. Optimistic revision prevents stale concurrent writes; a distinct concurrent review may return 409 REVIEW_CONFLICT.

Vocabulary content is currently seeded/managed outside the public API.

## Health
- GET /health — process liveness; does not prove database connectivity.
- GET /ready — lightweight D1 query, 503 if unavailable.

## Status codes
- 200 success or idempotent replay
- 201 new attempt or first vocabulary enrollment
- 400 invalid body/query
- 401 missing/invalid/expired session or Telegram data
- 404 route/resource/not-enrolled item
- 409 replay, conflicting answer, idempotency-key reuse or concurrent review conflict
- 503 required storage/auth configuration unavailable

## Not implemented
No admin API, account linking/merge, payments, subscriptions, AI tutor, media upload, Queue consumer, content authoring/review/publishing, account deletion workflow or production deployment.
