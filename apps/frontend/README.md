# Frontend — EnglishCode Telegram Mini App

## Purpose

The frontend is a mobile-first React application. Telegram is the first delivery channel, but the learning interface and feature modules must remain independent of Telegram-specific APIs so the same application can later support a standalone web client.

## Product and experience specification

The complete UI/product requirements, pedagogy, screen inventory, design system, accessibility, privacy, testing and delivery phases are documented in [docs/architecture/frontend-product-spec.md](../../docs/architecture/frontend-product-spec.md).

## Architecture

The frontend follows a **feature-based modular monolith**:

- `app/`: application composition, bootstrap, routing and providers.
- `features/`: user-facing business capabilities, each owning its UI, API adapter and domain types.
- `shared/`: cross-feature infrastructure such as HTTP, reusable UI primitives and utilities.
- `services/`: platform adapters, including Telegram Mini App integration.
- `styles/` and `assets/`: design tokens, global styles and static assets.

Feature modules must not import implementation details from another feature. Shared code is promoted only when it is genuinely reused. Avoid premature micro-frontends and global state.

## Current vertical slice

- React + TypeScript + Vite.
- Lesson catalog fetched from `GET /api/v1/lessons`.
- Explicit loading, error/retry and empty states.
- Persian RTL, responsive layout and mobile navigation shell.
- API transport isolated from feature components.

## API contract and authentication status

The source-inspected route and payload snapshot is documented in [docs/architecture/frontend-backend-contract.md](../../docs/architecture/frontend-backend-contract.md).

The public lesson catalog and question list are available without authentication. Inside Telegram, the app detects Bot API 9.0 SecureStorage, reads or stores the backend-issued bearer session there, and attaches the token to protected attempt/answer/complete/logout calls. The backend remains authoritative for correctness and score. Browser sign-in is intentionally not enabled because the backend does not yet issue an HttpOnly session cookie; outside Telegram, the app remains in public-preview mode.

## Boundaries

- The frontend owns presentation, navigation and transient UI state.
- The backend owns identity, authorization, answer correctness, scoring, attempts and progress.
- The frontend sends raw `Telegram.WebApp.initData` to the backend for validation. It must never trust `initDataUnsafe` for authentication.
- No direct D1/R2 access and no secrets in the browser bundle.
- Telegram bearer tokens are stored only in Telegram SecureStorage when Bot API 9.0+ is available.
- Do not persist bearer tokens in localStorage or sessionStorage.
- Browser authentication remains disabled until a backend-supported secure cookie/session contract exists.

## Quality gates

Every feature should include typed API contracts, loading/empty/error states, accessible interactions and tests for meaningful behavior. Build and typecheck must pass before a change is considered verified.


## Current implementation progress

- Selectable lesson catalog with client-side search.
- Lesson preview screen loading the public question list from `GET /api/v1/lessons/:lessonId/questions`.
- Lesson player creates a server attempt, submits selected answers and displays server-confirmed feedback when a valid Telegram SecureStorage session exists.
- Completion and final score are requested from the backend; the client does not calculate correctness or score.
- Browser mode and Telegram clients without SecureStorage remain public-preview-only.
- Telegram host adapter isolates raw initData, host detection, SecureStorage, viewport/safe-area/theme metadata and BackButton lifecycle.
- Profile screen exposes backend-verified display name, session status and server-backed logout.
- Progress screen reads per-lesson best score, completion count and last completion date from the authenticated `/api/v1/me/progress` endpoint.
- Hash navigation supports home, lesson, progress and profile routes, including direct lesson links, browser back/forward and Telegram BackButton.
- Implementation sequence and platform boundary are documented in [frontend-implementation-plan.md](../../docs/architecture/frontend-implementation-plan.md) and [frontend-platform-adapter.md](../../docs/architecture/frontend-platform-adapter.md).

The current branch has not been runtime-verified. Typecheck, production build, browser testing and Telegram-client testing remain outstanding. The authenticated lesson flow is source-implemented but has not yet been runtime-verified in Telegram.

## Validation commands

Run these from `apps/frontend`:

- `npm run typecheck` — TypeScript project check.
- `npm test` — dependency-free route contract tests (Node.js 22 with TypeScript type stripping).
- `npm run build` — production TypeScript and Vite build.

The route tests cover hash serialization, direct links, encoded lesson IDs and invalid-route fallback. Passing source configuration does not mean these commands have been executed; consult CI evidence and the acceptance checklist.

Architecture detail: [Frontend Runtime Contracts](../../docs/architecture/frontend-runtime-contracts.md).
