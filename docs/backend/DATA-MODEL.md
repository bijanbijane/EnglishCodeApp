# Backend Data Model

**Canonical schema:** versioned SQL under `database/migrations/`.  
**Initial store:** Cloudflare D1 / SQLite.

## Identity

### users
Internal application account. Stable ID independent of Telegram or any future login provider.

### external_identities
Maps a provider subject to an internal user. Unique constraint on `(provider, provider_user_id)`. Telegram username is mutable and must not be used as the identity key.

### sessions
Opaque session lifecycle. Persist token hash only, with expiry and revocation timestamps. Index user and expiry for bounded cleanup and account session views.

## Learning catalog

### courses
Provider-neutral learning course. Only `published` records are visible to public catalog routes.

### lessons
Belongs to a course and has stable slug, ordering, level, and version. Published-content immutability and content version snapshots must be enforced before content authoring is introduced.

### questions
Belongs to a lesson. `answer_key` is private server-side assessment data. Public DTOs must select an explicit allowlist and must never serialize this column.

## Assessment and progress

### lesson_attempts
Owned by one user and pinned to one lesson. State transitions must be explicit; only in-progress attempts accept answers. Future schema must pin content version and assessment policy version.

### attempt_answers
Unique on `(attempt_id, question_id)`. A duplicate submission must have deterministic semantics: return the prior result for an identical idempotent request or return a conflict for a different answer. Never silently overwrite an accepted answer.

### user_progress
Unique on `(user_id, lesson_id)`. Completion count and best score must be updated atomically with the winning attempt completion; retries must not double-count progress.

## Planned operational tables

Add only with a tested use case and migration:
- telegram_auth_replays: unique canonical fingerprint and expiry; no raw initData.
- idempotency_keys: request scope, owner, key, request hash, response/result reference and expiry.
- outbox_jobs: durable job state written before Queue enqueue; consumer idempotency.
- audit_events: minimal, append-oriented staff/security events with retention policy.
- ai_usage: provider, model, quota/cost units and purpose; no private prompt content by default.

## Schema invariants

- Migration files are immutable after application.
- All foreign keys and uniqueness constraints are enforced in D1.
- Use parameterized SQL only.
- UTC timestamps are stored in ISO-8601 form.
- Large numeric provider IDs are stored as text.
- Binary media belongs in private R2 objects; D1 stores metadata and object keys only.
- Seeds and fixtures contain synthetic data only.

## Migration history warning

The current main branch starts with `0001_initial.sql`. Older backend branches contain different migration histories. Before connecting any shared database, inspect its applied migration ledger and reconcile the history. Never renumber or rewrite a migration already applied to a shared database; use a forward-only migration instead.
