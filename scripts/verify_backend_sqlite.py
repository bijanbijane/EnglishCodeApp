#!/usr/bin/env python3
"""Exercise the backend's migration chain and critical SQLite/D1 SQL invariants.

This is a SQLite compatibility test. It does not replace a Cloudflare Local D1
or concurrent Worker integration test.
"""
from pathlib import Path
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "database" / "migrations"
SEED = ROOT / "database" / "seeds" / "0001_demo.sql"


def run_batch(db: sqlite3.Connection, statements: list[tuple[str, tuple]]) -> list[sqlite3.Cursor]:
    db.execute("BEGIN IMMEDIATE")
    try:
        results = []
        for sql, params in statements:
            results.append(db.execute(sql, params))
        db.commit()
        return results
    except Exception:
        db.rollback()
        raise


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="englishcode-sql-") as temp:
        db = sqlite3.connect(Path(temp) / "backend.sqlite")
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")

        for migration in sorted(MIGRATIONS.glob("*.sql")):
            db.executescript(migration.read_text(encoding="utf-8"))
        db.executescript(SEED.read_text(encoding="utf-8"))

        # Telegram identity + replay-gated session issuance.
        now = "2026-11-26T15:00:00.000Z"
        expiry = "2026-12-26T15:00:00.000Z"
        fingerprint = "f" * 64
        identity_statements = [
            (
                """INSERT INTO users (id, display_name)
                   SELECT ?, ? WHERE NOT EXISTS (
                     SELECT 1 FROM external_identities
                     WHERE provider = 'telegram' AND provider_user_id = ?
                   ) ON CONFLICT(id) DO NOTHING""",
                ("user-telegram-1", "Test User", "123456789"),
            ),
            (
                """INSERT INTO external_identities (id, user_id, provider, provider_user_id)
                   SELECT ?, ?, 'telegram', ?
                   WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
                   ON CONFLICT(provider, provider_user_id) DO NOTHING""",
                ("identity-1", "user-telegram-1", "123456789", "user-telegram-1"),
            ),
            (
                """INSERT INTO telegram_auth_replays (fingerprint, expires_at)
                   VALUES (?, ?) ON CONFLICT(fingerprint) DO NOTHING""",
                (fingerprint, expiry),
            ),
            (
                """INSERT INTO sessions (id, user_id, token_hash, expires_at)
                   SELECT ?, user_id, ?, ? FROM external_identities
                   WHERE provider = 'telegram' AND provider_user_id = ?
                     AND changes() = 1""",
                ("session-1", "a" * 64, expiry, "123456789"),
            ),
        ]
        results = run_batch(db, identity_statements)
        assert results[2].rowcount == 1, "first replay fingerprint must be inserted"
        assert results[3].rowcount == 1, "first valid initData must issue one session"

        replay_statements = [
            (
                """INSERT INTO telegram_auth_replays (fingerprint, expires_at)
                   VALUES (?, ?) ON CONFLICT(fingerprint) DO NOTHING""",
                (fingerprint, expiry),
            ),
            (
                """INSERT INTO sessions (id, user_id, token_hash, expires_at)
                   SELECT ?, user_id, ?, ? FROM external_identities
                   WHERE provider = 'telegram' AND provider_user_id = ?
                     AND changes() = 1""",
                ("session-replay", "b" * 64, expiry, "123456789"),
            ),
        ]
        replay_results = run_batch(db, replay_statements)
        assert replay_results[0].rowcount == 0, "duplicate replay must not win"
        assert replay_results[1].rowcount == 0, "duplicate replay must not issue a session"
        assert db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 1

        # Published version pointers and immutable question content.
        published = db.execute(
            """SELECT l.current_published_version_id, lv.status
               FROM lessons l JOIN lesson_versions lv
                 ON lv.id = l.current_published_version_id
               WHERE l.id = ?""",
            ("lesson-greetings-001",),
        ).fetchone()
        assert published and published["status"] == "published"
        assert db.execute(
            "SELECT COUNT(*) FROM question_versions WHERE lesson_version_id = ?",
            (published["current_published_version_id"],),
        ).fetchone()[0] == 2

        # Attempt creation pins a published lesson and assessment policy, then snapshots
        # the exact published question versions and their weights in one transaction.
        attempt_id = "attempt-1"
        user_id = "user-telegram-1"
        lesson_id = "lesson-greetings-001"
        attempt_results = run_batch(db, [
            (
                """INSERT INTO lesson_attempts
                     (id,user_id,lesson_id,lesson_version,lesson_version_id,assessment_policy_version_id,status)
                   SELECT ?,?,l.id,lv.version,lv.id,ap.id,'in_progress'
                   FROM lessons l
                   JOIN lesson_versions lv ON lv.id=l.current_published_version_id
                   JOIN assessment_policy_versions ap ON ap.id='percentage-v1'
                   WHERE l.id=? AND l.status='published' AND lv.status='published'
                     AND EXISTS (SELECT 1 FROM question_versions WHERE lesson_version_id=lv.id)""",
                (attempt_id, user_id, lesson_id),
            ),
            (
                """INSERT INTO attempt_questions
                     (attempt_id,question_id,question_version_id,question_type,prompt,options_json,answer_key,position,question_weight)
                   SELECT ?,q.source_question_id,q.id,q.question_type,q.prompt,q.options_json,q.answer_key,q.position,q.weight
                   FROM question_versions q
                   JOIN lesson_attempts a ON a.lesson_version_id=q.lesson_version_id
                   WHERE a.id=? AND a.user_id=? AND a.status='in_progress' AND changes()=1""",
                (attempt_id, attempt_id, user_id),
            ),
        ])
        assert attempt_results[0].rowcount == 1
        assert attempt_results[1].rowcount == 2, "all published question versions must be snapshotted"

        original_prompt = db.execute(
            "SELECT prompt FROM attempt_questions WHERE attempt_id=? AND question_id=?",
            (attempt_id, "question-greetings-001"),
        ).fetchone()[0]
        try:
            db.execute(
                "UPDATE question_versions SET prompt=? WHERE source_question_id=?",
                ("Forbidden published mutation", "question-greetings-001"),
            )
            raise AssertionError("published question versions must be immutable")
        except sqlite3.IntegrityError:
            db.rollback()
        db.execute(
            "UPDATE questions SET prompt=?,answer_key=? WHERE id=?",
            ("Mutated source prompt", "b", "question-greetings-001"),
        )
        db.commit()
        snapshot = db.execute(
            "SELECT prompt,answer_key,question_weight FROM attempt_questions WHERE attempt_id=? AND question_id=?",
            (attempt_id, "question-greetings-001"),
        ).fetchone()
        assert snapshot["prompt"] == original_prompt
        assert snapshot["answer_key"] == "a", "attempt must retain the original answer key"
        assert snapshot["question_weight"] == 1

        # Server-side answer insert uses the attempt snapshot and unique key.
        answer_sql = """INSERT INTO attempt_answers
             (id, attempt_id, question_id, submitted_answer, is_correct)
           SELECT ?, a.id, q.question_id, ?, ?
           FROM lesson_attempts a JOIN attempt_questions q ON q.attempt_id = a.id
           WHERE a.id = ? AND a.user_id = ? AND a.status = 'in_progress'
             AND q.question_id = ?
           ON CONFLICT(attempt_id, question_id) DO NOTHING"""
        answer_params = ("answer-1", "a", 1, attempt_id, user_id, "question-greetings-001")
        assert db.execute(answer_sql, answer_params).rowcount == 1
        assert db.execute(answer_sql, ("answer-duplicate", "a", 1, attempt_id, user_id, "question-greetings-001")).rowcount == 0
        assert db.execute(
            "SELECT submitted_answer, is_correct FROM attempt_answers WHERE attempt_id = ? AND question_id = ?",
            (attempt_id, "question-greetings-001"),
        ).fetchone()["is_correct"] == 1
        db.commit()

        # Completion and progress upsert: only the winning state transition counts.
        completed_at = "2026-11-26T15:01:00.000Z"
        completion_sql = """UPDATE lesson_attempts
           SET status = 'completed',
               score = COALESCE((
                 SELECT CAST(ROUND(
                   100.0 * SUM(CASE WHEN aa.is_correct = 1 THEN q.question_weight ELSE 0 END) /
                   NULLIF(SUM(q.question_weight), 0)
                 ) AS INTEGER)
                 FROM attempt_questions q
                 LEFT JOIN attempt_answers aa
                   ON aa.attempt_id = lesson_attempts.id AND aa.question_id = q.question_id
                 WHERE q.attempt_id = lesson_attempts.id
               ), 0),
               completed_at = ?
           WHERE id = ? AND user_id = ? AND status = 'in_progress'"""
        progress_sql = """INSERT INTO user_progress
             (user_id, lesson_id, best_score, completed_count, last_completed_at)
           SELECT user_id, lesson_id, score, 1, completed_at FROM lesson_attempts
           WHERE id = ? AND status = 'completed' AND completed_at = ? AND changes() = 1
           ON CONFLICT(user_id, lesson_id) DO UPDATE SET
             best_score = MAX(user_progress.best_score, excluded.best_score),
             completed_count = user_progress.completed_count + 1,
             last_completed_at = excluded.last_completed_at"""
        completion_results = run_batch(db, [
            (completion_sql, (completed_at, attempt_id, user_id)),
            (progress_sql, (attempt_id, completed_at)),
        ])
        assert completion_results[0].rowcount == 1
        assert completion_results[1].rowcount == 1
        # Repeating completion must not increment completed_count.
        repeated_results = run_batch(db, [
            (completion_sql, ("2026-11-26T15:02:00.000Z", attempt_id, user_id)),
            (progress_sql, (attempt_id, "2026-11-26T15:02:00.000Z")),
        ])
        assert repeated_results[0].rowcount == 0
        assert repeated_results[1].rowcount == 0
        progress = db.execute(
            "SELECT completed_count, best_score FROM user_progress WHERE user_id = ? AND lesson_id = ?",
            (user_id, lesson_id),
        ).fetchone()
        assert progress["completed_count"] == 1, "duplicate completion must not double-count progress"

        # RBAC, append-only audit, no-self-review and publish state machine.
        db.execute("INSERT INTO users (id,display_name) VALUES (?,?)", ("reviewer-1", "Reviewer"))
        db.execute("INSERT INTO users (id,display_name) VALUES (?,?)", ("admin-1", "Admin"))
        db.execute(
            "INSERT INTO user_roles (id,user_id,role,granted_by) VALUES (?,?,?,?)",
            ("role-author", user_id, "content_author", None),
        )
        db.execute(
            "INSERT INTO user_roles (id,user_id,role,granted_by) VALUES (?,?,?,?)",
            ("role-reviewer", "reviewer-1", "content_reviewer", None),
        )
        db.execute(
            "INSERT INTO user_roles (id,user_id,role,granted_by) VALUES (?,?,?,?)",
            ("role-admin", "admin-1", "admin", None),
        )
        # Commit valid principals and grants before testing the expected constraint failure.
        # sqlite3.Connection.rollback() otherwise removes the whole pending setup transaction.
        db.commit()
        try:
            db.execute(
                "INSERT INTO user_roles (id,user_id,role,granted_by) VALUES (?,?,?,?)",
                ("role-author-duplicate", user_id, "content_author", None),
            )
            raise AssertionError("duplicate active role grant must fail")
        except sqlite3.IntegrityError:
            db.rollback()

        draft_version_id = lesson_id + ":v2"
        db.execute(
            """INSERT INTO lesson_versions
                 (id,lesson_id,version,title,description,level,position,status,created_by_user_id)
               VALUES (?,?,2,?,?, 'A2',1,'draft',?)""",
            (draft_version_id, lesson_id, "Greetings v2", "Draft version", user_id),
        )
        db.execute(
            """INSERT INTO question_versions
                 (id,lesson_version_id,source_question_id,question_type,prompt,options_json,answer_key,explanation,weight,position)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            ("question-greetings-001:v2", draft_version_id, "question-greetings-001",
             "multiple_choice", "New prompt", '[{"id":"a","text":"A"},{"id":"b","text":"B"}]',
             "a", "", 2, 1),
        )
        db.execute(
            """INSERT INTO content_review_requests
                 (id,lesson_version_id,author_user_id,status)
               VALUES ('review-1',?,?, 'pending')""",
            (draft_version_id, user_id),
        )
        db.commit()

        try:
            db.execute(
                """UPDATE content_review_requests
                   SET status='approved',reviewed_by_user_id=?,reviewed_at=?
                   WHERE id='review-1'""",
                (user_id, now),
            )
            raise AssertionError("an author must not review their own content")
        except sqlite3.IntegrityError:
            db.rollback()

        reviewer_time = "2026-11-26T15:03:00.000Z"
        db.execute(
            """UPDATE content_review_requests
               SET status='approved',reviewed_by_user_id=?,reviewed_at=?,reason_code='approved'
               WHERE id='review-1' AND status='pending' AND author_user_id<>?""",
            ("reviewer-1", reviewer_time, "reviewer-1"),
        )
        db.execute(
            """INSERT INTO content_review_events (id,request_id,actor_user_id,event_type,reason_code)
               SELECT 'review-event-approved','review-1','reviewer-1','approved','approved'
               WHERE changes()=1"""
        )
        db.commit()

        publish_time = "2026-11-26T15:04:00.000Z"
        publish_results = run_batch(db, [
            (
                """UPDATE lesson_versions SET status='published',published_at=?
                   WHERE id=? AND lesson_id=? AND status='draft'
                     AND EXISTS (SELECT 1 FROM content_review_requests WHERE id='review-1' AND status='approved')""",
                (publish_time, draft_version_id, lesson_id),
            ),
            (
                """UPDATE lessons SET status='published',current_published_version_id=?
                   WHERE id=? AND changes()=1
                     AND EXISTS (SELECT 1 FROM lesson_versions WHERE id=? AND status='published')""",
                (draft_version_id, lesson_id, draft_version_id),
            ),
            (
                """UPDATE content_review_requests SET status='published'
                   WHERE id='review-1' AND status='approved' AND changes()=1""",
                (),
            ),
            (
                """INSERT INTO content_review_events (id,request_id,actor_user_id,event_type)
                   SELECT 'review-event-published','review-1','admin-1','published' WHERE changes()=1""",
                (),
            ),
            (
                """INSERT INTO admin_audit_events
                     (id,actor_user_id,action,resource_type,resource_id,request_id,metadata_json)
                   SELECT 'audit-publish','admin-1','content.version.published','lesson_version',?,
                          'request-publish-0001','{"version":2,"status":"published"}'
                   WHERE changes()=1""",
                (draft_version_id,),
            ),
        ])
        assert [result.rowcount for result in publish_results] == [1, 1, 1, 1, 1]
        assert db.execute(
            "SELECT current_published_version_id FROM lessons WHERE id=?",
            (lesson_id,),
        ).fetchone()[0] == draft_version_id

        try:
            db.execute(
                "UPDATE admin_audit_events SET action='tampered' WHERE id='audit-publish'"
            )
            raise AssertionError("admin audit events must be append-only")
        except sqlite3.IntegrityError:
            db.rollback()

        # Ownership predicate must prevent another user from reading this attempt.
        foreign_attempt = db.execute(
            "SELECT id FROM lesson_attempts WHERE id = ? AND user_id = ?",
            (attempt_id, "some-other-user"),
        ).fetchone()
        assert foreign_attempt is None

        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        assert not violations, f"foreign key violations: {violations}"
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        db.close()

    print("SQLite migration, replay gate, immutable attempt snapshot, answer idempotency,")
    print("completion/progress single-winner behavior, ownership, and integrity checks passed.")
    print("Note: this is SQLite compatibility evidence, not a Cloudflare Local D1 concurrency test.")


if __name__ == "__main__":
    main()
