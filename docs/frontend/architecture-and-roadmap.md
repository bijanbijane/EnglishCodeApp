# Frontend architecture audit and implementation roadmap

**Status:** Reviewed against the current repository on 2026-11-26. This is an implementation plan, not a claim that the proposed modules or tests already exist.

## 1. Executive finding

The current frontend is a React 19 + Vite + TypeScript starter, not yet a complete MVP learning client.

There are two relevant snapshots:
- PR #1 branch `feat/minimal-app-foundation` contains a lesson list, lesson detail panel, one-question answer selection and answer feedback.
- Backend foundation branch `feat/backend-domain-foundation` currently exposes a reduced `App.tsx` that only lists lessons. The lesson detail/answer UI from PR #1 is not present in that branch snapshot.
- PR #1 UI calls `GET /lessons/:id` and `POST /lessons/:id/check`; the backend foundation API instead defines `GET /lessons/:id/questions`, `POST /lessons/:id/attempts`, `POST /attempts/:id/answers` and `POST /attempts/:id/complete`. The old UI cannot be connected unchanged to the new backend API.

Therefore, do not treat the frontend vertical slice as complete. Rebuild the client flow against the current backend contract, rather than reviving old endpoint assumptions.

## 2. Confirmed findings in current code

| Priority | Finding | Impact | Required correction |
|---|---|---|---|
| P0 | The current branch's `App.tsx` only renders the lesson list; no lesson player, attempt, answer submission, result or progress UI. | The core learning journey cannot be completed. | Implement the flow against the backend v1 endpoints. |
| P0 | PR #1 uses legacy lesson-detail/check endpoints which differ from backend foundation v1. | Integration will fail or require an adapter. | Treat `docs/backend/API.md` as the source contract; remove legacy endpoint calls. |
| P1 | API response is cast with TypeScript only; JSON is not runtime-validated. | Malformed or changed responses can crash rendering. | Add runtime DTO validation at the API boundary. |
| P1 | Fetch calls have no AbortController or request identity. | Stale responses can overwrite newer UI state; unmounted components may still update state. | Abort on unmount/navigation and guard concurrent submissions. |
| P1 | Initial effect calls `loadLessons` without cleanup. React StrictMode deliberately re-runs Effects in development. | Duplicate development requests and hidden cleanup defects. | Use a cancellable query hook/service; retain StrictMode. |
| P1 | Relative `/api/v1` works with the Vite dev proxy and a same-origin production route, but no production routing configuration is committed. | Separate frontend/API hosting will return wrong-origin/404 requests. | Make same-origin Worker routing the default; document explicit API base URL and CORS only if deployment is split. |
| P1 | No frontend test script or test dependencies exist. | UI, request lifecycle and contract regressions are not automatically caught. | Add unit/component tests and a minimal API-mocked integration suite. |
| P1 | Telegram WebApp initialization and auth client are absent. | The actual launch/auth journey is not implemented. | Add a small platform adapter; send raw `initData` only to backend. |
| P2 | No route-level separation or reusable feature boundary exists. | Adding learning, profile and progress will concentrate logic in one component. | Split by app shell, pages, features and shared infrastructure; avoid premature micro-frontends. |
| P2 | Telegram theme, safe-area and viewport behavior are absent. | Notches, Telegram chrome and dynamic theme can cause layout defects. | Implement safe-area-aware shell and theme adapter. |
| P2 | Loading/error UI lacks consistent live-region and focus behavior. | Screen-reader and keyboard users may miss state changes. | Add semantic status/alert regions and focus handling. |

## 3. Target architecture

Use a **feature-oriented modular frontend inside one Vite application**. Do not introduce micro-frontends, Redux, a design-system package, or multiple deployables for this MVP.

Suggested structure:

