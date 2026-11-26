import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("semantic color roles are centralized", () => {
  for (const role of ["canvas", "surface", "surface-elevated", "text", "text-muted", "border", "primary", "success", "warning", "danger", "focus"]) {
    assert.match(tokens, new RegExp(`--ec-color-${role}\\s*:`));
  }
});

test("typography, spacing, shape, elevation, responsive and motion tokens exist", () => {
  for (const token of [
    "--ec-font-family-ui", "--ec-font-size-md", "--ec-line-height-normal", "--ec-weight-semibold",
    "--ec-space-1", "--ec-space-12", "--ec-radius-md", "--ec-radius-pill",
    "--ec-elevation-1", "--ec-breakpoint-mobile", "--ec-content-wide",
    "--ec-motion-normal", "--ec-motion-easing-standard", "--ec-touch-target-min",
  ]) assert.ok(tokens.includes(token), `Missing ${token}`);
});

test("global stylesheet imports and consumes the token layer", () => {
  assert.ok(styles.startsWith('@import "./styles/tokens.css";'));
  assert.ok(styles.includes("font-family: var(--ec-font-family-ui)"));
  assert.ok(styles.includes("outline: var(--ec-focus-width) solid var(--ec-color-focus)"));
});
