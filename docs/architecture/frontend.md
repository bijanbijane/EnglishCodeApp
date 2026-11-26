# Frontend Architecture — EnglishCodeApp

**Status:** Initial implementation baseline  
**Date:** 2026-11-26

## Decision

Use a feature-based modular monolith built with React, TypeScript and Vite. Keep the first client optimized for Telegram Mini App and small screens while preserving a channel-independent learning UI.

Do not introduce micro-frontends, a global event bus, a large state framework or a UI component library in the MVP without measured need.

## Dependency direction

```text
app composition
  ├── feature modules
  │     ├── feature UI
  │     ├── feature API adapter
  │     └── feature model/types
  └── shared infrastructure
        ├── HTTP client
        ├── UI primitives
        ├── formatting/utilities
        └── platform adapters (Telegram, browser)
```

Rules:

1. A feature may depend on shared infrastructure.
2. A feature must not import another feature's internal files. Cross-feature use requires an explicit public export or an application-level composition.
3. Shared modules must not import feature modules.
4. UI components do not own business rules such as grading, authorization or progress calculation.
5. API response types are explicit; do not spread untyped `any` through the app.
6. Telegram SDK access is isolated behind an adapter and is optional when running in a normal browser.

## Initial feature boundaries

- `identity`: login state, current-user view and session lifecycle.
- `learning-paths`: course/path discovery and enrollment.
- `lessons`: lesson catalog and lesson metadata.
- `practice`: question rendering and answer submission UI.
- `vocabulary`: vocabulary study and review.
- `grammar`: grammar topics and exercises.
- `listening`: audio learning experience.
- `speaking`: speaking exercises (later phase; no speech recognition in MVP).
- `reading`: reading passages and comprehension.
- `writing`: writing exercises and feedback.
- `progress`: server-confirmed progress and history.
- `profile`: user preferences and account controls.

Create a feature directory only when its first real use case is implemented; empty folders are not architecture.

## State strategy

- Local component state for ephemeral UI state.
- TanStack Query may be introduced when cache invalidation, retries and multiple screens justify server-state orchestration.
- Zustand may be introduced only for genuinely shared client state; do not mirror server-owned data in a global store.
- Never store secrets or long-lived bearer tokens in localStorage.
- The backend remains authoritative for user identity, permissions, answer correctness, score and progress.

## Routing and navigation

Keep route definitions in `app/`. Add a routing dependency when the first multi-screen authenticated flow is implemented. Navigation must work with Telegram Mini App constraints and browser refresh/deep links.

## Telegram boundary

Expose a small adapter for platform capabilities (initData, viewport, back button, haptics and theme). Feature modules must not import Telegram SDK directly. The raw initData is forwarded to the backend; `initDataUnsafe` is presentation-only and never an authentication source.

## Quality and acceptance

- Strict TypeScript; no implicit `any`.
- Loading, empty, error and retry states for remote data.
- RTL and keyboard/accessibility semantics.
- Mobile-first responsive behavior.
- Unit/component tests for stateful features and E2E coverage for the critical learning journey.
- Build, typecheck and relevant tests must pass in CI.
- No public deployment, paid resource activation or production data mutation is part of this implementation.
