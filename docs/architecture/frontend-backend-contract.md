# Frontend–Backend Contract Snapshot

**Status:** Source-inspected contract snapshot; not runtime-verified  
**Repository:** `bijanbijane/EnglishCodeApp`  
**Branch:** `feat/frontend-modular-foundation`  
**Scope:** Existing backend routes and current frontend transport only

This document records what is present in source code. It is not a substitute for API integration tests and must be updated when backend contracts change.

## 1. Response envelope and errors

Successful learning and authentication routes return a `{ data: ... }` envelope. The frontend `apiGet` helper unwraps this envelope.

Backend errors are produced through `errorBody(code, message, requestId)`; the current frontend transport reads `error.message` and otherwise falls back to a generic Persian message. Confirm the exact serialized error shape with an integration test before depending on additional fields.

## 2. Confirmed routes

| Method | Route | Authentication | Observed behavior |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Public | Service health response |
| GET | `/api/v1/ready` | Public | Checks D1 binding/readiness |
| GET | `/api/v1/lessons` | Public | Published lessons; fields: `id`, `title`, `level`, `position`; maximum 50 |
| GET | `/api/v1/lessons/:lessonId/questions` | Public in current route source | Questions include `id`, `prompt`, `options`, `position`; answer key is not returned |
| POST | `/api/v1/auth/telegram` | Telegram initData validation | Accepts `{ initData }`; returns a bearer token, token type, expiry and user |
| POST | `/api/v1/lessons/:lessonId/attempts` | Bearer session | Creates a started attempt and returns `attemptId` |
| POST | `/api/v1/attempts/:attemptId/answers` | Bearer session | Accepts `{ questionId, answerId }`; returns server-confirmed correctness and explanation |
| POST | `/api/v1/attempts/:attemptId/complete` | Bearer session | Completes attempt and returns server-calculated score |
| POST | `/api/v1/auth/logout` | Bearer session | Revokes current session |

## 3. Confirmed frontend behavior

- `GET /api/v1/lessons` is called by the lesson feature.
- `apiGet` unwraps a top-level `data` property.
- The shared transport currently sends `credentials: "same-origin"`.
- The shared transport now supports an explicit bearer token option; only authenticated feature API calls pass it.
- The lesson list UI has loading, error/retry and ready states; an empty list is rendered by the catalog component.

## 4. Authentication integration blocker

The backend issues a bearer token in the JSON response from `POST /api/v1/auth/telegram`; protected learning routes require that token in the `Authorization` header. The frontend now implements the Telegram-specific session path:

1. Detect Telegram SecureStorage support with `isVersionAtLeast("9.0")` and feature detection.
2. Read an unexpired session from the Telegram SecureStorage key `englishcode.session.v1`.
3. If no valid session exists and raw `initData` is present, call `POST /api/v1/auth/telegram` and store the returned token/expiry in SecureStorage.
4. Attach the bearer token only to protected attempt, answer, complete and logout requests.
5. Never read `initDataUnsafe`, and never persist the bearer token in browser localStorage/sessionStorage.

The browser client remains public-preview-only. The inspected backend does not establish an HttpOnly cookie, so browser sign-in and persistent browser sessions are not enabled. Telegram clients without Bot API 9.0 SecureStorage support also remain preview-only; no insecure fallback is used.

The lesson flow now calls the real attempt, answer and completion routes when a valid Telegram session exists. Server responses determine answer correctness, explanations and final score. This is source-implemented but still requires runtime integration testing; it is not yet verified in Telegram.

## 5. Contract and quality gates still required

- Add runtime schema validation or equivalent typed contract tests for success and error envelopes.
- Verify empty, malformed and unavailable database responses.
- Verify Telegram initData freshness, signature and replay rejection through backend tests.
- Verify bearer expiry, revocation, unauthorized responses and logout.
- Verify duplicate answer submission behavior and whether first-write-wins is intentional.
- Verify attempt completion idempotency and concurrent completion behavior.
- Add an integration test for catalog → questions → authenticated attempt → answer → completion.
- Confirm whether public access to lesson questions is intentional for the product's threat model.

## 6. Verification limitations

The source files were inspected through GitHub. The CI run associated with the previously recorded head reported both jobs as failed, but GitHub's job-log endpoint returned 404 and the job metadata contained no step details or log URL. The failure cause remains unknown. No local npm install, typecheck, test, build or browser execution was performed in this session.

Do not mark any runtime acceptance item complete based on source inspection alone.
