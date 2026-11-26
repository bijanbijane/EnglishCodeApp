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
- The shared transport does not currently attach an `Authorization: Bearer ...` header.
- The lesson list UI has loading, error/retry and ready states; an empty list is rendered by the catalog component.

## 4. Authentication integration blocker

The backend currently issues a bearer token in the JSON response from `POST /api/v1/auth/telegram`. Protected learning routes use bearer authentication. The frontend transport does not yet attach that token, and the inspected backend route does not establish an HttpOnly cookie.

Therefore:

1. Authenticated lesson attempts must not be presented as integrated or working yet.
2. Telegram SecureStorage integration must be designed against the exact host capability and backend token contract.
3. Browser authentication needs an explicit backend-supported secure session design. An HttpOnly cookie cannot be assumed to exist.
4. Do not add token persistence to localStorage or invent a sessionStorage fallback.
5. Do not implement a token adapter until the security/session design is reviewed and documented.

The current public lesson catalog can be integrated independently of authentication. Attempt creation, answer submission, completion and logout remain blocked on the session contract.

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
