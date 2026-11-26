# Frontend Platform Adapter — Telegram and Browser

## Purpose

The same React feature modules must run inside Telegram Mini App and in a normal browser. Platform-specific behavior belongs in `src/services/platform`; feature modules must not read `window.Telegram` directly.

## Implemented boundary

- `getPlatformContext()` detects Telegram versus browser and returns a normalized, typed context.
- The raw `initData` string is exposed unchanged for the backend verification request. `initDataUnsafe` is intentionally not read.
- Theme, platform/version, viewport and safe-area values are optional and capability-detected.
- `initializeTelegramHost()` calls the host `ready()` lifecycle method when available.
- Viewport subscriptions and BackButton registration return cleanup functions.
- Browser mode returns a stable context with null host-only values and does not throw.

## Security constraints

- The adapter does not authenticate the user. The backend must validate raw initData signature, age and replay state.
- It does not store tokens, read bot secrets, authorize requests or grade answers.
- Do not add localStorage/sessionStorage bearer-token persistence.
- Do not enable attempt, answer, complete or logout calls until the session transport is explicitly approved and implemented on both client and server.

## Remaining integration

1. Load the official Telegram WebApp bridge in the Mini App document and verify initialization in supported Telegram clients.
2. Connect viewport and safe-area values to CSS variables and layout state.
3. Bind BackButton to the navigation stack and verify handler cleanup.
4. Map Telegram theme parameters to design tokens while preserving contrast.
5. Implement SecureStorage only after verifying supported host versions and agreeing on token lifecycle with the backend.
6. Add browser session support through a backend-approved secure cookie/session contract.

## Verification status

The adapter is source-implemented but not runtime-verified in Telegram or a browser. Host API availability varies by Telegram client and version; every optional capability must remain guarded.
