/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api, type Course, type Lesson } from "../src/api";
import { useCourseCatalog } from "../src/hooks/useCourseCatalog";

const firstCourse: Course = {
  id: "course-1", slug: "course-1", title: "First course", description: null,
  source_language: "fa", target_language: "en",
};
const secondCourse: Course = {
  ...firstCourse, id: "course-2", slug: "course-2", title: "Second course",
};
const firstLesson: Lesson = {
  id: "lesson-1", course_id: firstCourse.id, slug: "lesson-1", title: "First lesson",
  description: null, level: "A1", position: 1, version: 1,
};
const secondLesson: Lesson = {
  ...firstLesson, id: "lesson-2", course_id: secondCourse.id, title: "Second lesson",
};

afterEach(() => vi.restoreAllMocks());

it("keeps only the latest course lesson response", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolveFirst!: (lessons: Lesson[]) => void;
  let resolveSecond!: (lessons: Lesson[]) => void;
  vi.spyOn(api, "lessons").mockImplementation((courseId) => new Promise((resolve) => {
    if (courseId === firstCourse.id) resolveFirst = resolve;
    else resolveSecond = resolve;
  }));
  let latest: ReturnType<typeof useCourseCatalog> | undefined;
  function Harness() {
    latest = useCourseCatalog({ onError: vi.fn() });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    await act(async () => { firstRequest = latest!.openCourse(firstCourse); });
    await act(async () => { secondRequest = latest!.openCourse(secondCourse); });
    await act(async () => { resolveSecond([secondLesson]); await secondRequest; });
    await act(async () => { resolveFirst([firstLesson]); await firstRequest; });
    expect(latest?.lessons).toEqual([secondLesson]);
    expect(latest?.loading).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

it("invalidates an in-flight lesson request when returning to courses", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolveLessons!: (lessons: Lesson[]) => void;
  vi.spyOn(api, "lessons").mockImplementation(() => new Promise((resolve) => {
    resolveLessons = resolve;
  }));
  let latest: ReturnType<typeof useCourseCatalog> | undefined;
  function Harness() {
    latest = useCourseCatalog({ onError: vi.fn() });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => { root.render(<Harness />); });
    let request!: Promise<void>;
    await act(async () => { request = latest!.openCourse(firstCourse); });
    await act(async () => { latest!.showCourses(); });
    await act(async () => { resolveLessons([firstLesson]); await request; });
    expect(latest?.lessons).toEqual([]);
    expect(latest?.loading).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});
