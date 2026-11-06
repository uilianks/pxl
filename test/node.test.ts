import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, inflateSync } from "node:zlib";
import { Img } from "../src/core/image.ts";
import { pack } from "../src/core/color.ts";
import { encodePng } from "../src/node/png.ts";
import { main } from "../src/node/cli.ts";
import { serve } from "../src/node/server.ts";

function chunks(buf: Buffer): { type: string; data: Buffer; crcOk: boolean }[] {
  const out = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    out.push({ type, data, crcOk: (crc32(buf.subarray(o + 4, o + 8 + len)) >>> 0) === buf.readUInt32BE(o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

test("png: indexed with transparency, valid CRCs, inflatable", () => {
  const img = new Img(2, 2);
  img.set(0, 0, pack(255, 0, 0));
  img.set(1, 1, pack(0, 0, 255, 128));
  const c = chunks(encodePng(img));
  assert.deepEqual(c.map((x) => x.type), ["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  assert.ok(c.every((x) => x.crcOk));
  assert.equal(inflateSync(c[3].data).length, 2 * 3);
});

test("png: RGBA when more than 256 colors", () => {
  const img = new Img(20, 20);
  for (let i = 0; i < 400; i++) img.data[i] = pack(i % 256, Math.floor(i / 256), 7);
  const c = chunks(encodePng(img));
  assert.equal(c[0].data[9], 6);
  assert.equal(inflateSync(c.find((x) => x.type === "IDAT")!.data).length, 20 * (20 * 4 + 1));
});

function tmpArt(src: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "pxl-"));
  const file = join(dir, "a.px.js");
  writeFileSync(file, src);
  return { dir, file };
}

test("cli build writes sprites, previews, layered exports and sheets", async () => {
  const { dir, file } = tmpArt(`use("pico8")
sprite("dot", { outline: "0" }, "8")
sprite("lay", { w: 2, h: 1, layers: true }, layer("a", px(0, 0, "7")), layer("b", px(1, 0, "8")))
sprite("_part", "7")
sheet("all", ["*"], { pad: 1 })`);
  const log = console.log;
  const lines: string[] = [];
  console.log = (s: string) => lines.push(s);
  try { assert.equal(await main(["build", file]), 0); } finally { console.log = log; }
  for (const p of ["sprites/dot.png", "sprites/lay.png", "sprites/lay/a.png", "sprites/lay/b.png", "_preview/dot.png", "all.png", "all.json"])
    assert.ok(existsSync(join(dir, "out", p)), p);
  assert.ok(!existsSync(join(dir, "out", "sprites", "_part.png")));
  const json = JSON.parse(readFileSync(join(dir, "out", "all.json"), "utf8"));
  assert.deepEqual(Object.keys(json.frames), ["dot", "lay"]);
  assert.deepEqual(json.frames.dot.frame, { x: 0, y: 0, w: 3, h: 3 });
  assert.ok(lines.some((l) => l.startsWith("sprite dot 3x3")));
});

test("cli build reports per-asset errors and still writes the rest", async () => {
  const { dir, file } = tmpArt(`use("pico8")\nsprite("good", "8")\nsprite("bad", "z")`);
  const err = console.error, log = console.log;
  const errors: string[] = [];
  console.error = (s: string) => errors.push(s);
  console.log = () => {};
  try { assert.equal(await main(["build", file]), 1); } finally { console.error = err; console.log = log; }
  assert.ok(existsSync(join(dir, "out", "sprites", "good.png")));
  assert.ok(errors.some((e) => e.includes("a.px.js:3:1") && e.includes("unknown color key 'z'")), errors.join("\n"));
});

test("server: state, asset frames, rebuild on change", async () => {
  const { file } = tmpArt(`use("pico8")\nsprite("a", { w: 2, h: 1 }, px(0, 0, "8"), px(1, 0, "7"))`);
  const logs: string[] = [];
  const s = await serve(file, { port: 0, out: false, log: (l) => logs.push(l) });
  try {
    const state = await (await fetch(s.url + "api/state")).json();
    assert.equal(state.assets[0].name, "a");
    const a = await (await fetch(s.url + "api/asset?name=a")).json();
    assert.deepEqual(a.frames.map((f: { label: string }) => f.label), ['px(0, 0, "8")', 'px(1, 0, "7")']);
    assert.equal(a.frames[1].loc, "a.px.js:2:44");
    const html = await (await fetch(s.url)).text();
    assert.ok(html.includes("/app.js"));
    const js = await (await fetch(s.url + "app.js")).text();
    assert.ok(js.includes("EventSource") && !js.includes("interface AssetInfo"));

    writeFileSync(file, `use("pico8")\nsprite("a", { w: 1, h: 1 }, px(0, 0, "9"))`);
    const t0 = Date.now();
    let v = 1;
    while (Date.now() - t0 < 5000) {
      await new Promise((r) => setTimeout(r, 100));
      const st = await (await fetch(s.url + "api/state")).json();
      v = st.version;
      if (v > 1) {
        assert.equal(st.assets[0].w, 1);
        assert.equal(st.assets[0].edited, true);
        break;
      }
    }
    assert.ok(v > 1, "rebuild did not happen");
  } finally {
    s.close();
  }
});

test("serve: feedback from the viewer is written next to the outputs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pxl-fb-"));
  const file = join(dir, "a.px.js");
  writeFileSync(file, `use("pico8")\nsprite("a", { w: 2, h: 1 }, px(0, 0, "8"), px(1, 0, "7"))`);
  const s = await serve(file, { port: 0, out: join(dir, "out"), preview: false, log: () => {} });
  const post = (body: unknown) => fetch(s.url + "api/feedback", { method: "POST", body: JSON.stringify(body) });
  try {
    const red = 0xff004dff, marks = Buffer.from(new Uint32Array([0, red]).buffer).toString("base64");
    const r = await post({ name: "a", w: 2, h: 1, marks, notes: [{ x: 0, y: 0, text: "darker here" }], comment: "warmer" });
    assert.equal(r.status, 200);
    const fb = JSON.parse(readFileSync(join(dir, "out", "_feedback", "a.json"), "utf8"));
    assert.equal(fb.comment, "warmer");
    assert.deepEqual(fb.notes[0], { n: 1, x: 0, y: 0, text: "darker here", under: { hex: "#ff004d", key: "8" } });
    assert.deepEqual(fb.paint.map((p: { key: string; kind: string; pixels: number[][] }) => [p.key, p.kind, p.pixels]), [["8", "palette", [[1, 0]]]]);
    assert.ok(existsSync(join(dir, "out", "_feedback", "a.marks.png")) && existsSync(join(dir, "out", "_feedback", "a.current.png")));
    assert.equal((await post({ name: "../x", w: 2, h: 1, marks })).status, 400);
    assert.equal((await post({ name: "a", w: 3, h: 1, marks })).status, 400);
  } finally {
    s.close();
  }
});

test("cli build --godot writes SpriteFrames beside sheets and strips; previews are .gdignored", async () => {
  const { dir, file } = tmpArt(`use("pico8")
sprite("dot", "8")
anim("blink", { fps: 4 }, "7", frame(), frame({ hold: 2 }, px(0, 0, "8")))
anim("pop", { fps: 10, loop: false }, "7", frame(), frame(px(0, 0, "8")))
sheet("all", ["*"])`);
  const log = console.log;
  console.log = () => {};
  try { assert.equal(await main(["build", file, "--godot"]), 0); } finally { console.log = log; }
  const out = join(dir, "out");
  assert.ok(existsSync(join(out, "_preview", ".gdignore")));
  const strip = readFileSync(join(out, "anims", "blink.tres"), "utf8");
  assert.match(strip, /^\[gd_resource type="SpriteFrames" load_steps=4 format=3\]/);
  assert.match(strip, /path="blink.png"/);
  assert.match(strip, /"duration": 1,\n"texture": SubResource\("f0"\)[^]*"duration": 2,/);
  assert.match(strip, /"loop": true,\n"name": &"blink",\n"speed": 4\n/);
  const all = readFileSync(join(out, "all.tres"), "utf8");
  assert.match(all, /"loop": false,\n"name": &"pop",\n"speed": 10\n/);
  assert.match(all, /"name": &"dot"/);
  assert.equal(JSON.parse(readFileSync(join(out, "all.json"), "utf8")).meta.frameTags.find((t: { name: string }) => t.name === "pop").repeat, "1");
  assert.match(readFileSync(join(out, "anims", "pop.tres"), "utf8"), /"loop": false/);
});
