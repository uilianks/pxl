// Godot 4 SpriteFrames (.tres) from a sheet JSON (TexturePacker hash + Aseprite frameTags), so a
// sheet drops into an AnimatedSprite2D. Platform-independent: string in, string out.

interface SheetJsonFrame { frame: { x: number; y: number; w: number; h: number }; duration?: number }
interface SheetJsonTag { name: string; from: number; to: number; repeat?: string }
interface SheetJson { frames: Record<string, SheetJsonFrame>; meta: { image: string; frameTags?: SheetJsonTag[] } }

const str = (s: string) => JSON.stringify(s);   // Godot strings use the same escapes

/**
 * One animation per frame tag (its frames, durations and loop: a tag with `repeat: "1"` plays
 * once); every untagged frame becomes a one-frame animation under its own name. The texture is
 * referenced by the path relative to the .tres (`meta.image`), which Godot resolves on load.
 */
export function spriteFramesTres(json: string): string {
  const j = JSON.parse(json) as SheetJson;
  const names = Object.keys(j.frames), tags = j.meta.frameTags ?? [];
  const tagged = new Set<number>();
  const anims: { name: string; idx: number[]; ms: (number | undefined)[]; loop: boolean }[] = [];
  for (const t of tags) {
    const idx = Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i);
    idx.forEach((i) => tagged.add(i));
    anims.push({ name: t.name, idx, ms: idx.map((i) => j.frames[names[i]].duration), loop: t.repeat !== "1" });
  }
  names.forEach((n, i) => { if (!tagged.has(i)) anims.push({ name: n, idx: [i], ms: [undefined], loop: false }); });

  const subs = names.map((n, i) => {
    const f = j.frames[n].frame;
    return `[sub_resource type="AtlasTexture" id="f${i}"]\natlas = ExtResource("1")\nregion = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})\n`;
  });
  const body = anims.map((a) => {
    // speed is frames per second at the shortest frame; each frame's duration is a multiple of it
    const known = a.ms.filter((m): m is number => m !== undefined && m > 0);
    const base = known.length ? Math.min(...known) : 1000 / 5;
    const frames = a.idx.map((i, k) => `{\n"duration": ${+((a.ms[k] ?? base) / base).toFixed(4)},\n"texture": SubResource("f${i}")\n}`);
    return `{\n"frames": [${frames.join(", ")}],\n"loop": ${a.loop},\n"name": &${str(a.name)},\n"speed": ${+(1000 / base).toFixed(4)}\n}`;
  });
  return `[gd_resource type="SpriteFrames" load_steps=${names.length + 2} format=3]\n\n` +
    `[ext_resource type="Texture2D" path=${str(j.meta.image)} id="1"]\n\n` +
    subs.join("\n") + `\n[resource]\nanimations = [${body.join(", ")}]\n`;
}
