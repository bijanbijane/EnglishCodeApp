# Backend API Contract — v1

Base path: `/api/v1`

All timestamps are UTC ISO-8601 strings. All endpoints return JSON.

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

The API must not return stack traces, SQL text, secrets, session tokens, or private answer keys in error or public content responses.

## Implemented endpoints

| Method | Path | Auth | Purpose | State |
|---|---|---|---|---|
| GET | `/health` | Public | Liveness | Implemented |
| GET | `/ready` | Public | D1 readiness | Implemented |
| GET | `/courses` | Public | Published course catalog | Implemented |
| GET | `/courses/:courseId/lessons` | Public | Published lessons in a course | Implemented |
| GET | `/lessons/:lessonId` | Public | Published lesson and question DTOs | Implemented |
| POST | `/auth/logout` | Bearer session | Revoke current session | Implemented; login issuance remains blocked |
| GET | `/me` | Bearer session | Current profile | Implemented; login issuance remains blocked |
| POST | `/lessons/:lessonId/attempts` | Bearer session | Start attempt and pin lesson version | Implemented; D1 integration unverified |
| POST | `/attempts/:attemptId/answers` | Bearer session | Validate and grade answer on server | Implemented; D1 concurrency unverified |
| POST | `/attempts/:attemptId/complete` | Bearer session | Complete attempt and update progress in one D1 batch | Implemented; atomicity unverified |
| GET | `/me/progress` | Bearer session | Current user's lesson progress | Implemented; D1 integration unverified |

## Planned endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/telegram` | Public, signed initData required | Validate Telegram launch data, prevent replay, and issue application session |

## Content and assessment invariants

- Only records with `status = 'published'` are returned by public catalog routes.
- Public question DTOs select an explicit allowlist of columns and never select `answer_key`.
- User ownership is derived from the authenticated principal, never from request JSON.
- Answers are unique per attempt/question. Repeating the same answer returns the stored result; a different second answer returns 409.
- Answer writes require an in-progress attempt and the question must belong to that attempt's lesson.
- Completion is a conditional state transition. Progress increment is conditional on the winning update in the same D1 batch; this requires a Local D1 concurrency test before production use.
- Attempts pin the lesson version at creation. Published lesson content must remain immutable for that version.

## Authentication invariants

- The Telegram HMAC verifier is implemented and covered by a static test vector, but is not yet exposed as a login endpoint.
- Opaque bearer token generation, SHA-256 token hashing, active-session lookup, revocation, middleware, `/auth/logout`, and `/me` are implemented.
- Session issuance must be atomic with replay protection before the login route is enabled.
- Raw Telegram initData and raw session tokens must never be persisted or logged.

## Compatibility policy

Changes to response shape require an explicit API compatibility decision. Additive optional fields are preferred; breaking changes require a new API version or a documented migration window.
