import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("Telegram mobile layout contracts", () => {
  it("accounts for both device and Telegram content safe areas", () => {
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(stylesheet).toContain(`env(safe-area-inset-${side},0px)`);
      expect(stylesheet).toContain(`var(--tg-safe-area-inset-${side},0px)`);
      expect(stylesheet).toContain(`var(--tg-content-safe-area-inset-${side},0px)`);
      expect(stylesheet).toContain(`--app-safe-${side}:`);
    }
  });

  it("applies safe-area padding to the app shell instead of clipping page content", () => {
    expect(stylesheet).toMatch(/\.app-shell\{[^}]*padding-top:var\(--app-safe-top\)/);
    expect(stylesheet).toMatch(/\.app-shell\{[^}]*padding-bottom:var\(--app-safe-bottom\)/);
  });

  it("keeps dismiss controls at least 44 by 44 CSS pixels", () => {
    expect(stylesheet).toMatch(/\.alert button,\.notice button\{[^}]*min-width:44px/);
    expect(stylesheet).toMatch(/\.alert button,\.notice button\{[^}]*min-height:44px/);
  });

  it("allows the Telegram header to grow when account text wraps on narrow screens", () => {
    expect(stylesheet).toContain(".topbar{min-height:82px;height:auto}");
    expect(stylesheet).toContain("@media(max-width:700px){.topbar{min-height:68px;height:auto}}");
  });
});
