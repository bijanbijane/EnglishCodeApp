# Frontend Platform Adapter — Telegram and Browser

## Purpose

The same React feature modules must run inside Telegram Mini App and in a normal browser. Platform-specific behavior belongs in `src/services/platform`; feature modules must not read `window.Telegram` directly.

## Implemented boundary

- `getPlatformContext()` detects Telegram versus browser and returns a normalized, typed context.
- The raw `initData` string is exposed unchanged for the backend verification request. `initDataUnsafe` is intentionally not read.
- Theme, platform/version, viewport and safe-area values are optional and capability-detected.
- `initializeTelegramHost()` calls the host `ready()` lifecycle method once at root app initialization, independently of network/session state; a React StrictMode guard prevents duplicate calls during development effect replay.
- Bot API 9.0 SecureStorage is capability-detected and wrapped in Promise-based get/set/remove functions.
- The session key is stored only in Telegram SecureStorage; unsupported hosts fail closed.
- Viewport, safe-area and theme changes are synchronized into CSS variables; subscriptions and BackButton registration return cleanup functions.
- Browser mode returns a stable context with null host-only values and does not throw.

## Security constraints

- The adapter does not authenticate the user. The backend must validate raw initData signature, age and replay state.
- It never reads bot secrets or grades answers. The identity session service stores the backend-issued bearer token in Telegram SecureStorage only; the API client attaches it only when a feature explicitly requests an authenticated call.
- Do not add localStorage/sessionStorage bearer-token persistence.
- Telegram attempt, answer, complete and logout calls use the implemented Bearer session contract. Keep browser authentication disabled until the backend implements and documents a secure HttpOnly cookie/session contract.

## Remaining integration

1. Verify the official Telegram WebApp bridge and `ready()` lifecycle in supported Telegram clients.
2. Verify viewport, safe-area and theme CSS variable updates on device rotation and Telegram theme changes.
3. Verify BackButton behavior and handler cleanup on route changes.
4. Exercise SecureStorage get/set/remove, unsupported-version and restoration/error paths on iOS and Android.
5. Add browser session support only after the backend implements and documents a secure HttpOnly cookie/session contract.

## Verification status

The adapter and SecureStorage session path are source-implemented but not runtime-verified in Telegram or a browser. Host API availability varies by Telegram client and version; every optional capability must remain guarded.
