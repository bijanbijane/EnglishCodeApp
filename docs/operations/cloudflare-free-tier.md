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
- The server checks a basic container signature against the declared MIME type, including the common browser value `audio/webm;codecs=opus`. This is format sniffing, not full media validation.
- Client-declared duration maximum 60 seconds. This is a client-side/UX guardrail, not a trusted media parser.
- **Production deployment blocker:** actual media duration is not parsed or verified server-side. Never treat `durationSeconds` as a cost-control boundary. Implement trusted duration validation (or a strictly constrained, server-verifiable audio representation) before exposing this endpoint to production traffic.
- Each inference attempt consumes an application reservation even when Workers AI returns an error. Reservations are deliberately retained after inference failures to prevent retries bypassing daily caps.
- The Workers Free plan includes 10,000 Workers AI Neurons per account per UTC day, resetting at 00:00 UTC. On Free, further inference requests fail after the allowance is exhausted; the platform does not automatically convert them into paid usage.
- Cloudflare lists Whisper Large V3 Turbo at 46.63 Neurons per audio minute (pricing documentation last updated 2026-11-18). That gives about 214.4 audio minutes if the entire account allowance were available to this model. At 60 verified 60-second requests, the app would use at most 2,797.8 Neurons. This is an estimate, not a reservation: other account workloads share the same allowance, and the 60-second cap is not yet verified by the server. See https://developers.cloudflare.com/workers-ai/platform/pricing/.
- Wrangler local-mode Workers AI inferences also count toward the account's AI limits. Tests must reject quota-full requests before calling the real model. See https://developers.cloudflare.com/workers-ai/platform/limits/.
- Per-user maximum: 2 reservations per UTC day.
- Account-wide application maximum: 60 reservations per UTC day.
- Local D1 integration tests exercise eight concurrent requests against exhausted per-user and account-wide quotas and verify the stored reservation counts do not exceed those limits.
- D1 stores quota reservations only; raw audio bytes are not persisted.
- Expired reservations are pruned by the existing daily maintenance Cron in bounded batches (500 rows per run), retaining seven days of operational quota history.
- Migration `0017` follows learning-event migration `0016` when both PRs are integrated.
- Quota exhaustion returns HTTP 429. No paid-provider fallback.
- Cloudflare's free allocation is shared across the entire account; the application quota does not reserve or isolate neurons from other account workloads.
## Upgrade path
Measure usage and latency before considering paid Workers AI, higher quotas, R2 retention, or queue consumers. No automatic paid upgrade or paid fallback is allowed.
