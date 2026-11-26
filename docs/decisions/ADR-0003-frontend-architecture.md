# ADR-0003: Feature-oriented React frontend and Telegram platform adapter

- Status: Proposed; requires review alongside the backend session contract.
- Date: 2026-11-26

## Context

The first client is a Telegram Mini App, but the product roadmap requires later web/mobile channels without coupling learning features to Telegram. The current UI is a single component and the earlier lesson UI uses endpoints that do not match the backend foundation API.

## Decision

1. Keep one React + Vite + TypeScript application for the MVP.
2. Organize code by app shell, pages, features, shared infrastructure and a thin platform adapter.
3. Use the backend API contract as the source of truth for authentication, lesson attempts, answer grading, score and progress.
4. Use same-origin `/api/v1` as the default deployment contract; keep the Vite proxy for local development.
5. Start with React state/context; add a global state or server-state library only when a concrete requirement justifies it.
6. Keep Telegram bridge operations behind `platform/telegram`; learning features must not import Telegram SDK types.
7. Validate API JSON at runtime and make requests abortable.
8. Use React StrictMode and test effect cleanup rather than disabling StrictMode.
9. Keep the frontend mobile-first, Persian RTL by default, with explicit LTR/auto direction for English content and Telegram safe-area/theme handling.

## Authentication decision

Telegram SecureStorage (Bot API 9.0+) is the preferred at-rest storage for the opaque backend session token when the Telegram client supports it. Feature-detect support. Do not silently fall back to localStorage or CloudStorage. When SecureStorage is unavailable, use a memory-only session and an explicit re-authentication path. See ADR-0004 and the Telegram Mini App architecture specification for the full lifecycle.

## Consequences

- The MVP remains a single deployable frontend.
- Feature boundaries support future web/mobile clients without introducing micro-frontends.
- The previous PR #1 lesson UI must be adapted to the backend v1 attempt lifecycle; it cannot be copied unchanged.
- No new paid service or Cloudflare resource is required by this decision.
- No production deployment is authorized by this ADR.
