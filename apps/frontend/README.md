# Frontend — Current state and architecture

React 19 + Vite + TypeScript. The current branch contains a minimal Persian RTL lesson-catalog screen only.

## Verified in the current branch

- React StrictMode entrypoint.
- RTL landing/catalog shell.
- GET `/api/v1/lessons` with loading, empty, error and retry states.
- Vite development proxy from `/api` to `http://localhost:8787`.

## Not implemented in this branch

- Lesson question screen and attempt lifecycle.
- Answer submission and server-calculated result.
- Authentication/session client and Telegram WebApp bridge.
- Profile and persisted progress screens.
- Runtime API response validation, abort/timeout handling and error boundary.
- Frontend unit/component/E2E test suite.
- Production API routing configuration and Telegram theme/safe-area integration.

PR #1's earlier lesson detail/answer UI calls legacy endpoints (`GET /lessons/:id` and `POST /lessons/:id/check`). Those do not match the backend foundation contract. Do not copy that UI unchanged; implement against `docs/backend/API.md`.

## Run locally

Start the backend and frontend in separate terminals:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173. The Vite proxy is development-only. The production target is same-origin `/api/v1` routing through the selected Worker/static-assets configuration. No production routing has been configured.

## Architecture and roadmap

See [Frontend architecture audit and roadmap](../../docs/frontend/architecture-and-roadmap.md) and [ADR-0003](../../docs/decisions/ADR-0003-frontend-architecture.md).

## Important security boundaries

- Send only raw `Telegram.WebApp.initData` to backend authentication; never trust `initDataUnsafe`.
- Never place bot token or server secrets in frontend source or Vite environment variables.
- Backend remains authoritative for identity, attempt ownership, correctness, score and progress.
- Do not persist session tokens in localStorage by default. Session persistence must follow the approved auth decision.
