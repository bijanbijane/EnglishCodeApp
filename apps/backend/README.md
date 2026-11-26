# Backend — Minimal API foundation

## Implemented

- Hono application with a Cloudflare Worker-compatible fetch entrypoint.
- Local Node development adapter with an isolated in-memory demo fixture.
- `GET /api/v1/health`.
- `GET /api/v1/lessons`, reading published lessons from the D1 binding.
- Structured 404/500/503 responses.
- API tests for health, configured database, missing D1 binding and unknown routes.

## Run locally

```bash
npm run dev:backend
```

The local Node adapter supplies demo lesson rows so the frontend can be previewed without creating a Cloudflare account or database. This fixture is local-only and is not imported by the Worker entrypoint. It is not persistent and must never be used as production data.

## Cloudflare boundary

The Worker entrypoint is `src/index.ts`. D1 is an optional binding in the current type contract. No Cloudflare account resource, secret, deployment or Wrangler configuration is created by this scaffold. For this new project, follow the Cloudflare `cf` CLI workflow rather than introducing Wrangler by default.

## Not implemented yet

Telegram initData verification, sessions, authorization, lesson attempts, answer grading, progress writes, rate limiting and production observability. Do not treat this API as production-ready.
