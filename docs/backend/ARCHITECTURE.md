# Backend Architecture

**Status:** implementation baseline; not production-ready.  
**Runtime:** Cloudflare Workers + Hono + TypeScript.  
**Transactional store:** Cloudflare D1.  
**Architecture style:** modular monolith.

## Boundaries

- HTTP transport validates and normalizes requests, then calls application/domain logic.
- Domain rules must not import Hono or Cloudflare binding types.
- D1 access belongs behind repository adapters; route handlers must not become the persistence layer.
- Telegram is an identity/channel adapter, not the owner of the learning domain.
- The API is versioned under `/api/v1`.
- The server is authoritative for identity, authorization, answer keys, scoring, and progress.

## Runtime contracts

- `GET /api/v1/health`: process liveness; no dependency calls.
- `GET /api/v1/ready`: readiness; verifies D1 with a bounded lightweight query.
- Success envelope: `{ "data": ..., "meta": { "requestId": ... } }`.
- Error envelope: `{ "error": { "code": ..., "message": ..., "requestId": ... } }`.
- Internal errors must not disclose stack traces, SQL, tokens, or secrets.
- CORS remains disabled until the exact production frontend origins are known. Prefer same-origin routing.

## Data invariants

- SQL migrations are canonical; never edit a migration after it has been applied.
- Telegram numeric IDs are stored as text to avoid JavaScript integer precision loss.
- Session tokens are random bearer secrets; only a cryptographic hash is persisted.
- Public lesson/question DTOs must never include `answer_key`.
- User ownership is derived from the authenticated principal, never from a client-supplied user ID.
- Attempt answers are unique per attempt/question pair.
- All timestamps are UTC ISO-8601 strings.

## Cloudflare resource policy

- D1 is the only required binding for the initial API.
- R2, Queues, KV, Durable Objects, and Workers AI remain disabled until a concrete use case and cost/limit review justify them.
- No production database, secret, deployment, paid service, or plan upgrade is created by this change.
- Queue work must be persisted in D1 (outbox/job record) before enqueueing; consumers must be idempotent.

## Delivery gates

1. Install dependencies and run typecheck.
2. Run migrations against a fresh local D1 database.
3. Add unit and D1 integration tests for auth, ownership, scoring, replay, and concurrent completion.
4. Add explicit Telegram auth and session modules.
5. Add rate limiting, origin policy, retention, export/delete, and operational runbooks.
6. Run CI and review before staging deployment.

The files created in this baseline are scaffolding, not evidence that these gates have passed.
