// The Vigil: a knight in a ruined chapel, in the HD-2D manner (a crisp pixel sprite standing in a
// lit, depth-blurred world). 384x216, so x5 is exactly 1920x1080.
//
// The knight is a small model rendered into pixels: every plate is a solid (ellipsoid, tube, slab)
// shaded from its surface normal by one upper-left light and quantized to a hue-shifted ramp, then
// outlined part by part so the plates read as separate pieces. The world is painted per pixel in
// true color: stone courses, a perspective floor, a stained-glass window whose light is traced
// onto the floor and through the dusty air, then depth of field, bloom and a vignette.

pal({ K: "#15121f" })
shades("123456", "#8591aa", { spread: 0.9, shift: 30, sat: 1.1 })   // steel: blue-black -> warm white
shades("abcde", "#a02736", { spread: 0.7 })                        // crimson: cape, plume, tabard
shades("ghij", "#d09a3c", { spread: 0.62, shift: 18 })             // gold trim
shades("tuv", "#6a4632", { spread: 0.4 })                          // leather
shades("wxyz", "#2c5a9c", { spread: 0.6 })                         // the shield's blue field
shades("mno", "#e2aa84", { spread: 0.34, shift: 10 })                         // skin, in the helm's shadow

const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l] }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const LIGHT = norm([-0.55, -0.62, 0.56]), HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1])
const KW = 64, KH = 88

// Paint a solid: `at(x, y)` returns a surface normal (or null outside it). `metal` adds a hard
// specular step and a darker core shadow, the way polished plate reads.
const solid = (c, ramp, at, { metal = false, bias = 0 } = {}) => {
  const n = ramp.length
  for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) {
    const nn = at(x + 0.5, y + 0.5)
    if (!nn) continue
    const v = norm(nn), d = dot(v, LIGHT)
    let I = clamp(0.5 + 0.5 * d + bias)
    if (metal) I = clamp(I ** 2.0 * 1.1 + 0.03 + bias)
    let k = Math.min(n - 1, Math.floor(I * n))
    if (metal) k = Math.min(n - 2, k)                 // the top step is kept for the specular glint
    if (metal && dot(v, HALF) > 0.972) k = n - 1
    c.px(x, y, ramp[k])
  }
}
const ball = (cx, cy, rx, ry = rx) => (x, y) => {
  const dx = (x - cx) / rx, dy = (y - cy) / ry, q = dx * dx + dy * dy
  return q > 1 ? null : [dx, dy, Math.sqrt(1 - q)]
}
// a capsule from a to b, radius r0 -> r1
const tube = (ax, ay, bx, by, r0, r1 = r0) => (x, y) => {
  const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))
  const r = r0 + (r1 - r0) * t, dx = (x - ax - vx * t) / r, dy = (y - ay - vy * t) / r, q = dx * dx + dy * dy
  return q > 1 ? null : [dx, dy, Math.sqrt(1 - q)]
}
const any = (...fs) => (x, y) => { for (const f of fs) { const n = f(x, y); if (n) return n } return null }
const part = (name, ...items) => sprite(name, { w: KW, h: KH, selout: "K" }, ...items)

// --- cape: hangs from the shoulders, the hem lifted to the right by a draught
part("_cape", (c) => {
  c.poly([20, 33, 44, 33, 50, 44, 55, 58, 57, 73, 53, 79, 48, 76, 43, 80, 37, 77, 31, 81, 25, 77, 19, 80, 13, 77, 11, 64, 14, 46], "c")
  for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) {
    if (!c.is(x, y, "c")) continue
    const k = (y - 33) / 48, f = Math.sin((x - 8 - k * 5) * 0.62 + Math.sin(y * 0.11) * 1.2)
    let I = 0.52 - f * 0.3 * (0.4 + k) - (x - 31) * 0.006 - (y < 50 ? 0.12 : 0)
    c.px(x, y, "abcde"[clamp(Math.floor(I * 5), 0, 4)])
  }
})

// --- legs: cuisses, knee cops, greaves, sabatons
part("_legs", (c) => {
  for (const [lx, s] of [[26.5, -1], [37, 1]]) {
    solid(c, "123456", tube(lx, 52, lx + s * 0.3, 61, 4.4, 3.8), { metal: true })
    solid(c, "123456", tube(lx + s * 0.3, 64, lx + s * 0.6, 76, 3.7, 3.1), { metal: true })
    solid(c, "123456", ball(lx + s * 1.4, 79, 5.6, 2.9), { metal: true })
    c.rect(Math.floor(lx - 4.5), 81, 11 + (s > 0 ? 1 : 0), 1, "1")
    solid(c, "123456", ball(lx + s * 0.3, 62.5, 4.3, 3.2), { metal: true, bias: 0.08 })
    c.hline(Math.floor(lx - 3), 67, 7, "2"); c.hline(Math.floor(lx - 2), 59, 6, "2"); c.hline(Math.floor(lx - 2), 75, 6, "2")
    c.px(Math.floor(lx + s * 0.3), 62, "i")                                   // a gilt rivet on the knee
  }
})

