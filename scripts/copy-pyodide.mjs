// Copies the Pyodide runtime (Python compiled for the browser) into public/
// so it is served from our own site instead of a CDN. Serving it ourselves
// keeps the cross-origin isolation headers happy, which input() and
// time.sleep() depend on.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pyodide");
const dest = join(root, "public", "pyodide");

const files = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

if (!existsSync(src)) {
  console.warn("pyodide is not installed yet; skipping copy.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of files) cpSync(join(src, file), join(dest, file));
console.log(`Copied Pyodide to ${dest}`);
