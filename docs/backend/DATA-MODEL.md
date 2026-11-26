# Backend data model

The SQL migration files are the source of truth. This page explains the initial relational model.

## Existing tables (0001)

- `users`: internal user identity and optional Telegram user ID.
- `courses`: course metadata and publication state.
- `lessons`: ordered lesson content and publication state.
- `questions`: question prompt, options JSON, private answer key, explanation, and order.
- `lesson_attempts`: one user's attempt at one lesson, state and final score.
- `attempt_answers`: one submitted answer and server-calculated correctness.

## Added tables and constraints

### Migration 0002

- `sessions`: user-owned, expiring, revocable sessions; stores token hash only.
- `user_progress`: per-user/per-lesson best score, completion count and last completion time.
- Unique index on `(attempt_id, question_id)` to prevent multiple persisted answers for one question in one attempt.

### Migration 0003

- `telegram_auth_replays`: canonical SHA-256 fingerprint of consumed Telegram initData, with expiry and creation timestamps. Raw initData is never stored.

## Integrity rules

- A session belongs to one user and its token hash is unique.
- An attempt belongs to one user and one lesson.
- Each question can have at most one persisted answer per attempt.
- Progress is unique for a user/lesson pair.
- Scores are integers from 0 through 100.
- Questions are returned to clients without `answer_key`.
- A Telegram initData fingerprint can be consumed only once while its auth window is valid.

## Query and scale assumptions

The initial schema is designed for the MVP query paths, not proven high-scale workloads. Add indexes only in response to query plans and measured access patterns. D1 capacity and latency must be load-tested before any DAU or SLA claim.

## Migration discipline

1. Add a new numbered SQL migration; do not edit an already-applied migration.
2. Test it against a fresh local database and a database created from all prior migrations.
3. Verify constraints, indexes, seed idempotency, and rollback/recovery plan.
4. Never apply to production without a separate explicit approval.
