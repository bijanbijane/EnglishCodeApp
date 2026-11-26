# Frontend — Telegram Mini App

## Implemented application

The frontend is a React 19 + TypeScript + Vite application. It currently provides:

- A responsive course catalogue backed by `GET /api/v1/courses`.
- Published lesson lists backed by `GET /api/v1/courses/:courseId/lessons`.
- Telegram Mini App initialization and server-verified sign-in using raw `Telegram.WebApp.initData`.
- Bearer-session restoration and authenticated profile loading.
- Server-owned lesson attempts, answer submission, grading and completion.
- Loading, empty, error and retry-friendly states.
- Mobile-first layout, keyboard focus states and reduced-motion support.

## Local development

```bash
cd apps/frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_API_BASE_URL` to the backend origin (for example, `http://localhost:8787`). Leave it empty only when the frontend and API are served from the same origin.

## Validation

```bash
npm run typecheck
npm run build
npm run preview
```

## Authentication and trust boundaries

- The client sends raw `Telegram.WebApp.initData` to the backend. It never trusts `initDataUnsafe` for identity or authorization.
- The backend remains authoritative for authentication, answer correctness, scoring and progress.
- The bearer token is held in session-scoped browser storage and sent only in the Authorization header.
- No database credentials, bot token or server secrets are included in the frontend bundle.
- Outside Telegram, the catalogue remains browsable, but authenticated learning actions require a supported sign-in flow.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend origin. Empty means same-origin API requests. |

The `VITE_` prefix means values are public and embedded in the client bundle. Never place secrets in these variables.
