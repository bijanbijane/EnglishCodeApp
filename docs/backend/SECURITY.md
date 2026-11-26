# Backend Security Baseline

**Status:** control requirements and initial safeguards; not a completed security review.

## Trust boundaries

- Browser/Telegram Mini App requests are untrusted until validated.
- Telegram initData is authentication evidence only after server-side HMAC verification and freshness checks.
- D1 is authoritative for identity, session state, content publication, assessment results, and progress.
- Queue messages, uploaded files, and external AI output must be treated as untrusted inputs.
- Public pre-answer content DTOs must not contain answer keys, answer explanations, staff-only metadata, or unpublished records.

## Authentication requirements

- Accept raw `Telegram.WebApp.initData`; never accept `initDataUnsafe` as proof.
- Enforce JSON content type and strict request-body limits.
- Reject duplicate initData parameter names and malformed required fields.
- Validate Telegram's HMAC-SHA-256 construction and `auth_date` age/future skew.
- Use an independently generated official test vector plus tampering and replay tests.
- Persist only a deterministic cryptographic fingerprint for replay prevention; never persist raw initData.
- Store only a cryptographic hash of opaque session tokens.
- Sessions require expiry and revocation; tokens must not appear in URLs, logs, analytics, or exception messages.

## Authorization requirements

- Derive the principal from a verified session, not request body or query parameters.
- Every user-owned read and write must scope by the principal's internal user ID.
- Attempt ownership and state must be checked in the same write transaction/conditional statement as answer mutation.
- Staff roles must be server-managed and auditable. No client-provided role is trusted.
- Admin bootstrap and role revocation require a documented, recoverable process.

## HTTP and abuse controls

- Keep CORS disabled until exact origins and same-origin deployment topology are known.
- If cookie sessions are selected, define SameSite, Secure, HttpOnly and CSRF protections before enabling them.
- Apply route-specific rate limits to authentication, attempt creation, answer submission, and administration.
- Bound request bodies, string lengths, pagination size, and expensive query paths.
- Return stable error codes without SQL, stack traces, secrets, or private record details.
- Use a server-generated request ID. Treat Cloudflare Ray ID as separate diagnostic metadata.

## Data minimization and privacy

- Do not log bot tokens, raw initData, bearer tokens, answer submissions, or unnecessary profile fields.
- Store Telegram numeric identifiers as text to avoid precision loss across JavaScript and SQLite.
- Define retention, account export, account deletion, and backup deletion behavior before real-user onboarding.
- Use synthetic fixtures only. Never commit production data or credentials.

## Required security test matrix

- Invalid, missing, expired, future-dated, duplicate-parameter, and tampered initData.
- Replay and concurrent duplicate login.
- Session expiry, revocation, and token rotation.
- Cross-user reads/writes for every user-owned resource.
- Answer-key non-disclosure through all public routes and error paths.
- Duplicate answer, stale attempt, completed attempt, and concurrent completion.
- Rate-limit behavior and malformed/oversized bodies.
- Admin role denial, role revocation, and audit integrity.

## Release rule

No production deployment, remote migration, secret mutation, paid provider, or plan upgrade is authorized by this document. Each requires a separate explicit approval after the applicable tests and recovery plan pass.
