import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const MODULE_ORDER = [
  "src/shared/config/constants.js",
  "src/shared/lib/dom/index.js",
  "src/shared/lib/math/index.js",
  "src/shared/lib/storage/index.js",
  "src/shared/lib/date/index.js",
  "src/shared/lib/canvas/index.js",
  "src/shared/ui/tooltip/tooltip.js",
  "src/entities/life-calendar/model/life-state.js",
  "src/entities/life-calendar/model/cascade-specs.js",
  "src/features/scale-switcher/ui/scale-switcher.js",
  "src/features/birth-date-input/model/birth-validation.js",
  "src/features/birth-date-input/ui/empty-state-transition.js",
  "src/features/birth-date-input/ui/birth-date-input.js",
  "src/features/birthday-highlight/ui/birthday-toggle.js",
  "src/features/gender-expectancy/model/expectancy-animation.js",
  "src/features/gender-expectancy/ui/gender-switch.js",
  "src/features/live-ticker/ui/live-ticker.js",
  "src/widgets/header/ui/header.js",
  "src/widgets/decade-board/model/board-renderer.js",
  "src/widgets/decade-board/ui/decade-board.js",
  "src/widgets/magnified-lens/model/lens-state.js",
  "src/widgets/magnified-lens/ui/magnified-lens.js",
  "src/widgets/footer-bar/ui/footer-bar.js",
  "src/pages/life-map/model/ticker-loop.js",
  "src/pages/life-map/ui/life-map-page.js",
  "src/app/index.js",
];

const parts = ['(() => {\n"use strict";\n'];
for (const relPath of MODULE_ORDER) {
  let code = fs.readFileSync(path.join(rootDir, relPath), "utf8");
  code = code.replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  code = code.replace(/^\s*export\s+(const|let|var|function)\s+/gm, "$1 ");
  parts.push(`// --- ${relPath} ---\n${code.trim()}\n`);
}
parts.push("})();\n");

const outDir = path.join(rootDir, "dist");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "bundle.js"), parts.join("\n"), "utf8");
console.log("Built dist/bundle.js successfully.");
