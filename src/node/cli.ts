// pxl command line.
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PxError, wrap } from "../core/errors.ts";
import { ascii, preview } from "../core/render.ts";
import { lint } from "../core/lint.ts";
import { loadProject } from "./load.ts";
import { writeOutputs, writePng } from "./output.ts";
import { serve } from "./server.ts";
import { traceFile } from "./trace.ts";

const USAGE = `pxl — pixel-art DSL

  pxl build <art.px.js> [--out DIR] [--only a,b] [--scale N] [--no-preview] [--godot]
      Build PNGs (out/sprites, out/scenes, out/anims strips + JSON + GIF, sheets + JSON) and
      previews (out/_preview; animated assets also get a .gif). --godot also writes a Godot 4
      SpriteFrames .tres beside every sheet and anim strip (one animation per tag).
  pxl serve <art.px.js> [--port 4321] [--out DIR | --no-out] [--no-preview]
      Live viewer: rebuilds on save and replays each asset's painting steps.
  pxl ascii <art.px.js> <name>
      Print an asset as palette keys with x/y rulers (anims: every frame).
  pxl lint  <art.px.js> [name ...]
      Critique pixel art: orphan pixels, jaggies, pillow shading, near-duplicate and too many colors,
      with coordinates; writes out/_preview/<name>.lint.png marking the pixels (default: every asset).
  pxl list  <art.px.js>
      List assets, groups and sheets with their source locations.
  pxl trace <image.png> [--w N | --h N | --scale S] [--colors 16 | --palette pico8] [--dither 0..1]
            [--name traced] [--out FILE.px.js]
      Turn a PNG (photo, render, reference) into pxl source: an extracted or built-in palette plus a
      grid string, with the fidelity of the result. Default out: <image dir>/<image name>.px.js.

Art files may be .js or .ts. Default out dir: <art file dir>/out.`;

interface Args {
  cmd?: string;
  file?: string;
  rest: string[];
  out?: string | false;
  only?: string[];
  scale?: number;
  godot?: boolean;
  preview?: boolean;
  port?: number;
  w?: number;
  h?: number;
  colors?: number;
  palette?: string;
  dither?: number;
  name?: string;
}

function parse(argv: string[]): Args {
  const a: Args = { rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const val = () => {
      const x = argv[++i];
      if (x === undefined) throw new PxError(`${v} needs a value`);
      return x;
    };
    if (v === "--out") a.out = val();
    else if (v === "--no-out") a.out = false;
    else if (v === "--only") a.only = val().split(",").map((s) => s.trim()).filter(Boolean);
    else if (v === "--scale") a.scale = Number(val());
    else if (v === "--godot") a.godot = true;
    else if (v === "--port") a.port = Number(val());
    else if (v === "--w") a.w = Number(val());
    else if (v === "--h") a.h = Number(val());
    else if (v === "--colors") a.colors = Number(val());
    else if (v === "--palette") a.palette = val();
    else if (v === "--dither") a.dither = Number(val());
    else if (v === "--name") a.name = val();
    else if (v === "--no-preview") a.preview = false;
    else if (v === "-h" || v === "--help") a.cmd = "help";
    else if (v.startsWith("--")) throw new PxError(`unknown flag ${v}\n\n${USAGE}`);
    else if (!a.cmd) a.cmd = v;
    else if (!a.file) a.file = v;
    else a.rest.push(v);
  }
  return a;
}

