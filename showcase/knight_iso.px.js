// The Vigil, isometric: the same knight turned to a true 2:1 isometric view, standing on a slab
// of flagstones whose tiles show the grid; the tile he stands on is marked like a tactics cursor.
// 384x216, so x5 is exactly 1920x1080.
//
// The knight is a 3D model (ellipsoids, capsules, slabs as signed distance fields) ray-marched by an
// orthographic camera at 30 degrees elevation, turned 45 degrees: the classic pixel-art isometric
// projection, where a floor square becomes a 2:1 diamond. Each hit is shaded from its normal and
// quantized to a hue-shifted ramp; plates are separated by a darker line where one overlaps another.

pal({ K: "#15121f" })
shades("123456", "#8591aa", { spread: 0.9, shift: 30, sat: 1.1 })   // steel
shades("abcde", "#a02736", { spread: 0.7 })                        // crimson: cape, plume, tabard
shades("ghij", "#d09a3c", { spread: 0.62, shift: 18 })             // gold trim
shades("tuv", "#6a4632", { spread: 0.4 })                          // leather
shades("wxyz", "#2c5a9c", { spread: 0.6 })                         // the shield's blue field
shades("mno", "#e2aa84", { spread: 0.34, shift: 10 })              // skin
const RAMPS = ["123456", "abcde", "ghij", "tuv", "wxyz", "mno"]

const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l] }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

// World: x runs to the lower right of the screen, y to the lower left, z up. The knight faces +x.
const S2 = Math.SQRT1_2
const RIGHT = [S2, -S2, 0], DOWN = [S2 / 2, S2 / 2, -Math.sqrt(0.75)], VIEW = [-Math.sqrt(0.375), -Math.sqrt(0.375), -0.5]   // screen axes, camera direction
const SUN = norm([-0.25, 0.7, 0.62]), HALF = norm([SUN[0] - VIEW[0], SUN[1] - VIEW[1], SUN[2] - VIEW[2]])

