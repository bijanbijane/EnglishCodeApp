# Backend data model

SQL migration files are the schema source of truth. This page describes the branch schema; future target entities are in ARCHITECTURE-V3.md.

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
- Repeats CREATE TABLE/INDEX IF NOT EXISTS for telegram_auth_replays from 0002. Retained as historical migration.

### 0004
- user_identities: provider-neutral external identity mapping.
- Unique provider + provider_subject and user_id + provider.
- Existing Telegram users are backfilled without changing users.id.
- Current login route writes verified Telegram identity mapping. Other providers/account linking are not implemented.

### 0005
- vocabulary_items: canonical published vocabulary content by language pair.
- user_vocabulary: state, due date, interval, ease, repetitions, lapses, scheduler version and optimistic revision.
- vocabulary_review_events: append-only review history with unique per-user idempotency key.

### 0006
- lesson_versions: immutable lesson version snapshots; existing lesson data is copied as version 1.
- question_versions: immutable question snapshots with private answer key and weight; public API maps to explicit DTO.
- assessment_policy_versions: versioned scoring configuration; percentage-v1 is the initial policy.
- lessons.current_published_version_id points to the active published version.
- lesson_attempts pins lesson_version_id and assessment_policy_version_id. Existing attempts are backfilled to v1.
- Triggers prevent updates/deletes to published lesson/question versions and prevent invalid publication pointers.

### 0007
- user_roles: explicit, revocable RBAC grants; roles are not client-controlled.
- admin_audit_events: minimal append-only audit facts. Actor may be nulled on account deletion; event content cannot be updated/deleted.

### 0008
- attempt_results: immutable completed-attempt facts with score, weights, counts and pinned versions.
- progress_events: append-only completion facts, one per attempt.
- Existing completed attempts are backfilled; user_progress is rebuilt from progress_events.
- Completion writes the result, event and projection conditionally in a single D1 batch.

### 0009
- lesson_versions.created_by_user_id records the author of new draft versions.
- content_review_requests records one review lifecycle per version.
- content_review_events is append-only and records submission, decision and publication.
- Self-review is blocked by route authorization and a D1 trigger.
- Content authoring, reviewer decisions and admin publishing write audit facts transactionally.

## Integrity rules
- A session belongs to one user; token hash unique.
- An external provider subject maps to at most one internal user.
- An attempt belongs to one user and one lesson and pins exact content/policy versions.
- One persisted answer per question per attempt.
- Progress unique per user/lesson.
- Scores are 0..100.
- Public question DTOs exclude answer_key.
- A Telegram initData fingerprint can be consumed once during its valid auth window.
- Review events are idempotent per user; optimistic revision prevents stale concurrent review updates.
- Published lesson/question/policy versions are immutable.
- Admin role checks read active grants from user_roles; privileged changes must be audited.
- Attempt result facts and progress events are append-only; user_progress is a rebuildable projection.

## Target but not yet implemented
Role bootstrap/revocation and audit query APIs, account linking/merge, four-skill evidence, media assets/jobs, durable outbox/queues, entitlements, analytics aggregates and account deletion workflows.

## Migration discipline
1. Add a new numbered SQL migration; do not edit an applied migration.
2. Test against fresh Local D1 and a database created from all previous migrations.
3. Verify constraints, triggers, indexes, foreign keys and idempotency.
4. No production migration without separate explicit approval.
