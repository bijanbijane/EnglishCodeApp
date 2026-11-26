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

## Boundaries

- The frontend owns presentation, navigation and transient UI state.
- The backend owns identity, authorization, answer correctness, scoring, attempts and progress.
- The frontend sends raw `Telegram.WebApp.initData` to the backend for validation. It must never trust `initDataUnsafe` for authentication.
- No direct D1/R2 access and no secrets in the browser bundle.
- Do not persist bearer tokens in localStorage. A session strategy must be selected and documented before authenticated browser flows are enabled.

## Quality gates

Every feature should include typed API contracts, loading/empty/error states, accessible interactions and tests for meaningful behavior. Build and typecheck must pass before a change is considered verified.