// --- torso: gorget, breastplate, belt, fauld and a short tabard
part("_torso", (c) => {
  solid(c, "123456", (x, y) => (y > 55.5 || y < 49 ? null : ball(31.5, 47, 12.5, 12)(x, y)), { metal: true, bias: -0.04 })  // fauld
  c.hline(21, 53, 21, "2")
  solid(c, "123456", (x, y) => {                                              // breastplate, with a keel down the middle
    const n = y > 49 ? null : ball(31.5, 39.5, 10.6, 10.5)(x, y)
    return n && [n[0] + Math.sign(x - 31.5) * 0.22 - 0.1, n[1], n[2]]
  }, { metal: true })
  solid(c, "123456", ball(31.5, 31.5, 6.5, 3.2), { metal: true, bias: -0.1 })  // gorget
  c.rect(23, 48, 17, 3, "u"); c.hline(23, 48, 17, "v"); c.hline(23, 50, 17, "t")
  c.rect(30, 47, 4, 4, "i"); c.rect(31, 48, 2, 2, "g"); c.px(30, 47, "j")
  // tabard
  c.poly([28, 51, 36, 51, 36, 63, 32, 66, 28, 63], "c")
  c.vline(28, 51, 12, "d"); c.vline(35, 51, 12, "b"); c.vline(32, 53, 9, "b")
  c.line(28, 63, 32, 66, "i"); c.line(35, 63, 32, 66, "h"); c.px(31, 57, "i"); c.px(32, 57, "i"); c.px(31, 58, "h"); c.px(32, 58, "h")
  // gilt edge on the breastplate's neckline, a couple of rivets
  for (let x = 25; x <= 38; x++) c.px(x, Math.round(33 + ((x - 31.5) / 7) ** 2 * -1.6 + 1.6), x < 32 ? "i" : "h")
  c.px(24, 41, "5"); c.px(39, 41, "3")
})

// --- sword: point down, tip resting on the stones
part("_sword", (c) => {
  for (let y = 57; y <= 85; y++) {
    const hw = y > 82 ? 85 - y : 2
    for (let x = 15 - hw; x <= 15 + hw; x++) c.px(x, y, x < 15 ? "6" : x === 15 ? "4" : "3")
    if (hw === 2) { c.px(13, y, "5"); c.px(17, y, "2") }
  }
  c.px(15, 86, "3")
  c.rect(15, 46, 2, 9, "t")                                                    // grip (the gauntlet covers most of it)
  c.rect(9, 55, 14, 2, "h"); c.hline(9, 55, 13, "i"); c.px(8, 55, "i"); c.px(8, 56, "h"); c.px(23, 55, "h"); c.px(23, 56, "g"); c.hline(10, 56, 13, "g")
  c.rect(14, 54, 4, 4, "h"); c.px(14, 54, "j"); c.px(15, 55, "i")
  c.circ(15.5, 45, 1.6, "h"); c.px(15, 44, "j")                                // pommel
})

// --- sword arm (viewer's left): pauldron, vambrace, gauntlet
part("_arm_l", (c) => {
  solid(c, "123456", tube(17.5, 39, 14.6, 46, 3.4, 3.1), { metal: true })
  solid(c, "123456", tube(14.6, 46, 15.6, 51, 3.2, 3.3), { metal: true, bias: -0.03 })
  solid(c, "123456", ball(14.4, 45.5, 3.5), { metal: true, bias: 0.06 })      // elbow cop
  solid(c, "123456", ball(15.8, 52, 3.7, 3.3), { metal: true })               // gauntlet
  c.hline(13, 53, 6, "2"); c.px(14, 51, "5")
})
const pauldron = (name, cx) => part(name, (c) => {
  solid(c, "123456", ball(cx, 36.3, 7.2, 6.6), { metal: true })
  solid(c, "123456", ball(cx, 34.6, 6.2, 5), { metal: true, bias: 0.08 })     // the upper lame overlaps the lower
  for (let x = cx - 7; x <= cx + 7; x++) {                                    // gilt rim along the bottom
    const dx = (x + 0.5 - cx) / 7.2, y = 36.3 + 6.6 * Math.sqrt(Math.max(0, 1 - dx * dx)) - 1
    if (Math.abs(dx) < 0.97) c.px(Math.floor(x), Math.floor(y), dx < 0 ? "i" : "h")
  }
})
pauldron("_pauldron_l", 18.5)
pauldron("_pauldron_r", 45)

// --- shield: a heater, blue field, gilt rim and cross
const SX = 48.5, ST = 41
const shieldHW = (y) => (y < ST || y > ST + 25 ? -1 : y < ST + 11 ? 7.8 : 7.8 * Math.sqrt(Math.max(0, 1 - ((y - ST - 11) / 14.2) ** 2)))
part("_shield", (c) => {
  for (let y = ST; y < ST + 26; y++) for (let x = 36; x < 60; x++) {
    const hw = shieldHW(y + 0.5), dx = x + 0.5 - SX
    if (Math.abs(dx) > hw) continue
    const edge = Math.min(hw - Math.abs(dx), y + 0.5 - ST, shieldHW(y + 2.5) - Math.abs(dx) + 0.6)
    const I = 0.56 - dx * 0.035 - (y - ST) * 0.012
    if (edge < 1.6) c.px(x, y, "ghij"[clamp(Math.floor((I + 0.1) * 4), 0, 3)])
    else {
      const cross = Math.abs(dx) < 1.5 && y > ST + 3 && y < ST + 21 || (y >= ST + 7 && y <= ST + 9 && Math.abs(dx) < 5.5)
      c.px(x, y, cross ? (dx < 0 && y < ST + 12 ? "j" : "i") : "wxyz"[clamp(Math.floor(I * 4 + 0.2), 0, 3)])
    }
  }
  
})

