// Runs every sample set through the rules engine: seeded-error recall and false positives.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { run } from "../src/lib/rules";

const dir = join(process.cwd(), "data", "samples");
let caught = 0, total = 0, fp = 0;
console.log("set".padEnd(18), "expected caught false+");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const s = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const got = new Set(run(s.docs).map((x) => x.id)), exp = new Set<string>(s.expected);
  const c = [...exp].filter((x) => got.has(x)).length, extra = [...got].filter((x) => !exp.has(x)).length;
  caught += c; total += exp.size; fp += extra;
  console.log(f.replace(".json", "").padEnd(18), String(exp.size).padStart(8), String(c).padStart(6), String(extra).padStart(6), c === exp.size && !extra ? "" : " <-- check");
}
console.log(`\nCaught ${caught}/${total} seeded errors, ${fp} false positives`);
process.exit(caught === total && fp === 0 ? 0 : 1);
