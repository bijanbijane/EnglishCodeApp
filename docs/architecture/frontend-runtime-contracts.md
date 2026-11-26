# Frontend Runtime Contracts — EnglishCodeApp

**Status:** Normative implementation contract for the current MVP.  
**Owner boundary:** Frontend application and feature modules.  
**Related:** [Product specification](./frontend-product-spec.md), [technical architecture](./frontend.md), [backend contract](./frontend-backend-contract.md), [acceptance checklist](./frontend-acceptance-checklist.md).

## 1. Runtime composition

The React root mounts one application composition. The composition layer owns:
- parsing and updating the current route;
- loading the public lesson catalog;
- bootstrapping the Telegram session once per document lifecycle;
- selecting feature screens and passing public props;
- coordinating Telegram BackButton behavior;
- handling navigation away from an unfinished attempt.

The composition layer must not own question grading, score calculation, progress aggregation, or raw Telegram storage operations. The root render is wrapped in an application error boundary; unexpected render failures show a recoverable fallback instead of a blank screen.

### Route contract

| Route | Access | Required behavior |
| --- | --- | --- |
| `#/` | Public | Catalog, search, loading/error/empty states |
| `#/lessons/:lessonId` | Public content; authenticated attempt | Direct links, missing lesson state, no client-side answer key |
| `#/progress` | Authenticated | Server-backed progress only; signed-out state otherwise |
| `#/profile` | Public shell; authenticated details/actions | Profile fetch, session status and logout |

Unknown routes resolve to home. Invalid percent-encoding resolves safely to home. Lesson IDs are URI-encoded when generating links. Route parsing is a pure function and has direct unit tests.

The desired product information architecture contains Home, Learn, Practice, Review and Profile. Only the routes listed above are currently implemented. Do not expose Review, Practice or skill destinations as active navigation until the relevant backend contract and real screen exist.

## 2. Feature module contract

A feature may export only the components, types or functions intentionally consumed by app composition. Other features must not import its private files.

Expected module shape when a feature grows:
- `api/`: endpoint-specific adapter and runtime response parsing;
- `model/`: feature-owned DTOs and UI state unions;
- `ui/`: presentational and feature composition components;
- `index.ts`: optional public export surface once multiple consumers exist.

Do not create empty directories, generic repositories, service locators or speculative abstractions. Keep a module local until at least two real consumers demonstrate the need to share it.

## 3. Data and state ownership

| State | Source of truth | Frontend owner |
| --- | --- | --- |
| Current route | URL hash | `app/navigation` |
| Lesson catalog | Backend | `lessons/api` + app composition |
| Questions/options | Backend | `lessons/api` |
| Attempt status and answer feedback | Backend | `lessons/api` + lesson player UI |
| Score and completion | Backend | Completion response |
| Profile | Backend | `identity/api` |
| Progress history | Backend | `progress/api` |
| Current UI selection/loading/error | Client | Owning component |
| Telegram host capabilities | Telegram WebApp API | Platform adapter |
| Session credential | Backend-issued bearer + Telegram SecureStorage | Identity/session service |

No client-side calculation may replace a server-owned result. Derived presentation values (for example a display-only progress bar) may be calculated from validated server fields.

Do not add a global store or server-state cache for the current screen count. Reassess when several screens need shared cache invalidation, background refresh or optimistic mutation; any later cache must not become a second source of truth.

## 4. API adapter contract

All feature requests use the shared HTTP client. Feature adapters:
1. use versioned backend paths;
2. pass bearer credentials only to protected endpoints;
3. require and unwrap the documented `{ data: ... }` success envelope through shared transport; bare or malformed success payloads fail with a typed contract error;
4. parse `unknown` into explicit feature DTOs at runtime;
5. reject malformed data rather than silently inventing defaults;
6. surface normalized errors without exposing raw server internals.

The UI must distinguish:
- loading;
- ready with data;
- ready but empty;
- recoverable request error with retry;
- unauthenticated or expired session;
- unavailable capability (for example Telegram SecureStorage unsupported).

A retry must not create duplicate attempts or submissions. Mutating actions disable their initiating control while pending. The server remains responsible for idempotency and duplicate-answer policy.

## 5. Authentication and host contract

