/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  api,
  type Attempt,
  type Course,
  type Lesson,
  type Profile,
  type ProgressEntry,
} from "../src/api";

const profile: Profile = {
  id: "user-integration-1",
  display_name: "Local Learner",
  created_at: "2026-11-27T00:00:00.000Z",
};

const course: Course = {
  id: "course-english-foundations",
  slug: "english-foundations",
  title: "English Foundations",
  description: "A starter course.",
  source_language: "fa",
  target_language: "en",
};

const lesson: Lesson = {
  id: "lesson-greetings-001",
  course_id: course.id,
  slug: "greetings",
  title: "Greetings and Introductions",
  description: "Practice common greetings.",
  level: "A1",
  position: 1,
  version: 1,
};

const savedProgress: ProgressEntry = {
  lesson_id: lesson.id,
  course_id: course.id,
  best_score: 100,
  completed_count: 1,
  lesson_title: lesson.title,
  last_completed_at: "2026-11-27T00:05:00.000Z",
};

function makeAttempt(answers: Record<string, string> = {}): Attempt {
  return {
    id: "attempt-integration-1",
    lesson_id: lesson.id,
    status: "in_progress",
    score: null,
    questions: [
      {
        id: "question-greetings-001",
        type: "multiple_choice",
        prompt: "Choose the correct greeting for the morning.",
        options: [
          { id: "a", text: "Good morning" },
          { id: "b", text: "Good night" },
        ],
        position: 1,
        submittedAnswer: answers["question-greetings-001"] ?? null,
        isCorrect: null,
      },
      {
        id: "question-greetings-002",
        type: "multiple_choice",
        prompt: "What is a suitable response to “How are you?”",
        options: [
          { id: "a", text: "I am fine, thank you." },
          { id: "b", text: "See you yesterday." },
        ],
        position: 2,
        submittedAnswer: answers["question-greetings-002"] ?? null,
        isCorrect: null,
      },
    ],
  };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button"))
    .find((item) => item.textContent?.includes(label) || item.getAttribute("aria-label")?.includes(label));
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "Telegram");
});

it("runs the Telegram sign-in, lesson, answer, completion, progress, and logout journey", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const secureValues = new Map<string, string>();
  const secureStorage = {
    getItem: (key: string, callback: (error: string | null, value: string | null) => void) =>
      callback(null, secureValues.get(key) ?? null),
    setItem: (key: string, value: string, callback: (error: string | null, stored?: boolean) => void) => {
      secureValues.set(key, value);
      callback(null, true);
    },
    removeItem: (key: string, callback: (error: string | null, removed?: boolean) => void) => {
      secureValues.delete(key);
      callback(null, true);
    },
  };

  const telegramReady = vi.fn();
  const telegramExpand = vi.fn();
  Object.defineProperty(window, "Telegram", {
    configurable: true,
    value: {
      WebApp: {
        initData: "signed-local-telegram-init-data",
        ready: telegramReady,
        expand: telegramExpand,
        isVersionAtLeast: () => true,
        SecureStorage: secureStorage,
      },
    },
  });

  let attemptReads = 0;
  let progressReads = 0;

  vi.spyOn(api, "courses").mockResolvedValue([course]);
  vi.spyOn(api, "lessons").mockResolvedValue([lesson]);
  let resolveLogin: ((value: Awaited<ReturnType<typeof api.login>>) => void) | null = null;
  vi.spyOn(api, "login").mockImplementation(() => new Promise((resolve) => {
    resolveLogin = resolve;
  }));
  vi.spyOn(api, "profile").mockResolvedValue(profile);
  vi.spyOn(api, "progress").mockImplementation(async () => {
    progressReads += 1;
    return progressReads === 1 ? [] : [savedProgress];
  });
  vi.spyOn(api, "startAttempt").mockResolvedValue({
    attemptId: "attempt-integration-1",
    status: "in_progress",
  });
  vi.spyOn(api, "attempt").mockImplementation(async () => {
    attemptReads += 1;
    if (attemptReads === 1) return makeAttempt();
    if (attemptReads === 2) return makeAttempt({ "question-greetings-001": "a" });
    return makeAttempt({
      "question-greetings-001": "a",
      "question-greetings-002": "a",
    });
  });
  vi.spyOn(api, "answer").mockResolvedValue({
    accepted: true,
    isCorrect: true,
    duplicate: false,
  });
  vi.spyOn(api, "complete").mockResolvedValue({
    status: "completed",
    score: 100,
    completedAt: "2026-11-27T00:05:00.000Z",
  });
  vi.spyOn(api, "logout").mockResolvedValue({ loggedOut: true });

  const { default: App } = await import("../src/App");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(<App />);
      // Allow the secure-storage read to resolve and start automatic login.
      await Promise.resolve();
    });

    expect(telegramReady).toHaveBeenCalledOnce();
    expect(telegramExpand).toHaveBeenCalledOnce();
    expect(api.login).toHaveBeenCalledOnce();
    const signInButton = container.querySelector<HTMLButtonElement>(".account-action");
    expect(signInButton?.disabled).toBe(true);
    signInButton?.click();

    await act(async () => {
      resolveLogin?.({
        accessToken: "local-integration-session",
        expiresAt: "2026-12-04T00:00:00.000Z",
        user: { id: profile.id, displayName: profile.display_name },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.login).toHaveBeenCalledOnce();
    expect(secureValues.get("englishcode_session")).toBe("local-integration-session");
    expect(container.textContent).toContain("English Foundations");

    await act(async () => {
      findButton(container, "English Foundations").click();
    });
    expect(container.textContent).toContain("Greetings and Introductions");

    await act(async () => {
      findButton(container, "Start Greetings and Introductions").click();
    });
    expect(container.textContent).toContain("Choose the correct greeting for the morning.");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".answer-option")?.click();
    });
    await act(async () => {
      findButton(container, "Check answer").click();
    });
    expect(container.textContent).toContain("Correct answer.");

    await act(async () => {
      findButton(container, "Continue").click();
    });
    expect(container.textContent).toContain("What is a suitable response to");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".answer-option")?.click();
    });
    await act(async () => {
      findButton(container, "Check answer").click();
    });

    await act(async () => {
      findButton(container, "Complete lesson").click();
    });
    expect(container.querySelector(".result-score")?.textContent).toContain("100");
    expect(container.textContent).toContain("Your result has been saved");

    await act(async () => {
      findButton(container, "Back to courses").click();
    });
    expect(container.textContent).toContain("1 lessons completed");
    expect(container.textContent).toContain("Greetings and Introductions");

    await act(async () => {
      findButton(container, "Sign out").click();
    });
    expect(api.logout).toHaveBeenCalledOnce();
    expect(secureValues.has("englishcode_session")).toBe(false);
    expect(container.textContent).toContain("Reopen app to sign in");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
