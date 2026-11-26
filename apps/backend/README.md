# Backend — Minimal API foundation

## Implemented

- Hono application with a Cloudflare Worker-compatible fetch entrypoint.
- Local Node development adapter for quick frontend/backend iteration.
- `GET /api/v1/health`.
- `GET /api/v1/lessons`, reading published lessons from the D1 binding.
- Structured 404/500/503 responses.
- Unit tests for health, missing D1 binding and unknown routes.

## Run locally

```bash
npm run dev:backend
```

The local Node adapter does not emulate D1. The health route works locally; lessons return a deliberate 503 until a D1 binding is configured.

## Cloudflare boundary

The Worker entrypoint is `src/index.ts`. D1 is an optional binding in the current type contract. No Cloudflare account resource, secret, deployment or Wrangler configuration is created by this scaffold. For this new project, follow the Cloudflare `cf` CLI workflow rather than introducing Wrangler by default.

## Not implemented yet

Telegram initData verification, sessions, authorization, lesson attempts, answer grading, progress writes, rate limiting and production observability. Do not treat this API as production-ready.
