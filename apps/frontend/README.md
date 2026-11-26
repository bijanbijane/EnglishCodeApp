# Frontend — Telegram Mini App first

React 19 + Vite + TypeScript. EnglishCodeApp's primary client is a Telegram Mini App, with browser-only development fallback.

## Verified in the current branch

- React StrictMode entrypoint.
- Persian RTL lesson catalog.
- GET `/api/v1/lessons` with loading, empty, error and retry states.
- Vite development proxy from `/api` to `http://localhost:8787`.

## Not implemented yet

- Telegram WebApp script/bootstrap and host capability adapter.
- Telegram initData authentication and SecureStorage session restore.
- Telegram theme, safe-area, viewport, BackButton and MainButton integration.
- Lesson question screen and backend attempt lifecycle.
- Answer submission, server-calculated result, profile and progress.
- Runtime API response validation, abort/timeout handling and error boundary.
- Frontend unit/component/E2E tests and production API routing.

## Architecture documents

- [Telegram Mini App architecture](../../docs/frontend/telegram-mini-app-architecture.md) — authoritative host-platform design and authentication lifecycle.
- [Frontend architecture audit and roadmap](../../docs/frontend/architecture-and-roadmap.md)
- [ADR-0003](../../docs/decisions/ADR-0003-frontend-architecture.md)

## Run locally

Start the backend and frontend in separate terminals:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173. The Vite proxy is development-only. Production routing to the Worker is not configured.

## Security boundaries

- Supported authenticated launch surfaces: Main Mini App and bot menu button.
- Keyboard-button and inline-mode launch are not supported for the authenticated experience because Telegram documents empty initData for these launch modes.
- Send raw `Telegram.WebApp.initData` only to backend authentication; never trust `initDataUnsafe`.
- Prefer Telegram SecureStorage for the opaque session token when available; no silent localStorage fallback.
- Never place bot token or server secrets in frontend source or Vite environment variables.
- Backend remains authoritative for identity, attempt ownership, correctness, score and progress.
