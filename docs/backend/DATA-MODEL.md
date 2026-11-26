# Backend Data Model

**Canonical schema:** forward-only SQL migrations under `database/migrations/`.  
**Store:** Cloudflare D1 / SQLite.  
**Current migration sequence on main:** `0001`–`0008`.

## Identity and sessions

| Table | Purpose | Key invariants |
|---|---|---|
| `users` | Internal application account | Stable internal UUID; provider-independent |
| `external_identities` | Provider subject mapping | Unique `(provider, provider_user_id)`; Telegram ID stored as text |
| `sessions` | Bearer session lifecycle | Only token hash stored; expiry and revocation checked |
| `telegram_auth_replays` | Single-use Telegram launch data | SHA-256 fingerprint unique; no raw initData |
| `auth_rate_limits` | Login abuse control | HMAC-derived IP bucket; fixed UTC minute; no raw IP |

## Catalog and versioned content

| Table | Purpose | Key invariants |
|---|---|---|
| `courses` | Course catalog | Public reads filter to published |
| `lessons` | Stable lesson identity and current publication pointer | `current_published_version_id` must reference a published version belonging to the same lesson |
| `lesson_versions` | Immutable published lesson snapshots | New versions start as drafts; published rows cannot be updated/deleted |
| `questions` | Stable source question identity | Answer key is private server-side data |
| `question_versions` | Versioned question content | Prompt/options/answer key/weight immutable once parent lesson version is published |
| `assessment_policy_versions` | Versioned scoring policy configuration | Policy versions immutable |

Existing lessons/questions are backfilled into a first version. Historical attempts retain their `attempt_questions` snapshots; old attempt snapshots are not rewritten to guess historical source content.

## Assessment and progress

| Table | Purpose | Key invariants |
|---|---|---|
| `lesson_attempts` | User-owned attempt | Pins `lesson_version_id` and `assessment_policy_version_id`; state transition is conditional |
| `attempt_questions` | Immutable per-attempt question snapshot | Includes question version reference when available, prompt/options/answer key/order/weight |
| `attempt_answers` | Accepted user answer | Unique `(attempt_id, question_id)`; server grades |
| `user_progress` | Read projection | Updated only by the winning completion transition |

The current progress table is a mutable projection. A later migration should add immutable attempt-result and progress-event facts plus a deterministic projection rebuild, after the Local D1 transaction path is verified.

## Administration and content governance\n\n| Table | Purpose | Key invariants |\n|---|---|---|\n| `user_roles` | Server-side role grants | Partial unique index allows one active grant per user/role; no public grant endpoint |\n| `admin_audit_events` | Privileged action history | Allowlisted metadata, append-only trigger, indexed keyset read |\n| `content_review_requests` | Draft review state | One request per lesson version; author and version identity immutable; no self-review; controlled state transitions |\n| `content_review_events` | Review event history | Append-only; event actor and timestamp retained |\n\nThe first admin role is owner-bootstrapped through a trusted D1 batch, not through the application API. See `ADMIN-BOOTSTRAP.md`.\n\n## Retention and operational cleanup

- Telegram replay fingerprints are removed after expiry in bounded batches.
- Rate-limit buckets older than 48 hours are removed in bounded batches.
- Unrevoked expired sessions are retained for at least seven days after expiry.
- Revoked sessions are retained for at least 30 days after revocation.
- Cleanup runs daily in Worker Cron only after deployment; no production cron is active.

## Schema invariants

- Parameterized SQL only.
- Foreign keys, unique indexes and CHECK constraints enforce durable invariants.
- UTC ISO-8601 timestamps.
- Synthetic fixtures only.
- Binary media belongs in private R2 objects; D1 stores metadata/object keys only.
- Migrations are never rewritten after being applied to a shared database.

## Branch history warning

Older feature branches contain a different schema history, including a different initial migration and versioned-learning migration sequence. They are not drop-in compatible with current main. Port code only after mapping every table/constraint and creating forward-only migrations. Do not merge their old numbered migrations into the current sequence.
