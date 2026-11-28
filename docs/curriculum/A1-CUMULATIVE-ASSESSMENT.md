# A1 Cumulative Achievement Assessment — Blueprint

**Status:** Proposed specification; not implemented  
**Target:** Learners completing A1 Foundations Units 1–9  
**Purpose:** Assess listening, reading, writing and speaking. Lesson-level multiple-choice recognition alone is not sufficient evidence of productive A1 ability.

## 1. Design principles

- Align tasks to observable CEFR A1 descriptors. CEFR describes communicative ability; it does not prescribe this product's grammar syllabus, test duration or pass mark.
- Sample all four skills and report each skill separately alongside an overall result.
- Use familiar contexts already introduced in Units 1–9: personal information, family, home, routines, food, town, work/study, weather, transport and simple services.
- Use original content. Publisher material is a methodological reference, not a source to copy.
- Keep instructions short, mobile-accessible and independent of colour or specialist knowledge.
- The backend owns assessment publication, answer keys, scoring, attempt state and final results.

## 2. Proposed blueprint

Timing and weights below are initial design targets requiring learner pilots and standard-setting; they are not CEFR rules.

| Skill | Task sampling | Evidence | Target time | Proposed weight |
|---|---|---|---:|---:|
| Listening | Short personal exchange, simple announcement, everyday dialogue | Names, numbers, times, places, purpose and simple instructions | 10–12 min | 25% |
| Reading | Short message/profile, notice or timetable, simple email | Gist, purpose and explicitly stated details | 12–15 min | 25% |
| Writing | Complete a practical form; write a short message (initial target 25–40 words) | Relevant information, simple sentences and comprehensibility | 15–20 min | 25% |
| Speaking | Personal questions; short description; predictable role-play | Interaction, description, asking/answering, intelligibility | 6–8 min | 25% |

Estimated total: 43–55 minutes excluding setup. Pilot task timing and accessibility before fixing it.

## 3. Task requirements

### Listening
- Use short, clearly articulated A1 recordings with natural but measured delivery and varied speakers.
- Assess gist and key details; avoid testing accent imitation or background knowledge.
- Define a consistent replay policy. Do not reveal transcripts before/during the task.
- Audio storage, delivery, rights, offline fallback and accessibility require a separate technical decision. No live external API is assumed.

### Reading
- Use original, short messages, signs, notices, schedules and descriptions.
- Include scanning for specific information and understanding overall purpose.
- Every answer must be supported by the text; distractors must not rely on ambiguity or trick wording.

### Writing
- Task A: complete a clearly labelled form using fictional task details.
- Task B: write a short message for a familiar purpose, such as inviting a friend or asking for simple information.
- Do not request real addresses, phone numbers or unnecessary personal data. Do not score typing speed or keyboard choice.

### Speaking
- Task A: answer familiar personal questions.
- Task B: describe a familiar person, place, picture or routine.
- Task C: role-play a predictable exchange, such as ordering a drink, buying a ticket or asking for directions.
- A self-recorded monologue is not equivalent to live interaction; the selected mode must be explicit. Speech recognition or AI grading is not a prerequisite.

## 4. Proposed productive-skill rubrics

Use four dimensions rated 0–4. These are local draft anchors, not official CEFR bands; reviewers must pilot and calibrate them.

### Writing
| Dimension | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Task completion | No relevant response | Minimal relevant detail | Some key points | Most required points | All required points |
| Comprehensibility | Meaning unrecoverable | Rarely recoverable | Partly recoverable | Generally clear | Clear throughout |
| Vocabulary | No usable words | Isolated words | Basic familiar words | Sufficient familiar range | Appropriate A1 range |
| Grammar/mechanics | No interpretable structures | Errors block meaning | Errors sometimes affect meaning | Basic structures mostly clear | Simple structures generally controlled |

### Speaking
| Dimension | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Task completion | No relevant response | Minimal response | Partly completes task | Mostly completes task | Completes task |
| Interaction | No interaction | Rarely responds | Responds to direct prompts | Maintains short exchange | Initiates/responds and uses simple repair |
| Intelligibility | Speech unrecoverable | Often difficult | Sometimes understandable | Generally understandable | Clear enough for task |
| Language resources | No usable language | Isolated words | Basic phrases | Familiar words/simple sentences | Appropriate familiar A1 range |

Raters need benchmark samples, evidence notes, moderation and a re-rating route. Normalize rubric totals only after the scoring policy is approved.

## 5. Scoring and result policy

- Listening and reading use objective answer keys and server-side scoring.
- Writing and speaking begin with human rubric ratings in a controlled pilot; AI scoring is out of scope.
- The proposed equal weights are provisional. Establish pass thresholds only through documented standard-setting and pilot evidence; do not call a local threshold an official CEFR cut score.
- Report four skill scores, overall result, completion state and actionable practice guidance. Do not imply certification or CEFR placement solely from one percentage.
- Define accommodations, technical-failure handling, retakes, appeals and result validity before release.

## 6. Security and persistence requirements (future implementation)

- Version assessment forms, tasks, answer keys and scoring policies. Snapshot the exact versions and task order when an attempt begins.
- Published content and attempt snapshots are immutable. Never send answer keys, hidden transcripts or examiner guidance to learners before the relevant task is complete.
- Derive ownership from authenticated sessions; enforce rater/reviewer permissions server-side.
- Make answer submission and completion idempotent; test concurrent retries in real Local D1.
- Minimize personal data. Do not retain raw audio/video by default. Any recording feature requires explicit purpose, consent, access controls, retention and deletion/export policy.
- Keep cumulative assessment results separate from lesson progress until progression policy is defined.

## 7. Delivery phases and acceptance gates

1. **Content pilot:** author original task scripts, texts, prompts, answer keys and rater guidance; obtain independent expert review; pilot timing, ambiguity, item difficulty and rubric agreement.
2. **Receptive skills:** implement versioned listening/reading forms and deterministic server grading. Decide audio delivery without silently adding R2, paid services or external APIs.
3. **Productive skills:** implement writing submission, human rating, rater roles, moderation and audit. Decide live versus recorded speaking before implementation.
4. **Release readiness:** approve scoring, accommodations, retakes, appeals, privacy/retention and learner-facing result language; complete mobile, security, reliability and cost checks.

## 8. Current implementation boundary

The repository currently supports published lesson versions, deterministic MCQs, immutable lesson-attempt snapshots, server-side objective grading and learner progress/history. The A1 foundation has nine units, 45 lessons and 180 MCQs.

This document does **not** implement cumulative assessment entities or endpoints, listening media delivery, new reading formats, writing submissions, speaking interactions/recordings, human rater workflows, analytic rubrics, standard setting or cumulative result reporting. Do not describe these as shipped features.

## 9. References

- Council of Europe, CEFR Companion Volume (2020): https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions
- CEFR descriptors: https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- Project editorial/rights register: [REFERENCE-SOURCES.md](REFERENCE-SOURCES.md)
