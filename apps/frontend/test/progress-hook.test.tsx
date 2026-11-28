/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api, type Profile, type ProgressEntry } from "../src/api";
import { useLearningProgress } from "../src/hooks/useLearningProgress";

const profile: Profile = {
  id: "progress-user",
  display_name: "Learner",
  created_at: "2026-11-28T00:00:00.000Z",
};
const entry: ProgressEntry = {
  lesson_id: "lesson-1",
  course_id: "course-1",
  best_score: 90,
  completed_count: 2,
  lesson_title: "Greetings",
  last_completed_at: "2026-11-28T00:00:00.000Z",
};

afterEach(() => vi.restoreAllMocks());
const onError = vi.fn();

it("loads progress and exposes an explicit refresh operation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const progress = vi.spyOn(api, "progress").mockResolvedValue([entry]);
  let latest: ReturnType<typeof useLearningProgress> | undefined;
  function Harness() {
    latest = useLearningProgress(profile, onError);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    expect(latest?.progress).toEqual([entry]);
    expect(latest?.progressLoading).toBe(false);
    await act(async () => { await latest?.refreshProgress(); });
    expect(progress).toHaveBeenCalledTimes(2);
    expect(latest?.progress).toEqual([entry]);
  } finally {
    await act(async () => root.unmount());
  }
});

it("does not apply a stale response after the profile is cleared", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolveProgress: ((value: ProgressEntry[]) => void) | undefined;
  vi.spyOn(api, "progress").mockImplementation(() => new Promise((resolve) => {
    resolveProgress = resolve;
  }));
  let currentProfile: Profile | null = profile;
  let latest: ReturnType<typeof useLearningProgress> | undefined;
  function Harness() {
    latest = useLearningProgress(currentProfile, onError);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    await act(async () => {
      currentProfile = null;
      root.render(<Harness />);
    });
    await act(async () => { resolveProgress?.([entry]); });
    expect(latest?.progress).toEqual([]);
    expect(latest?.progressLoading).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});
