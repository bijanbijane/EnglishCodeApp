/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api, type ApiEnvelope, type LearningHistoryEntry, type Profile } from "../src/api";
import { useLearningHistory } from "../src/hooks/useLearningHistory";

const profile: Profile = {
  id: "history-user",
  display_name: "Learner",
  created_at: "2026-11-28T00:00:00.000Z",
};
const entry = (attemptId: string): LearningHistoryEntry => ({
  attemptId,
  lessonId: "lesson-1",
  lessonVersion: 1,
  lessonTitle: "Greetings",
  courseId: "course-1",
  courseTitle: "English Foundations",
  status: "completed",
  score: 90,
  startedAt: "2026-11-28T10:00:00.000Z",
  completedAt: "2026-11-28T10:05:00.000Z",
  questionCount: 5,
  correctAnswerCount: 4,
});

afterEach(() => vi.restoreAllMocks());
const onError = vi.fn();

it("loads the first history page and appends subsequent cursor pages", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const history = vi.spyOn(api, "history")
    .mockResolvedValueOnce({ data: [entry("attempt-1")], meta: { nextCursor: "cursor-1" } })
    .mockResolvedValueOnce({ data: [entry("attempt-2")], meta: { nextCursor: null } });
  let latest: ReturnType<typeof useLearningHistory> | undefined;
  function Harness() {
    latest = useLearningHistory({ profile, onError });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    expect(latest?.history.map((item) => item.attemptId)).toEqual(["attempt-1"]);
    expect(latest?.hasMoreHistory).toBe(true);
    await act(async () => { await latest?.loadMoreHistory(); });
    expect(history).toHaveBeenNthCalledWith(2, 5, "cursor-1");
    expect(latest?.history.map((item) => item.attemptId)).toEqual(["attempt-1", "attempt-2"]);
    expect(latest?.hasMoreHistory).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

it("clears history and ignores stale page results after the profile is removed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolveHistory: ((value: ApiEnvelope<LearningHistoryEntry[]>) => void) | undefined;
  vi.spyOn(api, "history").mockImplementation(() => new Promise((resolve) => {
    resolveHistory = resolve;
  }));
  let currentProfile: Profile | null = profile;
  let latest: ReturnType<typeof useLearningHistory> | undefined;
  function Harness() {
    latest = useLearningHistory({ profile: currentProfile, onError });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    await act(async () => {
      currentProfile = null;
      root.render(<Harness />);
    });
    await act(async () => { resolveHistory?.({ data: [entry("stale-attempt")], meta: { nextCursor: null } }); });
    expect(latest?.history).toEqual([]);
    expect(latest?.historyLoading).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});


it("exposes a retry after the first history page fails", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(api, "history")
    .mockRejectedValueOnce(new Error("History service unavailable"))
    .mockResolvedValueOnce({ data: [entry("attempt-recovered")], meta: { nextCursor: null } });
  let latest: ReturnType<typeof useLearningHistory> | undefined;
  function Harness() {
    latest = useLearningHistory({ profile, onError });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    expect(latest?.historyLoadFailed).toBe(true);
    await act(async () => { await latest?.refreshHistory(); });
    expect(latest?.historyLoadFailed).toBe(false);
    expect(latest?.history.map((item) => item.attemptId)).toEqual(["attempt-recovered"]);
  } finally {
    await act(async () => root.unmount());
  }
});