```text
apps/frontend/src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── providers.tsx
│   └── bootstrap.ts
├── pages/
│   ├── HomePage.tsx
│   ├── LessonPage.tsx
│   ├── LessonResultPage.tsx
│   ├── ProgressPage.tsx
│   └── NotFoundPage.tsx
├── features/
│   ├── auth/
│   │   ├── auth.api.ts
│   │   ├── auth.store.ts
│   │   └── useAuth.ts
│   ├── lessons/
│   │   ├── lessons.api.ts
│   │   ├── lessons.types.ts
│   │   ├── LessonList.tsx
│   │   └── useLessons.ts
│   ├── assessment/
│   │   ├── assessment.api.ts
│   │   ├── assessment.types.ts
│   │   ├── QuestionCard.tsx
│   │   └── useAttempt.ts
│   └── progress/
│       ├── progress.api.ts
│       └── ProgressSummary.tsx
├── shared/
│   ├── api/
│   │   ├── http.ts
│   │   ├── errors.ts
│   │   └── schemas.ts
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── styles/
├── platform/
│   └── telegram/
│       ├── telegram.types.ts
│       ├── telegram.client.ts
│       └── useTelegram.ts
└── test/
    ├── fixtures/
    ├── mocks/
    └── setup.ts
```

Rules:
- Pages compose features; pages do not contain raw fetch calls.
- Feature APIs call the shared HTTP client and own feature DTOs.
- Shared components contain no learning-domain rules.
- Telegram SDK details stay behind `platform/telegram`; web fallback remains possible.
- The backend remains authoritative for identity, permissions, answer correctness, score and progress.
- Do not add a global state library until real cross-page state justifies it. Start with React state/context and a small auth store.
- Avoid duplicating backend domain models in the UI; define only the response DTOs the UI needs.

## 4. API integration contract

Default API origin: same-origin `/api/v1`. Vite development proxy points to `http://localhost:8787`. Production should route `/api/*` to the Worker behind the same origin using the selected Cloudflare static-assets/Worker routing configuration.

If a separate API origin becomes necessary, use an explicit `VITE_API_BASE_URL`, allow only known origins, and configure backend CORS narrowly. Never infer production origin from user-controlled query parameters.

Frontend client responsibilities:
- Add `Accept: application/json` and JSON content headers when needed.
- Attach `Authorization: Bearer <session>` only to authenticated requests.
- Parse the standard `{ data }` / `{ error: { code, message, requestId } }` envelope.
- Validate unknown JSON at runtime before using it.
- Normalize HTTP, network, timeout and validation errors into typed UI errors.
- Support AbortSignal and request timeouts.
- Never log initData, bearer tokens or full private payloads.

### Endpoint mapping

| User action | Backend endpoint | Frontend responsibility |
|---|---|---|
| Load lesson catalog | `GET /api/v1/lessons` | Render loading, empty, error and retry states |
| Open a lesson | `GET /api/v1/lessons/:lessonId/questions` | Render prompt/options; never expect answer_key |
| Start learning attempt | `POST /api/v1/lessons/:lessonId/attempts` | Create and retain attemptId |
| Submit an answer | `POST /api/v1/attempts/:attemptId/answers` | Send questionId/answerId; prevent duplicate UI submit |
| Finish lesson | `POST /api/v1/attempts/:attemptId/complete` | Render server-calculated result only |
| Load profile | `GET /api/v1/me` | Display minimal authenticated profile |
| Load progress | `GET /api/v1/me/progress` | Display persisted progress |
| Sign out | `POST /api/v1/auth/logout` | Revoke server session and clear client session |

Do not call the legacy `GET /lessons/:id` or `POST /lessons/:id/check` endpoints from the new client unless the backend contract is explicitly changed.

## 5. Authentication and Telegram boundary

