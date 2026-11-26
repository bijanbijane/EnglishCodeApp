# Backend Domain Modules

| Module | Current implementation | Target responsibility |
|---|---|---|
| auth | Telegram verification, session issue/revoke | provider auth and lifecycle |
| identity | verified Telegram mapping to internal user | provider-neutral identity linking |
| users | /me and progress reads | preferences and account lifecycle |
| learning | version-aware lesson reads and attempts | learning orchestration |
| content | immutable lesson/question snapshots, author-owned drafts and protected review/publish workflow | bulk authoring, ETag/If-Match and localization |
| assessment | pinned policy, weighted completion and immutable attempt_results | richer item types and reviewable assessment policies |
| progress | append-only progress_events and atomic per-user projection rebuild | rebuildable skill/mastery projections |
| review | deterministic scheduler v1 | scheduler policies and review state |
| vocabulary | enrollment, list and review API | lexicon and user vocabulary |
| integrations | Telegram Mini App login only | bot webhook and provider adapters |
| media | not implemented | private R2 assets and retention |
| jobs | not implemented | outbox and idempotent async jobs |
| entitlements | not implemented | action-level access policy |
| administration | role authorization, audit writer, draft creation, review queue/detail, reviewer decisions and admin publish | role bootstrap/management, audit queries and full admin console |
| analytics | not implemented | purpose-limited aggregate metrics |

## Dependency rules
- Routes validate transport data and call application services.
- Domain logic stays independent of Hono, D1 and provider SDKs.
- Repositories own SQL; no cross-module direct table access.
- Platform adapters implement D1/R2/Queue/clock/ID interfaces.
- No circular imports or shared god-service.
- Every new module needs ownership tests, API contract, migration, observability and documented failure behavior.

See docs/backend/ARCHITECTURE-V3.md and DOMAIN-MODULES.md for the full target boundaries and implementation sequence.
