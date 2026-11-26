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

The API must not return stack traces, SQL text, secrets, session tokens, or private answer keys in error or public content responses. The only endpoint that returns a raw session credential is the successful login response, once.

## Implemented endpoints

| Method | Path | Auth | Purpose | State |
|---|---|---|---|---|
| GET | `/health` | Public | Liveness | Implemented |
| GET | `/ready` | Public | D1 readiness | Implemented |
| GET | `/courses` | Public | Published course catalog | Implemented |
| GET | `/courses/:courseId/lessons` | Public | Published lessons in a course | Implemented |
| GET | `/lessons/:lessonId` | Public | Published lesson and pre-answer question DTOs | Implemented |
| POST | `/auth/telegram` | Public, signed initData required | Validate Telegram launch data, prevent replay, issue session | Implemented; D1 concurrency verification pending |
| POST | `/auth/logout` | Bearer session | Revoke current session | Implemented |
| GET | `/me` | Bearer session | Current profile | Implemented |
| POST | `/lessons/:lessonId/attempts` | Bearer session | Start attempt and snapshot question content | Implemented; D1 integration unverified |
| GET | `/attempts/:attemptId` | Bearer session | Read own attempt and immutable question snapshot | Implemented |
| POST | `/attempts/:attemptId/answers` | Bearer session | Validate and grade answer on server | Implemented; concurrency unverified |
| POST | `/attempts/:attemptId/complete` | Bearer session | Complete attempt and update progress in one D1 batch | Implemented; atomicity unverified |
| GET | `/me/progress` | Bearer session | Current user's lesson progress | Implemented; D1 integration unverified |

## Content and assessment invariants

- Only records with `status = 'published'` are returned by public catalog routes.
- Public pre-answer question DTOs never select or return `answer_key` or answer `explanation`.
- User ownership is derived from the authenticated principal, never from request JSON.
- Each attempt snapshots question IDs, types, prompts, options, answer keys, and ordering at creation.
- Attempt reads are owner-scoped and omit answer keys. Correctness is withheld until completion in the attempt-read DTO.
- Answers are unique per attempt/question. Repeating the same answer returns the stored result; a different second answer returns 409.
- Answer writes require an in-progress attempt and the question must belong to that attempt's snapshot.
- Completion is a conditional state transition. Progress increment is conditional on the winning update in the same D1 batch; this requires a Local D1 concurrency test before production use.
- Attempts pin the lesson version at creation. Snapshot rows preserve the exact assessment content even if the source lesson changes later.

## Authentication invariants

- Telegram initData is verified using the documented two-stage HMAC-SHA-256 construction, freshness validation, and duplicate-parameter rejection.
- Replay fingerprint insertion and session insertion occur in one D1 batch. Session insertion is gated by `changes() = 1` from the immediately preceding replay insert.
- Opaque bearer token generation, SHA-256 token hashing, active-session lookup, expiry, revocation, and middleware are implemented.
- The login route returns the canonical internal account ID, not a newly generated candidate ID.
- Raw Telegram initData and raw session tokens must never be persisted or logged.
- Telegram login is limited to 30 attempts per client IP per minute using an HMAC-derived pseudonymous bucket key; raw IP addresses are not persisted by this limiter.\n- The D1 batch and SQLite `changes()` behavior must be verified against Local D1, including concurrent identical login requests, before production use.

## Compatibility policy

Changes to response shape require an explicit API compatibility decision. Additive optional fields are preferred; breaking changes require a new API version or a documented migration window.
