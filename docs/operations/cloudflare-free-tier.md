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
- Per-user maximum: 2 reservations per UTC day.
- Account-wide maximum: 60 reservations per UTC day.
- D1 stores quota reservations only; audio bytes are not persisted.
- Quota exhaustion returns HTTP 429. No paid-provider fallback.
- Workers AI free allocation is shared across the Cloudflare account. Other account workloads also consume the shared daily allocation.

## Upgrade path
Measure usage and latency before considering paid Workers AI, higher quotas, R2 retention, or queue consumers. No automatic paid upgrade or paid fallback is allowed.
