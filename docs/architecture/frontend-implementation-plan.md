# Frontend Implementation Plan — EnglishCodeApp

**Status:** Active implementation; source-level features are ahead of verified runtime state.  
**Branch:** `feat/frontend-modular-foundation`  
**Parent PR:** [#4 — Draft](https://github.com/bijanbijane/EnglishCodeApp/pull/4)  
**Last reviewed:** 2026-11-26

## Architectural decisions

- Feature-based modular monolith using React 19, TypeScript and Vite.
- Telegram is the first host; feature modules remain host-independent.
- App composition owns route mapping and cross-feature composition.
- Feature modules own their UI, API adapters and domain types.
- Shared infrastructure owns HTTP transport and generic UI primitives.
- Platform adapters isolate Telegram WebApp globals, lifecycle and storage.
- Backend remains authoritative for identity, permissions, correctness, score, attempts and progress.
- No global state library, routing dependency or paid package is introduced without demonstrated need.

## Current screen and route inventory

| Route | Screen | Data source | State |
| --- | --- | --- | --- |
| `#/` | Home + lesson catalog | `GET /api/v1/lessons` | Implemented; loading/error/empty/search |
| `#/lessons/:lessonId` | Lesson player | Public questions + protected attempt APIs | Source-implemented; runtime unverified |
| `#/progress` | Progress history | `GET /api/v1/me/progress` | Source-implemented; runtime unverified |
| `#/profile` | Account/session | `GET /api/v1/me`, logout | Source-implemented; runtime unverified |
| — | Review queue | No review endpoint in inspected backend | Not implemented; do not fake data |
| — | Vocabulary/grammar/listening/speaking/reading/writing | No corresponding feature contracts yet | Not implemented |

Navigation uses a small hash-route adapter in `app/navigation/routes.ts`. It supports direct lesson links and browser hash changes without coupling feature components to a routing library. Telegram BackButton follows the active non-home route. An active lesson attempt prompts before leaving because the current API has no resume endpoint.

## Module boundaries

| Module | Owns | Current implementation |
| --- | --- | --- |
| `app` | Bootstrap, route parsing, navigation, feature composition | Home, lesson, progress and profile routes |
| `identity` | Telegram login, session lifecycle, profile, logout | SecureStorage bootstrap, profile endpoint, logout |
| `lessons` | Catalog, question retrieval, attempt lifecycle UI | Searchable catalog and server-backed lesson player |
| `progress` | Learner progress views and API DTOs | Server-backed per-lesson history |
| `shared/api` | HTTP transport, error normalization, auth header option | Implemented; contract tests outstanding |
| `services/platform` | Telegram/browser detection, SecureStorage, theme, safe-area, BackButton | Source-implemented; device verification outstanding |
| `practice`, `review`, skill modules | Skill-specific learning experiences | Deferred until backend contracts and curriculum are defined |

Dependency rule: a feature must not import another feature's private implementation. App composition may combine public feature components and map shared route data into props. Shared modules never import features.

## Authentication and session lifecycle

1. Read the signed raw `Telegram.WebApp.initData`; never use `initDataUnsafe` for authentication.
2. Detect Bot API 9.0 SecureStorage support using host feature detection and version check.
3. Read the existing session from Telegram SecureStorage.
4. If no valid session exists, submit raw initData to `POST /api/v1/auth/telegram`.
5. Validate the returned bearer type and expiry, then store the token only in Telegram SecureStorage.
6. Attach Bearer credentials only to protected feature requests.
7. On 401, invalidate the local session and return the UI to a recoverable signed-out state.
8. Logout revokes the server session and removes the SecureStorage entry.

Browser mode remains public-preview-only. The inspected backend does not issue an HttpOnly cookie, so the frontend does not invent localStorage/sessionStorage persistence. Telegram clients without SecureStorage support also remain preview-only.

## Verified backend API surface (source inspection)

| Method and path | Auth | Frontend use |
| --- | --- | --- |
| `GET /api/v1/lessons` | Public | Catalog |
| `GET /api/v1/lessons/:lessonId/questions` | Public | Question list (no answer key returned) |
| `POST /api/v1/auth/telegram` | Signed initData validation | Session bootstrap |
| `POST /api/v1/lessons/:lessonId/attempts` | Bearer | Start attempt |
| `POST /api/v1/attempts/:attemptId/answers` | Bearer | Submit answer and receive server feedback |
| `POST /api/v1/attempts/:attemptId/complete` | Bearer | Complete and receive server score |
| `GET /api/v1/me` | Bearer | Profile display name |
| `GET /api/v1/me/progress` | Bearer | Per-lesson progress |
| `POST /api/v1/auth/logout` | Bearer | Revoke session |

All successful endpoints use a `{ data: ... }` envelope. Feature API adapters validate response shape before handing data to UI. Correctness and score are never computed in the browser.

## Delivery sequence

### Phase A — Foundation and contract
- [x] Split app composition from the root entry point.
- [x] Add an application-level render error boundary with an accessible reload fallback.
- [x] Introduce shared API transport and feature-owned API adapters.
- [x] Add product specification, architecture, backend contract and acceptance checklist.
- [x] Add Telegram host adapter and official WebApp script.
- [x] Add hash-based route contract.
- [x] Add native Node route-contract tests for home/profile/progress/lesson parsing, encoding and malformed hashes.
- [ ] Add automated tests for API envelopes and DTO validation; route test execution remains pending CI/runtime evidence.
- [ ] Resolve CI failure evidence and establish reproducible install/typecheck/build.

### Phase B — Core learning journey
- [x] Public lesson catalog with search, loading, error/retry and empty states.
- [x] Public question retrieval and structured option rendering.
- [x] Telegram SecureStorage session bootstrap.
- [x] Protected attempt creation, answer submission and completion.
- [x] Server-confirmed correctness, explanation and score.
- [x] Warn before abandoning an active attempt.
- [ ] Verify duplicate submission and completion behavior against integration tests.
- [ ] Add server-backed attempt resume/recovery before presenting lesson continuation as complete.

### Phase C — Account and progress
- [x] Profile screen using `GET /api/v1/me`.
- [x] Server-backed logout and local session invalidation handling.
- [x] Progress screen using `GET /api/v1/me/progress`.
- [x] Display best score, completion count and last completion date.
- [ ] Verify data rendering with seeded and empty accounts.
- [ ] Add skill-level progress only after the backend exposes validated skill metrics.

### Phase D — Review and additional skills
- [ ] Define spaced-repetition/review API contract and learning model.
- [ ] Implement review queue and response capture against server-owned scheduling.
- [ ] Define vocabulary and grammar content schemas.
- [ ] Add reading/listening/writing/speaking experiences in separate feature modules.
- [ ] Treat AI feedback as advisory until assessment rubrics are validated.

### Phase E — Platform and release hardening
- [ ] Verify Telegram SecureStorage on supported iOS and Android clients.
- [ ] Verify safe-area, viewport, orientation, theme and BackButton lifecycle.
- [ ] Add browser authentication only after an approved backend HttpOnly cookie/session contract.
- [ ] Add accessibility, RTL/LTR mixed-content and mobile viewport audits.
- [ ] Add Playwright E2E for the critical learning journey.
- [ ] Verify performance on representative low-end devices and constrained networks.

## Current verification status

- Source changes are committed to the working branch.
- The latest inspected CI run is [#451](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45809465749), run ID `45809465749`, on head `be0f1b78c000c4fe7828643e7863e5d7582f8794`; both `validate-backend` and `validate-frontend` failed.
- GitHub job metadata returned no steps or logs URL; direct job-log retrieval returned 404 `BlobNotFound`. Check-run metadata contains one annotation per job but no readable message. Root cause is unknown. The CI workflow installs monorepo dependencies from the repository root and now includes native Node route-contract tests. The failure persisted before job steps/logs were exposed; root cause remains unknown.
- No local `npm install`, typecheck, build, automated test, browser test or Telegram-device test has been executed in this work session.
- Therefore implementation status is **source-implemented, not runtime-verified**.

## Release controls

PR #4 remains open and Draft. Do not merge, deploy, run production migrations, mutate production data or enable paid resources until the backend dependency is resolved and all acceptance evidence is reviewed.
