/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api, type Lesson, type Profile } from "../src/api";
import { useAttemptLifecycle } from "../src/hooks/useAttemptLifecycle";

const profile: Profile = { id: "user-1", display_name: "Learner", created_at: "2026-11-28T00:00:00Z" };
const lesson: Lesson = {
  id: "lesson-1", course_id: "course-1", slug: "lesson-1", title: "Greetings",
  description: null, level: null, position: 1, version: 1,
};

afterEach(() => vi.restoreAllMocks());

it("starts and loads an attempt from the server", async () => {
  vi.spyOn(api, "startAttempt").mockResolvedValue({ attemptId: "attempt-1", status: "in_progress" });
  const loaded = { id: "attempt-1", lesson_id: lesson.id, status: "in_progress" as const, score: null, questions: [] };
  vi.spyOn(api, "attempt").mockResolvedValue(loaded);
  let latest: ReturnType<typeof useAttemptLifecycle> | undefined;
  function Harness() {
    latest = useAttemptLifecycle({
      profile, refreshProgress: vi.fn(), onError: vi.fn(), onNotice: vi.fn(), onCompleted: vi.fn(),
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  try {
    await act(async () => { root.render(<Harness />); });
    await act(async () => { await latest?.startAttempt(lesson); });
    expect(latest?.attempt).toEqual(loaded);
    expect(latest?.busy).toBe(false);
  } finally { await act(async () => root.unmount()); }
});

it("ignores an attempt response after the authenticated profile changes", async () => {
  let resolveLoad: ((value: Awaited<ReturnType<typeof api.attempt>>) => void) | undefined;
  vi.spyOn(api, "startAttempt").mockResolvedValue({ attemptId: "attempt-1", status: "in_progress" });
  vi.spyOn(api, "attempt").mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));
  let currentProfile: Profile | null = profile;
  let latest: ReturnType<typeof useAttemptLifecycle> | undefined;
  const callbacks = { refreshProgress: vi.fn(), onError: vi.fn(), onNotice: vi.fn(), onCompleted: vi.fn() };
  function Harness() {
    latest = useAttemptLifecycle({ profile: currentProfile, ...callbacks });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  try {
    await act(async () => { root.render(<Harness />); });
    let starting: Promise<boolean> | undefined;
    await act(async () => { starting = latest?.startAttempt(lesson); });
    await act(async () => { currentProfile = null; root.render(<Harness />); });
    await act(async () => { resolveLoad?.({ id: "attempt-1", lesson_id: lesson.id, status: "in_progress", score: null, questions: [] }); });
    await act(async () => { await starting; });
    expect(latest?.attempt).toBeNull();
    expect(latest?.busy).toBe(false);
  } finally { await act(async () => root.unmount()); }
});
