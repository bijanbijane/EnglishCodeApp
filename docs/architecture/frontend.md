# Frontend Architecture — EnglishCodeApp

**Status:** Architecture baseline; product requirements are defined in the companion specification.  
**Date:** 2026-11-26

## Source of truth

The complete product and experience requirements are in [Frontend Product & Experience Specification](./frontend-product-spec.md). This file records technical architecture and implementation boundaries. If a UI implementation decision conflicts with the product specification, record the conflict and resolve it rather than silently diverging.

## Decision

Use a feature-based modular monolith built with React 19, TypeScript and Vite. The first client is optimized for Telegram Mini App and small screens, while learning features remain channel-independent.

Do not introduce micro-frontends, a global event bus, a large state framework or a UI component library in the MVP without measured need.

## Dependency direction

```text
app composition
  ├── feature public APIs
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
1. App composition may import public feature APIs.
2. A feature may depend on shared infrastructure and its own internals.
3. A feature must not import another feature's private files.
4. Shared modules must not import features.
5. Platform adapters contain platform capabilities, not learning-domain rules.
6. UI components do not own grading, authorization or progress calculation.
7. API response types are explicit; avoid untyped `any`.
8. Telegram SDK access is isolated behind an adapter and optional in a normal browser.

## Feature boundaries

- `identity`: login state, current-user view and session lifecycle.
- `learning-paths`: course/path discovery and enrollment.
- `lessons`: lesson catalog, metadata and player.
- `practice`: question rendering and answer submission UI.
- `review`: due review sessions and learner responses.
- `vocabulary`, `grammar`: focused learning and practice.
- `listening`, `speaking`, `reading`, `writing`: skill-specific experiences.
- `progress`: server-confirmed progress and history.
- `profile`: preferences and account controls.

Create a feature directory only when its first real use case is implemented. Empty folders are not architecture.

## State strategy

- Local component state for ephemeral UI state.
- URL/navigation state for routes and shareable location.
- Backend is authoritative for identity, permissions, lesson content, correctness, score, attempts and progress.
- TanStack Query may be introduced when cache invalidation, retries and multiple screens justify server-state orchestration.
- Zustand may be introduced only for genuinely shared client state; do not mirror server-owned data in a global store.
- Never store secrets or long-lived bearer tokens in localStorage.

## Routing

Route definitions belong in `app/navigation/`. The current app uses a small hash-based route adapter for `#/`, `#/profile`, `#/progress` and `#/lessons/:lessonId`, avoiding a routing dependency while supporting refresh, direct lesson links, browser back/forward and Telegram BackButton. The app composition maps lesson IDs to catalog data and injects labels into progress views; feature modules do not import each other's private implementation. If nested route complexity grows, replace the adapter behind the same route contract rather than moving routing into feature modules.

## Platform boundary

Expose a small interface for raw Telegram initData, viewport/safe area, back button, theme and optional haptics. Feature modules must not import Telegram SDK directly. Browser adapter provides safe fallback behavior.

Raw initData is forwarded to the backend for validation. `initDataUnsafe` is presentation-only and never an authentication source. Bot tokens and secrets must never enter the browser bundle.

## API boundary

Use versioned `/api/v1` endpoints and feature-owned typed adapters. Shared HTTP transport normalizes errors, handles cancellation and follows the backend-defined credential/session policy. Do not invent a client-side session scheme before the backend contract is confirmed.

Backend owns all security-sensitive validation and learning-domain decisions. Frontend validation exists for usability only.

## UI and design system

Follow the Editorial Learning Studio direction in the product specification. Centralize color, typography, spacing, radius, motion, breakpoints and focus tokens. Preserve RTL Persian interface chrome and LTR English learning content at the component level. Avoid adding a component library until a concrete need justifies it.

## Quality gates

- strict Typecheck and production build;
- loading, empty, error and retry states for remote data;
- semantic HTML, keyboard operation, visible focus and screen-reader status;
- RTL/LTR mixed-content checks;
- responsive behavior across Telegram and browser;
- unit/component tests for stateful features;
- integration and E2E coverage for the critical learning journey;
- no secrets or answer keys in client payloads;
- CI evidence before considering work verified.

## Current implementation baseline

Branch: `feat/frontend-modular-foundation`  
PR: [#4](https://github.com/bijanbijane/EnglishCodeApp/pull/4)

Implemented in the branch: app composition split, shared API client, searchable/selectable lesson catalog, server-backed question list, Telegram SecureStorage session bootstrap (Bot API 9.0+), bearer-authenticated attempt/answer/complete flow, server-confirmed answer feedback and final score, responsive RTL dashboard, Telegram BackButton/safe-area/theme adapter, architecture documentation and CI workflow path correction.

Not yet verified: npm install, typecheck, tests, production build, browser behavior and Telegram-client behavior. Browser sign-in remains preview-only until the backend supports an approved secure cookie/session contract. Review remains incomplete; progress has a basic server-backed summary screen; profile exposes account display name, session status and logout.

No merge, deployment, production migration, production data mutation or paid-resource activation is part of this work.
