# ADR-0002: Telegram identity and opaque bearer sessions

- Status: Proposed implementation baseline; review required before production use.
- Date: 2026-11-26

## Context

The first client is a Telegram Mini App, but the learning domain must remain independent of Telegram so that a web or mobile client can be added later. The backend must verify Telegram identity server-side and must not trust client-provided user IDs.

## Decision

- Validate raw Telegram Mini App initData using the official HMAC-SHA-256 procedure and enforce auth_date freshness.
- Map the verified Telegram user ID to an internal users.id.
- Issue a random opaque bearer token after successful validation.
- Store only the SHA-256 hash of the token in D1.
- Enforce expiry and support revocation.
- Keep the authentication adapter in the auth module; domain use cases depend on internal user identity, not Telegram payloads.

## Alternatives considered

- Trusting initDataUnsafe: rejected; it is not a server-verifiable authentication proof.
- Using Telegram user ID as the primary application ID: rejected; it couples the whole data model to one channel.
- Storing raw bearer tokens: rejected; a database read would expose usable credentials.
- Cookie sessions: deferred; the initial Mini App API uses bearer transport. Browser origin/CSRF requirements must be evaluated before a cookie-based web client.

## Consequences

- The backend requires the bot token as a secret.
- Sessions need cleanup/retention policy and expiry handling.
- Bearer tokens must be protected by clients and excluded from logs.
- Rate limiting and abuse controls remain required before public beta.
