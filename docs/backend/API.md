# Backend API Contract — v1

Base path: `/api/v1`. Timestamps are UTC ISO-8601. Success and error responses include a request ID.

## Public and authenticated endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| GET | `/ready` | Public | D1 readiness |
| GET | `/courses` | Public | Published course catalog |
| GET | `/courses/:courseId/lessons` | Public | Published lesson versions |
| GET | `/lessons/:lessonId` | Public | Published lesson and pre-answer question DTO |
| POST | `/auth/telegram` | Signed Telegram initData | Validate launch data, prevent replay, issue bearer session |
| POST | `/auth/logout` | Bearer session | Revoke current session |
| GET | `/me` | Bearer session | Current profile |
| POST | `/lessons/:lessonId/attempts` | Bearer session | Start attempt and pin published versions |
| GET | `/attempts/:attemptId` | Bearer session | Read own immutable attempt snapshot |
| POST | `/attempts/:attemptId/answers` | Bearer session | Validate and grade answer server-side |
| POST | `/attempts/:attemptId/complete` | Bearer session | Complete attempt and update progress |
| GET | `/me/progress` | Bearer session | Current user's progress |

## Role-protected administration

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/admin/content/lessons/:lessonId/versions` | content_author | Create draft lesson version |
| GET | `/admin/content/lessons/:lessonId/versions` | content_author | List own versions |
| POST | `/admin/content/lessons/:lessonId/versions/:versionId/submit-review` | content_author | Submit own draft |
| GET | `/admin/content/reviews` | content_reviewer | Bounded review queue |
| GET | `/admin/content/reviews/:requestId` | content_reviewer | Review details including private answer key |
| POST | `/admin/content/reviews/:requestId/decision` | content_reviewer | Approve or reject; self-review forbidden |
| POST | `/admin/content/reviews/:requestId/publish` | admin | Publish approved version |
| GET | `/admin/audit` | admin | Filtered keyset-paginated audit feed |

There is no public role-grant endpoint. First-admin bootstrap is owner-controlled and documented in `ADMIN-BOOTSTRAP.md`.

## Response envelopes

Success:

```json
{
  "data": {},
  "meta": { "requestId": "opaque-correlation-id" }
}
```

Error:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "opaque-correlation-id"
  }
}
```

The API never returns stack traces, SQL text, secrets, raw session tokens except once in the successful login response, or private answer keys in public content DTOs.

## Content and assessment invariants

- Public reads use the current published lesson version and its question versions.
- Public pre-answer DTOs omit answer keys and explanations.
- Reviewers may read answer keys only through the role-protected review detail endpoint.
- Attempts pin lesson and assessment policy versions; snapshots preserve question IDs, type, prompt, options, answer key, ordering and weight.
- Attempt ownership is derived from the authenticated principal.
- Same-answer retry returns the existing result; a different second answer returns 409.
- Only in-progress attempts accept answers.
- Weighted percentage scoring treats unanswered questions as incorrect.
- Completion/progress D1 atomicity requires real Local D1 race tests before production use.

## Authentication and abuse invariants

- Telegram HMAC-SHA-256 verification, freshness and duplicate-parameter checks are required.
- Replay fingerprint insertion and session creation are in one D1 batch; session insert is gated by `changes()=1`.
- Raw initData and raw session tokens are never persisted.
- Login limit: 30 requests per client IP per fixed UTC minute. The stored key is HMAC-derived; raw IP is not stored.
- API body limit is 256 KiB; Telegram login additionally enforces 20 KiB.
- CORS reflects only exact origins in `ALLOWED_ORIGINS`; wildcard and credentialed CORS are disabled.

## Compatibility

Prefer additive optional fields. Breaking response changes require a documented migration window or a new API version.
