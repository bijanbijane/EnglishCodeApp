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
    method, path, token=None, payload=None, ip="203.0.113.10", include_headers=False
):
    headers = {
        "Accept": "application/json",
        "CF-Connecting-IP": ip,
    }
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


def make_init_data(user_id, first_name):
    values = {
        "auth_date": str(int(time.time())),
        "query_id": f"local-test-{user_id}",
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
                f"('local-reviewer-role','{second_user_id}','content_reviewer',NULL);",
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
            expect_status(
                request("GET", "/api/v1/admin/content/reviews", second_token),
                200,
                "reviewer role grant",
            )

            pagination_sql = PERSIST_DIR / "admin-pagination-fixtures.sql"
            pagination_sql.write_text(
                "INSERT INTO lesson_versions "
                "(id,lesson_id,version,title,description,level,position,status,created_by_user_id) VALUES "
                f"('review-page-v2','lesson-greetings-001',2,'Review Page 2','Local fixture','A1',2,'draft','{user_id}'),"
                f"('review-page-v3','lesson-greetings-001',3,'Review Page 3','Local fixture','A1',3,'draft','{user_id}');"
                "INSERT INTO content_review_requests "
                "(id,lesson_version_id,author_user_id,status,submitted_at) VALUES "
                f"('review-page-1','review-page-v2','{user_id}','pending','2026-11-26 10:00:00'),"
                f"('review-page-2','review-page-v3','{user_id}','pending','2026-11-26 10:00:00');"
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
                request("GET", "/api/v1/admin/audit?limit=1", second_token),
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
                        "limit": "1", "cursor": audit_cursor
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

            clear_limits = PERSIST_DIR / "clear-rate-limits.sql"
            clear_limits.write_text("DELETE FROM auth_rate_limits;", encoding="utf-8")
            run([
                "npx", "wrangler", "d1", "execute", DATABASE,
                "--local", "--persist-to", persist, f"--file={clear_limits}",
            ])
            for attempt_number in range(30):
                status, _ = request(
                    "POST", "/api/v1/auth/telegram",
                    payload={"initData": "invalid"},
                    ip="203.0.113.12",
                )
                if status != 401:
                    raise AssertionError(
                        f"Rate limit request {attempt_number + 1} expected 401, got {status}"
                    )
            status, limited_body, response_headers = request(
                "POST", "/api/v1/auth/telegram",
                payload={"initData": "invalid"},
                ip="203.0.113.12",
                include_headers=True,
            )
            assert status == 429, (status, limited_body)
            assert limited_body.get("error", {}).get("code") == "RATE_LIMITED"
            assert response_headers.get("Retry-After") == "60", response_headers

            print(
                "Wrangler local D1 integration passed: Telegram HMAC/replay, "
                "session issuance/revocation, content privacy, attempt ownership, "
                "answer idempotency, concurrent completion, concurrent login replay, admin/reviewer RBAC grant/revocation, review/audit cursor pagination, login rate limiting with Retry-After, and frontend API response-contract compatibility."
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
