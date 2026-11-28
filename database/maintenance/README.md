# Learning progress maintenance

`rebuild_user_progress_from_events.sql` is currently a **SQLite-only** maintenance/test script.

- It is exercised by `scripts/verify_backend_sqlite.py`.
- It uses explicit `BEGIN IMMEDIATE` / `COMMIT` and must not be passed to Wrangler D1.
- `apps/backend/src/modules/maintenance/progress.ts` provides an internal D1 `batch()` rebuild helper. The Local D1 integration suite invokes the actual helper through the isolated `wrangler.progress-test.jsonc` test Worker and verifies both successful projection reconstruction and rollback when the insert is forced to fail. The harness is test-only and is not the application Worker entrypoint.
- The helper is not wired to a public route, cron trigger, or operator command. Do not invoke it against shared/production data; an owner-controlled invocation and recovery procedure requires separate review and approval.
- The script rebuilds only the derived `user_progress` projection. It does not mutate or delete immutable `learning_events`.
