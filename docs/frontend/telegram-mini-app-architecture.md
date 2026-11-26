# Telegram Mini App architecture — corrected frontend specification

**Status:** Required design baseline for EnglishCodeApp. Reviewed against the official Telegram Mini Apps documentation on 2026-11-26. This document corrects the generic web-app assumptions in the first frontend roadmap. It does not claim that Telegram integration is implemented.

## 1. Product decision

EnglishCodeApp is a **Telegram-first Mini App**, not a conventional responsive website embedded in a WebView.

The first production client must be optimized for Telegram iOS, Android and Desktop, while retaining a browser-only development fallback. Telegram is a host platform adapter, not the owner of learning-domain logic or persisted learning data.

Recommended initial launch surfaces:
1. Main Mini App launched from the bot profile's Launch App button.
2. Bot menu button configured to open the same Mini App.

Do not use a keyboard-button or inline-mode launch as the primary authenticated entry point. Telegram documents that `initData` is empty for Mini Apps launched from keyboard buttons or inline mode. The current backend login requires signed initData, so those launch modes would produce an authentication dead end unless a separate, explicitly designed flow is introduced.

Direct links can be supported later. Treat `start_param` only as an untrusted navigation hint (e.g. open a lesson slug); never as proof of identity, entitlement, ownership or authorization.

## 2. Confirmed repository gaps

The current branch was inspected:

- `apps/frontend/index.html` does not load Telegram's `telegram-web-app.js` in the document head.
- `apps/frontend/src/App.tsx` does not read `window.Telegram.WebApp`, call `ready()`, synchronize theme/viewport, or integrate Telegram buttons.
- `apps/frontend/src/styles.css` uses a fixed light background, a fixed gradient hero and conventional page margins; it does not consume Telegram theme variables or safe-area insets.
- The UI does not distinguish browser development from an actual Telegram launch.
- The current API requires `POST /api/v1/auth/telegram` with raw initData, but there is no frontend auth adapter.
- The backend rejects replayed initData and issues an opaque Bearer session. The client has no session restoration strategy.

These are implementation gaps, not merely styling improvements.

## 3. Target frontend structure

Keep one React/Vite application and add a strict host-platform boundary:

```text
apps/frontend/src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── providers.tsx
│   └── bootstrap.ts
├── features/
│   ├── auth/
│   ├── lessons/
│   ├── assessment/
│   └── progress/
├── pages/
│   ├── HomePage.tsx
│   ├── LessonPage.tsx
│   ├── ResultPage.tsx
│   └── ProgressPage.tsx
├── platform/
│   └── telegram/
│       ├── telegram.types.ts
│       ├── telegram.client.ts
│       ├── telegram.capabilities.ts
│       ├── telegram.theme.ts
│       ├── telegram.viewport.ts
│       ├── telegram.buttons.ts
│       ├── telegram.storage.ts
│       └── useTelegram.ts
├── shared/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   └── styles/
└── test/
    ├── fixtures/
    ├── mocks/
    └── setup.ts
```

Rules:
- Feature modules must not import Telegram SDK types directly.
- Only `platform/telegram` may call Telegram WebApp APIs.
- App bootstrap detects host capabilities once and exposes a typed adapter.
- Browser preview uses a clearly marked development adapter. It must not impersonate a real Telegram identity or silently bypass backend auth in production.
- Keep React StrictMode enabled. All event subscriptions must have matching cleanup.

## 4. Bootstrap and launch lifecycle

### HTML bootstrap

Load the official Telegram script in `apps/frontend/index.html` inside `<head>`, before the Vite module entry:

```html
<script src="https://telegram.org/js/telegram-web-app.js?65"></script>
```

The exact version query must be reviewed when upgrading the Telegram WebApp API. The script must not be duplicated by a second dynamic loader.

### React bootstrap sequence

1. Read `window.Telegram?.WebApp` through the platform adapter.
2. Detect Telegram presence and supported API version/capabilities.
3. Register theme, viewport, safe-area, activation and deactivation listeners.
4. Apply initial theme and viewport values.
5. Mount the essential shell and initial loading state.
6. Call `WebApp.ready()` as soon as the essential UI is ready; do not wait for all lesson/API requests.
7. Request `expand()` only if the chosen launch surface/UX needs it and the method is supported. Do not force fullscreen at startup.
8. Initialize session restoration/authentication.
9. Load user-scoped data only after authentication is established.

The bootstrap must be idempotent under React StrictMode and must not register duplicate listeners.

## 5. Telegram launch modes and authentication

The current backend contract is:
- `POST /api/v1/auth/telegram` accepts raw `initData`.
- It validates Telegram HMAC and auth_date.
- It rejects reuse of the same signed initData fingerprint.
- It returns an opaque Bearer token and expiry.
- `GET /api/v1/me` validates an existing session.
- `POST /api/v1/auth/logout` revokes the current session.

### Launch mode policy

