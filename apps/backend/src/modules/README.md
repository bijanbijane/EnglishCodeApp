# Backend Domain Modules

| Module | Current implementation | Target responsibility |
|---|---|---|
| auth | Telegram verification, session issue/revoke | provider auth and lifecycle |
| identity | verified Telegram mapping to internal user | provider-neutral identity linking |
| users | /me and progress reads | preferences and account lifecycle |
| learning | lesson reads and attempts | learning orchestration |
| review | deterministic scheduler v1 | scheduler policies and review state |
| vocabulary | enrollment, list and review API | lexicon and user vocabulary |
| content | basic lesson/question reads | immutable versioned content |
| assessment | basic grading and completion | versioned policies and results |
| progress | basic lesson aggregate | rebuildable skill/mastery projections |
| integrations | Telegram Mini App login only | bot webhook and provider adapters |
| media | not implemented | private R2 assets and retention |
| jobs | not implemented | outbox and idempotent async jobs |
| entitlements | not implemented | action-level access policy |
| administration | not implemented | RBAC, publishing and audit |
| analytics | not implemented | purpose-limited aggregate metrics |

## Dependency rules
- Routes validate transport data and call application services.
- Domain logic stays independent of Hono, D1 and provider SDKs.
- Repositories own SQL; no cross-module direct table access.
- Platform adapters implement D1/R2/Queue/clock/ID interfaces.
- No circular imports or shared god-service.
- Every new module needs ownership tests, API contract, migration, observability and documented failure behavior.

See docs/backend/ARCHITECTURE-V3.md and DOMAIN-MODULES.md for the full target boundaries and implementation sequence.
