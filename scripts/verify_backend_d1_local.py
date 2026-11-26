#!/usr/bin/env python3
"""Run the backend against Wrangler's local D1 runtime and verify critical flows."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import shutil
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


def request(method, path, token=None, payload=None, ip="203.0.113.10"):
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
    except HTTPError as error:
        status = error.code
        body = error.read()
    parsed = json.loads(body.decode() or "{}")
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
            assert profile["data"]["id"]

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

            progress = expect_status(request("GET", "/api/v1/me/progress", token), 200, "progress")
            assert len(progress["data"]) == 1
            assert progress["data"][0]["completed_count"] == 1

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

            print(
                "Wrangler local D1 integration passed: Telegram HMAC/replay, "
                "session issuance/revocation, content privacy, attempt ownership, "
                "answer idempotency, concurrent completion, and concurrent login replay."
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
