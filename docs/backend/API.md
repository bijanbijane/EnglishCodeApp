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
| POST | `/auth/logout` | Bearer session | Revoke current session | Implemented; requires a session issued by the not-yet-built login flow |
| GET | `/me` | Bearer session | Current profile | Implemented; requires a session issued by the not-yet-built login flow |

## Planned endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/telegram` | Public, signed initData required | Validate Telegram launch data, prevent replay, and issue application session |
| GET | `/me/progress` | Session | Current user's progress |
| POST | `/lessons/:lessonId/attempts` | Session | Start attempt |
| POST | `/attempts/:attemptId/answers` | Session | Submit answer; grade on server |
| POST | `/attempts/:attemptId/complete` | Session | Complete attempt and update progress |

## Content security invariants

- Only records with `status = 'published'` are returned by public catalog routes.
- Public question DTOs select an explicit allowlist of columns and never select `answer_key`.
- Future write endpoints must derive user ownership from the authenticated principal.
- Scoring policy and content version must be pinned to an attempt before assessment expands beyond basic multiple choice.

## Authentication invariants

- The Telegram HMAC verifier is implemented and covered by a static test vector, but is not yet exposed as a login endpoint.
- Opaque bearer token generation, SHA-256 token hashing, active-session lookup, revocation, middleware, `/auth/logout`, and `/me` are implemented.
- Session issuance must be atomic with replay protection before the login route is enabled.
- Raw Telegram initData and raw session tokens must never be persisted or logged.

## Compatibility policy

Changes to response shape require an explicit API compatibility decision. Additive optional fields are preferred; breaking changes require a new API version or a documented migration window.
