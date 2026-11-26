# EnglishCodeApp Backend Threat Model

**Scope:** Telegram Mini App and standalone clients, Cloudflare Worker API, D1, future R2/Queues and administrative workflows.
**Status:** Design baseline; not a completed penetration test or security certification.

## Assets
- Telegram bot token and future provider credentials.
- Session bearer tokens and internal user identity.
- Learning history, answers, progress, voice recordings and written submissions.
- Private answer keys, assessment rubrics and unpublished content.
- Admin permissions, publication actions and audit history.
- Media objects, job payloads and deletion/retention state.

## Trust boundaries
1. Client to Worker: all client fields are untrusted.
2. Telegram to Worker: initData is untrusted until HMAC and freshness validation pass.
3. Worker to D1: enforce constraints and transactional invariants; never trust application-only locks.
4. Worker to R2: private object namespace, scoped upload intent and short-lived access.
5. Queue to consumer: messages can be duplicated, delayed or malformed.
6. Admin client to Worker: role claims from client are never authorization.
7. External AI/STT/TTS provider: treat payloads/results as third-party data; apply consent, redaction and retention.

## Threats and controls

| Threat | Example | Required control | Required evidence |
|---|---|---|---|
| Forged Telegram login | Fake initData | Official HMAC, fixed independent vectors, freshness | positive/negative vector tests |
| Replay login | Reuse valid initData | Unique fingerprint claim and atomic session issuance | real D1 race test |
| Token theft | Leaked bearer | Hash at rest, short TTL, revoke, no logs/URLs | log scan, session tests |
| Cross-user access | Change attempt ID | Ownership predicate on every read/write | two-user authorization suite |
| Answer disclosure | Fetch answer_key | Explicit DTO allowlist | response contract test |
| Double submission | Retry conflicting answer | Unique constraint + idempotency semantics | concurrent D1 tests |
| Double completion | Parallel complete requests | Single conditional state transition and progress write | race test and count assertion |
| Content tampering | Modify published question | Immutable versions and ETag/If-Match | version pinning tests |
| Privilege escalation | Client sets admin=true | Server-side RBAC and least privilege | role matrix tests |
| Upload abuse | Oversized/malicious file | scoped intent, size/signature/codec validation, quarantine | malformed upload tests |
| Queue replay | Duplicate delivery | outbox, idempotent consumer, bounded retry | duplicate message test |
| Prompt/data leakage | Private text sent to AI | consent, minimization, provider policy and retention | data-flow review |
| Cost exhaustion | Login/AI abuse | rate limits, quotas, kill switches, budget alerts | abuse/load test |
| Privacy overcollection | Raw voice retained forever | purpose, retention, deletion and access controls | deletion test and audit |

## Security logging rules
Never log Authorization headers, raw initData, bot tokens, full audio/transcripts, answer keys, user free text, signed upload URLs or full request bodies. Log application request ID and Cloudflare Ray ID separately. Use stable error codes and redacted context.

## Incident response minimum
- Revoke/rotate compromised Telegram bot token and invalidate sessions if required.
- Disable affected upload/job routes using a server-side kill switch.
- Preserve redacted security audit evidence.
- Identify affected data and retention obligations.
- Restore from verified backup if integrity is affected.
- Notify owner and follow applicable notification obligations.
- Document timeline, scope, root cause, corrective action and regression tests.

## Release blockers
No public beta until fixed independent Telegram vector, Local D1 concurrency tests, cross-user tests, answer-key DTO tests, origin/rate-limit policy, account deletion/retention policy, admin RBAC/audit controls (if admin routes ship), backup/restore exercise and CI are verified.