export async function main(argv: string[]): Promise<number> {
  let a: Args;
  try { a = parse(argv); } catch (e) { console.error(wrap(e).message); return 2; }
  if (!a.cmd || a.cmd === "help" || !a.file) {
    console.log(USAGE);
    return a.cmd === "help" ? 0 : 2;
  }
  const file = resolve(a.file);
  const outDir = typeof a.out === "string" ? resolve(a.out) : join(dirname(file), "out");
  try {
    switch (a.cmd) {
      case "build": {
        const p = loadProject(file);
        const r = writeOutputs(p, outDir, { only: a.only, preview: a.preview, scale: a.scale, godot: a.godot });
        for (const l of r.lines) console.log(l);
        for (const e of r.errors) console.error("error: " + e.message);
        console.log(`-> ${outDir}${r.errors.length ? ` (${r.errors.length} error${r.errors.length > 1 ? "s" : ""})` : ""}`);
        return r.errors.length ? 1 : 0;
      }
      case "ascii": {
        const name = a.rest[0];
        if (!name) throw new PxError("ascii needs an asset name: pxl ascii <file> <name>");
        const p = loadProject(file);
        const pal = p.assets.get(name)?.pal ?? p.pal;
        if (p.assets.get(name)?.kind === "anim")
          p.frames(name).forEach((f, i) => console.log(`frame ${i} (${f.ms}ms)\n${ascii(f.img, pal)}\n`));
        else console.log(ascii(p.image(name), pal));
        return 0;
      }
      case "lint": {
        const p = loadProject(file);
        const names = a.rest.length ? a.rest : p.exported();
        let total = 0;
        for (const name of names) {
          const img = p.assets.get(name)?.kind === "anim" ? p.frames(name)[0]?.img ?? p.image(name) : p.image(name);
          const found = lint(img, p.assets.get(name)?.kind ?? "asset");
          total += found.length;
          if (!found.length) { console.log(`${name}: clean`); continue; }
          console.log(`${name}: ${found.length} finding${found.length > 1 ? "s" : ""}`);
          for (const f of found) console.log(`  ${f.rule.padEnd(14)} ${f.message}${f.at.length ? `\n${" ".repeat(17)}at ${f.at.slice(0, 12).map(([x, y]) => `${x},${y}`).join(" ")}${f.at.length > 12 ? " …" : ""}` : ""}`);
          if (a.preview !== false && found.some((f) => f.at.length)) {
            const s = Math.max(4, Math.min(16, Math.floor(512 / Math.max(img.w, img.h))));
            const pv = preview(img, s);
            const mark = { orphan: 0xff2bd6ff, jaggy: 0x00e5ffff } as Record<string, number>;
            for (const f of found) for (const [x, y] of f.at)
              for (let k = 0; k < s; k++) for (const [px, py] of [[x * s + k, y * s], [x * s + k, y * s + s - 1], [x * s, y * s + k], [x * s + s - 1, y * s + k]])
                pv.set(px, py, mark[f.rule] ?? 0xff0000ff);
            writePng(join(outDir, "_preview", `${name}.lint.png`), pv);
            writeFileSync(join(outDir, "_preview", ".gdignore"), "");
          }
        }
        console.log(`${total} finding${total === 1 ? "" : "s"} in ${names.length} asset${names.length === 1 ? "" : "s"}`);
        return 0;
      }
      case "trace": {
        const out = typeof a.out === "string" ? resolve(a.out) : file.replace(/\.[^./]+$/, "") + ".px.js";
        const t = traceFile(file, { w: a.w, h: a.h, scale: a.scale, colors: a.colors, palette: a.palette, dither: a.dither, name: a.name });
        writeFileSync(out, t.source);
        console.log(`trace ${t.w}x${t.h}: ${t.colors} colors -> ${out}`);
        console.log(`fidelity: mean error ${t.fit.meanError}/255, ${(t.fit.close * 100).toFixed(1)}% of pixels within 16 of the image`);
        return 0;
      }
      case "list": {
        const p = loadProject(file);
        for (const n of p.order) {
          const d = p.assets.get(n)!;
          console.log(`${d.kind.padEnd(6)} ${n.padEnd(24)} ${d.loc ?? ""}`);
        }
        for (const g of p.groups.values()) console.log(`${"group".padEnd(6)} ${g.name.padEnd(24)} ${g.loc ?? ""}  [${g.members.join(" ")}]`);
        for (const s of p.sheets) console.log(`${"sheet".padEnd(6)} ${s.name.padEnd(24)} ${s.loc ?? ""}`);
        return 0;
      }
      case "serve": {
        const s = await serve(file, { port: a.port, out: a.out === false ? false : outDir, preview: a.preview });
        console.log(`pxl live viewer: ${s.url}  (watching ${file}; Ctrl+C to stop)`);
        return await new Promise<number>(() => {});
      }
      default:
        console.error(`unknown command '${a.cmd}'\n\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    console.error("error: " + wrap(e).message);
    return 1;
  }
}
