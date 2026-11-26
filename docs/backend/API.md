# Backend API contract — v1

Base path: `/api/v1`. All payloads are JSON. Errors use `{ "error": { "code", "message", "requestId" } }`. Successful resources use `{ "data": ... }` unless noted.

## Authentication

### POST /auth/telegram

Public. Body:

```json
{ "initData": "<raw Telegram.WebApp.initData>" }
```

The backend verifies the Telegram HMAC signature, rejects duplicate parameters, enforces auth_date freshness, and records the signed hash in D1 to reject replay. A consumed initData value cannot be used again.

Success: `200` with `data.token`, `data.tokenType = "Bearer"`, `data.expiresAt`, and the minimal user object. The client must not log the token or put it in a URL.

### POST /auth/logout

Requires `Authorization: Bearer <token>`. Revokes the current session.

## User

- `GET /me` — authenticated minimal profile.
- `GET /me/progress` — up to 100 most recently completed lesson progress records.

The authenticated user ID is derived only from the session. A user ID in a request body is never used to select ownership.

## Learning

- `GET /lessons` — published lesson list, ordered by position.
- `GET /lessons/:lessonId/questions` — public question prompts/options. The answer key is never returned.
- `POST /lessons/:lessonId/attempts` — authenticated; creates a new attempt and returns `attemptId`.
- `POST /attempts/:attemptId/answers` — authenticated; body `{ "questionId": "...", "answerId": "..." }`. The server loads the answer key and grades the response. One answer per question per attempt is enforced by a database unique index; a repeat returns the originally stored answer.
- `POST /attempts/:attemptId/complete` — authenticated; finalizes the attempt, calculates a percentage score on the server, and updates progress.

## Health

- `GET /health` — process liveness; does not prove database connectivity.
- `GET /ready` — performs a lightweight D1 query and returns 503 if the binding/database is unavailable.

## Status codes

| Status | Meaning |
|---|---|
| 200 | Request completed |
| 201 | Attempt created |
| 400 | Invalid request body or fields |
| 401 | Missing, invalid, or expired session / Telegram data |
| 404 | Route, lesson, question, or owned attempt not found |
| 409 | Domain conflict, including replayed Telegram initData or a lesson without questions |
| 503 | Required storage or authentication configuration unavailable |

## Explicit non-goals

No admin API, payment, subscription, public profile, AI tutor, media upload, queue consumer, or production deployment is included in this backend foundation.