// --- helm: a barbute, T-shaped opening, gilt brow band; a face in its shadow
const HXC = 31.5, HYC = 20.5
part("_helm", (c) => {
  solid(c, "123456", (x, y) => {
    const dx = x - HXC, dy = y - HYC
    if (y > 31.6) return null
    const hw = y < 24 ? 10.8 * Math.sqrt(Math.max(0, 1 - (dy / 10.8) ** 2)) : 10.2 - (y - 24) * 0.32
    if (Math.abs(dx) > hw) return null
    const nx = dx / 10.8, ny = clamp(dy / 10.8, -1, 0.35)
    return [nx + Math.sign(dx) * 0.08, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]
  }, { metal: true, bias: 0.02 })
  // brow band, crest ridge
  for (let x = 21; x <= 42; x++) if (c.is(x, 17, "123456")) { c.px(x, 17, x < 28 ? "j" : x < 36 ? "i" : "h"); c.px(x, 18, x < 34 ? "h" : "g") }
  c.vline(31, 10, 7, "6"); c.vline(32, 10, 7, "4"); c.px(31, 17, "j"); c.px(32, 17, "j")
  // the opening: eye slit and breath slot, rimmed dark above and light below
  const open = (x, y) => (y >= 20 && y <= 23 && Math.abs(x + 0.5 - HXC) < 7.6) || (y >= 23 && y <= 31 && Math.abs(x + 0.5 - HXC) < 1.6 + (y - 23) * 0.2)
  for (let y = 18; y <= 32; y++) for (let x = 20; x <= 43; x++) {
    if (open(x, y)) continue
    if (c.is(x, y, "123456") && (open(x, y - 1) || open(x - 1, y))) c.px(x, y, "5")
    else if (c.is(x, y, "123456") && (open(x + 1, y))) c.px(x, y, "2")
  }
  for (let y = 19; y <= 31; y++) for (let x = 20; x <= 43; x++) if (open(x, y)) c.px(x, y, y === 20 ? "m" : y < 24 ? "n" : x === 31 ? "o" : "n")
  c.px(24, 21, "m"); c.px(39, 21, "m"); c.px(24, 22, "m"); c.px(39, 22, "m"); c.px(24, 23, "m"); c.px(39, 23, "m")
  // eyes, a shadowed nose, a firm mouth
  c.rect(27, 21, 2, 2, "K"); c.rect(35, 21, 2, 2, "K"); c.px(27, 21, "2"); c.px(35, 21, "2")
  c.px(32, 25, "m"); c.px(32, 26, "m"); c.px(31, 29, "b"); c.px(32, 29, "a")
  // rivets
  c.px(23, 26, "5"); c.px(40, 26, "3"); c.px(25, 29, "5"); c.px(38, 29, "3")
})

// --- plume: rises from the crown and falls back to the right
part("_plume", (c) => {
  const pts = []
  for (let t = 0; t <= 1; t += 0.02) {
    const a = -1.9 + t * 2.9
    pts.push([31 + 10.5 * Math.cos(a) + 4.5 + t * 4, 13.5 + 9.5 * Math.sin(a) + t * 6, 1.4 + 2.8 * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) ** 0.8])
  }
  for (const [x, y, r] of pts) c.circ(x, y + 0.5, r, "a")
  for (const [x, y, r] of pts) c.circ(x - 0.3, y, Math.max(0.6, r - 0.7), "b")
  for (const [x, y, r] of pts) c.circ(x - r * 0.25, y - r * 0.4, Math.max(0.5, r * 0.55), "c")
  for (const [x, y, r] of pts) if (r > 2.4) c.circ(x - r * 0.35, y - r * 0.62, r * 0.28, "d")
  // barbs: short dark strokes across the vane
  for (let i = 8; i < pts.length - 4; i += 6) { const [x, y, r] = pts[i]; c.line(x, y + r * 0.2, x + 1.5, y + r * 0.95, "a") }
  c.px(33, 9, "h"); c.px(34, 9, "i"); c.px(33, 10, "g"); c.px(34, 10, "h")    // the gilt socket it is set in
})

sprite("knight", { w: KW + 2, h: KH + 2 },
  stamp("_cape", 0, 0), stamp("_legs", 0, 0), stamp("_torso", 0, 0),
  stamp("_pauldron_r", 0, 0), stamp("_sword", 0, 0), stamp("_arm_l", 0, 0), stamp("_pauldron_l", 0, 0),
  stamp("_shield", 0, 0), stamp("_plume", 0, 0), stamp("_helm", 0, 0))

