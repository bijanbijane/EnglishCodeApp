# Local verification record — 2026-11-26

**Repository branch:** `feat/backend-architecture-v3`  
**Target:** Local macOS Node 26 + Wrangler 4.168.0 + Local D1.  
**Data:** Synthetic test users/content only.  
**Remote/production:** Not accessed or modified.

## Reproducible workspace gates

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Passed |
| `npm run typecheck` | Passed; frontend and backend |
| `npm test` | Passed; 8 files / 32 tests at time of run |
| `npm run build:frontend` | Passed |
| `git diff --check` | Passed |

An initial typecheck found missing Node type declarations and a WebCrypto `BufferSource` typing incompatibility. Added `@types/node` and copied HMAC key bytes into an ArrayBuffer-backed view. The first unit run then found incomplete test doubles for provider identity persistence and an Hono test that omitted the empty env object; both test fixtures were corrected. The complete suite then passed.

## Fresh Local D1 install

Using Wrangler with the explicit `--local` flag:
- `npm run db:migrate:local`
- Applied migrations 0001 through 0006 successfully.
- D1 migration registry reported all six as applied.

## Upgrade/backfill path

A second isolated Local D1 database was initialized with migration 0001 only. Synthetic legacy rows were inserted:
- user `legacy-user-1`, Telegram subject `legacy-telegram-1`;
- published lesson `legacy-lesson-1`;
- one question;
- one completed attempt `legacy-attempt-1`.

Migrations 0002 through 0006 then applied successfully. A join query confirmed:
- provider mapping `telegram / legacy-telegram-1` belongs to the original internal user ID;
- lesson content version 1 exists;
- old attempt references `legacy-lesson-1:v1`;
- assessment policy reference is `percentage-v1`.

## Actual Worker + Local D1 request tests

Wrangler Worker ran at localhost with a dummy local bot token and Local D1 binding. `/api/v1/ready` and `/api/v1/health` both returned 200.

| Scenario | Observed result |
|---|---|
| Two simultaneous login requests with identical signed initData | 200 + 409; exactly one session issued |
| Published lesson read and public question DTO | 200; no answer_key field |
| Attempt start | 201 |
| Correct answer | 200; server returned isCorrect=true |
| Weighted score with one correct of two questions | 50 |
| Repeat completed attempt request | 200; progress completion count did not increment again |
| Answer racing completion | one request won according to transaction order; completion returned 200 |
| Answer after completion | 409 ATTEMPT_NOT_ACTIVE |
| Concurrent completion calls for same attempt | both callers received 200; progress incremented once |
| Vocabulary enrollment | 200/201 depending on pre-existing enrollment |
| Same review idempotency key and same payload | 200 replay of existing event |
| Same idempotency key with different rating | 409 IDEMPOTENCY_KEY_REUSED |
| Two distinct review requests | both accepted sequentially by local D1 in this run |

The review race was serialized in this local runtime; this does not prove the stale-revision conflict branch under every distributed timing. That branch still needs a deliberately synchronized concurrency test.

## Important limits

- Wrangler Local D1 is a local emulator/runtime path, not Cloudflare remote D1.
- No production migration, secret, deployment or Cloudflare resource mutation was performed.
- No cross-user authorization matrix, load/abuse test, browser Telegram WebView matrix or backup/restore drill has been completed.
- GitHub Actions jobs still fail before exposing step details/logs. The same checks have been run locally; hosted runner failure remains separately unresolved.
- The temporary local seed and request scripts are under ignored `tmp/`; they are not part of the application source.

## Next gates

1. Commit the lockfile and CI `npm ci` workflow; obtain hosted Actions evidence.
2. Add a deterministic test for stale review revision and same-key concurrent replay.
3. Add cross-user ownership tests for every attempt endpoint.
4. Implement content authoring/review/publish only after admin RBAC and append-only audit.
5. Add account deletion/export and retention rules before media collection.
