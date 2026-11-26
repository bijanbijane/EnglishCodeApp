# Backend data model

SQL migration files are the schema source of truth. This page describes what is present in the branch; target entities are in ARCHITECTURE-V3.md.

## Existing tables (0001)
- users: internal user row and legacy optional telegram_user_id.
- courses, lessons, questions: initial course and learning content.
- lesson_attempts, attempt_answers: attempt and server-graded answers.

## Added schema
### 0002
- sessions: user-owned expiring/revocable sessions; token hash only.
- user_progress: per-user/per-lesson best score, completion count, last completion.
- unique index on (attempt_id, question_id).
- telegram_auth_replays table/index is also created here.

### 0003
- Repeats CREATE TABLE/INDEX IF NOT EXISTS for telegram_auth_replays from 0002. Retained as historical migration; do not rewrite until all environment migration histories are known.

### 0004
- user_identities: provider-neutral external identity mapping.
- Unique provider + provider_subject and user_id + provider.
- Existing Telegram users are backfilled without changing users.id.
- Current login route writes verified Telegram identity mapping. Other providers/account linking are not implemented.

### 0005
- vocabulary_items: canonical published vocabulary content by language pair.
- user_vocabulary: user state, due date, interval, ease, repetitions, lapses, scheduler version and optimistic revision.
- vocabulary_review_events: append-only review history with unique per-user idempotency key.

## Integrity rules
- A session belongs to one user; token hash unique.
- An external provider subject maps to at most one internal user.
- An attempt belongs to one user and one lesson.
- One persisted answer per question per attempt.
- Progress unique per user/lesson.
- Scores are 0..100.
- Public question DTOs exclude answer_key.
- A Telegram initData fingerprint can be consumed once during its valid auth window.
- Review events are idempotent per user; optimistic revision prevents stale concurrent review updates.

## Target but not yet implemented
Versioned course/lesson/question content, versioned assessment policies, immutable result facts, rebuildable progress projections, four-skill evidence, media assets/jobs, outbox, entitlements, RBAC/audit, analytics aggregates and account deletion workflows.

## Migration discipline
1. Add a new numbered SQL migration; do not edit an applied migration.
2. Test against fresh Local D1 and a database created from all previous migrations.
3. Verify constraints, indexes, foreign keys and idempotency.
4. No production migration without separate explicit approval.