// ---------------------------------------------------------------------------------------------
// The chapel. Everything below paints true color into float buffers and writes them back.
const W = 384, H = 216
const HZ = 122                       // where the back wall meets the floor
const VY = -40, CX = 192             // the floor's vanishing point (high: the camera looks down)
const zAt = (ys) => 256 / (ys - VY)  // floor depth factor at a screen row: 1 at the bottom edge
const ZWALL = zAt(HZ), DEPTH = 466   // world depth of the floor per unit of z
const SUNX = 0.7, SUNH = 0.5        // the sun: per unit toward the camera, this far right and this far down
const WX = 128                       // the window's axis
const KX0 = 182, KY0 = 93, KFEET = 176, ZK = zAt(KFEET), DK = (ZWALL - ZK) * DEPTH   // where the knight stands

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")
const h2 = (a, b, s = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s, 974711)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const rand = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const buf = (ch = 3) => new Float32Array(W * H * ch)
const add = (b, x, y, r, g, bl, k = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; b[i] += r * k; b[i + 1] += g * k; b[i + 2] += bl * k }
const set = (b, x, y, r, g, bl) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; b[i] = r; b[i + 1] = g; b[i + 2] = bl }
const scale = (b, x, y, k) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; b[i] *= k; b[i + 1] *= k; b[i + 2] *= k }
// separable box blur, `passes` times (3 passes is close to a gaussian)
const blur = (src, ch, r, passes = 2) => {
  let a = Float32Array.from(src), b = new Float32Array(a.length)
  for (let p = 0; p < passes; p++) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const n = dx ? W : H, lines = dx ? H : W, step = (dx ? 1 : W) * ch
      for (let l = 0; l < lines; l++) for (let k = 0; k < ch; k++) {      // running sum along each line, edges clamped
        const o = (dx ? l * W : l) * ch + k, at = (i) => a[o + clamp(i, 0, n - 1) * step]
        let s = 0
        for (let i = -r; i <= r; i++) s += at(i)
        for (let i = 0; i < n; i++) { b[o + i * step] = s / (2 * r + 1); s += at(i + r + 1) - at(i - r) }
      }
      ;[a, b] = [b, a]
    }
  }
  return a
}
const readCanvas = (c) => { const b = buf(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = c.get(x, y), i = (y * W + x) * 3; b[i] = v >>> 24; b[i + 1] = (v >>> 16) & 255; b[i + 2] = (v >>> 8) & 255 } return b }
const writeCanvas = (c, b) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; c.px(x, y, hex(b[i], b[i + 1], b[i + 2])) } }

// --- the window: a pointed arch, two lancets under an oculus, stained glass above a transom
const opening = (x, y) => {
  if (y > 100 || y < 6) return false
  const dx = x - WX
  return y >= 44 ? Math.abs(dx) <= 26 : Math.hypot(dx + 14, y - 44) <= 40 && Math.hypot(dx - 14, y - 44) <= 40
}
const GLASS = [[255, 186, 84], [226, 104, 104], [92, 186, 190], [255, 226, 150], [126, 128, 228], [255, 150, 66], [255, 236, 190]]
// light let through at a wall point (0..1 per channel), or null where stone blocks it
const glass = (fx, fy) => {
  const x = Math.floor(fx), y = Math.floor(fy), dx = x + 0.5 - WX
  if (!opening(x + 0.5, y + 0.5)) return null
  if (Math.abs(dx) < 1.6 && y > 30) return null                    // mullion
  if (y === 71 || y === 72) return null                            // transom
  let stained = y < 58
  if (y < 44) {
    const lancet = (lx) => Math.hypot(x + 0.5 - (lx - 7), y - 44) <= 19.5 && Math.hypot(x + 0.5 - (lx + 7), y - 44) <= 19.5
    if (!(Math.hypot(dx, y - 20.5) <= 6.6 || lancet(WX - 13.5) || lancet(WX + 13.5))) return null
  }
  if (stained) {
    const p = x + y, q = x - y + 600
    if (p % 6 === 0 || q % 6 === 0) return [0.1, 0.08, 0.1]         // leading
    return GLASS[Math.floor(h2(Math.floor(p / 6), Math.floor(q / 6), 7) * GLASS.length)].map((v) => (v / 255) * 0.95)
  }
  if (y > 87 + 4 * Math.sin(x * 0.33) + 2.5 * Math.sin(x * 0.9 + 1)) return [0.36, 0.5, 0.26]   // treetops outside
  return [1, 0.94 - (y - 58) * 0.002, 0.76 - (y - 58) * 0.004]
}
// is the knight's silhouette at this screen point?
const knightAt = (K, xs, ys) => { const x = Math.floor(xs - KX0), y = Math.floor(ys - KY0); return x >= 0 && y >= 0 && x < K.w && y < K.h && (K.get(x, y) & 255) > 0 }

let RAYS_FRONT = null, MOTES = null

