// Stop hook: refuse to finish while source files are newer than MEMORY.md, so context is never lost.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { /* no stdin */ }
if (input.stop_hook_active) process.exit(0); // never loop

if (!existsSync("MEMORY.md")) { console.error("MEMORY.md is missing. Create it using the memory-keeper skill."); process.exit(2); }
const mem = statSync("MEMORY.md").mtimeMs;
const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => {
  const p = join(dir, e.name);
  return Math.max(m, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
}, 0);
const code = Math.max(0, ...["src", "scripts", "tests", "data/samples"].filter(existsSync).map(newest));
if (code > mem + 1000) {
  console.error("MEMORY.md is older than your latest code changes. Append a dated log entry (what changed, why, what is unverified, next step) using the memory-keeper skill, then finish.");
  process.exit(2);
}