| Launch surface | Primary support | Reason |
|---|---|---|
| Main Mini App / profile Launch App | Yes | Preferred authenticated entry point |
| Bot menu button | Yes | Same authenticated Mini App experience |
| Direct link / startapp | Later | Support only after validating launch payload and treating start_param as untrusted route input |
| Keyboard button | No for authenticated app | Telegram documents initData is empty in this mode |
| Inline mode | No for authenticated app | Telegram documents initData is empty in this mode |
| Browser outside Telegram | Development only by default | No Telegram identity; no production auth bypass |

### Session storage decision

The previous generic roadmap left this unresolved. For a Telegram-first app, use this preference order:

1. **Telegram SecureStorage** for the opaque backend session token when available and supported (Bot API 9.0+). Feature-detect the object/methods and version; do not assume every Telegram client exposes it.
2. Keep the token in memory for the active app session.
3. If SecureStorage is unavailable, do not silently fall back to localStorage or Telegram CloudStorage for a bearer token. Use an explicit limited-session behavior and require a fresh valid Telegram launch/authentication when the in-memory session is lost.
4. Store non-sensitive UI preferences in DeviceStorage if useful. Do not store authoritative progress, answer state, identity claims or entitlements there.

SecureStorage encrypts values at rest using the device's Keychain/Keystore according to Telegram's documentation. It does not protect a token from malicious JavaScript running inside the active Mini App. Therefore XSS prevention, CSP, dependency hygiene and no token logging remain mandatory.

### Session bootstrap algorithm

- Try to read the token from Telegram SecureStorage.
- If a token exists, call `GET /api/v1/me`.
- If valid, enter the authenticated app.
- If 401/expired, remove the stored token and enter the re-authentication state.
- If no token exists and raw initData is non-empty, send it once to `POST /api/v1/auth/telegram`; store the returned token in SecureStorage if supported, then call/load `/me`.
- If initData is empty, do not read identity from `initDataUnsafe`; show an explicit unsupported-launch message and direct the user to open the bot's Main Mini App/menu button.
- Never automatically retry the same initData after a replay/409 response.
- Never place initData or the session token in a URL, analytics event, console log or error report.

### Backend follow-up

Before coding auth persistence, verify actual backend session TTL and revocation behavior. If product requirements need renewal without a fresh Telegram launch, design a separate refresh/renewal contract with rotation and replay controls; do not weaken the existing one-time initData replay defense.

## 6. Telegram-native navigation and buttons

### BackButton

- Use Telegram's native BackButton for in-app navigation where supported.
- Show it only when the app has an internal page/history entry to return to.
- Hide it on the root/home page.
- On click, invoke the router's back behavior; if there is no safe internal history, navigate to a deterministic in-app fallback.
- Register and unregister the click callback exactly once.
- Do not confuse Telegram's BackButton with closing the Mini App.

### MainButton / BottomButton

Use the Telegram bottom MainButton for the single primary action in a focused task flow:
- Start lesson
- Submit/continue after an answer is selected
- Complete lesson / view result

Do not show it on every screen. Hide it when there is no valid primary action. Disable it while validation/submission is pending; use Telegram's progress state for longer requests. Prevent duplicate submissions in application state as well as the button UI.

Avoid displaying a second visually competing sticky CTA inside the page. If the task has multiple independent actions, keep secondary actions inside the content or use Telegram SecondaryButton only when the layout clearly warrants it.

### Haptics

Use light selection feedback only for meaningful selection changes and success/error notifications only after the server confirms the result. Do not use haptics as decoration and provide a non-haptic visual equivalent.

## 7. Viewport, safe areas and mobile WebView

- Do not use `100vh` as the sole app-height contract.
- Use Telegram's `--tg-viewport-stable-height` for stable bottom-anchored layout sizing; the live viewport height changes during drag/expand animation and is not suitable for pinning fixed UI.
- Subscribe to `viewportChanged`; update layout when stable state changes.
- Respect both `safeAreaInset` and `contentSafeAreaInset`. Telegram exposes CSS variables such as `--tg-safe-area-inset-top` and `--tg-content-safe-area-inset-bottom`.
- Account for iPhone notch/home indicator, Android navigation bars, Telegram's own bottom button and keyboard.
- When the software keyboard opens, allow content to scroll and focused fields to remain visible. Do not pin a custom footer over the keyboard.
- Keep vertical swipe-to-close enabled unless a specific tested gesture conflict makes disabling it necessary.
- Do not request fullscreen by default for a learning app. Consider it only for a clearly immersive mode (e.g. a full-screen video exercise), with an explicit user action and a graceful fallback.

## 8. Theme and visual design corrections

The current fixed palette/gradient is not an appropriate default for a host-controlled Mini App.

- Use Telegram theme variables for page background, text, hint, link, button, button text and secondary surfaces.
- Listen to `themeChanged` and update immediately without reloading.
- Set Telegram header/background colors to harmonize with the app surface; avoid a visual seam between Telegram chrome and the app.
- Provide fallbacks for missing optional theme fields.
- Maintain accessible contrast; do not assume Telegram's button color guarantees readable text for every custom theme.
- Use the existing product accent only as a restrained accent, not as a fixed full-page background.
- Remove browser-like duplicate chrome and unnecessary "test version" badges from the production Mini App shell.
- Keep a compact brand/header area; devote most initial viewport space to the learning action and lesson content.
- Use RTL as the shell direction; set English question/code spans to `dir="ltr"` or `dir="auto"`.

