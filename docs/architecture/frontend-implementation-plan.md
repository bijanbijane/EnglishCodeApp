# Frontend Implementation Plan — EnglishCodeApp

**Status:** Active implementation plan  
**Branch:** `feat/frontend-modular-foundation`  
**Parent PR:** [#4](https://github.com/bijanbijane/EnglishCodeApp/pull/4)

## Architectural decisions

- Use a feature-based modular monolith. Keep app composition, feature modules, shared infrastructure and platform adapters separate.
- Keep React UI independent of Telegram. Only the platform adapter may read Telegram WebApp globals or subscribe to host events.
- Keep server authority for identity, answer correctness, score, attempt lifecycle and progress.
- Use the existing versioned API and a single shared transport. Validate response data at feature boundaries before rendering.
- Do not persist bearer tokens in localStorage or invent a browser storage fallback. Authenticated flows remain gated until the backend exposes a reviewed secure session contract.
- Do not introduce a router, state library, component library or paid dependency until the app needs it and the value is demonstrated.

## Feature boundaries

| Area | Owns | Current status |
| --- | --- | --- |
| App shell | Bootstrap, navigation, layout, providers | Partial |
| Home | Next action, learning overview, announcements | Partial; progress data unavailable |
| Lessons | Published catalog, lesson metadata | Catalog implemented; interaction in progress |
| Lesson player | Lesson content and exercise rendering | Preview UI in progress; submission gated by auth |
| Practice | Skill practice and targeted tasks | Not implemented |
| Review | Due queue and retrieval practice | Not implemented; backend contract needed |
| Progress | Evidence, scores, skill breakdown | Not implemented; user progress API needs verification |
| Profile | Account details, preferences, session controls | Not implemented; user API needs verification |
| Platform | Telegram/browser capability adapter | Not implemented |
| Shared | HTTP, errors, design tokens, accessible primitives | Partial |

## Dependency-aware implementation sequence

1. Stabilize shell, route/view state, navigation and responsive primitives.
2. Complete public catalog → lesson preview → public question retrieval.
3. Resolve backend session contract before wiring Telegram sign-in, attempt creation, answer submission, completion or logout.
4. Add contract validation and component/integration tests around each API boundary.
5. Implement review, progress and profile only against verified backend endpoints and data definitions.
6. Add Telegram host lifecycle, viewport, safe-area, theme and BackButton integration.
7. Complete accessibility, RTL/LTR, mobile and performance audits.

## Verification gates

- Every async view has loading, empty, error and retry/recovery states.
- No UI claims a protected action succeeded without a server response.
- No sample or placeholder metric is represented as learner data.
- Feature modules do not import another feature's implementation.
- Typecheck, production build, automated tests and critical E2E must pass in a real execution environment.
- PR #4 remains Draft until its backend dependency and acceptance evidence are resolved.
- No merge, deployment, production migration, production data mutation or paid-resource activation is included.

## Current blockers

- Backend issues a bearer token but the frontend has no approved secure storage/session transport.
- CI job logs were unavailable in the prior inspection; both frontend and backend jobs failed and the root cause remains unknown.
- No terminal/browser execution was available during this repository-only implementation pass. Source writes are not runtime verification.
