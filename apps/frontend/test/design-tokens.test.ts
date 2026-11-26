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

test("screen styles consume the extended semantic palette instead of repeated literals", () => {
  for (const token of [
    "--ec-color-text-strong", "--ec-color-text-secondary", "--ec-color-text-tertiary",
    "--ec-color-border-subtle", "--ec-color-brand-accent", "--ec-color-brand-accent-strong",
    "--ec-color-brand-deep", "--ec-color-brand-mid", "--ec-color-brand-tint",
    "--ec-color-brand-soft", "--ec-color-brand-hover-border", "--ec-color-brand-action",
    "--ec-color-mint-accent", "--ec-color-success-accent", "--ec-color-surface-white",
  ]) {
    assert.ok(tokens.includes(token), `Missing ${token}`);
    assert.ok(styles.includes(`var(${token})`), `Styles do not consume ${token}`);
  }
  for (const legacyColor of ["#26324b", "#65718a", "#7d89a2", "#e5eaf2", "#4b6df0", "#2846b5", "#172a61", "#3b55ad", "#e9eeff", "#edf1ff", "#d6def8", "#4564d5", "#a8e9d0", "#3eb78b", "#3659d9", "#8ba4ff"]) {
    assert.ok(!styles.toLowerCase().includes(legacyColor), `Legacy color remains in screen stylesheet: ${legacyColor}`);
  }
});