scene("knight_hd2d", { w: W, h: H, bg: "#0c0b16" },
  (c) => {
    const B = buf(), K = c.asset("knight")
    const AMB = [0.42, 0.46, 0.66]

    // --- back wall: coursed ashlar, offset joints; lit only by what spills around the window
    const dist = new Float32Array(W * HZ).fill(99)
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      if (opening(x + 0.5, y + 0.5)) { dist[y * W + x] = 0; continue }
      if (Math.abs(x - WX) > 40 || y > 112) continue
      let d = 99
      for (let oy = -7; oy <= 7; oy++) for (let ox = -7; ox <= 7; ox++) if (opening(x + ox + 0.5, y + oy + 0.5)) d = Math.min(d, Math.hypot(ox, oy))
      dist[y * W + x] = d
    }
    const STONE = ["#3d3b55", "#454362", "#4e4c6a", "#39374e", "#423f58"].map(rgb)
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      const d = dist[y * W + x]
      if (d === 0) {
        const g = glass(x + 0.5, y + 0.5)
        if (g) { set(B, x, y, g[0] * 300, g[1] * 290, g[2] * 270); continue }
        // tracery: dark stone against the light, its edges catching a little of it
        const lit = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => glass(x + ox + 0.5, y + oy + 0.5))
        set(B, x, y, ...(lit ? [96, 70, 62] : [40, 34, 46])); continue
      }
      const base = y > HZ - 12                                           // a heavier plinth course at the foot of the wall
      const ch = base ? 12 : 11, row = Math.floor(y / ch), bw = base ? 38 : 26, off = (row & 1) * (bw >> 1) + Math.floor(h2(row, 3, 1) * 5)
      const u = (x + off) % bw, v = base ? y - (HZ - 12) : y % ch, bx = Math.floor((x + off) / bw)
      let col = STONE[Math.floor(h2(bx, row, 2) * STONE.length)]
      let k = 1
      if (u === 0 || v === 0) k = 0.5                                     // joints
      else if (v === 1 || u === 1) k = 1.13                               // the top and left arris catch the light
      else if (v === ch - 1) k = 0.88
      if (d < 5.5) { col = [98, 92, 120]; k = d < 1.5 ? 1.5 : (Math.floor(Math.atan2(y - 44, x - WX) * 9) & 1 ? 1.05 : 0.92) }   // the arch's voussoirs
      if (y >= 101 && y <= 104 && Math.abs(x - WX) <= 31) { col = [104, 98, 126]; k = y === 101 ? 1.35 : y === 104 ? 0.6 : 1 }     // sill
      // moss creeping up from the floor and down from the sill
      const moss = h2(x >> 1, y >> 1, 5) < (y - 96) / 60 && h2(bx, row, 9) < 0.55
      if (moss && k >= 0.88) col = y & 1 ? [58, 84, 66] : [50, 74, 62]
      const glow = Math.exp(-Math.max(0, d - 1) / 20) * (d < 99 ? 1 : 0), top = 0.5 + 0.5 * (y / HZ)
      const far = clamp(1 - Math.abs(x - WX) / 260)
      set(B, x, y, col[0] * k * (AMB[0] * top + glow * 1.05 + far * 0.1), col[1] * k * (AMB[1] * top + glow * 0.72 + far * 0.08), col[2] * k * (AMB[2] * top + glow * 0.42 + far * 0.06))
    }
    // --- a banner on the wall, swallow-tailed, the knight's own cross on it
    for (let y = 18; y < 100; y++) for (let x = 256; x < 300; x++) {
      const dx = x + 0.5 - 277.5
      if (y < 21) { if (Math.abs(dx) < 19) set(B, x, y, ...(Math.abs(dx) > 16.5 ? [150, 112, 50] : y === 18 ? [86, 62, 50] : [50, 36, 34])); continue }
      if (Math.abs(dx) > 14 || y > 80 + Math.abs(dx) * 1.1) continue
      const fold = Math.sin(dx * 0.62 + Math.sin(y * 0.09) * 0.8), sh = 0.62 + fold * 0.2 - (y - 20) * 0.0022
      const edge = Math.abs(dx) > 11.5 || y > 77 + Math.abs(dx) * 1.1
      const cross = (Math.abs(dx) < 2 && y > 32 && y < 66) || (Math.abs(y - 43) < 2 && Math.abs(dx) < 8)
      const col = edge || cross ? [206, 160, 74] : [150, 38, 52]
      set(B, x, y, col[0] * sh * 0.8, col[1] * sh * 0.78, col[2] * sh * 0.95)
    }
    // --- ivy: runners down the wall from the right and around the window, leaves in two greens
    {
      const r = rand(11)
      for (const [x0, y0, len, drift] of [[330, 0, 70, -0.25], [372, 0, 96, -0.1], [300, 0, 34, 0.2], [158, 14, 60, 0.12], [164, 40, 50, 0.2], [70, 0, 44, 0.15], [96, 96, 22, -0.3], [8, 0, 60, 0.1]]) {
        let x = x0, y = y0
        for (let i = 0; i < len; i++) {
          y += 0.7 + r() * 0.6; x += drift + (r() - 0.5) * 1.6
          if (y >= HZ - 1) break
          const near = clamp(1 - Math.abs(x - WX) / 90), g = r()
          const col = g < 0.4 ? [34, 62, 50] : g < 0.8 ? [46, 84, 58] : [70, 112, 66]
          const k = 0.75 + near * 0.9
          for (const [ox, oy] of r() < 0.6 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0], [-1, 0], [0, 1], [-1, 1]]) set(B, x + ox, y + oy, col[0] * k * (1 + near * 0.3), col[1] * k, col[2] * k * 0.9)
        }
      }
    }

    // --- floor: flagstones in perspective; the window's light traced down onto them
    const FLOOR = ["#4b485e", "#56536b", "#5f5b72", "#464359", "#514d62"].map(rgb)
    const sun = buf()
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const z = zAt(y + 0.5), X = (x + 0.5 - CX) * z, d = (ZWALL - z) * DEPTH
      const g = glass(CX + (X - d * SUNX) / ZWALL, HZ - (d * SUNH) / ZWALL)
      if (!g) continue
      // the knight stands in the beam: his shadow falls toward us
      const e = d - DK
      if (e > 0 && knightAt(K, CX + (X - e * SUNX) / ZK, KFEET - (e * SUNH) / ZK)) continue
      set(sun, x, y, g[0], g[1], g[2])
    }
    const sunSoft = blur(sun, 3, 1, 2), bounce = blur(sun, 3, 9, 2)
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const z = zAt(y + 0.5), X = (x + 0.5 - CX) * z, d = (ZWALL - z) * DEPTH
      const T = 40, TD = 44, row = Math.floor(d / TD), xo = X + (row & 1) * 20 + 2000
      const tx = Math.floor(xo / T), u = (xo - tx * T) / z, v = (d - row * TD) / (DEPTH * z * z / 256)   // distance into the stone, in screen px
      let col = FLOOR[Math.floor(h2(tx, row, 4) * FLOOR.length)], k = 1
      const worn = h2(tx, row, 12)
      if (u < 1 || v < 1) k = 0.46
      else if (v < 2 || u < 2) k = 1.14
      else if (worn < 0.16 && h2(x >> 1, y, 3) < 0.8 && (u < 5 || v < 4)) col = y & 1 ? [62, 92, 66] : [52, 80, 62]       // moss in the joints of some stones
      const i = (y * W + x) * 3, s = [sunSoft[i], sunSoft[i + 1], sunSoft[i + 2]], bo = [bounce[i], bounce[i + 1], bounce[i + 2]]
      const fade = 0.62 + 0.38 * clamp((y - HZ) / 30)                    // darker toward the foot of the wall
      set(B, x, y, col[0] * k * (AMB[0] * fade + s[0] * 2.5 + bo[0] * 0.5), col[1] * k * (AMB[1] * fade + s[1] * 2.1 + bo[1] * 0.38), col[2] * k * (AMB[2] * fade + s[2] * 1.5 + bo[2] * 0.26))
    }
    // contact shadow under the knight
    for (let y = KFEET - 5; y < KFEET + 7; y++) for (let x = KX0 + 6; x < KX0 + 62; x++) {
      const q = ((x - (KX0 + 34)) / 27) ** 2 + ((y - (KFEET + 1)) / 5.5) ** 2
      if (q < 1) scale(B, x, y, 0.45 + 0.55 * q)
    }

    // --- depth of field: the wall and the far floor fall out of focus, and so does the near edge
    {
      const soft = blur(B, 3, 1, 2)
      for (let y = 0; y < H; y++) {
        const a = y < HZ + 2 ? 1 : y < HZ + 26 ? 1 - (y - HZ - 2) / 24 : y > 198 ? ((y - 198) / 18) * 0.9 : 0
        if (a <= 0) continue
        for (let i = y * W * 3; i < (y + 1) * W * 3; i++) B[i] = B[i] * (1 - a) + soft[i] * a
      }
    }

    // --- two columns in the plane of focus: fluted drums, lit on the side that faces the window
    for (const [px, side] of [[36, 1], [344, -1]]) {
      const R = 17, FOOT = 152
      for (let y = FOOT - 2; y < FOOT + 12; y++) for (let x = px - 44; x < px + 44; x++) {     // its shadow pooled on the floor
        const q = ((x - px) / 40) ** 2 + ((y - FOOT - 5) / 6) ** 2
        if (q < 1) scale(B, x, y, 0.5 + 0.5 * q)
      }
      for (let y = 0; y < FOOT + 6; y++) {
        const hw = y < 132 ? R : y < 136 ? R + 2 : y < 140 ? R + 1 : y < 144 ? R + 4 : y < FOOT ? R + 6 : R + 6
        for (let x = Math.ceil(px - hw); x < px + hw; x++) {
          const shaft = y < 132, nx = clamp((x + 0.5 - px) / hw, -1, 1), nz = Math.sqrt(1 - nx * nx * (shaft || y < 144 ? 1 : 0.5))
          let col = [92, 88, 114], k = 1
          const a = Math.asin(nx)
          if (shaft) {
            const fl = Math.cos(a * 9)                                   // flutes
            k *= fl > 0.55 ? 1.12 : fl < -0.5 ? 0.74 : 0.95
            const v = (y + 9) % 27
            if (v === 0) k *= 0.5; else if (v === 1) k *= 1.2
            if (h2(Math.floor(a * 3), Math.floor((y + 9) / 27), px) < 0.12 && v > 3 && v < 12) k *= 0.7     // a chipped drum
          } else {
            if (y === 132 || y === 140 || y === 144) k *= 1.3
            if (y === 135 || y === 139 || y === 143) k *= 0.6
            if (y >= FOOT) { k *= y === FOOT ? 1.25 : 0.7 }
          }
          const facing = Math.max(0, nx * side * 0.85 + nz * 0.35), rim = Math.max(0, -nx * side - 0.75) * 1.2
          const moss = y > 118 && h2(x >> 1, y >> 1, 21) < (y - 118) / 50
          if (moss) col = [62, 96, 70]
          set(B, x, y, col[0] * k * (0.3 + facing * 1.2 + rim * 0.3), col[1] * k * (0.33 + facing * 0.98 + rim * 0.36), col[2] * k * (0.5 + facing * 0.68 + rim * 0.7))
        }
      }
    }

    // --- things on the floor: fallen stones, grass and small flowers pushing through the joints
    const stone = (x, y, w, h, seed) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const q = ((i + 0.5 - w / 2) / (w / 2)) ** 2 + ((j + 0.5 - h * 0.6) / (h * 0.62)) ** 2 + (h2(i >> 1, j >> 1, seed) - 0.5) * 0.3
        if (q > 1 || j >= h) continue
        const lit = clamp(0.5 - (i - w / 2) / w * 0.9 - (j - h / 2) / h * 1.1, 0.15, 1)
        const k = lit > 0.72 ? 1.25 : lit > 0.45 ? 0.9 : 0.55
        set(B, x + i, y + j, 96 * k, 92 * k, 118 * k)
      }
      for (let i = -1; i <= w; i++) scale(B, x + i, y + h, 0.55)
    }
    stone(64, 158, 13, 8, 1); stone(79, 163, 7, 5, 2); stone(306, 170, 16, 10, 3); stone(298, 178, 6, 4, 4); stone(120, 186, 9, 6, 5); stone(322, 160, 8, 5, 6)
    {
      const r = rand(5)
      for (let n = 0; n < 46; n++) {
        const y = 134 + Math.floor(r() * 74), x = Math.floor(r() * W)
        if (x > KX0 + 4 && x < KX0 + 62 && y > KFEET - 8 && y < KFEET + 6) continue
        const i0 = (y * W + x) * 3, bright = clamp((B[i0] + B[i0 + 1]) / 150, 0.75, 2.2), tall = 2 + Math.floor(r() * 3 + (y - 134) / 30)
        for (let b = -2; b <= 2; b++) {
          const hgt = tall - Math.abs(b) + (r() < 0.5 ? 1 : 0)
          for (let j = 0; j < hgt; j++) {
            const g = j === hgt - 1 ? [112, 164, 84] : j > hgt / 2 ? [72, 128, 74] : [44, 88, 62]
            set(B, x + b + (j > 2 ? Math.sign(b) : 0), y - j, g[0] * bright * 0.62, g[1] * bright * 0.62, g[2] * bright * 0.6)
          }
        }
        if (r() < 0.3) { const f = r() < 0.5 ? [250, 236, 200] : [244, 200, 110]; set(B, x + 1, y - tall - 1, f[0] * bright * 0.6, f[1] * bright * 0.6, f[2] * bright * 0.6) }
      }
    }

    // --- shafts of light: every pane throws a ray through the dust to the spot it lights
    const back = buf(), front = buf()
    for (let wy = 6; wy <= 100; wy++) for (let wx = WX - 27; wx <= WX + 27; wx++) {
      const g = glass(wx + 0.5, wy + 0.5)
      if (!g || g[0] + g[1] + g[2] < 0.5) continue
      const h = (HZ - wy - 0.5) * ZWALL, X0 = (wx + 0.5 - CX) * ZWALL, d = h / SUNH
      const sk = DK / d, blocked = sk < 1 && knightAt(K, CX + (X0 + DK * SUNX) / ZK, KFEET - (h * (1 - sk)) / ZK)
      const N = 90
      for (let n = 0; n < N; n++) {
        const s = (n + 0.5) / N
        if (blocked && s > sk) break
        const z = ZWALL - (s * d) / DEPTH, xs = CX + (X0 + s * d * SUNX) / z, ys = VY + 256 / z - (h * (1 - s)) / z
        const k = (0.55 + 0.45 * s) / N
        add(s * d < DK ? back : front, xs, ys, g[0], g[1], g[2], k)
      }
    }
    const bs = blur(back, 3, 1, 2)
    for (let i = 0; i < B.length; i += 3) { B[i] += bs[i] * 190; B[i + 1] += bs[i + 1] * 156; B[i + 2] += bs[i + 2] * 100 }
    RAYS_FRONT = blur(front, 3, 1, 2)

    // dust motes hanging in the beams
    MOTES = []
    {
      const r = rand(23)
      while (MOTES.length < 90) {
        const wx = WX - 26 + r() * 52, wy = 8 + r() * 90, g = glass(wx, wy)
        if (!g || g[0] < 0.5) continue
        const h = (HZ - wy) * ZWALL, X0 = (wx - CX) * ZWALL, d = h / SUNH, s = 0.12 + r() * 0.85
        const z = ZWALL - (s * d) / DEPTH
        MOTES.push([CX + (X0 + s * d * SUNX) / z, VY + 256 / z - (h * (1 - s)) / z, 0.35 + r() * 0.65, r() < 0.14])
      }
    }
    writeCanvas(c, B)
  },
  stamp("knight", KX0, KY0),
  (c) => {
    const B = readCanvas(c), K = c.asset("knight")
    // the knight takes the room's light: cool in the shade below, warm where the beam strikes him
    for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
      if (!(K.get(x, y) & 255)) continue
      const i = ((y + KY0) * W + x + KX0) * 3, t = y / K.h
      const edge = x === 0 || !(K.get(x - 1, y) & 255) || !(K.get(x - 1, Math.max(0, y - 1)) & 255)
      const inner = !edge && x > 1 && (!(K.get(x - 2, y) & 255) || !(K.get(x - 2, Math.max(0, y - 2)) & 255))
      const w = [0.96 - t * 0.2, 0.91 - t * 0.16, 0.9 - t * 0.04]
      for (let k = 0; k < 3; k++) B[i + k] *= w[k]
      if (inner) { B[i] = B[i] * 0.55 + 255 * 0.5; B[i + 1] = B[i + 1] * 0.55 + 226 * 0.5; B[i + 2] = B[i + 2] * 0.55 + 160 * 0.5 }   // rim light from the window behind him
    }
    for (let i = 0; i < B.length; i += 3) { B[i] += RAYS_FRONT[i] * 110; B[i + 1] += RAYS_FRONT[i + 1] * 92; B[i + 2] += RAYS_FRONT[i + 2] * 60 }
    for (const [x, y, a, big] of MOTES) {
      add(B, x, y, 255, 236, 180, a * 0.75)
      if (big) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(B, x + ox, y + oy, 255, 230, 170, a * 0.28)
    }

    // --- foreground, far out of focus: a fern at the lower left, a fallen block at the lower right, ivy overhead
    const F = buf(4)
    const fput = (x, y, r, g, b) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; F[i] = r; F[i + 1] = g; F[i + 2] = b; F[i + 3] = 1 }
    const blob = (cx, cy, r, col) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) fput(x, y, ...col) }
    {
      const r = rand(3)
      for (let n = 0; n < 11; n++) {                                  // fern fronds arching up from the corner
        const a0 = -1.5 + n * 0.14 + r() * 0.1, len = 50 + r() * 44, col = n % 3 === 0 ? [44, 76, 58] : [16, 28, 30]
        let x = -6 + n * 2.5, y = 222, a = a0
        for (let t = 0; t < len; t++) { a += 0.016 + n * 0.0012; x += Math.cos(a) * 1; y += Math.sin(a) * 1; blob(x, y, 1.4 + 3.2 * Math.sin((t / len) * Math.PI), col) }
      }
      for (let y = 176; y < H; y++) for (let x = 296; x < W; x++) {   // a fallen block
        const top = 196 - (x - 296) * 0.16 + (x < 312 ? (312 - x) * 1.6 : 0)
        if (y >= top) fput(x, y, ...(y < top + 3 ? [84, 74, 100] : [20, 18, 30]))
      }
      for (let n = 0; n < 60; n++) {                                  // ivy hanging into the top right
        const x = 300 + r() * 90, y = r() * r() * 46 * clamp((x - 290) / 60)
        blob(x, y, 2 + r() * 3.5, r() < 0.3 ? [34, 58, 46] : [14, 22, 26])
      }
    }
    const FB = blur(F, 4, 2, 3)
    for (let p = 0; p < W * H; p++) { const a = clamp(FB[p * 4 + 3] * 1.15); if (a > 0) for (let k = 0; k < 3; k++) B[p * 3 + k] = B[p * 3 + k] * (1 - a) + (FB[p * 4 + k] / Math.max(0.001, FB[p * 4 + 3])) * a }

    // --- bloom: whatever is bright bleeds into its surroundings
    const hi = buf()
    for (let i = 0; i < B.length; i += 3) { const l = 0.3 * B[i] + 0.59 * B[i + 1] + 0.11 * B[i + 2], k = clamp((l - 165) / 90); hi[i] = B[i] * k; hi[i + 1] = B[i + 1] * k; hi[i + 2] = B[i + 2] * k }
    const b1 = blur(hi, 3, 2, 2), b2 = blur(hi, 3, 7, 2)
    // --- grade: lifted blue shadows, a soft shoulder on the highlights, vignette
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3, vg = 1 - 0.62 * clamp(((x - 200) / 250) ** 2 + ((y - 118) / 150) ** 2) ** 1.2
      for (let k = 0; k < 3; k++) {
        let v = (B[i + k] + b1[i + k] * 0.3 + b2[i + k] * 0.5) * vg + [5, 6, 14][k]
        B[i + k] = v > 190 ? 190 + (v - 190) * 0.55 : v
      }
    }
    writeCanvas(c, B)
  })
