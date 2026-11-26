# Backend Data Model

**Store:** Cloudflare D1 / SQLite.  
**Canonical schema:** forward-only SQL under `database/migrations/`.  
**Main migration sequence:** `0001`–`0010`.

## Identity and security

| Table | Purpose | Invariants |
|---|---|---|
| `users` | Internal application account | Provider-independent stable ID |
| `external_identities` | Provider subject mapping | Unique `(provider, provider_user_id)`; Telegram numeric ID stored as text |
| `sessions` | Bearer session lifecycle | Token hash only; expiry and revocation enforced |
| `telegram_auth_replays` | Telegram initData replay protection | Unique fingerprint; no raw initData |
| `auth_rate_limits` | Login abuse control | HMAC-derived IP bucket; fixed UTC minute; no raw IP |
| `user_roles` | Server-side role grants | One active grant per user/role; no public grant API |
| `admin_audit_events` | Privileged action history | Allowlisted metadata, append-only trigger, keyset indexes |

## Catalog and immutable content

| Table | Purpose | Invariants |
|---|---|---|
| `courses` | Course catalog | Public reads expose published courses only |
| `lessons` | Stable lesson identity | Current published pointer must reference its own published version |
| `lesson_versions` | Lesson content versions | Draft before publish; published versions cannot be updated/deleted |
| `questions` | Stable source question identity | Private answer key; never public DTO |
| `question_versions` | Versioned assessment content | Immutable after parent lesson version is published |
| `assessment_policy_versions` | Versioned scoring configuration | Immutable policy rows |

## Review workflow

| Table | Purpose | Invariants |
|---|---|---|
| `content_review_requests` | Review state for a lesson version | One request per version; controlled state machine; no self-review |
| `content_review_events` | Review history | Append-only; actor may be anonymized on account deletion |

The first admin role is owner-bootstrapped through a trusted D1 batch. There is no public role-grant endpoint. See `ADMIN-BOOTSTRAP.md`.

## Assessment and progress

| Table | Purpose | Invariants |
|---|---|---|
| `lesson_attempts` | User-owned attempt | Pins lesson and assessment policy versions; explicit state |
| `attempt_questions` | Per-attempt immutable snapshot | Question ID/type/prompt/options/answer key/order/weight |
| `attempt_answers` | Accepted answer | Unique `(attempt_id, question_id)`; server graded |
| `user_progress` | Read projection | Updated only by winning completion transition |

Existing attempts retain their own snapshots. Historical source content is not guessed or rewritten during version backfill.

## Retention

- Replay fingerprints: deleted after expiry in bounded batches.
- Rate-limit buckets: deleted after 48 hours in bounded batches.
- Unrevoked expired sessions: retained at least seven days after expiry.
- Revoked sessions: retained at least 30 days after revocation.
- Review and audit history is append-only; actor references may be nulled to support account anonymization.

## Invariants

- Parameterized SQL only.
- Foreign keys, unique indexes, CHECK constraints and triggers enforce durable rules.
- UTC ISO-8601 timestamps.
- Synthetic fixtures only.
- Binary media belongs in private R2; D1 stores metadata/object keys only.
- Migrations are never rewritten after being applied to a shared database.

## Branch history warning

Older feature branches contain a different initial schema and incompatible migration history. Do not merge their old numbered migrations into main. Port code only after schema mapping and forward-only migration review.
