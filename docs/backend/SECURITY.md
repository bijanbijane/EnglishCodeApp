# Backend security baseline

## Identity and sessions

- Only raw Telegram Mini App `initData` is accepted as authentication evidence.
- HMAC-SHA-256 verification follows Telegram's documented Web Apps algorithm.
- Duplicate query keys, missing/invalid hash, malformed user data, expired auth_date, and implausibly future auth_date are rejected.
- Telegram bot token is an environment secret; never store it in Git or return it to the client.
- The backend issues a cryptographically random opaque bearer token. Only its SHA-256 hash is stored in D1.
- Sessions expire and can be revoked. Current default TTL is 7 days, bounded by a 5-minute minimum and 30-day maximum.
- Session tokens must never be logged or placed in URLs.

## Authorization

- User identity is derived from the validated session.
- User-owned reads and writes include the authenticated user ID in their database predicate.
- The browser cannot choose attempt ownership or provide answer correctness.
- Public question DTOs exclude answer keys.

## Input and error handling

- JSON payloads are parsed at the route boundary.
- User-supplied identifiers and answer IDs have length bounds.
- API errors use stable codes and do not expose SQL, secret values, stack traces, or internal configuration.
- A request ID is returned in the response headers and structured error body.

## Data integrity

- Foreign keys protect ownership and content references.
- Unique index prevents multiple stored answers for the same question in one attempt.
- D1 remains the source of truth; no in-memory cache is used for identity or progress.
- Session token hashes, not raw bearer tokens, are persisted.

## Required before public beta

1. Configure and test platform-level rate limits for authentication and write endpoints.
2. Define origin/CORS policy for each deployed frontend origin; same-origin hosting is preferred.
3. Define data retention, account deletion, and data export behavior.
4. Add security tests for cross-user access, session expiry/revocation, replay, malformed JSON, and request abuse.
5. Run end-to-end tests against local D1 and verify migration/recovery procedures.
6. Add operational monitoring that excludes initData, bearer tokens, answer content, and other unnecessary personal data.

This document is a baseline, not a claim that the system has passed a security audit.
