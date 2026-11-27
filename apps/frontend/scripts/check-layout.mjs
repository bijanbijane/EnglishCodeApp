import { readFile } from "node:fs/promises";

const stylesheet = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const requiredPatterns = [
  ["device safe-area fallback (top)", /env\\(safe-area-inset-top,0px\\)/],
  ["device safe-area fallback (right)", /env\\(safe-area-inset-right,0px\\)/],
  ["device safe-area fallback (bottom)", /env\\(safe-area-inset-bottom,0px\\)/],
  ["device safe-area fallback (left)", /env\\(safe-area-inset-left,0px\\)/],
  ["Telegram content safe areas", /--tg-content-safe-area-inset-(top|right|bottom|left)/],
  ["app shell top padding", /\\.app-shell\\{[^}]*padding-top:var\\(--app-safe-top\\)/],
  ["app shell bottom padding", /\\.app-shell\\{[^}]*padding-bottom:var\\(--app-safe-bottom\\)/],
  ["dismiss target width", /\\.alert button,\\.notice button\\{[^}]*min-width:44px/],
  ["dismiss target height", /\\.alert button,\\.notice button\\{[^}]*min-height:44px/],
  ["flexible desktop header", /\\.topbar\\{min-height:82px;height:auto\\}/],
  ["flexible mobile header", /@media\\(max-width:700px\\)\\{\\.topbar\\{min-height:68px;height:auto\\}\\}/],
];

const failures = requiredPatterns
  .filter(([, pattern]) => !pattern.test(stylesheet))
  .map(([name]) => name);

if (failures.length) {
  throw new Error(`Frontend layout contract failed: ${failures.join(", ")}`);
}

process.stdout.write(`Frontend layout contract passed (${requiredPatterns.length} checks).\\n`);
