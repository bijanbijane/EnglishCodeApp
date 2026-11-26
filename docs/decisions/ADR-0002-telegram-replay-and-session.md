# ADR-0002: Atomic Telegram Replay Protection and Session Issuance

- **Status:** Accepted design; implementation and D1 concurrency verification pending.
- **Date:** 2026-11-26

## Context

Telegram Mini App initData is signed but can be replayed within its validity window. A login flow must prevent a captured valid payload from creating multiple sessions. Session issuance and replay registration must not be separate best-effort operations.

## Decision

1. Validate the raw initData signature and freshness before any identity or session mutation.
2. Compute a deterministic SHA-256 fingerprint from the canonical complete validated payload; never persist raw initData.
3. Store the fingerprint in `telegram_auth_replays`, whose primary key is the fingerprint.
4. Resolve the provider-neutral internal user through the unique `(provider, provider_user_id)` identity constraint.
5. Generate an opaque 256-bit session token and persist only its SHA-256 hash.
6. Perform replay insertion and conditional session insertion in one D1 `batch()` transaction. The session insert is conditional on the immediately preceding replay insert having changed exactly one row (SQLite `changes() = 1`).
7. A duplicate fingerprint creates no session and returns a generic conflict/authentication response.
8. Add an integration test that races two identical login requests and proves exactly one session is created. If D1 batch semantics do not preserve the conditional `changes()` invariant, replace the implementation with a tested single-statement/transaction strategy before enabling login.

## Consequences

- Replay protection is persisted and survives Worker isolates/restarts.
- Raw initData and bearer tokens are not stored.
- Login is blocked until the batch behavior is verified against Local D1.
- Expired replay rows require bounded cleanup; cleanup must not run as an unbounded per-login delete.

## Alternatives rejected

- In-memory replay cache: not durable across isolates and not concurrency-safe.
- KV-only replay records: eventual consistency is not an acceptable source of truth for single-use login.
- Insert replay then create session in separate calls: failure between calls can strand a login and does not provide one atomic state transition.
