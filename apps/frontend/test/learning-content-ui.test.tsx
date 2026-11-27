/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import LearningContentModule from "../src/features/learning-content/LearningContentModule";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

it("renders the vocabulary tool and filters sense-level entries", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<LearningContentModule onBack={() => undefined} />));
  expect(container.textContent).toContain("Learning library");
  expect(container.textContent).toContain("bank");
  const search = container.querySelector<HTMLInputElement>("[aria-label='Search vocabulary']");
  await act(async () => {
    if (search) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "feeling joy");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  expect(container.textContent).toContain("happy");
});

it("reveals the correction, explanation, and production prompt in the error clinic", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<LearningContentModule onBack={() => undefined} />));
  const clinicTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Error clinic"));
  await act(async () => clinicTab?.click());
  const reveal = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Reveal correction"));
  await act(async () => reveal?.click());
  expect(container.textContent).toContain("IMPROVED VERSION");
  expect(container.textContent).toContain("THE PATTERN");
  expect(container.textContent).toContain("MAKE IT YOURS");
});

it("previews the original eight-stage A2 communicative lesson", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<LearningContentModule onBack={() => undefined} />));
  const lessonTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("A2 lesson"));
  await act(async () => lessonTab?.click());
  expect(container.textContent).toContain("Talk about a personal goal and a simple plan");
  expect(container.textContent).toContain("THE 8-STAGE LEARNING SEQUENCE");
  expect(container.textContent).toContain("delayed recall required");
  expect(container.querySelectorAll(".lesson-stage")).toHaveLength(8);
});


it("runs the new grammar exercise pack and reveals a checked answer", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<LearningContentModule onBack={() => undefined} />));
  const exercisesTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Grammar practice"));
  await act(async () => exercisesTab?.click());
  expect(container.textContent).toContain("Grammar Foundations: Present Simple and Sentence Order");
  expect(container.textContent).toContain("Choose the correct sentence.");
  const correctOption = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("She goes to work by bus."));
  await act(async () => correctOption?.click());
  const reveal = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check answer"));
  await act(async () => reveal?.click());
  expect(container.textContent).toContain("ANSWER / FEEDBACK");
  expect(container.textContent).toContain("Use -s with he, she, and it in the present simple.");
});
