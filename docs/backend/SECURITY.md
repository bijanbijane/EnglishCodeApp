# Backend Security Baseline

**Status:** initial controls and threat boundaries are implemented in code; full runtime/security verification remains pending.

## Trust boundaries

- Client, Telegram WebApp payload, admin input, external AI output and uploaded files are untrusted.
- D1 is authoritative for identity, session state, role grants, publication, answer keys, scoring and progress.
- Only verified session principals and D1 role grants authorize protected operations.

## Implemented controls

- Telegram initData HMAC-SHA-256 verification, timestamp freshness and duplicate-parameter rejection.
- D1 replay fingerprint with conditional session insert in the same batch; raw initData is not stored.
- Random 256-bit bearer token; SHA-256 hash only in D1; 30-day expiry and revocation.
- 30/minute per-IP login rate limit with HMAC-derived pseudonymous bucket key; raw IP is not persisted by this limiter.
- 20 KiB login request limit and 256 KiB API body limit.
- Exact-origin CORS from `ALLOWED_ORIGINS`; wildcard and credentials disabled.
- User ownership derived from session; attempt reads/writes scoped by internal user ID.
- Public DTOs omit answer keys and explanations; reviewers see private answer keys only behind role checks.
- Role grants stored in D1; no public role-grant endpoint.
- Author/reviewer/admin separation, self-review prevention, publication state triggers and append-only audit/review events.
- Audit metadata allowlist drops arbitrary free text and unknown keys.
- Global `Cache-Control: no-store` on Worker responses to prevent caching of authentication and user-specific API data.
- Bounded cleanup for replay fingerprints, rate-limit buckets and stale sessions.

## Remaining controls and verification

- Real Local D1 race tests for replay, answer/complete and publish workflows.
- Verify session expiry, revocation and role revocation on Worker runtime.
- Set exact approved frontend origins; keep `ALLOWED_ORIGINS` unset until confirmed.
- Owner-controlled first-admin bootstrap and role grant/revocation maintenance process.
- Account export/deletion and backup deletion policy.
- Structured non-sensitive logging, monitoring, alerting and backup/restore drill.
- Security test matrix for every user-owned resource and every privileged route.
- Threat-model review before beta.

## Data minimization

- Never log bot tokens, raw initData, bearer tokens, private answer submissions or unnecessary profile data.
- Audit metadata is limited to allowlisted scalar fields; do not include transcripts, prompts, user notes or credentials.
- Review/audit history is append-only. Actor references may be nulled for privacy-preserving account anonymization.
- Fixtures are synthetic; no production data or secrets belong in the repository.

## Release rule

No production deployment, remote migration, secret mutation, paid provider, or plan upgrade is authorized by this document. Each requires separate explicit approval and successful applicable tests.
