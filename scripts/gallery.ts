// Renders the README gallery (docs/gallery/) from the examples: clean nearest-neighbour upscales,
// GIFs for animated assets. Run: node scripts/gallery.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeGif } from "../src/node/gif.ts";
import { loadProject } from "../src/node/load.ts";
import { encodePng } from "../src/node/png.ts";
import { packSheet } from "../src/core/render.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs", "gallery");
mkdirSync(out, { recursive: true });

// [example file, asset, target width in px]
const shots: [string, string, number][] = [
  ["no_magic.px.js", "no_magic_night", 768],
  ["shop.px.js", "comet_repair", 576],
  ["tackle.px.js", "gull_and_gill", 576],
  ["moon_bakery_3d.px.js", "moon_buns_3d", 576],
  ["neon_noodle_3d.px.js", "neon_noodle_3d", 576],
  ["cave.px.js", "cave", 576],
  ["no_magic.px.js", "cat", 192],
  ["no_magic.px.js", "frog", 192],
  ["no_magic.px.js", "clock", 192],
  // README "Examples" section
  ["basics.px.js", "chars", 400],
  ["torch.px.js", "torch", 120],
];

for (const [file, name, width] of shots) {
  const p = loadProject(join(root, "examples", file));
  const sheet = p.sheets.find((x) => x.name === name);
  if (sheet) {
    // a sheet: its still entries packed as `pxl build` packs them
    const { sheet: img } = packSheet(p.sheetNames(sheet).map((n) => ({ name: n, img: p.image(n) })), sheet.opts.cols, sheet.opts.pad);
    const s = Math.max(1, Math.floor(width / img.w));
    writeFileSync(join(out, name + ".png"), encodePng(img.scale(s)));
    console.log(`${name} ${img.w}x${img.h} @${s}x`);
    continue;
  }
  const b = p.build(name);
  const s = Math.max(1, Math.floor(width / b.img.w));
  if (b.anim) {
    const frames = p.frames(name).map((f) => ({ img: f.img.scale(s), ms: f.ms }));
    writeFileSync(join(out, name + ".gif"), encodeGif(frames));
  } else writeFileSync(join(out, name + ".png"), encodePng(b.img.scale(s)));
  console.log(`${name} ${b.img.w}x${b.img.h} @${s}x`);
}
