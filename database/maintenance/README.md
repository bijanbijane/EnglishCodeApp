# Learning progress maintenance

`rebuild_user_progress_from_events.sql` is currently a **SQLite-only** maintenance/test script.

- It is exercised by `scripts/verify_backend_sqlite.py`.
- It uses explicit `BEGIN IMMEDIATE` / `COMMIT` and must not be passed to Wrangler D1.
- No D1-compatible rebuild command is provided by this change. A future D1 implementation must use the supported D1 transactional/batch interface, include failure/rollback verification, and be reviewed separately.
- The script rebuilds only the derived `user_progress` projection. It does not mutate or delete immutable `learning_events`.
