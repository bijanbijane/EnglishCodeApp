# Learning progress maintenance

`rebuild_user_progress_from_events.sql` is currently a **SQLite-only** maintenance/test script.

- It is exercised by `scripts/verify_backend_sqlite.py`.
- It uses explicit `BEGIN IMMEDIATE` / `COMMIT` and must not be passed to Wrangler D1.
- `apps/backend/src/modules/maintenance/progress.ts` provides an internal D1 `batch()` rebuild helper. It atomically replaces only the derived projection from immutable completion events; it is not wired to a public route, cron trigger, or operator command. Invocation must remain owner-controlled and should be added only with explicit operational safeguards and Local D1 rollback verification.
- The script rebuilds only the derived `user_progress` projection. It does not mutate or delete immutable `learning_events`.
