// Builds every example (examples/*.px.js -> examples/out, with --godot) and regenerates the README
// gallery from them. Fails if any example has an error. Run: npm run examples (part of npm run check).
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "../src/node/cli.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "examples");
const log = console.log;
let failed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".px.js")).sort()) {
  const lines: string[] = [];
  console.log = (s: string) => lines.push(s);
  const code = await main(["build", join(dir, f), "--godot"]).finally(() => { console.log = log; });
  if (code !== 0) failed++;
  console.log(`${code === 0 ? "ok  " : "FAIL"} ${f} (${lines.length - 1} outputs)`);
}
if (failed) { console.error(`${failed} example(s) failed`); process.exit(1); }
await import("./gallery.ts");
