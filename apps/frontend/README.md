# Frontend — Minimal learning interface

React 19 + Vite + TypeScript mobile-first starter.

## Implemented

- Persian RTL landing/learning screen.
- API-backed published lesson list.
- Loading, error, retry and empty states.
- Vite development proxy for `/api` to `http://localhost:8787`.

## Run locally

Start the backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173. Without a D1 binding, the API will report that lessons are temporarily unavailable; the frontend displays an error and retry action.

## Not implemented yet

Telegram WebApp SDK integration, sign-in, lesson player, answer submission, profile and progress views.
