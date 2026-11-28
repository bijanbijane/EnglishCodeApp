# Backend Data Model

**Store:** Cloudflare D1 / SQLite.  
**Canonical schema:** forward-only SQL under `database/migrations/`.  
**Main migration sequence:** `0001`–`0016` (baseline commit `15b9b47c32e5f0a04542d946d61679f62b15f47c`).

## Identity and security

| Table | Purpose | Invariants |
|---|---|---|
| `users` | Internal application account | Provider-independent stable ID |
| `external_identities` | Provider subject mapping | Unique provider/subject; Telegram numeric ID stored as text |
| `sessions` | Bearer session lifecycle | Token hash only; expiry and revocation enforced |
| `telegram_auth_replays` | Telegram initData replay protection | Unique fingerprint; no raw initData |
| `auth_rate_limits` | Login abuse control | HMAC-derived IP bucket; fixed UTC minute; no raw IP |
| `user_roles` | Server-side role grants | Active grants are checked server-side; no public grant API |
| `admin_audit_events` | Privileged action history | Allowlisted metadata, append-only behavior and keyset indexes |

## Catalog and immutable content

| Table | Purpose | Invariants |
|---|---|---|
| `courses` | Course catalog | Public reads expose published courses only |
| `lessons` | Stable lesson identity | Published pointer references its own published version |
| `lesson_versions` | Lesson content versions | Draft before publish; published versions cannot be updated/deleted |
| `questions` | Stable source question identity | Private answer key; never in public DTO |
| `question_versions` | Versioned assessment content | Immutable after parent lesson version is published |
| `assessment_policy_versions` | Versioned scoring configuration | Immutable policy rows |

## Review workflow

| Table | Purpose | Invariants |
|---|---|---|
| `content_review_requests` | Review state for a lesson version | One request per version; controlled state machine; no self-review |
| `content_review_events` | Review history | Append-only; actor may be anonymized on account deletion |

First-admin bootstrap and subsequent role grants/revocations remain owner-controlled. There is no public role-grant endpoint. See `ADMIN-BOOTSTRAP.md`.

## Assessment and progress

| Table | Purpose | Invariants |
|---|---|---|
| `lesson_attempts` | User-owned attempt | Pins lesson and assessment-policy versions; explicit state |
| `attempt_questions` | Per-attempt immutable snapshot | Question ID/type/prompt/options/answer key/order/weight |
| `attempt_answers` | Accepted answer | Unique attempt/question; validated and graded by backend |
| `user_progress` | Read projection | Updated only by winning completion transition |
| `learning_events` | Immutable learning facts | Append-only lesson-attempt completion events; unique event type/aggregate |

Attempts retain their own snapshots. Historical source content is not guessed or rewritten during version backfill.

Migration `0016_immutable_learning_events.sql` creates `learning_events`, adds lookup indexes, backfills qualifying completed attempts and prevents direct updates/deletes. Parent-user cascade remains available for a controlled account-erasure workflow. Event uniqueness on `(event_type, aggregate_id)` makes completion-event insertion idempotent.

The ledger currently represents `lesson_attempt_completed`; it is not a general event bus or a cumulative-assessment result store. The mutable `user_progress` table remains a projection. The existing rebuild script is SQLite-specific; a D1-compatible deterministic rebuild remains to be implemented.

## Retention

- Replay fingerprints: deleted after expiry in bounded batches.
- Rate-limit buckets: deleted after 48 hours in bounded batches.
- Unrevoked expired sessions: retained at least seven days after expiry.
- Revoked sessions: retained at least 30 days after revocation.
- Review and audit history is append-only; actor references may be anonymized to support account deletion.
- Learning events are retained as immutable facts while their owning account exists; parent-user deletion follows the controlled cascade path.

## Invariants

- Parameterized SQL only.
- Foreign keys, unique indexes, CHECK constraints and triggers enforce durable rules.
- UTC ISO-8601 timestamps.
- Synthetic fixtures only.
- Binary media belongs in private object storage only if that capability is separately approved; D1 stores metadata/object keys.
- Migrations are never rewritten after being applied to a shared database.

## Branch history warning

Older feature branches contain incompatible initial schemas and migration histories. Do not merge their old numbered migrations into main. Port code only after schema mapping and forward-only migration review.
