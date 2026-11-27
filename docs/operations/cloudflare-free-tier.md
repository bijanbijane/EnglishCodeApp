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
- Accept only single-track WebM audio containing an Opus track. Other formats (including Ogg and MP4) are rejected in this iteration; a browser client must feature-detect `audio/webm;codecs=opus`.
- JSON request maximum: 1.5 MiB. Decoded audio maximum: 1 MiB. Cloudflare's Whisper tutorial demonstrates processing 1 MB audio chunks; the application imposes its own stricter per-request cap. See https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/.
- The server parses the EBML structure, validates a single Opus audio track, walks Cluster/Block timestamps, and derives packet durations from Opus TOC values. It handles no lacing, Xiph lacing, fixed-size lacing, and EBML lacing. It does not rely on the optional WebM Info/Duration field.
- Client-supplied `durationSeconds` is ignored. The server-derived duration must be greater than zero and no longer than 60 seconds before any quota reservation is created.
- The parser is a bounded metadata/timeline parser, not a full Opus decoder. Browser-generated recordings have not yet been captured and tested end-to-end; validate representative Chrome, Android WebView, and Telegram Mini App recordings before production deployment. iOS browsers that do not support WebM/Opus need a separately implemented codec path, not a MIME spoof.
- The 1 MiB byte cap corresponds to about 140 kbit/s average for a 60-second recording before container overhead. A recording that exceeds the byte cap is rejected even if its duration is valid; measure real browser output before changing this cap.
- Each inference attempt consumes an application reservation even when Workers AI returns an error. Reservations are deliberately retained after inference failures to prevent retries bypassing daily caps.
- The Workers Free plan includes 10,000 Workers AI Neurons per account per UTC day, resetting at 00:00 UTC. On Free, further inference requests fail after the allowance is exhausted; the platform does not automatically convert them into paid usage.
- Cloudflare lists Whisper Large V3 Turbo at 46.63 Neurons per audio minute. At 60 verified 60-second requests, the app would use at most 2,797.8 Neurons. This is an estimate, not a reservation: other account workloads share the same allowance. See https://developers.cloudflare.com/workers-ai/platform/pricing/.
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
