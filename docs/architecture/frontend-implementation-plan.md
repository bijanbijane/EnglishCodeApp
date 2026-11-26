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
| `#/` | Home dashboard | Public app composition | Implemented; next actions and session states |
| `#/learn` | Learning library | `GET /api/v1/lessons` | Source-implemented; search, loading/error/empty states |
| `#/lessons/:lessonId` | Lesson player | Public questions + protected attempt APIs | Source-implemented; runtime unverified |
| `#/progress` | Progress history | `GET /api/v1/me/progress` | Source-implemented; runtime unverified |
| `#/profile` | Account/session | `GET /api/v1/me`, logout | Source-implemented; runtime unverified |
| — | Review queue | No review endpoint in inspected backend | Not implemented; do not fake data |
| — | Vocabulary/grammar/listening/speaking/reading/writing | No corresponding feature contracts yet | Not implemented |

Navigation uses a small hash-route adapter in `app/navigation/routes.ts`. It supports direct lesson links and browser hash changes without coupling feature components to a routing library. Telegram BackButton follows the active non-home route. An active lesson attempt prompts before leaving because the current API has no resume endpoint.

## Module boundaries

| Module | Owns | Current implementation |
| --- | --- | --- |
| `app` | Bootstrap, route parsing, navigation, feature composition | Home, Learn, lesson, progress and profile routes |
| `identity` | Telegram login, session lifecycle, profile, logout | SecureStorage bootstrap, profile endpoint, logout |
| `lessons` | Catalog, question retrieval, attempt lifecycle UI | Dedicated learning library, pure search filter, and server-backed lesson player |
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
- [x] Add explicit public `index.ts` export surfaces for lessons, identity and progress features; app composition imports through those boundaries.
- [x] Add an application-level render error boundary with an accessible reload fallback.
- [x] Decouple Telegram `ready()` initialization from API state and guard against StrictMode effect replay.
- [x] Validate question/option identity and reject duplicate or malformed learning payloads.
- [x] Verify answer feedback matches the submitted question/answer and completion belongs to the active attempt.
- [x] Add recoverable Telegram session bootstrap retry and ignore stale lesson/progress responses.
- [x] Introduce shared API transport and feature-owned API adapters.
- [x] Add product specification, architecture, backend contract and acceptance checklist.
- [x] Establish the centralized semantic design-token foundation for color roles, typography, spacing, shape/elevation, responsive references, motion, focus and touch targets; legacy component literals remain under gradual migration.
- [x] Add Telegram host adapter and official WebApp script.
- [x] Add hash-based route contract.
- [x] Add native Node route-contract tests for home/profile/progress/lesson parsing, encoding and malformed hashes.
- [x] Add pure contract unit tests for strict API envelopes, question payloads, attempt responses, profile DTOs, progress DTOs and lesson search.
- [x] Execute frontend typecheck, all frontend contract tests and Vite production build locally; record the successful results (2026-11-26).
- [x] Add the root workspace lockfile and verify a clean `npm ci` installation locally.
- [ ] Resolve hosted CI failure evidence and establish green cross-workspace typecheck/build.

### Phase B — Core learning journey
- [x] Separate the Home dashboard from the Learn library screen.
- [x] Add the canonical `#/learn` route, mobile navigation state and return path from lesson player.
- [x] Extract lesson search into a pure feature-model function; search covers title, CEFR level and description.
- [x] Add route and lesson-search unit cases for the dedicated Learn screen.
- [x] Add a data-driven CEFR level filter and normalize common Persian/Arabic keyboard variants in lesson search.
- [x] Public lesson catalog with search, loading, error/retry and empty states.
- [x] Public question retrieval and structured option rendering.
- [x] Telegram SecureStorage session bootstrap.
- [x] Protected attempt creation, answer submission and completion.
- [x] Server-confirmed correctness, explanation and score.
- [x] Warn before abandoning an active attempt.
- [x] Prevent overlapping answer, attempt-start and completion actions in the mounted UI with tested single-flight guards; server-side idempotency remains an integration requirement.
- [ ] Verify duplicate submission and completion behavior against integration tests.
- [ ] Add server-backed attempt resume/recovery before presenting lesson continuation as complete.

### Phase C — Account and progress
- [x] Profile screen using `GET /api/v1/me`.
- [x] Add an explicit retry action for recoverable profile-fetch failures without clearing the authenticated session.
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
- [x] Add shared keyboard focus-visible styling and the 44px minimum touch-target baseline to primary buttons, navigation, answers and search/filter controls; full device/accessibility audit remains open.
- [ ] Add accessibility, RTL/LTR mixed-content and mobile viewport audits.
- [ ] Add Playwright E2E for the critical learning journey.
- [ ] Verify performance on representative low-end devices and constrained networks.

## Current verification status — 2026-11-26

