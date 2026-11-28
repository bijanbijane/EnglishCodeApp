/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { getTelegramWebApp } from "../src/platform/telegram";

afterEach(() => {
  Reflect.deleteProperty(window, "Telegram");
  vi.unstubAllGlobals();
});

describe("Telegram platform adapter", () => {
  it("returns undefined when the app runs outside Telegram", () => {
    expect(getTelegramWebApp()).toBeUndefined();
  });

  it("returns the WebApp bridge exposed by Telegram", () => {
    const bridge = {
      initData: "signed-init-data",
      ready: vi.fn(),
      expand: vi.fn(),
      isVersionAtLeast: vi.fn(() => true),
    };
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: { WebApp: bridge },
    });

    expect(getTelegramWebApp()).toBe(bridge);
  });
});
