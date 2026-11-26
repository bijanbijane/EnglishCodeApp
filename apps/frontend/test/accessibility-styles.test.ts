import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("keyboard focus styling covers native form controls and buttons", () => {
  assert.match(styles, /:where\(button, a, input, select, textarea, \[role="button"\]\):focus-visible/);
  assert.match(styles, /outline: var\(--ec-focus-width\) solid var\(--ec-color-focus\)/);
});

test("primary interactive controls consume the shared touch-target token", () => {
  assert.match(styles, /:where\(\.button, \.back-link, \.answer-option, \.mobile-nav__item,[^\{]+\)\s*\{\s*min-block-size: var\(--ec-touch-target-min\)/);
  assert.match(styles, /\.catalog-search input \{ block-size: var\(--ec-touch-target-min\); \}/);
  assert.match(styles, /\.learning-library__level-filter \{ block-size: var\(--ec-touch-target-min\); \}/);
});

test("the avatar button has a minimum inline and block target size", () => {
  assert.match(styles, /\.avatar--button \{ min-inline-size: var\(--ec-touch-target-min\); \}/);
  assert.match(styles, /min-block-size: var\(--ec-touch-target-min\)/);
});