- Read `Telegram.WebApp.initData` from the Telegram bridge; never use `initDataUnsafe` as proof of identity.
- Send raw initData once to `POST /api/v1/auth/telegram`; backend validates HMAC, auth_date and replay.
- Keep the bot token out of frontend code and build-time environment variables.
- Current backend contract issues an opaque Bearer token. A short-lived in-memory token is safest against persistence but is lost on reload; replay protection means blindly re-submitting the same initData may fail. Before coding the client, decide the session survival strategy with backend: for the Mini App MVP, sessionStorage can survive same-tab reloads but remains accessible to injected JavaScript; strengthen CSP/XSS controls and never use localStorage by default. A future standalone web app should evaluate Secure, HttpOnly, SameSite cookies and CSRF controls as a separate ADR.
- On 401, clear the invalid session and show a controlled re-authentication state; do not loop login attempts.
- Local/test auth bypass must be explicit, impossible to enable in production, and absent from production builds.

## 6. Telegram UI platform behavior

Implement only a thin adapter around Telegram WebApp:
- Call `ready()` after the essential UI has mounted.
- Request `expand()` only if it improves the experience; do not assume all clients support identical viewport behavior.
- Subscribe/unsubscribe to `themeChanged` and `viewportChanged`; avoid leaking listeners.
- Use theme parameters as CSS variables with safe fallbacks.
- Respect safe-area and content-safe-area insets; use stable viewport height for bottom-anchored controls.
- Provide a browser development fallback when Telegram is absent.
- Add BackButton integration only after route navigation exists and test its lifecycle.
- Keep Telegram-specific code out of learning features and API DTOs.

Reference: https://core.telegram.org/bots/webapps

## 7. UX, localization and accessibility

