#!/usr/bin/env python3
"""Run the backend against Wrangler's local D1 runtime and verify critical flows."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import shutil
import secrets
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "apps" / "backend"
DATABASE = "englishcodeapp-dev"
BOT_TOKEN = "local-test-bot-token"
BASE_URL = "http://127.0.0.1:8796"
PERSIST_DIR = Path(tempfile.mkdtemp(prefix="englishcode-d1-local-"))


def run(command):
    result = subprocess.run(
        command,
        cwd=BACKEND,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(command)}\n{result.stdout}"
        )
    return result.stdout


def request(
    method, path, token=None, payload=None, ip="203.0.113.10", include_headers=False, extra_headers=None
):
    headers = {
        "Accept": "application/json",
        "CF-Connecting-IP": ip,
    }
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, separators=(",", ":")).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(BASE_URL + path, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=12) as response:
            status = response.status
            body = response.read()
            response_headers = dict(response.headers.items())
    except HTTPError as error:
        status = error.code
        body = error.read()
        response_headers = dict(error.headers.items())
    parsed = json.loads(body.decode() or "{}")
    if include_headers:
        return status, parsed, response_headers
    return status, parsed


def expect_status(result, expected, label):
    status, body = result
    if status != expected:
        raise AssertionError(
            f"{label}: expected HTTP {expected}, received {status}: {json.dumps(body)}"
        )
    return body


def make_init_data(user_id, first_name, query_id=None):
    values = {
        "auth_date": str(int(time.time())),
        "query_id": query_id or f"local-test-{user_id}",
        "user": json.dumps(
            {"id": user_id, "first_name": first_name},
            separators=(",", ":"),
        ),
    }
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(values.items())
    )
    secret_key = hmac.new(
        BOT_TOKEN.encode(), b"WebAppData", hashlib.sha256
    ).digest()
    values["hash"] = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()
    return urlencode(values)


def wait_for_worker(process, log_path):
    for _ in range(60):
        if process.poll() is not None:
            raise RuntimeError(
                "Wrangler dev exited before becoming ready:\n"
                + log_path.read_text(errors="replace")[-12000:]
            )
        try:
            status, body = request("GET", "/api/v1/health")
            if status == 200 and body.get("status") == "ok":
                return
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            pass
        time.sleep(0.5)
    raise TimeoutError(
        "Wrangler dev did not become ready:\n"
        + log_path.read_text(errors="replace")[-12000:]
    )


def main():
    persist = str(PERSIST_DIR)
    run([
        "npx", "wrangler", "d1", "migrations", "apply", DATABASE,
        "--local", "--persist-to", persist,
    ])
    run([
        "npx", "wrangler", "d1", "execute", DATABASE,
        "--local", "--persist-to", persist,
        "--file=../../database/seeds/0001_demo.sql",
    ])

    log_path = PERSIST_DIR / "wrangler-dev.log"
    with log_path.open("w", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            [
                "npx", "wrangler", "dev", "--local",
                "--ip", "127.0.0.1", "--port", "8796",
                "--persist-to", persist,
                "--var", f"TELEGRAM_BOT_TOKEN:{BOT_TOKEN}",
                "--var", "TELEGRAM_WEBHOOK_SECRET:local-test-webhook-secret",
                "--var", "APP_ENV:local",
            ],
            cwd=BACKEND,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            wait_for_worker(process, log_path)

            health = expect_status(request("GET", "/api/v1/health"), 200, "health")
            assert health.get("status") == "ok"
            assert health.get("service") == "englishcode-backend"

            ready = expect_status(request("GET", "/api/v1/ready"), 200, "readiness")
            assert ready.get("data", {}).get("database") == "ok"

            webhook_headers = {"X-Telegram-Bot-Api-Secret-Token": "local-test-webhook-secret"}
            invalid_update = expect_status(
                request(
                    "POST", "/api/v1/telegram/webhook",
                    payload={"message": {"text": "/start", "chat": {"id": 42, "type": "private"}}},
                    extra_headers=webhook_headers,
                ),
                400,
                "Telegram webhook requires update_id",
            )
            assert invalid_update.get("error") == "A valid Telegram update_id is required."

            webhook_update = {
                "update_id": 900000101,
                "callback_query": {"id": "local-dedup-test"},
            }
            first_webhook = expect_status(
                request("POST", "/api/v1/telegram/webhook", payload=webhook_update, extra_headers=webhook_headers),
                200,
                "Telegram webhook first delivery",
            )
            assert first_webhook.get("ok") is True and first_webhook.get("duplicate") is not True
            duplicate_webhook = expect_status(
                request("POST", "/api/v1/telegram/webhook", payload=webhook_update, extra_headers=webhook_headers),
                200,
                "Telegram webhook duplicate delivery",
            )
            assert duplicate_webhook == {"ok": True, "duplicate": True}

            courses = expect_status(request("GET", "/api/v1/courses"), 200, "frontend course contract")
            assert courses["data"]
            course = courses["data"][0]
            for field in ("id", "slug", "title", "source_language", "target_language"):
                assert field in course, f"course contract missing {field}"
            lessons = expect_status(
                request("GET", f"/api/v1/courses/{course['id']}/lessons"),
                200,
                "frontend lesson-list contract",
            )
            assert lessons["data"]
            for field in ("id", "course_id", "slug", "title", "description", "level", "position", "version"):
                assert field in lessons["data"][0], f"lesson contract missing {field}"

            init_data = make_init_data(900000001, "Local Learner")
            tampered = init_data[:-1] + ("0" if init_data[-1] != "0" else "1")
            expect_status(
                request("POST", "/api/v1/auth/telegram", payload={"initData": tampered}),
                401,
                "invalid Telegram signature",
            )

            login = expect_status(
                request("POST", "/api/v1/auth/telegram", payload={"initData": init_data}),
                201,
                "Telegram login",
            )
            token = login["data"]["accessToken"]
            profile = expect_status(request("GET", "/api/v1/me", token), 200, "profile")
            user_id = profile["data"]["id"]
            assert user_id == login["data"]["user"]["id"]
            assert "display_name" in profile["data"] and "created_at" in profile["data"]

            expired_token = secrets.token_urlsafe(32)
            expired_hash = hashlib.sha256(expired_token.encode()).hexdigest()
            expired_session_sql = PERSIST_DIR / "expired-session.sql"
            expired_session_sql.write_text(
                "INSERT INTO sessions (id,user_id,token_hash,expires_at,revoked_at) "
                f"VALUES ('expired-session','{user_id}','{expired_hash}',"
                "'2000-01-01T00:00:00.000Z',NULL);",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist,
                f"--file={expired_session_sql}",
            ])
            expect_status(
                request("GET", "/api/v1/me", expired_token),
                401,
                "expired session",
            )

            expect_status(
                request("POST", "/api/v1/auth/telegram", payload={"initData": init_data}),
                409,
                "Telegram replay protection",
            )

            public_lesson = expect_status(
                request("GET", "/api/v1/lessons/lesson-greetings-001"),
                200,
                "public lesson",
            )
            assert len(public_lesson["data"]["questions"]) == 2
            assert "answer_key" not in json.dumps(public_lesson)

            created = expect_status(
                request(
                    "POST", "/api/v1/lessons/lesson-greetings-001/attempts",
                    token, {},
                ),
                201,
                "start attempt",
            )
            attempt_id = created["data"]["attemptId"]
            attempt = expect_status(
                request("GET", f"/api/v1/attempts/{attempt_id}", token),
                200,
                "read attempt",
            )
            for field in ("id", "lesson_id", "status", "score", "questions"):
                assert field in attempt["data"], f"attempt contract missing {field}"
            questions = attempt["data"]["questions"]
            assert len(questions) == 2
            assert "answer_key" not in json.dumps(attempt)

            first_question = questions[0]["id"]

            def submit_same_answer():
                return request(
                    "POST", f"/api/v1/attempts/{attempt_id}/answers",
                    token, {"questionId": first_question, "answer": "a"},
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                answer_results = list(pool.map(lambda _: submit_same_answer(), range(2)))
            assert sorted(status for status, _ in answer_results) == [200, 201], answer_results
            assert sum(
                1 for status, body in answer_results
                if status == 200 and body.get("data", {}).get("duplicate") is True
            ) == 1

            expect_status(
                request(
                    "POST", f"/api/v1/attempts/{attempt_id}/answers",
                    token, {"questionId": first_question, "answer": "b"},
                ),
                409,
                "conflicting duplicate answer",
            )
            expect_status(
                request(
                    "POST", f"/api/v1/attempts/{attempt_id}/answers",
                    token, {"questionId": questions[1]["id"], "answer": "a"},
                ),
                201,
                "second answer",
            )

            def complete_attempt():
                return request("POST", f"/api/v1/attempts/{attempt_id}/complete", token, {})

            with ThreadPoolExecutor(max_workers=2) as pool:
                completion_results = list(pool.map(lambda _: complete_attempt(), range(2)))
            for result in completion_results:
                completed = expect_status(result, 200, "concurrent completion")
                assert completed["data"]["status"] == "completed"
                assert completed["data"]["score"] == 100
                assert completed["data"]["completedAt"]

            progress = expect_status(request("GET", "/api/v1/me/progress", token), 200, "progress")
            assert len(progress["data"]) == 1
            for field in ("lesson_id", "course_id", "best_score", "completed_count", "lesson_title", "last_completed_at"):
                assert field in progress["data"][0], f"progress contract missing {field}"
            assert progress["data"][0]["completed_count"] == 1

            second_attempt = expect_status(
                request(
                    "POST", "/api/v1/lessons/lesson-greetings-001/attempts",
                    token, {},
                ),
                201,
                "start second attempt",
            )
            second_attempt_id = second_attempt["data"]["attemptId"]

            # Simulate an existing completion-event key for an attempt that is
            # still in progress. The completion event INSERT must conflict, but
            # the winning attempt transition must still update user_progress.
            preexisting_event_sql = PERSIST_DIR / "preexisting-completion-event.sql"
            preexisting_event_sql.write_text(
                "INSERT INTO learning_events "
                "(event_id,user_id,event_type,aggregate_id,lesson_id,score,occurred_at,payload_json) "
                "SELECT 'attempt-completed:' || a.id,a.user_id,'lesson_attempt_completed',"
                "a.id,a.lesson_id,0,'2026-11-27T00:00:00.000Z',"
                "json_object('attemptId',a.id,'score',0) "
                "FROM lesson_attempts a "
                f"WHERE a.id='{second_attempt_id}' AND a.status='in_progress';",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist,
                f"--file={preexisting_event_sql}",
            ])
            second_attempt_detail = expect_status(
                request("GET", f"/api/v1/attempts/{second_attempt_id}", token),
                200,
                "read second attempt",
            )
            for question_row in second_attempt_detail["data"]["questions"]:
                expect_status(
                    request(
                        "POST", f"/api/v1/attempts/{second_attempt_id}/answers",
                        token,
                        {"questionId": question_row["id"], "answer": "a"},
                    ),
                    201,
                    "second attempt answer",
                )
            second_completion = expect_status(
                request("POST", f"/api/v1/attempts/{second_attempt_id}/complete", token, {}),
                200,
                "complete second attempt",
            )
            assert second_completion["data"]["score"] == 100

            progress_after_second = expect_status(
                request("GET", "/api/v1/me/progress", token),
                200,
                "progress after second attempt",
            )
            assert progress_after_second["data"][0]["completed_count"] == 2

            # The completion ledger must contain one fact per completed attempt.
            event_count_sql = PERSIST_DIR / "learning-event-count.sql"
            event_count_sql.write_text(
                "SELECT COUNT(*) AS event_count FROM learning_events "
                f"WHERE user_id='{user_id}' AND event_type='lesson_attempt_completed';",
                encoding="utf-8",
            )
            event_count_output = run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={event_count_sql}", "--json",
            ])
            event_count_payload = json.loads(event_count_output)
            if isinstance(event_count_payload, list):
                event_count_rows = event_count_payload[0]["results"]
            else:
                event_count_rows = event_count_payload["results"]
            assert event_count_rows[0]["event_count"] == 2, event_count_rows

            # Direct event deletion must be rejected by the immutable-ledger trigger.
            direct_delete_sql = PERSIST_DIR / "direct-learning-event-delete.sql"
            direct_delete_sql.write_text(
                f"DELETE FROM learning_events WHERE aggregate_id='{attempt_id}';",
                encoding="utf-8",
            )
            direct_delete = subprocess.run(
                [
                    "npx", "wrangler", "d1", "execute", DATABASE,
                    "--local", "--persist-to", persist, f"--file={direct_delete_sql}",
                ],
                cwd=BACKEND,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=False,
            )
            assert direct_delete.returncode != 0 and (
                "learning events cannot be deleted directly" in direct_delete.stdout.lower()
            ), (
                "direct event deletion did not fail for the expected immutability trigger: "
                + direct_delete.stdout[-2000:]
            )

            # Parent-user deletion must still cascade its learning events.
            cascade_insert_sql = PERSIST_DIR / "cascade-event-fixture.sql"
            cascade_insert_sql.write_text(
                "INSERT INTO users (id,display_name) VALUES ('cascade-user-001','Cascade User');"
                "INSERT INTO learning_events "
                "(event_id,user_id,event_type,aggregate_id,lesson_id,score,occurred_at,payload_json) "
                "VALUES ('cascade-event-001','cascade-user-001','lesson_attempt_completed',"
                "'cascade-attempt-001','lesson-greetings-001',75,'2026-11-27T00:00:00.000Z',"
                "json_object('attemptId','cascade-attempt-001'));",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={cascade_insert_sql}",
            ])
            cascade_delete_sql = PERSIST_DIR / "cascade-user-delete.sql"
            cascade_delete_sql.write_text(
                "DELETE FROM users WHERE id='cascade-user-001';",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={cascade_delete_sql}",
            ])
            cascade_count_sql = PERSIST_DIR / "cascade-event-count.sql"
            cascade_count_sql.write_text(
                "SELECT COUNT(*) AS event_count FROM learning_events "
                "WHERE user_id='cascade-user-001';",
                encoding="utf-8",
            )
            cascade_count_output = run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={cascade_count_sql}", "--json",
            ])
            cascade_count_payload = json.loads(cascade_count_output)
            if isinstance(cascade_count_payload, list):
                cascade_count_rows = cascade_count_payload[0]["results"]
            else:
                cascade_count_rows = cascade_count_payload["results"]
            assert cascade_count_rows[0]["event_count"] == 0, cascade_count_rows

            history_page_one = expect_status(
                request("GET", "/api/v1/me/history?limit=1", token),
                200,
                "history first page",
            )
            assert [row["attemptId"] for row in history_page_one["data"]] == [second_attempt_id]
            assert history_page_one["data"][0]["questionCount"] == 2
            assert history_page_one["data"][0]["correctAnswerCount"] == 2
            assert history_page_one["data"][0]["lessonTitle"] == public_lesson["data"]["title"]
            history_cursor = history_page_one["meta"]["nextCursor"]
            assert history_cursor
            history_page_two = expect_status(
                request(
                    "GET",
                    "/api/v1/me/history?" + urlencode({"limit": "1", "cursor": history_cursor}),
                    token,
                ),
                200,
                "history second page",
            )
            assert [row["attemptId"] for row in history_page_two["data"]] == [attempt_id]
            assert history_page_two["meta"]["nextCursor"] is None

            second_init = make_init_data(900000002, "Second Learner")

            def concurrent_login():
                return request(
                    "POST", "/api/v1/auth/telegram",
                    payload={"initData": second_init},
                    ip="203.0.113.11",
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                login_results = list(pool.map(lambda _: concurrent_login(), range(2)))
            assert sorted(status for status, _ in login_results) == [201, 409], login_results
            second_login = next(body for status, body in login_results if status == 201)
            second_token = second_login["data"]["accessToken"]
            second_profile = expect_status(
                request("GET", "/api/v1/me", second_token),
                200,
                "second profile",
            )
            second_user_id = second_profile["data"]["id"]
            if not second_user_id.replace("-", "").replace("_", "").isalnum():
                raise AssertionError("Unexpected user ID format")

            # Distinct valid Telegram payloads for the same provider identity
            # must converge on one canonical account under concurrent requests.
            def concurrent_same_identity(query_id):
                init_data = make_init_data(
                    900000003, "Concurrent Identity", query_id=query_id
                )
                return request(
                    "POST", "/api/v1/auth/telegram",
                    payload={"initData": init_data},
                    ip="203.0.113.13",
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                identity_results = list(pool.map(
                    concurrent_same_identity,
                    ("local-identity-race-a", "local-identity-race-b"),
                ))
            assert [status for status, _ in identity_results] == [201, 201], identity_results
            identity_tokens = [
                body["data"]["accessToken"] for _, body in identity_results
            ]
            identity_profiles = [
                expect_status(
                    request("GET", "/api/v1/me", identity_token),
                    200,
                    "concurrent same-identity profile",
                )
                for identity_token in identity_tokens
            ]
            canonical_ids = {
                profile["data"]["id"] for profile in identity_profiles
            }
            assert len(canonical_ids) == 1, identity_profiles

            identity_count_sql = PERSIST_DIR / "concurrent-identity-count.sql"
            identity_count_sql.write_text(
                "SELECT COUNT(*) AS account_count FROM users "
                "WHERE display_name='Concurrent Identity';",
                encoding="utf-8",
            )
            identity_count_output = run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist,
                f"--file={identity_count_sql}", "--json",
            ])
            identity_count_payload = json.loads(identity_count_output)
            if isinstance(identity_count_payload, list):
                identity_count_rows = identity_count_payload[0]["results"]
            else:
                identity_count_rows = identity_count_payload["results"]
            assert identity_count_rows[0]["account_count"] == 1, identity_count_rows

            expect_status(
                request("GET", "/api/v1/admin/audit", second_token),
                403,
                "admin RBAC denial",
            )
            expect_status(
                request("GET", "/api/v1/admin/content/reviews", second_token),
                403,
                "reviewer RBAC denial",
            )

            grant_file = PERSIST_DIR / "grant-local-admin-roles.sql"
            grant_file.write_text(
                "INSERT INTO user_roles (id,user_id,role,granted_by) VALUES "
                f"('local-admin-role','{second_user_id}','admin',NULL),"
                f"('local-reviewer-role','{second_user_id}','content_reviewer',NULL),"
                f"('local-author-role','{user_id}','content_author',NULL);",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={grant_file}",
            ])
            expect_status(
                request("GET", "/api/v1/admin/audit", second_token),
                200,
                "admin role grant",
            )

            # Exercise author lesson-version keyset pagination against real Local D1.
            # Use an isolated fixture lesson so high test versions cannot affect the
            # later authoring workflow's expected next version on lesson-greetings-001.
            pagination_lesson_id = "lesson-author-version-pagination-fixture"
            author_versions_sql = PERSIST_DIR / "author-version-pagination-fixtures.sql"
            author_versions_sql.write_text(
                "INSERT INTO lessons "
                "(id,course_id,slug,title,description,level,position,version,status) VALUES "
                f"('{pagination_lesson_id}','course-english-foundations','author-version-pagination-fixture',"
                "'Author pagination fixture','Local test fixture','A1',99,1,'draft');"
                "INSERT INTO lesson_versions "
                "(id,lesson_id,version,title,description,level,position,status,created_by_user_id) VALUES "
                f"('author-page-v40','{pagination_lesson_id}',40,'Author Page 40','Local fixture','A1',40,'draft','{user_id}'),"
                f"('author-page-v39','{pagination_lesson_id}',39,'Author Page 39','Local fixture','A1',39,'draft','{user_id}'),"
                f"('author-page-v38','{pagination_lesson_id}',38,'Author Page 38','Local fixture','A1',38,'draft','{user_id}'),"
                f"('other-author-page-v41','{pagination_lesson_id}',41,'Other Author Page 41','Local fixture','A1',41,'draft','{second_user_id}');",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={author_versions_sql}",
            ])

            author_page_one = expect_status(
                request(
                    "GET",
                    "/api/v1/admin/content/lessons/lesson-author-version-pagination-fixture/versions?limit=2",
                    token,
                ),
                200,
                "author lesson-version first page",
            )
            assert [(row["version"], row["id"]) for row in author_page_one["data"]] == [
                (40, "author-page-v40"),
                (39, "author-page-v39"),
            ], author_page_one
            assert all(row["id"] != "other-author-page-v41" for row in author_page_one["data"])
            author_version_cursor = author_page_one["meta"]["nextCursor"]
            assert author_version_cursor

            author_page_two = expect_status(
                request(
                    "GET",
                    "/api/v1/admin/content/lessons/lesson-author-version-pagination-fixture/versions?"
                    + urlencode({"limit": "2", "cursor": author_version_cursor}),
                    token,
                ),
                200,
                "author lesson-version second page",
            )
            assert [(row["version"], row["id"]) for row in author_page_two["data"]] == [
                (38, "author-page-v38"),
            ], author_page_two
            assert author_page_two["meta"]["nextCursor"] is None

            expect_status(
                request("GET", "/api/v1/admin/content/reviews", second_token),
                200,
                "reviewer role grant",
            )

            draft = expect_status(
                request(
                    "POST", "/api/v1/admin/content/lessons/lesson-greetings-001/versions",
                    token,
                    {
                        "title": "Greetings — reviewed local release",
                        "level": "A1",
                        "questions": [
                            {
                                "type": "multiple_choice",
                                "prompt": "Which greeting is appropriate in the morning?",
                                "options": [
                                    {"id": "a", "text": "Good morning"},
                                    {"id": "b", "text": "Good night"},
                                ],
                                "answerKey": "a",
                                "explanation": "Use good morning in the morning.",
                                "weight": 2,
                                "position": 1,
                            }
                        ],
                    },
                ),
                201,
                "create content draft",
            )
            lesson_version_id = draft["data"]["lessonVersionId"]
            assert draft["data"]["version"] == 2
            assert draft["data"]["questionCount"] == 1

            submitted = expect_status(
                request(
                    "POST",
                    f"/api/v1/admin/content/lessons/lesson-greetings-001/versions/{lesson_version_id}/submit-review",
                    token,
                    {},
                ),
                201,
                "submit content review",
            )
            review_request_id = submitted["data"]["reviewRequestId"]
            review_detail = expect_status(
                request(
                    "GET", f"/api/v1/admin/content/reviews/{review_request_id}",
                    second_token,
                ),
                200,
                "read submitted review",
            )
            assert review_detail["data"]["status"] == "pending"
            assert review_detail["data"]["lesson"]["version"] == 2
            assert review_detail["data"]["questions"][0]["answerKey"] == "a"

            decision = expect_status(
                request(
                    "POST", f"/api/v1/admin/content/reviews/{review_request_id}/decision",
                    second_token,
                    {"decision": "approve"},
                ),
                200,
                "approve content review",
            )
            assert decision["data"]["status"] == "approved"

            published = expect_status(
                request(
                    "POST", f"/api/v1/admin/content/reviews/{review_request_id}/publish",
                    second_token,
                    {},
                ),
                200,
                "publish approved content",
            )
            assert published["data"]["status"] == "published"
            assert published["data"]["lessonVersionId"] == lesson_version_id

            released_lesson = expect_status(
                request("GET", "/api/v1/lessons/lesson-greetings-001"),
                200,
                "read newly published lesson",
            )
            assert released_lesson["data"]["title"] == "Greetings — reviewed local release"
            assert len(released_lesson["data"]["questions"]) == 1
            assert released_lesson["data"]["questions"][0]["prompt"] == (
                "Which greeting is appropriate in the morning?"
            )
            assert "answer_key" not in json.dumps(released_lesson)
            assert "answerKey" not in json.dumps(released_lesson)

            def assert_audit_event(action, resource_type, resource_id):
                query = urlencode({
                    "limit": "5",
                    "action": action,
                    "resourceType": resource_type,
                })
                audit = expect_status(
                    request("GET", f"/api/v1/admin/audit?{query}", second_token),
                    200,
                    f"audit event {action}",
                )
                assert any(
                    row["action"] == action and row["resourceType"] == resource_type
                    and row["resourceId"] == resource_id
                    for row in audit["data"]
                ), f"Missing audit event: {action} / {resource_type} / {resource_id}"

            assert_audit_event("content.version.created", "lesson_version", lesson_version_id)
            assert_audit_event("content.review.submitted", "content_review", review_request_id)
            assert_audit_event("content.review.approved", "content_review", review_request_id)
            assert_audit_event("content.version.published", "lesson_version", lesson_version_id)

            pagination_sql = PERSIST_DIR / "admin-pagination-fixtures.sql"
            pagination_sql.write_text(
                "INSERT INTO lesson_versions "
                "(id,lesson_id,version,title,description,level,position,status,created_by_user_id) VALUES "
                f"('review-page-v3','lesson-greetings-001',3,'Review Page 3','Local fixture','A1',3,'draft','{user_id}'),"
                f"('review-page-v4','lesson-greetings-001',4,'Review Page 4','Local fixture','A1',4,'draft','{user_id}');"
                "INSERT INTO content_review_requests "
                "(id,lesson_version_id,author_user_id,status,submitted_at) VALUES "
                f"('review-page-1','review-page-v3','{user_id}','pending','2026-11-26 10:00:00'),"
                f"('review-page-2','review-page-v4','{user_id}','pending','2026-11-26 10:00:00');"
                "INSERT INTO admin_audit_events "
                "(id,actor_user_id,action,resource_type,resource_id,request_id,metadata_json,created_at) VALUES "
                f"('audit-page-1','{second_user_id}','test.pagination','test_resource','1','req-audit-0001','{{}}','2026-11-26 10:00:00'),"
                f"('audit-page-2','{second_user_id}','test.pagination','test_resource','2','req-audit-0002','{{}}','2026-11-26 10:00:00');",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={pagination_sql}",
            ])

            review_page_one = expect_status(
                request("GET", "/api/v1/admin/content/reviews?status=pending&limit=1", second_token),
                200,
                "review queue first page",
            )
            assert [row["review_request_id"] for row in review_page_one["data"]] == ["review-page-1"]
            review_cursor = review_page_one["meta"]["nextCursor"]
            assert review_cursor
            review_page_two = expect_status(
                request(
                    "GET",
                    "/api/v1/admin/content/reviews?" + urlencode({
                        "status": "pending", "limit": "1", "cursor": review_cursor
                    }),
                    second_token,
                ),
                200,
                "review queue second page",
            )
            assert [row["review_request_id"] for row in review_page_two["data"]] == ["review-page-2"]
            assert review_page_two["meta"]["nextCursor"] is None

            audit_page_one = expect_status(
                request("GET", "/api/v1/admin/audit?limit=1&action=test.pagination&resourceType=test_resource", second_token),
                200,
                "audit first page",
            )
            assert [row["id"] for row in audit_page_one["data"]] == ["audit-page-2"]
            audit_cursor = audit_page_one["meta"]["nextCursor"]
            assert audit_cursor
            audit_page_two = expect_status(
                request(
                    "GET",
                    "/api/v1/admin/audit?" + urlencode({
                        "limit": "1", "action": "test.pagination", "resourceType": "test_resource", "cursor": audit_cursor
                    }),
                    second_token,
                ),
                200,
                "audit second page",
            )
            assert [row["id"] for row in audit_page_two["data"]] == ["audit-page-1"]
            assert audit_page_two["meta"]["nextCursor"] is None

            revoke_file = PERSIST_DIR / "revoke-local-admin-roles.sql"
            revoke_file.write_text(
                "UPDATE user_roles SET revoked_at=CURRENT_TIMESTAMP "
                "WHERE id IN ('local-admin-role','local-reviewer-role');",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={revoke_file}",
            ])
            expect_status(
                request("GET", "/api/v1/admin/audit", second_token),
                403,
                "admin role revocation",
            )
            expect_status(
                request("GET", "/api/v1/admin/content/reviews", second_token),
                403,
                "reviewer role revocation",
            )

            expect_status(
                request("GET", f"/api/v1/attempts/{attempt_id}", second_token),
                404,
                "cross-user attempt read",
            )
            expect_status(
                request(
                    "POST", f"/api/v1/attempts/{attempt_id}/answers",
                    second_token,
                    {"questionId": questions[0]["id"], "answer": "a"},
                ),
                404,
                "cross-user answer write",
            )

            logout = expect_status(
                request("POST", "/api/v1/auth/logout", token, {}),
                200,
                "logout",
            )
            assert logout["data"]["loggedOut"] is True
            expect_status(request("GET", "/api/v1/me", token), 401, "revoked session")

            # Seed the bucket at its threshold rather than sending 30 requests.
            # This keeps the integration check deterministic across minute boundaries.
            rate_limit_ip = "203.0.113.12"
            rate_limit_key = hmac.new(
                BOT_TOKEN.encode(),
                f"telegram-login-rate-limit:{rate_limit_ip}".encode(),
                hashlib.sha256,
            ).hexdigest()
            seed_rate_limit = PERSIST_DIR / "seed-rate-limit.sql"
            seed_rate_limit.write_text(
                "INSERT INTO auth_rate_limits (bucket_key,window_start,request_count,updated_at) "
                f"VALUES ('{rate_limit_key}',strftime('%Y-%m-%dT%H:%M:00.000Z','now'),30,strftime('%Y-%m-%dT%H:%M:%fZ','now')) "
                "ON CONFLICT(bucket_key) DO UPDATE SET "
                "window_start=excluded.window_start,request_count=excluded.request_count,updated_at=excluded.updated_at;",
                encoding="utf-8",
            )
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={seed_rate_limit}",
            ])
            status, limited_body, response_headers = request(
                "POST", "/api/v1/auth/telegram",
                payload={"initData": "invalid"},
                ip=rate_limit_ip,
                include_headers=True,
            )
            assert status == 429, (status, limited_body)
            assert limited_body.get("error", {}).get("code") == "RATE_LIMITED"
            assert response_headers.get("Retry-After") == "60", response_headers

            print(
                "Wrangler local D1 integration passed: Telegram HMAC/replay, "
                "session issuance/revocation, content privacy, attempt ownership, "
                "answer idempotency, concurrent completion, concurrent login replay, concurrent same-identity account convergence, admin/reviewer RBAC grant/revocation, review/audit cursor pagination, login rate limiting with Retry-After, and frontend API response-contract compatibility."
            )
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
    finally:
        shutil.rmtree(PERSIST_DIR, ignore_errors=True)
