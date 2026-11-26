# Frontend Acceptance Checklist — EnglishCodeApp

This checklist operationalizes `frontend-product-spec.md`. Check an item only when implementation and evidence exist. A design proposal, source file or open PR is not evidence of runtime correctness.

## A. Product and pedagogy
- [ ] Every lesson has an observable learning objective.
- [ ] Lesson content has context, appropriate input, practice and a meaningful use/production task where relevant.
- [ ] Exercise type and feedback policy are explicit.
- [ ] Correctness, score and progress are server-authoritative.
- [ ] CEFR labels are not presented as formal certification.
- [ ] Lesson completion is not conflated with mastery.

## B. Navigation and screens
- [ ] Five primary destinations: Home, Learn, Practice, Review, Profile.
- [ ] Home prioritizes one next action and due review.
- [ ] Learning path shows outcomes, prerequisites and status.
- [ ] Lesson catalog includes level, skills, outcome, duration and state.
- [ ] Lesson player focuses on one dominant activity.
- [ ] Review requires active recall before answer reveal.
- [ ] Progress metrics have definitions and sufficient evidence.
- [ ] Inactive modules are not presented as ready features.

## C. UI states
- [ ] Loading, loaded, empty, error and retry states.
- [ ] Session expired/unauthorized state.
- [ ] Submitting state prevents duplicate actions.
- [ ] Recoverable errors preserve safe user input.
- [ ] Network failure and stale data behavior are defined.
- [ ] Feedback explains errors and provides a next action.

## D. Visual system and responsive behavior
- [ ] Design tokens centralize color, typography, spacing, radius, motion and breakpoints.
- [ ] Editorial Learning Studio direction is consistent.
- [ ] Mobile-first behavior works in Telegram Mini App.
- [ ] Browser and desktop layouts remain usable.
- [ ] Safe areas and Telegram viewport changes are handled.
- [ ] No horizontal overflow at supported widths.
- [ ] Reduced-motion preference is respected.
- [ ] Critical startup does not depend on third-party font/network.

## E. Accessibility and localization
- [ ] Semantic landmarks and heading hierarchy.
- [ ] All controls keyboard operable with visible focus.
- [ ] Icon-only controls have accessible names.
- [ ] Status and feedback are announced to assistive technology.
- [ ] Contrast is sufficient and meaning is not color-only.
- [ ] Touch targets are usable.
- [ ] Persian RTL chrome and English LTR learning content are tested together.
- [ ] Text zoom/reflow does not hide essential content.
- [ ] Audio/video learning content has suitable text alternatives.

## F. Architecture and security
- [ ] Feature dependency boundaries are respected.
- [ ] Shared modules do not import features.
- [ ] Feature internals are not imported by other features.
- [ ] Telegram SDK is isolated in platform adapter.
- [ ] Official WebApp script and bootstrap/ready lifecycle are implemented.
- [ ] Authenticated entry is limited to supported launch paths; missing initData is handled safely.
- [ ] Raw initData freshness, signature and replay validation are enforced by backend; initDataUnsafe is not authentication.
- [ ] Viewport, safe areas, theme, BackButton and MainButton are feature-detected and cleaned up correctly.
- [ ] Telegram SecureStorage is capability-detected and used according to the backend session contract.
- [ ] Browser fallback uses the backend-approved secure session mechanism.
- [ ] No bot token, secret or answer key in client bundle/payload.
- [ ] No direct D1/R2 access from frontend.
- [ ] No long-lived bearer token in localStorage or undocumented sessionStorage fallback.
- [ ] Session policy matches documented backend contract.
- [ ] Backend remains authoritative for grading and progress.

## G. Testing and performance
- [x] Unit tests for meaningful domain-to-view mapping and utilities.
- [ ] Component tests for states, forms and keyboard behavior.
- [ ] Integration test for lesson catalog.
- [ ] Integration test for lesson start, answer submit and server result.
- [ ] Session expiry and recovery tested.
- [ ] E2E critical journey passes in test environment.
- [x] TypeScript typecheck passes.
- [x] Production build passes.
- [ ] CI run is green and linked.
- [ ] Mobile network and representative device performance checked.
- [ ] No performance compliance claim without measurement.

## H. Privacy and analytics
- [ ] Analytics event schema and purpose are documented.
- [ ] Retention and access rules are documented.
- [ ] Credentials, raw private message content and unnecessary personal data are excluded.
- [ ] No keystroke/mouse surveillance or inferred psychological profiling.
- [ ] Voice processing and retention are disclosed before speaking feature launch.

## I. Release controls
- [ ] All dependent PRs and API contracts are resolved.
- [ ] Review evidence is recorded.
- [ ] PR remains Draft until acceptance is satisfied.
- [ ] No production migration, deployment or paid resource activation without separate authorization.


## Current source implementation note — 2026-11-26

The branch now contains a searchable lesson catalog, public question retrieval, Telegram Bot API 9.0 SecureStorage session bootstrap, authenticated attempt/answer/complete requests, server-confirmed feedback and score, authenticated profile and progress screens, logout, hash navigation and Telegram BackButton/safe-area/theme integration. Frontend typecheck, unit/contract tests and production build have passed locally; integration tests, hosted CI, Telegram-device verification and browser E2E remain open. Browser authentication remains unavailable because the backend does not yet expose a secure HttpOnly cookie/session contract.


## Learn library implementation update — 2026-11-26

The source now separates the Home dashboard from the dedicated `#/learn` library. The library supports search by lesson title, CEFR level and description, a data-driven CEFR level selector, Persian/Arabic keyboard-variant normalization, explicit no-results feedback, and the existing loading/empty/error/retry catalog states. Pure tests cover filters and verify the source list is not mutated. Lesson selection opens the lesson player; returning from the player returns to Learn. Pure search and route tests were added to the repository.

The profile screen now offers a retry action after a recoverable `GET /api/v1/me` failure without clearing the authenticated session. Local validation on 2026-11-26 passed: clean `npm ci`, frontend typecheck, 39/39 frontend tests, Vite production build and `git diff --check`. Backend workspace typecheck/tests and hosted CI remain separate open gates; Telegram-device and E2E checks have not been run.

Practice and Review remain intentionally absent from active navigation until the frontend's backend base exposes the required server-owned contracts. The five-destination navigation acceptance item above remains unchecked. Local frontend unit tests, typecheck and production build are now checked based on 2026-11-26 execution evidence. Component/integration/E2E tests, hosted CI, accessibility audits and Telegram-device checks remain unchecked.