- `npm ci --no-audit --no-fund`: successful from the root workspace lockfile; npm reported that install scripts for `esbuild` and `fsevents` were not approved in this local npm environment. The frontend build nevertheless completed successfully.
- `npm run typecheck --workspace @englishcode/frontend`: passed.
- `npm test --workspace @englishcode/frontend`: **47/47 tests passed** on the latest local run, including API envelope, profile/progress DTO, lesson/attempt contract, lesson search, route, design-token and accessibility-style suites.
- `npm run build --workspace @englishcode/frontend`: passed; Vite emitted 267.10 KB JavaScript (80.97 KB gzip) and 22.22 KB CSS (5.41 KB gzip) on the latest build.
- `git diff --check`: passed.
- Full-workspace typecheck remains blocked by the backend base currently used by this PR: missing Node `process` types and a WebCrypto `BufferSource` typing mismatch. Backend tests on that base also have 2 failures: the no-D1 response returns 500 instead of 503, and the Telegram login fixture returns 401 instead of 200. These are backend dependency failures, not frontend failures; do not silently patch backend code from this frontend task.
- Hosted CI is still failing on the backend job; the frontend must be rechecked on the latest pushed head. No successful Telegram-device, browser E2E, or full learning-journey integration run is claimed.
- Therefore frontend local typecheck, contract tests and production build are verified; cross-workspace and release verification remain incomplete.

## Progress accounting — 2026-11-26

- Architecture design: **100% documented**; module boundaries, route/state ownership, platform adapter, API/security contracts and acceptance criteria are recorded.
- Implementation-plan checklist: **32/48 items (66.7%) checked**. This is checklist coverage, not release readiness or a production-completion percentage.
- Frontend local gates: clean `npm ci` on the unchanged lockfile baseline, typecheck, **47/47 tests**, production build and `git diff --check` passed.
- Remaining release gates: backend base typecheck/tests, hosted CI, component/integration/E2E coverage, Telegram iOS/Android verification, accessibility and performance audits.

## Release controls

PR #4 remains open and Draft. Do not merge, deploy, run production migrations, mutate production data or enable paid resources until the backend dependency is resolved and all acceptance evidence is reviewed.


## Runtime hardening continuation — 2026-11-26

- Added contract tests for lesson question payloads and attempt start/answer/completion response validation.
- The frontend `npm test` script now runs all `test/*.test.ts` suites with Node 22 TypeScript stripping.
- Question payload parsing rejects empty prompts/options, fewer than two choices, unsafe positions, and duplicate question/option identifiers.
- Answer feedback must match the submitted question and answer IDs; completion must belong to the active attempt and carry a safe integer score from 0 to 100.
- Telegram session bootstrap can be retried after a recoverable error. Replayed one-time initData is distinguished and requires reopening the Mini App for a fresh payload. Lesson catalog and progress requests ignore stale responses after a newer request or navigation.
- Logout requires explicit server confirmation before local credentials are cleared (401 is treated as already revoked).

These are source-level changes only; runtime verification remains pending until a successful CI or local test/build run is available.

- Strict API transport now rejects bare success payloads and requires the backend `{ data: ... }` envelope; malformed response shapes raise a typed `ApiContractError`.


## Learning library screen — 2026-11-26

- Home is now a dashboard rather than a page that embeds the full lesson catalogue.
- The dedicated `#/learn` screen owns the searchable published-lesson library and has explicit loading, empty, no-search-results, error and retry behavior through the existing lesson catalogue component.
- Search is isolated in `features/lessons/model/lesson-search.ts`; it matches title, CEFR level and optional description, normalizes common Persian/Arabic letter variants, and has dependency-free Node unit coverage. A CEFR filter is derived only from levels actually returned by the backend.
- Route parsing/serialization tests cover `#/learn` and query suffixes. The lesson player returns to Learn, while Home and other secondary screens retain their own back behavior.
- Practice and Review remain deliberately inactive because the inspected backend currently has no review scheduling or separate practice-center contracts. Existing lesson attempts are the working practice flow; duplicate menu entries would misrepresent functionality.

### Progress accounting

- Architecture design: **100% documented** (module boundaries, route/state ownership, Telegram adapter, API/security contracts, accessibility, resilience and acceptance criteria are recorded).
- Implementation checklist: **28/45 source tasks (62.2%)** after recording the new Learn screen work. This is source-level completion, not a runtime pass rate.
- Runtime/release verification: **not yet verified**. Do not count written tests as passing tests until a green CI or local execution report exists.