// --- signed distances
const sdEll = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const k0 = Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz), k1 = Math.hypot((x - cx) / (rx * rx), (y - cy) / (ry * ry), (z - cz) / (rz * rz))
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}
const sdCap = (x, y, z, ax, ay, az, bx, by, bz, r) => {
  const vx = bx - ax, vy = by - ay, vz = bz - az, t = clamp(((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / (vx * vx + vy * vy + vz * vz))
  return Math.hypot(x - ax - vx * t, y - ay - vy * t, z - az - vz * t) - r
}
const sdBox = (x, y, z, cx, cy, cz, hx, hy, hz) => {
  const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
}
const PLUME = Array.from({ length: 31 }, (_, i) => { const t = i / 30; return [-1 - 15 * t ** 1.1, 82.5 + 9 * Math.sin(t * Math.PI * 0.9) - 14 * t * t, 1.8 + 3.2 * Math.sin(Math.min(1, t * 1.2 + 0.1) * Math.PI) ** 0.8] })
const SN = norm([0.35, 1, 0]), ST = [-SN[1], SN[0]], SC = [5.5, 19]     // the shield's facing, its horizontal axis, its center
const shield = (x, y, z) => {
  const qx = x - SC[0], qy = y - SC[1], dn = qx * SN[0] + qy * SN[1], us = qx * ST[0] + qy * ST[1]
  const hw = z >= 36 ? 9.5 : z > 19 ? 9.5 * Math.sqrt(Math.max(0, 1 - ((36 - z) / 17) ** 2)) : 0
  return [Math.max(Math.abs(us) - hw, z - 50, 19 - z), dn, us]
}

// The knight: distance to the nearest part; HIT says which.
// The eight facings, 45 degrees apart, named by where he looks on screen (se = lower right).
const DIRS = ["se", "s", "sw", "w", "nw", "n", "ne", "e"]
let FC = 1, FS = 0                                                    // cos, sin of the current facing
const face = (dir) => { FC = Math.cos((dir * Math.PI) / 4); FS = Math.sin((dir * Math.PI) / 4) }
const local = ([x, y, z]) => [x * FC + y * FS, y * FC - x * FS, z]    // world -> the knight's own axes
let HIT = 0
const map = (wx, wy, z) => {
  const x = wx * FC + wy * FS, y = wy * FC - wx * FS
  let b = 1e9
  HIT = 0
  const U = (d, i) => { if (d < b) { b = d; HIT = i } }
  { // cape: a sheet from the shoulders, swept back and a little aside
    // (it wraps the shoulders, so its edges come forward; folds deepen toward the hem)
    const k = (54 - z) / 48, xc = -9.5 - k * 9 - Math.sin(z * 0.12) * 1.2 + y * y * 0.022 + Math.sin(y * 0.85 + 1) * (0.3 + k * 1.3)
    U(sdBox(x - xc, y + 1, z, 0, 0, 31, 1.1, 11 + k * 5, 24) * 0.7, 1)
  }
  for (const [s, id] of [[1, 2], [-1, 3]]) {
    const ly = s * 5.8
    U(sdCap(x, y, z, 0, ly, 34, 1, ly, 22, 5), id)                       // cuisse
    U(sdCap(x, y, z, 1, ly, 20, 0, ly, 5, 4.3), id)                      // greave
    U(sdEll(x, y, z, 3.5, ly, 3.2, 7.2, 4.6, 3.2), id + 20)              // sabaton
    U(sdEll(x, y, z, 2, ly, 22, 5.2, 5.2, 4.4), id + 16)                 // knee cop
  }
  U(sdEll(x, y, z, 0, 0, 35.5, 10.5, 12.5, 6.5), 6)                      // fauld
  U(sdEll(x, y, z, 0, 0, 48, 9.5, 11.5, 11), 5)                          // breastplate
  U(sdEll(x, y, z, 0, 0, 58, 6, 7, 3.5), 7)                              // gorget
  U(sdBox(x, y, z, 10.2, 0, 29.5, 0.8, 4, 8.5), 8)                       // tabard
  U(sdEll(x, y, z, 0, 14, 53, 6.8, 6.8, 6), 9)                       // pauldrons
  U(sdEll(x, y, z, 0, -14, 53, 6.8, 6.8, 6), 10)
  U(sdCap(x, y, z, 0, -15, 50, 1, -17, 40, 3.6), 11); U(sdCap(x, y, z, 1, -17, 40, 5.5, -16, 32, 3.5), 11)   // sword arm
  U(sdEll(x, y, z, 5.5, -16, 31, 4.2, 4.2, 4), 25)                       // gauntlet
  U(sdCap(x, y, z, 0, 15, 50, 1, 17.5, 41, 3.6), 12); U(sdCap(x, y, z, 1, 17.5, 41, 5, 15, 37, 3.5), 12)     // shield arm
  U(Math.max(Math.abs(x - 6) - 0.8, Math.abs(y + 16) - Math.min(2.7, z * 0.8 + 0.2), Math.abs(z - 13.5) - 13.5), 13)   // blade, point down
  U(sdBox(x, y, z, 6, -16, 27.5, 1.4, 7.5, 1.3), 14); U(sdEll(x, y, z, 6, -16, 39.5, 2.2, 2.2, 2.2), 14)     // crossguard, pommel
  U(sdCap(x, y, z, 6, -16, 28, 6, -16, 38, 1.2), 24)                     // grip
  { const [d2, dn] = shield(x, y, z); U(Math.max(d2, Math.abs(dn) - 1.2), 15) }
  U(sdEll(x, y, z, 0, 0, 70, 11.5, 11.5, 12), 16); U(sdEll(x, y, z, 0, 0, 64.5, 10.6, 10.6, 8.5), 16)        // helm
  for (const [px, pz, r] of PLUME) U(Math.hypot(x - px, y, z - pz) - r, 17)
  return b
}

const tone = (n, ramp, metal = false, bias = 0) => {
  let I = clamp(0.5 + 0.5 * dot(n, SUN) + bias)
  if (metal) I = clamp(I ** 2.2 * 1.12 + 0.03 + bias)
  let k = Math.min(ramp.length - 1, Math.floor(I * ramp.length))
  if (metal) { k = Math.min(ramp.length - 2, k); if (dot(n, HALF) > 0.972) k = ramp.length - 1 }
  return ramp[k]
}
const HC = Math.cos(0.42), HS = Math.sin(0.42)
// color of a hit: part id, the point, its normal
const paint = (id, [x, y, z], n) => {
  const steel = (b = 0) => tone(n, "123456", true, b), gold = (b = 0) => tone(n, "ghij", false, b)
  switch (id) {
    case 1: return tone(n, "abcde", false, -0.06)
    case 17: return tone(n, "abcde", false, -0.1 + (Math.sin(x * 1.5 + z * 1.1) > 0.6 ? -0.14 : 0))   // barbs
    case 8: return z < 23.2 || (Math.abs(z - 30) < 1.2 && Math.abs(y) < 1.3) ? gold(0.1) : tone(n, "abcde", false, Math.abs(y) > 3 ? -0.1 : 0.04)
    case 5: return z > 56 ? gold(0.1) : z < 40.2 ? (Math.abs(y) < 2.3 && x > 0 ? gold(0.15) : tone(n, "tuv")) : steel()
    case 6: return Math.abs(z - 34) < 0.6 ? "2" : steel(-0.04)
    case 9: case 10: return z < 49.2 ? gold(0.08) : steel(0.03)
    case 18: case 19: return steel(0.08)
    case 13: return steel(Math.abs(y + 16) < 0.7 ? -0.12 : 0.12)
    case 14: return gold(0.1)
    case 24: return tone(n, "tuv")
    case 15: {
      const [d2, dn, us] = shield(x, y, z)
      if (dn < 0.5) return tone(n, "tuv", false, -0.1)                                  // its back, and the edge
      if (d2 > -2.2) return gold(0.05)
      if ((Math.abs(us) < 1.6 && z > 25 && z < 46.5) || (Math.abs(z - 40) < 1.6 && Math.abs(us) < 5.6)) return us < 0 && z > 36 ? "j" : "i"
      return "wxyz"[clamp(Math.floor((0.62 + us * 0.03 + (z - 36) * 0.012) * 4), 0, 3)]
    }
    case 16: {
      // the barbute's T-shaped opening, cut where the helm faces forward
      // (his head is turned a little toward us: hx, hy are the helm's own forward and left)
      const hx = x * HC + y * HS, hy = y * HC - x * HS
      const eyes = z > 66.2 && z < 72 && Math.abs(hy) < 8.6, slot = Math.abs(hy) < 2.3 && z > 58.5 && z <= 66.2
      const near = (g) => z > 65.4 - g && z < 72.8 + g && Math.abs(hy) < 9.4 + g || (Math.abs(hy) < 3.1 + g && z > 57.7 - g && z <= 66.2)
      if (hx > 2 && (eyes || slot)) {
        if (eyes && Math.abs(Math.abs(hy) - 4.3) < 1.4 && z > 67.2 && z < 70.4) return "K"
        if (slot && z < 61.4 && z > 60.2) return "a"
        return z > 70.8 ? "m" : slot && hy < 0 ? "o" : "n"
      }
      if (hx > 2 && near(0)) return z > 69 ? "2" : "5"                   // the opening's rim: dark under the brow, bright on the lower lip
      if (z > 73.6 && z < 76.2) return gold(0.12)
      if (Math.abs(hy) < 1.2 && z > 76.2) return steel(0.2)
      return steel(0.02)
    }
    default: return steel()
  }
}

// Sprite: 72 wide, the knight's ground point at (KOX, KOY).
const KW = 72, KH = 100, KOX = 36, KOY = 88
const knight = (name, dir) => sprite(name, { w: KW, h: KH, selout: "K" }, (c) => {
  face(dir)
  const ids = new Int16Array(KW * KH), dep = new Float32Array(KW * KH), keys = new Array(KW * KH)
  for (let py = 0; py < KH; py++) for (let px = 0; px < KW; px++) {
    const u = px + 0.5 - KOX, v = py + 0.5 - KOY
    const ox = RIGHT[0] * u + DOWN[0] * v, oy = RIGHT[1] * u + DOWN[1] * v, oz = DOWN[2] * v
    let t = -75, hit = 0
    for (let n = 0; n < 140 && t < 75; n++) {
      const d = map(ox + VIEW[0] * t, oy + VIEW[1] * t, oz + VIEW[2] * t)
      if (d < 0.2) { hit = HIT; break }
      t += Math.max(0.3, d * 0.6)
    }
    const p = [ox + VIEW[0] * t, oy + VIEW[1] * t, oz + VIEW[2] * t]
    if (!hit || p[2] < -0.5) continue
    const e = 0.4
    const n = norm([map(p[0] + e, p[1], p[2]) - map(p[0] - e, p[1], p[2]), map(p[0], p[1] + e, p[2]) - map(p[0], p[1] - e, p[2]), map(p[0], p[1], p[2] + e) - map(p[0], p[1], p[2] - e)])
    const i = py * KW + px
    ids[i] = hit; dep[i] = t; keys[i] = paint(hit, local(p), n)
  }
  // where a nearer plate overlaps a farther one, the farther one gets a dark line along the seam
  for (let py = 0; py < KH; py++) for (let px = 0; px < KW; px++) {
    const i = py * KW + px
    if (!ids[i]) continue
    let k = keys[i]
    const seam = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
      const x = px + ox, y = py + oy, j = y * KW + x
      return x >= 0 && y >= 0 && x < KW && y < KH && ids[j] && ids[j] !== ids[i] && dep[j] < dep[i] - 1.4
    })
    if (seam && k !== "K") { const r = RAMPS.find((r) => r.includes(k)), at = r.indexOf(k); k = at >= 2 ? r[at - 2] : "K" }
    c.px(px, py, k)
  }
})
DIRS.forEach((d, i) => knight("knight_iso_" + d, i))
sprite("knight_iso", { base: "knight_iso_se" })
sheet("knight_iso_dirs", DIRS.map((d) => "knight_iso_" + d), { cols: 4, pad: 1 })

