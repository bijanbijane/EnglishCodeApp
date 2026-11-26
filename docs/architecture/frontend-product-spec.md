# EnglishCodeApp — Frontend Product & Experience Specification

**Status:** Product/design specification — implementation baseline  
**Version:** 1.0  
**Date:** 2026-11-26  
**Repository:** `bijanbijane/EnglishCodeApp`  
**Working branch:** `feat/frontend-modular-foundation`  
**Related PR:** [#4 — Frontend modular foundation](https://github.com/bijanbijane/EnglishCodeApp/pull/4)

## 1. Purpose and product position

EnglishCodeApp is a structured English-learning product whose first distribution channel is Telegram Bot + Telegram Mini App. The learning experience must remain independent of Telegram so a standalone web client can be added without rewriting learning features.

The product is not a digital textbook, a quiz collection, or a points-first game. It is a guided learning studio that combines:
- a coherent curriculum and transparent learning goals;
- meaningful language input in context;
- guided practice and independent language production;
- actionable feedback;
- retrieval practice and spaced review;
- skill-level progress evidence.

The interface should make the next useful learning action obvious, reduce avoidable cognitive load, and keep the learner in control.

### 1.1 Product principles

1. **Learning outcome before feature count.** Every screen and interaction must support a stated learning outcome.
2. **Use before display.** Learners must use language to complete tasks, not only read explanations or recognize answers.
3. **Meaning before isolated rules.** Grammar and vocabulary are taught in meaningful contexts, then made explicit when useful.
4. **Practice before passive completion.** Retrieval, production and feedback are core interactions.
5. **Progress means demonstrated ability.** Finished screens, streaks and points are not proof of proficiency.
6. **Simple navigation, rich learning.** Complexity belongs inside well-structured lessons, not in the global menu.
7. **Learner agency.** Explain recommendations and allow review, pause, resume and reasonable choice.
8. **Accessible by default.** Keyboard, screen-reader, reduced-motion, contrast and touch targets are baseline requirements.
9. **Channel independence.** Telegram capabilities are adapters, not dependencies of feature modules.
10. **Honest AI.** AI feedback must distinguish suggestions from verified assessment and must not invent certainty.

## 2. Pedagogical foundation

No single Oxford or Cambridge branded method is treated as a universal proprietary method. The product uses established complementary principles and should map curriculum outcomes to CEFR descriptors where appropriate.

### 2.1 Instructional model

The default instructional approach combines:
- Communicative Language Teaching: language is learned for meaningful communication.
- Task-Based Learning: units culminate in a purposeful task with a clear outcome.
- CEFR-informed progression: learning goals are described as observable abilities, not vague labels.
- Retrieval practice: learners recall language rather than repeatedly reread it.
- Spaced review: items return according to learner performance and a review schedule.
- Formative feedback: errors are explained and become inputs to subsequent practice.
- Four-skill integration: listening, speaking, reading and writing connect with grammar and vocabulary.

These principles guide product design; they do not justify claiming accreditation, institutional endorsement, or equivalence to an Oxford/Cambridge course.

### 2.2 CEFR and curriculum rules

- Support CEFR levels A1, A2, B1, B2, C1 and C2 as curriculum metadata.
- Do not assign a CEFR level from a single quiz or raw XP total.
- A placement result is provisional until supported by sufficient evidence across relevant skills.
- Each course, unit and lesson declares: target level, prerequisites, learning outcomes, estimated time, skills, language functions, vocabulary/grammar scope and assessment method.
- A learner may see the path ahead. Prerequisites should prevent accidental skipping only when pedagogically justified.
- Do not present course completion as proof of an official CEFR certificate.

### 2.3 Standard lesson lifecycle

Every lesson uses a consistent instructional skeleton, while allowing content-specific activity types:

1. **Context / lead-in:** a situation, question, text, audio or problem that gives the language a reason to exist.
2. **Learning objective:** a concise, observable “By the end, you can…” statement.
3. **Input:** comprehensible language examples, audio/text and relevant vocabulary.
4. **Notice and explain:** focused explanation of a pattern, function or usage; concise by default, expandable when needed.
5. **Guided practice:** controlled retrieval and scaffolded tasks.
6. **Communicative task / production:** learner creates or understands language to achieve a meaningful outcome.
7. **Feedback and repair:** identify the issue, explain why, show a useful model and offer a retry.
8. **Reflection / summary:** what was learned and what remains uncertain.
9. **Review scheduling:** important items are queued for later retrieval based on performance.

A lesson may omit a stage only when the learning objective makes it unnecessary. Do not force every lesson into an identical number of screens.

### 2.4 Exercise design requirements

The activity renderer should support typed, extensible exercise contracts, including:
- single and multiple choice;
- gap fill;
- word/sentence ordering;
- matching;
- categorization;
- error identification and correction;
- short answer;
- sentence transformation;
- reading/listening comprehension;
- dictation where appropriate;
- guided dialogue and role-play;
- free writing and spoken response (later capability).

Each exercise declares its objective, prompt, instructions, input mode, expected response contract, feedback policy, hints, attempt policy, accessibility text and optional media. Correct answers and grading rules remain server-owned. Do not ship answer keys in public lesson payloads.

### 2.5 Feedback policy

Feedback should be:
- specific to the learner's response;
- understandable at the learner's level;
- explanatory rather than merely colored red/green;
- proportionate (do not overwhelm with every possible correction at once);
- respectful and non-punitive;
- actionable, with a retry or next practice step.

For open-ended AI feedback, clearly label it as AI-generated guidance. Avoid presenting uncertain grammar/style judgments as definitive. High-stakes or certificate-like assessment requires validated scoring rules and is out of MVP scope.

## 3. Information architecture and navigation

### 3.1 Primary navigation

The Telegram Mini App uses five primary destinations:
1. **Home** — next action, resume lesson, daily plan and concise progress.
2. **Learn** — learning paths, levels, units and lesson catalog.
3. **Practice** — skill practice and targeted exercises.
4. **Review** — due vocabulary, phrases, grammar patterns and prior errors.
5. **Profile** — account, preferences, level goals and learning settings.

Do not place every skill or grammar topic in the bottom navigation. Listening, speaking, reading, writing, grammar and vocabulary are destinations within Learn/Practice, not six additional top-level tabs.

### 3.2 Navigation behavior

- Preserve a visible and predictable way back.
- Lesson progress must survive navigation and app interruption when supported by backend state.
- A resumed lesson returns to the last safe checkpoint, not an unsubmitted transient answer.
- Deep links must resolve safely in Telegram and a normal browser.
- Browser refresh must not strand a learner on an invalid screen.
- Back-button behavior must be adapted through the platform adapter.
- Avoid nested modal stacks and hidden navigation gestures as the only route.

## 4. Screen specifications

### 4.1 Home dashboard

Purpose: answer “What is the most useful next action?”

Required content:
- greeting or neutral welcome (optional);
- current learning level with an explanation that it is an estimate/status, not certification;
- one primary “Continue learning” card when an active lesson exists;
- due review count and a direct review action;
- today's suggested plan, with estimated time;
- compact progress summary, not a wall of charts;
- a clear empty state for a new learner.

Do not show fabricated streaks, fake social proof, arbitrary rankings or multiple competing primary buttons.

### 4.2 Learning path

Purpose: make curriculum structure and learner position understandable.

Required content:
- course/level identity and level description;
- unit list with status (locked, available, in progress, completed);
- learning outcomes and estimated effort;
- prerequisites where relevant;
- clear distinction between completed, attempted and mastered;
- accessible list alternative to any visual path/map.

Do not use a maze-like path that hides the curriculum or forces unnecessary linearity.

### 4.3 Lesson catalog

Purpose: help the learner select or resume an appropriate lesson.

Each lesson card shows title, target level, learning outcome, skills, approximate time and state. Filters must be useful and limited. Search may be added when catalog size justifies it. Loading, empty, error and retry states are mandatory.

### 4.4 Lesson player

Purpose: maintain attention on one learning activity at a time.

Required regions:
- compact lesson title and progress indicator;
- current activity content;
- primary response/action area;
- contextual hint or explanation;
- feedback region;
- previous/next or continue controls where appropriate;
- exit/pause behavior with unsaved-work warning only when necessary.

Rules:
- one dominant task per viewport;
- no unrelated dashboard cards inside the player;
- progress indicator represents lesson stages, not proficiency;
- avoid auto-advancing before feedback can be read;
- preserve input on recoverable network errors;
- announce state changes accessibly.

### 4.5 Practice center

Organize practice by learner need and skill, not by an arbitrary catalogue of exercise widgets. Offer:
- recommended practice based on evidence;
- skill-based entry points;
- short focused sessions;
- targeted practice from error history;
- clear distinction between practice and formal assessment.

### 4.6 Review center

Show what is due and why it is due. Support vocabulary, phrases, grammar patterns and selected prior errors. Use active recall before revealing answers. Allow “I knew it / difficult / forgot” only if the resulting schedule is defined and consistent. Do not use an opaque algorithm without explaining the review behavior at a useful level.

### 4.7 Skills lab

Provide dedicated experiences for Listening, Speaking, Reading and Writing as they are implemented. Each skill must define its own task types, feedback and assessment limitations. Do not display inactive or nonfunctional modules as if they were ready.

### 4.8 Progress

Show:
- activity and consistency over time;
- progress by skill;
- demonstrated learning outcomes;
- strengths and areas needing practice;
- review retention signals where enough data exists;
- assessment history with dates and scope.

Every metric needs a definition and denominator. Avoid claiming mastery based on lesson completion, streaks or one attempt. Do not compare learners publicly by default.

### 4.9 Profile and settings

Include account/session status, language preferences, learning goal, notification preferences where supported, accessibility preferences and account controls. Do not expose internal identifiers, security tokens or sensitive telemetry.

## 5. Visual and interaction design system

### 5.1 Visual direction

Use an **Editorial Learning Studio** direction:
- calm, clear and contemporary;
- typography-led hierarchy;
- generous but efficient spacing;
- restrained color palette;
- cards only when they clarify grouping or action;
- strong reading and exercise focus;
- consistent visual language across dashboard, lesson and review.

The interface should feel credible as a learning product, not like a children's game by default. Brand personality can be friendly without childish illustrations, excessive gradients or decorative noise.

### 5.2 Design tokens

Create centralized tokens for:
- color roles: canvas, surface, elevated surface, text, muted text, border, primary, success, warning, danger, focus;
- typography: family, size scale, line height, weight;
- spacing scale;
- radius and elevation;
- breakpoints and content widths;
- motion duration/easing;
- touch target minimums.

Do not hardcode one-off colors or spacing throughout feature components. Theme variants must preserve contrast and semantic meaning.

### 5.3 Responsive behavior

- Mobile-first; Telegram Mini App is the primary target.
- Support narrow phones, large phones, tablet and desktop web.
- Keep essential actions reachable with one hand where practical.
- Avoid horizontal scrolling except for genuinely horizontal content.
- Respect safe areas and Telegram viewport changes.
- Desktop may use wider content and a side navigation, but must not become a separate product.

### 5.4 Typography and localization

- English learning content must render with appropriate Latin typography.
- Persian interface chrome must support RTL correctly.
- Direction is assigned per content region, not blindly to the entire page. Mixed Persian/English examples must remain readable.
- Use semantic language metadata and correct punctuation/direction handling.
- Never rely on an externally hosted font for core rendering.
- Text must reflow without clipping at 200% zoom where browser support applies.

### 5.5 Motion and gamification

Motion is functional: confirm an action, explain a state transition or provide orientation. Respect reduced-motion settings.

Gamification is secondary:
- optional goals and progress indicators may support consistency;
- rewards must never replace feedback or learning evidence;
- no punitive streak loss, manipulative countdowns, random reward loops or public ranking by default;
- points must not be represented as language proficiency.

## 6. Design states and error handling

Every data-backed screen defines:
- initial/loading;
- skeleton or progress state where useful;
- loaded/content;
- empty/no result;
- recoverable error with retry;
- offline or degraded state where applicable;
- unauthorized/session-expired state;
- forbidden state;
- stale data state where relevant.

Forms define idle, validating, submitting, success and failure states. Disable duplicate submission while a request is pending. Preserve user-entered work when safe. Error copy should explain what happened and what the user can do next without exposing stack traces or internal service details.

## 7. Frontend architecture

### 7.1 Architectural decision

Use a feature-based modular monolith:
- React 19 + TypeScript + Vite;
- application composition and route ownership in `app/`;
- feature-owned UI, model and API adapters in `features/`;
- cross-feature primitives and transport in `shared/`;
- platform capabilities in `services/`;
- centralized design tokens and global styles.

Do not use micro-frontends for this product at the current scale. Do not introduce a global event bus or global state library without a demonstrated use case.

### 7.2 Dependency rules

1. App composition may import public feature APIs.
2. A feature may depend on shared modules and its own internal modules.
3. A feature must not import another feature's private files.
4. Shared modules must never import feature modules.
5. Platform adapters must not contain learning-domain rules.
6. API transport must be separate from UI rendering.
7. Backend-owned facts must not be reimplemented as frontend authority.

### 7.3 Suggested source structure

```text
apps/frontend/src/
  app/
    bootstrap/
    navigation/
    providers/
    routes/
    App.tsx
  features/
    identity/
    learning-paths/
    lessons/
    practice/
    review/
    vocabulary/
    grammar/
    listening/
    speaking/
    reading/
    writing/
    progress/
    profile/
  shared/
    api/
    components/
    hooks/
    lib/
    types/
  services/
    platform/
    telegram/
    browser/
  styles/
    tokens.css
    global.css
  assets/
```

Create folders when a real use case is implemented. Avoid empty placeholder modules.

### 7.4 State ownership

- Component state: open panels, current input, temporary UI choices.
- URL/navigation state: route, selected lesson/unit and shareable navigation state.
- Server state: identity, catalog, lesson data, attempts and progress; backend is authoritative.
- Persistent client preferences: only non-sensitive settings with a clear need.
- Never mirror all server state into a global client store.
- Do not store long-lived bearer credentials in localStorage.
- Introduce a query/cache library only when multiple screens and invalidation needs justify it.

## 8. Telegram and browser platform boundary

Define a small platform interface for:
- raw Telegram initData;
- viewport and safe-area information;
- back button;
- theme parameters;
- haptic feedback (optional);
- close behavior (optional).

Feature code must not import Telegram SDK directly. A browser adapter provides safe no-op or browser-native behavior when Telegram is absent.

Security:
- send raw initData to the backend for signature and freshness validation;
- never trust initDataUnsafe as authentication;
- never embed bot tokens or backend secrets in the client;
- backend owns session issuance, authorization and expiry;
- do not log initData, credentials or personal learning content;
- use the backend-defined secure session mechanism; do not invent a token storage scheme in the UI.

## 9. API and domain integration

- Use the versioned API contract under `/api/v1`.
- Keep typed request/response models near the owning feature.
- Central HTTP client handles base URL, credentials policy, JSON parsing, request cancellation and normalized errors.
- Feature adapters translate API DTOs into view models when needed.
- Frontend may validate form shape for usability, but backend validates all security- and domain-relevant input.
- Server response is the source of truth for answer correctness, score, attempt status and progress.
- Do not ship answer keys or private course authoring metadata to the client.
- Contract changes require coordinated backend/frontend review.

## 10. Accessibility and internationalization acceptance

Minimum requirements:
- semantic landmarks, headings and form labels;
- full keyboard operation and visible focus;
- accessible names for icon-only controls;
- status and feedback announced to assistive technology;
- sufficient text and non-text contrast;
- no color-only meaning;
- reduced motion support;
- usable touch targets;
- captions/transcripts or equivalent text alternatives for audio/video learning media where appropriate;
- RTL/LTR mixed-content testing;
- no clipped content at common mobile sizes and zoom.

## 11. Performance and reliability

- Keep initial JavaScript and CSS payload proportionate to the first learning task.
- Lazy-load genuinely secondary modules and heavy media tools.
- Optimize images/audio and avoid autoplay with sound.
- Avoid unnecessary re-renders and repeated API calls.
- Cancel stale requests when navigation changes.
- Provide resilient loading and retry behavior.
- Test on constrained mobile networks and lower-end devices.
- Avoid third-party network dependencies for critical app startup.

Performance targets must be measured on representative devices before being treated as achieved. Do not claim Core Web Vitals compliance without field or lab evidence.

## 12. Privacy, analytics and learner trust

Collect only events needed to improve product quality and learning outcomes, such as screen/feature use, lesson starts/completions, exercise outcome categories and review scheduling events. Apply data minimization, retention limits and access controls.

Do not collect:
- passwords, bot tokens or session credentials in analytics;
- raw private message content;
- keystroke or mouse surveillance;
- exact permanent location;
- inferred psychological profiles;
- voice recordings beyond the explicitly disclosed processing purpose and retention policy.

Explain what is measured and why. Analytics are not a substitute for validated learning assessment.

## 13. Testing strategy

### Unit tests
- design token and utility behavior where meaningful;
- API error normalization;
- exercise view-model mapping;
- state transitions and review scheduling presentation.

### Component tests
- loading/empty/error/retry states;
- keyboard and screen-reader behavior;
- feedback and answer submission states;
- RTL and mixed-language rendering.

### Integration tests
- catalog retrieval;
- lesson start/resume;
- answer submission and server result;
- session expiry and recovery;
- progress refresh after a completed activity.

### End-to-end critical journey
1. Open Mini App or browser client.
2. Establish a valid session using the platform adapter.
3. View home and learning path.
4. Open a lesson.
5. Complete a supported exercise.
6. Submit and receive backend-confirmed feedback.
7. Resume or review the recorded progress.

Tests must use local/test fixtures and must not mutate production data.

## 14. Delivery phases

### Phase 0 — Specification and design foundation
- approve this product specification;
- document screen inventory and interaction states;
- establish design tokens and component conventions;
- map learning outcomes and API dependencies.

### Phase 1 — Core learning shell
- application shell and navigation;
- home dashboard;
- learning path and lesson catalog;
- accessible responsive layout;
- loading/empty/error states.

### Phase 2 — Lesson vertical slice
- lesson player;
- supported exercise renderer;
- submission and backend feedback;
- pause/resume and recovery;
- integration tests.

### Phase 3 — Review and progress
- review queue UI;
- review outcome capture;
- skill-level progress;
- metric definitions and explanatory UI.

### Phase 4 — Platform hardening
- Telegram adapter and browser fallback;
- session expiry handling;
- Mini App viewport/back button behavior;
- accessibility and performance audit.

### Phase 5 — Extended skills
- reading and listening experiences;
- writing tasks and feedback;
- speaking only after media permissions, privacy, latency and evaluation limits are designed;
- AI tutoring as a bounded learning tool, not an unrestricted chat replacement.

Phases may be reordered when backend dependencies or evidence require it. No dates are committed by this document.

## 15. Explicit non-goals for the initial release

- micro-frontends;
- native iOS/Android applications;
- public social feed or learner leaderboard;
- complex avatar/coin economy;
- unrestricted AI chat;
- automated official CEFR certification;
- speech scoring presented as authoritative without validation;
- offline-first synchronization before conflict behavior is designed;
- paid third-party services without explicit approval;
- production deployment or production database mutation as part of this specification.

## 16. Definition of Done

A screen or feature is complete only when:
- its learning/product purpose is documented;
- requirements and backend contract are explicit;
- responsive behavior is implemented;
- loading, empty, error and recovery states exist where relevant;
- accessibility and RTL/LTR checks pass;
- no secret or backend-owned authority leaks to the client;
- unit/component/integration tests appropriate to the feature pass;
- TypeScript typecheck and production build pass;
- CI evidence is available;
- documentation and Notion traceability are updated.

A PR remains Draft until dependencies are resolved and all acceptance evidence is reviewed. A passing build alone does not authorize merge or deployment.

## 17. Current implementation status and constraints

The existing branch contains the modular app composition, shared API client, first lesson-catalog feature, responsive RTL dashboard and a CI workflow correction. These are implementation artifacts, not proof that all product requirements are complete.

As of this specification:
- typecheck/build/test results are not verified in this environment;
- Telegram session integration and lesson player are not complete;
- the frontend branch is stacked on backend foundation work;
- PR #4 remains Draft;
- no merge, deployment, production migration or paid-resource activation is authorized.

## 18. Open decisions to resolve with evidence

- exact session transport and cookie policy for Telegram and browser clients;
- API response contracts and error envelope consistency;
- lesson content schema and supported exercise types for MVP;
- curriculum ownership, authoring workflow and CEFR mapping review;
- analytics event schema, retention and consent notice;
- validated rubric for open-ended writing/speaking feedback;
- final brand typography and color tokens after visual review.

Until resolved, use conservative defaults and do not invent backend contracts or assessment validity.