- Mobile-first, minimum supported viewport 320 CSS px; verify common iOS/Android Telegram WebViews and desktop Telegram.
- RTL is the default Persian shell. English prompts, code, numbers and mixed-direction text must use explicit `dir="ltr"` or `dir="auto"` at content boundaries; do not flip the entire document for English question text.
- Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`) instead of left/right assumptions.
- Support Telegram light/dark themes and system/browser fallback.
- All controls keyboard-operable with visible focus; no clickable non-semantic divs.
- Loading uses `role="status"` / `aria-live="polite"`; blocking errors use an appropriate alert and retry control.
- Manage focus when opening/closing lesson and result views; preserve keyboard position on recoverable errors.
- Respect `prefers-reduced-motion`; avoid expensive blur/animation in low-end WebViews.
- Every stateful screen defines loading, empty, error, unauthorized, success and retry behavior as applicable.

## 8. State and request lifecycle

- Server data is fetched through feature API functions, not from render.
- Every request that can be superseded accepts an AbortSignal.
- Effects register cleanup and must behave correctly under React StrictMode's extra development setup/cleanup cycle.
- Disable answer/complete buttons while a request is in flight; use an idempotency-aware UX and show the server's canonical result.
- Do not calculate final score in the browser.
- Do not optimistically mark an attempt complete before server confirmation.
- Cache only low-risk read data initially; never treat cached progress as authoritative.
- On logout, clear auth state and all user-scoped in-memory caches.

## 9. Frontend implementation roadmap

### F0 — Contract and branch reconciliation
- [x] Inspect current frontend files and PR #1 / PR #2 branch contracts.
- [x] Identify the lesson-player regression and legacy endpoint mismatch.
- [x] Record the target architecture and acceptance criteria in this document.
- [ ] Resolve whether PR #1 or PR #2 is the base for the next integrated UI change; do not merge either automatically.
- [ ] Agree the frontend session persistence strategy with backend.

Exit: one authoritative API contract and one agreed integration base.

### F1 — Frontend foundation
- [ ] Restore/create app shell, page boundary and feature folders.
- [ ] Create typed HTTP client, error envelope parser and runtime response validation.
- [ ] Configure same-origin API routing; document local Vite proxy and production route.
- [ ] Add abort/timeout handling and StrictMode-safe hooks.
- [ ] Add global error boundary and consistent state components.

Exit: typecheck/build and component tests pass; malformed API responses do not crash the app.

### F2 — Telegram and auth
- [ ] Add Telegram bridge types and browser fallback.
- [ ] Implement initData handoff to backend auth endpoint.
- [ ] Implement the approved session persistence/rehydration strategy.
- [ ] Handle 401, logout and unavailable Telegram context.
- [ ] Test missing, expired, replayed and malformed auth responses.

Exit: a real Mini App launch can authenticate without trusting initDataUnsafe or exposing secrets.

### F3 — Learning journey against backend v1
- [ ] Lesson catalog and lesson question screen.
- [ ] Start attempt and retain attemptId.
- [ ] Submit one answer at a time through backend v1.
- [ ] Complete attempt and show server score/result.
- [ ] Profile and progress views.
- [ ] Retry/recovery behavior for network interruption and duplicate submission.

Exit: one authenticated user completes a lesson and sees persisted server progress.

### F4 — Responsive Telegram UX
- [ ] Theme synchronization and safe-area support.
- [ ] Stable viewport handling and Telegram BackButton.
- [ ] RTL/LTR content boundaries and responsive layouts.
- [ ] Keyboard, screen-reader and reduced-motion checks.

Exit: verified on Telegram iOS, Android and desktop or explicitly documented unsupported clients.

### F5 — Quality and release readiness
- [ ] Unit tests for API client, error mapping and feature state.
- [ ] Component tests for catalog, question, submission, result and progress.
- [ ] Integration tests with mocked API contract.
- [ ] E2E test for login-to-completion once local D1 is available.
- [ ] Build-size and performance budget; no analytics SDK until privacy and value are approved.
- [ ] Accessibility and security review.

Exit: CI green and all MVP acceptance criteria have evidence. No production deploy is implied.

## 10. Required test matrix

| Area | Minimum checks |
|---|---|
| API client | 2xx envelope, API error envelope, invalid JSON, network failure, timeout, abort |
| Request lifecycle | StrictMode setup/cleanup, navigation during fetch, stale response, double submit |
| Auth | no Telegram bridge, empty initData, 401, expired session, replay rejection, logout |
| Learning | no lessons, no questions, one/multiple questions, server error, answer conflict, completion |
| RTL/i18n | Persian shell, English question, mixed numbers/punctuation, long labels |
| Responsive | 320 px, 375 px, 768 px, desktop width, safe-area insets |
| Accessibility | keyboard-only, focus order, status announcement, contrast, reduced motion |
| Security | no token/initData in logs, no answer_key in client DTO, no secret in Vite bundle |

## 11. Non-goals for this phase

- No Redux/Zustand unless state complexity is demonstrated.
- No micro-frontends or multiple frontend apps.
- No AI tutor, speech recognition, audio pipeline or payment UI.
- No production deployment, Cloudflare resource creation or paid service.
- No claim of global-scale readiness from a frontend build.

## 12. Sources

- React StrictMode and effect cleanup: https://react.dev/reference/react/StrictMode
- React rules and hook purity: https://react.dev/reference/rules
- Telegram Mini Apps initialization, theme, viewport and safe areas: https://core.telegram.org/bots/webapps


## 13. Telegram Mini App correction — authoritative addendum

The product is Telegram-first. The generic platform notes above must be interpreted through the dedicated [Telegram Mini App architecture](telegram-mini-app-architecture.md), which is the authoritative specification for launch modes, bootstrap, session persistence, native buttons, theme, viewport and safe areas.

Key corrections:
- Load the official Telegram WebApp script in the HTML head before the application entrypoint.
- Prefer Main Mini App and bot menu button as authenticated entry points. Keyboard-button and inline-mode launches provide empty initData and cannot use the current auth contract.
- Use Telegram SecureStorage (Bot API 9.0+, feature-detected) for the opaque backend session token where available; do not fall back to localStorage or CloudStorage for bearer tokens.
- Integrate Telegram BackButton/MainButton only when the current route/task requires them.
- Use Telegram theme variables and safe-area/content-safe-area CSS variables; use viewportStableHeight for stable bottom-anchored UI.
- Do not request fullscreen by default.
- Treat start_param as untrusted navigation input, never as identity or authorization.

The previous session-storage discussion is superseded by the SecureStorage-first policy in the Telegram-specific specification. Backend session TTL and refresh behavior still require verification before auth client implementation.