// ---------------------------------------------------------------------------------------------
// The slab: 5x5 flagstones, each a 56x28 diamond. a and b are the two floor axes in screen units
// (a tile is 56 of each); the world coordinate along an axis is a / sqrt(2).
const W = 384, H = 216, TOPX = 192, TOPY = 44, TILE = 56, N = 5, SIDE = N * TILE
const KI = 2, KJ = 2                                                  // the knight's tile
const KSX = TOPX, KSY = TOPY + ((KI + KJ + 1) * TILE) / 4             // its center on screen
const hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")
const h2 = (a, b, s = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s, 974711)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const rand = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const buf = (ch = 3) => new Float32Array(W * H * ch)
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H
const add = (b, x, y, r, g, bl, k = 1) => { x |= 0; y |= 0; if (!inside(x, y)) return; const i = (y * W + x) * 3; b[i] += r * k; b[i + 1] += g * k; b[i + 2] += bl * k }
const set = (b, x, y, r, g, bl) => { x |= 0; y |= 0; if (!inside(x, y)) return; const i = (y * W + x) * 3; b[i] = r; b[i + 1] = g; b[i + 2] = bl }
const scale = (b, x, y, k) => { x |= 0; y |= 0; if (!inside(x, y)) return; const i = (y * W + x) * 3; b[i] *= k; b[i + 1] *= k; b[i + 2] *= k }
const blur = (src, ch, r, passes = 2) => {
  let a = Float32Array.from(src), b = new Float32Array(a.length)
  for (let p = 0; p < passes; p++) for (const dx of [1, 0]) {
    const n = dx ? W : H, lines = dx ? H : W, step = (dx ? 1 : W) * ch
    for (let l = 0; l < lines; l++) for (let k = 0; k < ch; k++) {
      const o = (dx ? l * W : l) * ch + k, at = (i) => a[o + clamp(i, 0, n - 1) * step]
      let s = 0
      for (let i = -r; i <= r; i++) s += at(i)
      for (let i = 0; i < n; i++) { b[o + i * step] = s / (2 * r + 1); s += at(i + r + 1) - at(i - r) }
    }
    ;[a, b] = [b, a]
  }
  return a
}
const readCanvas = (c) => { const b = buf(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = c.get(x, y), i = (y * W + x) * 3; b[i] = v >>> 24; b[i + 1] = (v >>> 16) & 255; b[i + 2] = (v >>> 8) & 255 } return b }
const writeCanvas = (c, b) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; c.px(x, y, hex(b[i], b[i + 1], b[i + 2])) } }
const toScreen = (a, b, z = 0) => [TOPX + (a - b) / 2, TOPY + (a + b) / 4 - z]

