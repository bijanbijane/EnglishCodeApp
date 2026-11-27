# Cloudflare free-tier operating policy

## Hard constraints
- Do not enable a paid plan, billing, or any product requiring a payment card without explicit approval.
- Do not deploy paid-only models or services.
- Product catalog visibility does not prove free entitlement.
- Keep development and production resource bindings separate.
- Fail closed if quota storage is unavailable.
- Do not persist raw learner audio by default.

## Development integrations
- Existing Workers: `englishcode-backend-dev` and `englishcode-frontend-dev`.
- Existing D1: `englishcodeapp-dev`.
- Workers AI: Whisper Large V3 Turbo via native binding; no separate model-provider key is used inside the Worker.
- Queues: `englishcode-audio-jobs` and `englishcode-audio-jobs-dlq` are provisioned for future asynchronous jobs. No consumer is attached until a retry-safe consumer exists.
- R2: not enabled; Cloudflare API currently requires dashboard activation. Do not enable until card/billing requirements are verified.

## Speech transcription guardrails
- Authenticated users only; English transcription in this first iteration.
- Request maximum 192 KiB; decoded audio maximum 96 KiB.
- Client-declared duration maximum 60 seconds. This is a client-side/UX guardrail, not a trusted media parser; byte limit is enforced server-side.
- **Deployment blocker:** actual media duration is not parsed or verified server-side. Never treat `durationSeconds` as a cost-control boundary. Implement trusted duration validation (or a strictly constrained, server-verifiable audio representation) before exposing this endpoint to production traffic.
- Each inference attempt consumes an application reservation even when Workers AI returns an error. Do not release quota after an upstream inference attempt; doing so enables unlimited retry attempts against the free allocation.
- Cloudflare Workers AI Free currently includes 10,000 Neurons per account per day. Whisper Large V3 Turbo is listed at 46.63 Neurons per audio minute (pricing docs last updated 2026-11-12). At a verified maximum of 60 seconds, 60 daily requests would use at most 2,797.8 Neurons. This estimate is only valid when actual duration is verified and no other account workload consumes the shared allocation. See https://developers.cloudflare.com/workers-ai/platform/pricing/.
- Wrangler local-mode Workers AI inferences also count toward the account's AI limits; integration tests must deny requests before inference rather than call the real model. See https://developers.cloudflare.com/workers-ai/platform/limits/.
- Per-user maximum: 2 reservations per UTC day.
- Account-wide maximum: 60 reservations per UTC day.
- D1 stores quota reservations only; audio bytes are not persisted.
- Expired quota reservations are pruned by the existing daily maintenance Cron in bounded batches (500 rows per run), retaining seven days of operational quota history.
- The AI quota migration is numbered `0017` so it can follow the learning-event migration `0016` when both PRs are integrated.
- Quota exhaustion returns HTTP 429. No paid-provider fallback.
- Quota reservations are retained after inference failures so retries cannot bypass the daily cap.
- Workers AI free allocation is shared across the Cloudflare account. Other account workloads also consume the shared daily allocation.

## Upgrade path
Measure usage and latency before considering paid Workers AI, higher quotas, R2 retention, or queue consumers. No automatic paid upgrade or paid fallback is allowed.