- The latest inspected CI run is [#657](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45814430122) on head `e7ca0a40c47c296bbf11c4e57c4c75e8c4039e15`; both frontend and backend jobs failed. GitHub exposes empty step arrays and no logs URL, so no typecheck/test/build output or failure cause can be determined. This was also the branch head at the latest inspection. No full local install, typecheck, repository test run or production build has been executed.


## Duplicate-action protection — 2026-11-26

- Added a shared single-flight guard and applied it to answer submission, attempt creation and lesson completion. Rapid repeated activations from one mounted UI owner no longer start overlapping requests.
- Added two deterministic Node tests covering concurrent invocation suppression and lock release after a failed request.
- This is a client-side interaction safeguard only. It does not replace backend idempotency, persisted attempt recovery or integration tests; those acceptance items remain open.


## Semantic design-token foundation — 2026-11-26

- Added `src/styles/tokens.css` with semantic color roles, type scale/families/weights/line heights, a 4px spacing scale, radii, elevations, responsive reference values/content widths, motion timings/easing, focus treatment and minimum touch target size.
- Imported the token layer before global styles and mapped the root palette, typography, focus ring and content width to semantic variables. Existing feature-specific literal colors/spacing have not all been migrated; acceptance for complete token centralization remains open until that migration and visual review are complete.
- Added static contract tests for required token groups and stylesheet consumption.


## Keyboard focus and touch-target baseline — 2026-11-26

- Expanded the global `:focus-visible` ring to native buttons, links, inputs, selects, textareas and role=button controls, using the central focus tokens.
- Applied the central 44px minimum block-size token to primary buttons, back navigation, answer options, mobile navigation, avatar button, search container and CEFR filter; search input, select and avatar button receive explicit dimension rules.
- Added three static CSS contract tests. These verify token wiring, not actual device hit-testing or WCAG conformance. Full keyboard walkthrough, contrast review, touch interaction on Telegram clients and zoom/reflow audits remain open.


## Semantic palette migration continuation — 2026-11-26

- Extended the semantic token layer with reusable text, brand, border, surface, success, focus and translucent-accent roles.
- Migrated repeated color literals in the shared screen stylesheet to semantic variables; alpha overlays use dedicated tokens so the original visual opacity is preserved.
- Added a contract test that checks token definitions, actual stylesheet consumption and removal of the migrated repeated literals.
- This is a staged migration, not completion: the current stylesheet still contains 99 raw color occurrences across 91 distinct values. Remaining one-off values require role-by-role consolidation and visual/contrast review; the design-token acceptance item remains unchecked.
- Latest source changes have not yet been re-run through local typecheck/tests/build. CI run [#717](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45840537070) failed both jobs; GitHub returned no step summaries or downloadable logs, so the cause remains unknown.


## Accessibility follow-through — 2026-11-26

- Progress-bar accessible names now use the learner-facing lesson title instead of the internal lesson ID.
- Progress and lesson-question loading states announce changes through a polite live region; decorative loading indicators are hidden from assistive technology.
- The lesson-catalog retry control now declares `type="button"` explicitly.
- Added source-contract tests for these accessible names, loading announcements and retry semantics. These tests are committed but have not yet been executed after the latest edits.
- This does not close the full accessibility gate: keyboard-only walkthrough, screen-reader behavior, contrast, 200% zoom/reflow and Telegram-device testing remain open.
- Latest hosted CI run [#739](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45841109336) failed both jobs with no step summaries or downloadable logs.


## Palette centralization continuation — 2026-11-26

- Centralized every hexadecimal color used by `apps/frontend/src/styles.css` into palette primitives in `apps/frontend/src/styles/tokens.css`; the stylesheet no longer embeds color literals.
- Existing semantic role tokens remain the preferred interface for new UI work. Palette primitives preserve one-off legacy values without changing their rendered colors; they are an intermediate compatibility layer, not a claim that every value has already been semantically consolidated.
- Extended the design-token contract test to fail if raw hexadecimal colors reappear in the screen stylesheet.
- The source-level migration removes the previously measured 99 literal color occurrences (91 distinct values) from `styles.css`. Visual regression, contrast review and responsive/device audits remain open.
- No checklist acceptance item is marked complete from source edits alone. Checklist coverage remains 34/50 (68.0%) until verification evidence justifies a change.


## Hosted CI after palette centralization — 2026-11-26

- CI run [#753](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45853827396) on the updated frontend head completed with failure in both `validate-frontend` and `validate-backend`.
- GitHub returned `steps=null` and no log URLs for both jobs; attempts to retrieve the job logs returned `BlobNotFound`. The failure cause is therefore unknown. Do not infer that the palette migration caused the failure.
- The combined commit status endpoint returned no individual status records. No local test/typecheck/build execution has been performed after these commits.
- Frontend implementation-plan coverage remains 34/50 (68.0%); release readiness is not established.

## Reduced-motion accessibility continuation — 2026-11-26

- Added a global `prefers-reduced-motion: reduce` override in `apps/frontend/src/styles.css`.
- Under the operating-system reduced-motion preference, smooth scrolling is disabled and non-essential CSS animations/transitions are reduced to a near-zero duration.
- Added a source-contract test for the media query and its motion overrides.
- This is a targeted accessibility improvement, not a complete accessibility audit. Keyboard-only operation, screen-reader behavior, contrast, 200% zoom/reflow and Telegram iOS/Android checks remain open.
- The new test has been committed but has **not** been executed in this environment. Do not count it as passing until local or hosted test output is available.
- Hosted CI run [#755](https://github.com/bijanbijane/EnglishCodeApp/actions/runs/45853964599) still reports both jobs as failed; the GitHub job API exposes no steps or logs. The cause remains unknown and cannot be attributed to this frontend change.
- Checklist coverage remains 34/50 (68.0%); no acceptance criterion was checked off by this source-only change.
