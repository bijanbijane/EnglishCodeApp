# Backend API contract — v1

Base path: /api/v1. All payloads are JSON. Errors use { "error": { "code", "message", "requestId" } }. Successful resources use { "data": ... }.

## Authentication and identity
- POST /auth/telegram — accepts raw Telegram.WebApp.initData, verifies HMAC/freshness, claims replay fingerprint and issues opaque bearer session.
- POST /auth/logout — revokes current bearer session.
- GET /me — authenticated minimal profile.
- GET /me/progress — up to 100 recent progress rows.

Verified Telegram login now also ensures a provider-neutral identity row (provider=telegram, provider_subject=Telegram user ID) maps to the immutable internal users.id. Account linking and account merge are not implemented.

## Learning
- GET /lessons — published lesson list, ordered by position.
- GET /lessons/:lessonId/questions — public question prompts/options. answer_key is never returned.
- POST /lessons/:lessonId/attempts — authenticated; creates attempt.
- POST /attempts/:attemptId/answers — body { "questionId": "...", "answerId": "..." }. Server grades answer. Same answer retry returns the stored result; a different second answer returns 409.
- POST /attempts/:attemptId/complete — finalizes attempt and updates progress conditionally.

## Vocabulary and spaced repetition (implemented in v1 branch)
- GET /me/vocabulary?limit=50 — current user's vocabulary state; limit 1..100.
- POST /me/vocabulary/:itemId — enrolls the authenticated user in a published vocabulary item; idempotent.
- GET /me/reviews/due?limit=20 — returns due learning/review/mastered items; limit 1..100.
- POST /me/reviews/:itemId — body { "rating": 0|1|2|3, "idempotencyKey": "..." }. Rating 0=again, 1=hard, 2=good, 3=easy. Scheduler v1 is deterministic and SM-2-inspired, not a scientific optimality claim. Concurrent distinct reviews use optimistic revision and may return 409 REVIEW_CONFLICT.

Vocabulary content is currently seeded/managed outside the public API. No public content-authoring endpoint exists.

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
No admin API, account linking/merge, payments, subscriptions, public profile, AI tutor, media upload, Queue consumer, content version authoring or production deployment.
