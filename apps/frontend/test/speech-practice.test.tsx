/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/api";
import SpeechPractice from "../src/SpeechPractice";

const audioBlob = new Blob(
  [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
  { type: "audio/webm;codecs=opus" },
);

class MockMediaRecorder {
  static nextBlob = audioBlob;
  static isTypeSupported(type: string) {
    return type === "audio/webm;codecs=opus";
  }

  state: RecordingState = "inactive";
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "audio/webm;codecs=opus";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: MockMediaRecorder.nextBlob } as BlobEvent);
    this.onstop?.(new Event("stop"));
  }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.includes(label),
  );
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalMediaDevices: PropertyDescriptor | undefined;
let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;

function mount(isAuthenticated = true) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<SpeechPractice isAuthenticated={isAuthenticated} />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else Reflect.deleteProperty(navigator, "mediaDevices");
  if (originalCreateObjectURL) Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

it("records audio, enforces the client payload cap, and submits a transcription request", async () => {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:recorded-audio") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

  const transcribe = vi.spyOn(api, "transcribeAudio").mockResolvedValue({
    transcription: "Good morning. My name is Alex.",
    wordCount: 6,
    language: "en",
    durationSeconds: 1,
    model: "@cf/openai/whisper-large-v3-turbo",
  });
  const view = mount();

  await act(async () => {
    button(view, "Start recording").click();
    await Promise.resolve();
  });
  expect(view.textContent).toContain("Recording");

  await act(async () => {
    button(view, "Stop recording").click();
  });
  expect(view.querySelector("audio")).not.toBeNull();
  expect(view.textContent).toContain("Transcribe audio");

  await act(async () => {
    button(view, "Transcribe audio").click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(transcribe).toHaveBeenCalledWith({
    audioBase64: "GkXfow==",
    mimeType: "audio/webm;codecs=opus",
    durationSeconds: 1,
  });
  expect(view.textContent).toContain("Good morning. My name is Alex.");
  expect(view.textContent).toContain("6 words");
  expect(stopTrack).toHaveBeenCalledOnce();
});

it("rejects a recording larger than the upload cap before calling the API", async () => {
  const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:too-large") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  MockMediaRecorder.nextBlob = new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "audio/webm;codecs=opus" });
  const transcribe = vi.spyOn(api, "transcribeAudio");
  const view = mount();

  await act(async () => {
    button(view, "Start recording").click();
    await Promise.resolve();
  });
  await act(async () => {
    button(view, "Stop recording").click();
  });

  expect(view.textContent).toContain("exceeded the 1 MiB upload limit");
  expect(transcribe).not.toHaveBeenCalled();
  MockMediaRecorder.nextBlob = audioBlob;
});

it("requires an authenticated learner before recording", () => {
  const view = mount(false);
  expect(view.textContent).toContain("Sign in to your Telegram account");
  expect(view.querySelector("button")).toBeNull();
});
