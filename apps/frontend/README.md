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

Set `VITE_API_BASE_URL` to the backend origin (for example, `http://localhost:8787`). Leave it empty when using the Cloudflare Worker service-binding path, which serves the frontend and proxies `/api/*` to `englishcode-backend-dev`.

## Cloudflare Worker development and deployment

The Worker configuration serves the Vite build as static assets and forwards `/api/*` requests through the `BACKEND` service binding to `englishcode-backend-dev`.

```bash
npm run build
npm run dev:worker
npm run deploy:dry-run
npm run deploy:dev
```

The backend Worker is configured separately in `apps/backend/wrangler.jsonc` and uses the provisioned `englishcodeapp-dev` D1 database. Apply database migrations before expecting authenticated API routes to work. A dry run validates packaging and configuration; it does not deploy or prove that the remote service binding or database schema is operational.

## Validation

```bash
npm run typecheck
npm run build
npm run preview
npm run deploy:dry-run
```

## Authentication and trust boundaries

- The client sends raw `Telegram.WebApp.initData` to the backend. It never trusts `initDataUnsafe` for identity or authorization.
- The backend remains authoritative for authentication, answer correctness, scoring and progress.
- Telegram bearer tokens are stored only through Telegram Bot API 9.0+ SecureStorage (iOS Keychain / Android Keystore) and sent only in the Authorization header.
- Browser-only authentication is intentionally disabled; no token is persisted in localStorage or sessionStorage.
- If Telegram SecureStorage is unavailable, authenticated learning actions remain disabled rather than falling back to insecure browser storage.
- No database credentials, bot token or server secrets are included in the frontend bundle.
- Outside Telegram, the catalogue remains browsable, but authenticated learning actions require a supported sign-in flow.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend origin. Empty means same-origin API requests. |

The `VITE_` prefix means values are public and embedded in the client bundle. Never place secrets in these variables.
