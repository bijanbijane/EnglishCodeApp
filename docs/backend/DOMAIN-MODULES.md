# Backend Domain Modules and API Boundaries

This is the module-level implementation contract for Architecture v3. Planned means not implemented.

## Status snapshot

| Module | Current state | Target responsibility |
|---|---|---|
| Auth | Partial | Provider verification and session lifecycle |
| Identity | Missing | Internal users and provider identity mapping |
| Profiles | Minimal /me | Preferences, locale, account lifecycle |
| Content | Basic lesson/question reads | Immutable versioned content and publishing |
| Assessment | Basic attempt/answer/complete | Versioned policies, grading and results |
| Progress | Basic per-lesson aggregate | Rebuildable skill/mastery projections |
| Vocabulary | Missing | Lexicon and user vocabulary |
| Review | Missing | Versioned spaced-repetition scheduler |
| Skills | Missing | Listening/speaking/reading/writing evidence |
| Media | Missing | Private assets, upload lifecycle and retention |
| Jobs | Missing | Outbox, async job state and idempotent consumers |
| Integrations | Telegram login only | Bot webhook and external adapters |
| Entitlements | Missing | Central action-level access policy |
| Administration | Missing | RBAC, content review/publish, audit |
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
- GET /attempts/:attemptId/result
- GET /me/attempts?cursor=...
All routes enforce ownership and pinned content/policy versions. Result DTO is immutable after completion except explicitly versioned manual review.

Progress:
- GET /me/progress
- GET /me/skills
- GET /me/learning-history?cursor=...
Progress is a projection from immutable facts and can be rebuilt deterministically.

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
- GET /admin/audit
- GET /admin/users/:userId (minimum necessary data)
- Content author/reviewer/publisher operations.
Every admin endpoint requires explicit permission and records an audit event. Support role must not grant arbitrary content or account mutation.

Analytics:
- POST /events only for allowlisted event types, bounded payload schemas and purpose tags.
- Aggregation jobs write aggregate tables; raw event retention is short and defined.
- No raw audio, auth material, full free-text answers or precise location in analytics.

## Module implementation order

1. Stabilize auth/learning P0 with executable CI and Local D1 integration.
2. Introduce provider-neutral identity with a forward-only backfill migration.
3. Add content versioning and immutable attempt references.
4. Add assessment policy and attempt state machine.
5. Add rebuildable progress facts/projections.
6. Add vocabulary + review scheduler.
7. Add skill-specific learning records.
8. Add media/job/outbox only when audio workflow is ready.
9. Add RBAC/audit before admin routes.
10. Add entitlements and analytics after privacy policy and product rules.

## Cross-module invariants

- Every user-owned row has ownership predicate and foreign key.
- Every write endpoint validates body and has replay/idempotency semantics.
- Every public content response is allowlisted and excludes secrets/answer keys.
- Every result pins content and policy versions.
- Every privileged mutation is audited.
- Every async job has owner, purpose, status, expiry, retry policy and idempotency key.
- Every personal-data class has purpose, retention, deletion and access policy.