let MASK = null
const diorama = (name, dir) => scene(name, { w: W, h: H, bg: "#0c0b16" },
  (c) => {
    const B = buf()
    face(dir)
    MASK = new Uint8Array(W * H)                                       // 1 = the slab (kept sharp), 0 = backdrop
    // --- backdrop: deep blue haze, a soft glow behind the slab, far bokeh
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const g = Math.exp(-(((x - 192) / 190) ** 2 + ((y - 96) / 100) ** 2))
      set(B, x, y, 14 + g * 38 + y * 0.02, 14 + g * 30 + y * 0.03, 30 + g * 52 + y * 0.08)
    }
    {
      const r = rand(8)
      for (let n = 0; n < 34; n++) {
        const cx = r() * W, cy = r() * H, rad = 3 + r() * 8, warm = r() < 0.5, a = 0.05 + r() * 0.1
        for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
          if (Math.hypot(x - cx, y - cy) <= rad) add(B, x, y, warm ? 255 : 120, warm ? 200 : 150, warm ? 130 : 255, a)
      }
    }
    const soft = blur(B, 3, 3, 3)
    B.set(soft)

    // --- the slab
    const AMB = [0.4, 0.44, 0.64], SQ = Math.SQRT2
    const KA = (KI + 0.5) * TILE, KB = (KJ + 0.5) * TILE
    const TOP = [[98, 94, 120], [84, 80, 106]], SIDEC = [92, 86, 110]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - TOPX, py = y - TOPY, a = px + 2 * py, b = 2 * py - px
      if (a < 0 || b < 0) continue
      if (a < SIDE && b < SIDE) {
        // top face
        const i = Math.floor(a / TILE), j = Math.floor(b / TILE), fa = a - i * TILE, fb = b - j * TILE, m = Math.min(fa, fb, TILE - 1 - fa, TILE - 1 - fb)
        let col = TOP[(i + j) & 1], k = 0.94 + h2(i, j, 3) * 0.12
        if (fa < 2 || fb < 2) k *= 0.45                                 // joints
        else if (fa < 4 || fb < 4) k *= 1.16                            // the edge that faces the light
        else if (fa >= TILE - 2 || fb >= TILE - 2) k *= 0.84
        if (m >= 2 && h2(i, j, 6) < 0.4 && h2(a >> 2, b >> 2, 9) < 0.75 && (fa < 9 || fb < 7)) col = (a + b) & 2 ? [64, 98, 70] : [54, 84, 64]   // moss along two sides of some stones
        // light: a warm pool around the knight; his shadow is found by marching toward the sun
        const wx = (a - KA) / SQ, wy = (b - KB) / SQ, dist = Math.hypot(wx, wy)
        let warm = Math.exp(-((dist / 78) ** 2)) * 0.8
        if (dist < 100) {
          let t = 1.5, lit = 1
          for (let n = 0; n < 60 && t < 110; n++) { const d = map(wx + SUN[0] * t, wy + SUN[1] * t, 0.4 + SUN[2] * t); if (d < 0.15) { lit = 0; break } lit = Math.min(lit, (6 * d) / t + 0.25); t += Math.max(0.7, d) }
          warm *= 0.12 + 0.88 * clamp(lit)
        }
        let r = col[0] * k * (AMB[0] + warm * 1.5), g = col[1] * k * (AMB[1] + warm * 1.22), bl = col[2] * k * (AMB[2] + warm * 0.72)
        // the cursor: the knight's tile is ringed in gold, with heavier brackets at its corners
        if (i === KI && j === KJ) {
          const corner = Math.min(fa, TILE - 1 - fa) < 16 && Math.min(fb, TILE - 1 - fb) < 16
          r *= 1.25; g *= 1.14
          if (m >= 3 && m < 6) { r = 250; g = 196; bl = 96 }
          if (corner && m >= 3 && m < 9) { r = 310; g = 246; bl = 140 }
        } else if (Math.abs(i - KI) + Math.abs(j - KJ) === 1) {        // the four tiles he could step to: a cool wash and a thin line
          r *= 0.92; g *= 1.04; bl *= 1.3
          if (m >= 4 && m < 6) { r += 30; g += 70; bl += 130 }
        }
        set(B, x, y, r, g, bl); MASK[y * W + x] = 1
        continue
      }
      // side faces: left under the b edge, right under the a edge
      const left = a <= b, h = ((left ? b : a) - SIDE) / 2, e = left ? a - (b - SIDE) : b - (a - SIDE)
      if (e < 0 || e >= SIDE) continue
      const depth = 24 + Math.floor(h2(e >> 3, left ? 1 : 2, 4) * 5) + (h2(e >> 1, 7, left ? 3 : 4) < 0.5 ? 1 : 0)
      if (h >= depth) continue
      const course = Math.floor(h / 8), u = (e + (course & 1) * 14) % 28, v = h - course * 8
      let k = left ? 0.78 : 0.48
      if (h < 1) k *= 1.5; else if (h < 2) k *= 1.2
      else if (v < 1 || u < 2) k *= 0.5
      else if (h > 16) k *= 0.72 - (h - 16) * 0.03                     // rough rock under the dressed courses
      let col = SIDEC
      if (h < 2 + h2(e >> 1, 5, left ? 6 : 7) * 4.5) { col = [70, 118, 72]; k = (left ? 0.9 : 0.62) * (h < 1 ? 1.2 : 1) }      // grass spilling over the lip
      set(B, x, y, col[0] * k * 0.8, col[1] * k * 0.84, col[2] * k); MASK[y * W + x] = 1
    }

    // --- things on the slab: fallen stones, grass and flowers in the joints
    const stone = (x, y, w, h, seed) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const q = ((i + 0.5 - w / 2) / (w / 2)) ** 2 + ((j + 0.5 - h * 0.6) / (h * 0.62)) ** 2 + (h2(i >> 1, j >> 1, seed) - 0.5) * 0.3
        if (q > 1) continue
        const lit = clamp(0.5 - ((i - w / 2) / w) * 0.9 - ((j - h / 2) / h) * 1.1, 0.15, 1), k = lit > 0.72 ? 1.25 : lit > 0.45 ? 0.9 : 0.55
        set(B, x + i, y + j, 100 * k, 96 * k, 122 * k)
      }
      for (let i = 0; i < w; i++) scale(B, x + i, y + h, 0.6)
    }
    for (const [ta, tb, w, h] of [[30, 236, 12, 8], [44, 250, 6, 4], [248, 60, 13, 8], [236, 40, 7, 5], [250, 212, 9, 6], [70, 20, 8, 5]]) { const [x, y] = toScreen(ta, tb); stone(x - w / 2, y - h, w, h, ta) }
    {
      const r = rand(5)
      for (let n = 0; n < 70; n++) {
        const a = r() * SIDE, b = r() * SIDE
        if (Math.min(a % TILE, b % TILE) > 5 && r() < 0.8) continue          // mostly in the joints
        if (Math.hypot(a - KA, b - KB) < 34) continue
        const [x, y] = toScreen(a, b), i0 = ((y | 0) * W + (x | 0)) * 3, bright = clamp((B[i0] + B[i0 + 1]) / 150, 0.8, 2.2), tall = 2 + Math.floor(r() * 3)
        for (let bl = -2; bl <= 2; bl++) {
          const hgt = tall - Math.abs(bl) + (r() < 0.5 ? 1 : 0)
          for (let j = 0; j < hgt; j++) { const g = j === hgt - 1 ? [112, 164, 84] : j > hgt / 2 ? [72, 128, 74] : [44, 88, 62]; set(B, x + bl, y - j, g[0] * bright * 0.62, g[1] * bright * 0.62, g[2] * bright * 0.6) }
        }
        if (r() < 0.3) { const f = r() < 0.5 ? [250, 236, 200] : [244, 200, 110]; set(B, x + 1, y - tall - 1, f[0] * bright * 0.6, f[1] * bright * 0.6, f[2] * bright * 0.6) }
      }
    }
    writeCanvas(c, B)
  },
  stamp("knight_iso_" + DIRS[dir], KSX - KOX - 1, KSY - KOY - 1),
  (c) => {
    const B = readCanvas(c), K = c.asset("knight_iso_" + DIRS[dir])
    // the knight takes the room's light: a touch dimmer and cooler toward the feet
    for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
      if (!(K.get(x, y) & 255)) continue
      const i = ((y + KSY - KOY - 1) * W + x + KSX - KOX - 1) * 3, t = y / K.h
      B[i] *= 0.95 - t * 0.2; B[i + 1] *= 0.91 - t * 0.16; B[i + 2] *= 0.9 - t * 0.04
    }
    // motes drifting in the light above the slab
    {
      const r = rand(23)
      for (let n = 0; n < 70; n++) {
        const a = KSX - 90 + r() * 180, y = 30 + r() * 120, k = 0.3 + r() * 0.6
        add(B, a, y, 255, 236, 180, k * 0.7)
        if (r() < 0.15) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(B, a + ox, y + oy, 255, 230, 170, k * 0.25)
      }
    }
    // --- depth of field: the far and near corners of the slab soften a little
    {
      const softB = blur(B, 3, 1, 2)
      for (let y = 0; y < H; y++) { const a = clamp((Math.abs(y - KSY) - 58) / 40) * 0.85; if (a > 0) for (let i = y * W * 3; i < (y + 1) * W * 3; i++) B[i] = B[i] * (1 - a) + softB[i] * a }
    }
    // --- bloom, grade, vignette
    const hi = buf()
    for (let i = 0; i < B.length; i += 3) { const l = 0.3 * B[i] + 0.59 * B[i + 1] + 0.11 * B[i + 2], k = clamp((l - 165) / 90); hi[i] = B[i] * k; hi[i + 1] = B[i + 1] * k; hi[i + 2] = B[i + 2] * k }
    const b1 = blur(hi, 3, 2, 2), b2 = blur(hi, 3, 7, 2)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3, vg = 1 - 0.55 * clamp(((x - 192) / 260) ** 2 + ((y - 110) / 160) ** 2) ** 1.2
      for (let k = 0; k < 3; k++) { const v = (B[i + k] + b1[i + k] * 0.3 + b2[i + k] * 0.5) * vg + [5, 6, 14][k]; B[i + k] = v > 190 ? 190 + (v - 190) * 0.55 : v }
    }
    writeCanvas(c, B)
  })
diorama("knight_iso_hd2d", 0)
DIRS.forEach((d, i) => diorama("knight_iso_turn_" + d, i))