## 9. Navigation and app state

Recommended first-level navigation:
- Home / lesson catalog
- Current lesson
- Result
- Progress
- Profile/settings (later, once required endpoints exist)

The router owns navigation state; Telegram BackButton mirrors that state. Avoid implementing a second custom history stack.

Persist only what is needed to recover an in-progress interaction. The server remains authoritative for attempt ownership, accepted answers, score and progress. If attempt recovery is required after a WebView reload, the backend must expose a safe "current attempt/resume" endpoint scoped to the authenticated session. Do not attempt to reconstruct server state from localStorage or URL parameters.

## 10. Performance and reliability

- Keep initial JS and CSS payload small; defer nonessential modules.
- Avoid large animation libraries, expensive blur/backdrop filters and continuous layout measurements.
- Respect reduced motion and Android device performance class when available.
- Avoid loading lesson media until needed; use responsive media dimensions and lazy loading.
- Cache only public lesson catalog/questions when policy allows; never treat cached private progress as authoritative.
- Handle network interruption and app deactivation. Abort stale reads; do not abort an answer write after it may have reached the server without checking the attempt state.
- Make answer submission UX resilient to repeated taps and uncertain network outcomes. The backend currently returns the stored answer for duplicate question submissions; the client should still lock the action while pending and reconcile by refetching server state when needed.

## 11. Security and privacy

- Raw initData is sent only to the backend authentication endpoint over HTTPS.
- Bot token is a Worker secret; never ship it to Vite/client bundles.
- No identity is derived from initDataUnsafe, query params, start_param, username or photo_url.
- Do not log initData, bearer tokens, full Telegram user payloads or question-answer private state.
- Enforce CSP and minimize third-party scripts/dependencies. Avoid injecting untrusted HTML.
- Treat all startapp parameters as untrusted and allowlist navigation targets.
- Production browser mode must not contain a mock identity or bypass auth.
- DeviceStorage/SecureStorage are caches, not the source of truth for learning records.

## 12. Test matrix — Telegram-specific

| Platform / condition | Required verification |
|---|---|
| Telegram iOS, light theme | bootstrap, safe-area, native buttons, keyboard, back navigation |
| Telegram iOS, dark/custom theme | live theme change, contrast, Telegram header integration |
| Telegram Android, light/dark | safe-area/navigation bar, keyboard, swipe behavior, performance |
| Telegram Desktop | window resizing, keyboard navigation, native button fallback |
| Telegram Web | script availability, secure storage capability detection, viewport fallback |
| Main Mini App launch | valid initData and successful login |
| Menu button launch | same login/session path |
| Keyboard/inline launch | explicit unsupported auth state; no silent bypass |
| Direct link with start_param | allowlisted navigation only; no authorization based on parameter |
| SecureStorage supported | save, read, expire, revoke and clear token |
| SecureStorage absent/failed | memory-only behavior and clear re-authentication path |
| Viewport expand/collapse | stable-height handling and no fixed-control overlap |
| Orientation/safe-area change | content remains visible and scrollable |
| App deactivated/reactivated | no duplicate listeners or duplicate writes |
| Network loss during answer | no duplicate score/answer; reconcile with backend |

## 13. Revised implementation order

- **T0 — Launch/auth contract:** confirm Main Mini App + menu button as supported launch surfaces; document unsupported keyboard/inline auth modes.
- **T1 — Telegram bootstrap:** load official script, typed WebApp adapter, version/capability detection, ready lifecycle and browser dev adapter.
- **T2 — Session lifecycle:** SecureStorage feature detection, session restore, /me validation, logout and expired/replay states; confirm backend TTL.
- **T3 — Host UI integration:** theme, header/background, viewport, safe-area, BackButton and MainButton.
- **T4 — Learning journey:** lesson → attempt → answer → completion using backend API v1.
- **T5 — Resilience and QA:** iOS/Android/Desktop/Web test matrix, E2E, security, accessibility and performance.

### Acceptance gate

The Mini App MVP is not complete until a real user can launch from the bot's Main Mini App or menu button, authenticate with server-verified initData, restore a valid session, complete a lesson through the backend v1 attempt flow, see persisted progress, and navigate without viewport/theme/button regressions on supported Telegram clients.

No Telegram BotFather configuration, bot token, Cloudflare resource, production deployment or paid service is changed by this design document.

## 14. Official references

- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Launch modes and initData behavior: https://core.telegram.org/bots/webapps#implementing-mini-apps
- Telegram theme, viewport and safe-area APIs: https://core.telegram.org/bots/webapps#initializing-mini-apps
- SecureStorage: https://core.telegram.org/bots/webapps#securestorage