- Only signed raw `Telegram.WebApp.initData` is sent for Telegram authentication. `initDataUnsafe` is not an authentication source.
- The backend validates signature, age and replay policy.
- SecureStorage capability is detected before enabling authenticated learning.
- The bearer is kept in memory while the document is active and persisted only through Telegram SecureStorage.
- Never persist bearer credentials in localStorage, sessionStorage, URL, analytics, logs or error messages.
- Protected requests attach `Authorization: Bearer` through shared transport.
- A 401 clears local session state and returns the UI to a recoverable state. The user may need to reopen the Mini App to obtain fresh initData.
- The backend consumes each Telegram initData fingerprint once. A replay response (`TELEGRAM_INIT_DATA_REPLAYED`) is not retried with the same payload; the UI instructs the user to close and reopen the Mini App for fresh initData.
- Logout revokes the backend session before clearing local storage. A network failure must not be represented as a successful remote logout.
- Browser mode remains public-preview-only until the backend defines and implements a secure HttpOnly cookie/session contract.
- A Telegram client without the required SecureStorage capability remains public-preview-only.

## 6. Navigation and attempt lifecycle

Starting an attempt is an explicit action. Before it starts, a user may leave freely. Once started:
- browser navigation and Telegram BackButton must be intercepted or confirmed;
- a destructive leave warning must explain that the current backend does not yet support attempt resume;
- an attempt must not be silently recreated on component remount;
- completion becomes final only after the backend returns a valid completion response;
- the displayed score comes only from that response.

A future resume feature requires a backend endpoint and a stable attempt-state contract. Do not infer active attempts from browser memory after reload.

## 7. Platform adapter lifecycle

Only `services/platform` may access `window.Telegram.WebApp`. It owns capability detection and subscriptions for viewport, safe areas, theme and BackButton.

Every event subscription must have a matching cleanup. Platform APIs are optional and feature-detected. Browser behavior must remain usable when Telegram globals are absent. Telegram-specific state must not leak into feature domain types.

## 8. Localization, layout and accessibility

- Application chrome is Persian RTL; English learning content is explicitly LTR where appropriate.
- Mixed-script identifiers, code, URLs and English examples must use direction-aware wrappers rather than inheriting accidental direction.
- Dates and user-facing numbers use locale-aware formatting.
- UI controls use semantic HTML, visible keyboard focus and accessible names.
- Async loading, completion and error feedback use appropriate live/status semantics.
- Color is never the sole carrier of correctness or status.
- Touch targets, text zoom and narrow viewports are part of acceptance.
- Respect `prefers-reduced-motion`; avoid animation as a required signal.
- Do not make startup depend on a third-party font request.

## 9. Performance and resilience

- Keep the MVP dependency-light; do not add a UI kit, router or state library without evidence.
- Avoid fetching the same public catalog on every child render; catalog ownership remains in app composition.
- Abort obsolete requests when a screen unmounts or a request is superseded.
- Prevent stale async responses from overwriting a newer screen state.
- Render stable loading placeholders and preserve recoverable user choices after transient errors.
- Optimize only after recording a baseline on representative mobile devices and constrained networks.
- Do not claim Core Web Vitals, bundle-size or latency compliance without measurements.

## 10. Test strategy

| Layer | Required coverage |
| --- | --- |
| Pure unit | Route parser/serializer, DTO parsers, formatting and state derivation |
| Component | Loading/empty/error/ready states, keyboard controls, disabled/pending actions |
| API integration | Envelope parsing, auth header policy, 401 invalidation, malformed payloads |
| Learning integration | Start → answer → complete, server feedback, duplicate and retry behavior |
| Platform integration | SecureStorage supported/unsupported, BackButton and viewport cleanup |
| E2E | Telegram-like launch, public catalog, authenticated learning, progress and logout |
| Release | Typecheck, tests, production build, CI evidence and device verification |

The current frontend has dependency-free Node 22 TypeScript-stripping suites for route serialization, strict API envelope validation, lesson-question payload validation, attempt-response validation and attempt/question identity matching. These are contract unit tests, not a substitute for component, API integration or E2E tests.

## 11. Explicit non-goals until contracts exist

Do not build fake review queues, fake skill scores, mock AI tutors, fabricated course enrollment, client-side mastery estimates, or nonfunctional navigation. Review scheduling, vocabulary, grammar, listening, speaking, reading and writing each require defined learning outcomes, content schemas, API contracts, server-owned state and acceptance tests before production UI is exposed.
