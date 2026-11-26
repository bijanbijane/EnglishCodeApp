# ADR-0004: Telegram-first Mini App host integration

- Status: Proposed; implementation and cross-client validation pending.
- Date: 2026-11-26

## Context

EnglishCodeApp is primarily launched inside Telegram. The existing frontend is a generic React page and does not load the Telegram WebApp bridge, consume Telegram theme/viewport data, or integrate native navigation/actions. The backend login contract requires signed initData and rejects replay.

## Decisions

1. The primary authenticated launch surfaces are the bot's Main Mini App and bot menu button.
2. Keyboard-button and inline-mode launches are not supported for the authenticated app because Telegram documents that initData is empty in those modes.
3. Load the official telegram-web-app.js script in the HTML head before the React module entrypoint.
4. Isolate all Telegram APIs behind platform/telegram. Feature modules remain host-agnostic.
5. Call ready() when essential UI is ready. Expand only when required by the chosen launch experience; do not request fullscreen by default.
6. Use Telegram theme variables and themeChanged event; respect safeAreaInset and contentSafeAreaInset.
7. Use viewportStableHeight for stable bottom-anchored layout, not the continuously changing viewportHeight.
8. Mirror app navigation through Telegram BackButton. Use MainButton for a single clear primary task action, not as a permanent universal CTA.
9. Prefer Telegram SecureStorage for backend bearer session tokens when the client supports Bot API 9.0+; feature-detect and define a safe memory-only fallback. Never store bearer tokens in localStorage or CloudStorage by default.
10. Treat start_param and all URL inputs as untrusted navigation hints only.
11. Keep server as the authority for identity, attempt, answer correctness and progress.

## Consequences

- The frontend is a Telegram Mini App first, not merely a responsive website.
- Browser development mode must be visibly separate from production Telegram authentication.
- Telegram client compatibility must be tested on iOS, Android, Desktop and Web.
- SecureStorage protects values at rest but does not remove the need for XSS prevention, CSP and secret-free logs.
- No BotFather settings, bot secrets, Cloudflare resources, paid services or deployments are changed by this ADR.

## Source

Official Telegram Mini Apps documentation: https://core.telegram.org/bots/webapps
