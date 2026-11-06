// A wall torch: a procedural flame anim (frames from c.phase loop seamlessly), placed in a sprite.
// `pxl build examples/torch.px.js --godot` also writes anims/flame.tres for an AnimatedSprite2D.
use("sweetie16")
pal({ k: 0, p: 1, r: 2, o: 3, y: 4, w: 12, s: 14, d: 15, n: 8 })

anim("flame", { w: 9, h: 12, frames: 6, fps: 10 }, (c) => {
  const k = c.phase * Math.PI * 2, sway = Math.round(Math.sin(k) * 1.2)
  c.poly([0, 11, 4 + sway, Math.round(1 + Math.sin(k * 2)), 8, 11], "r")
  c.poly([2, 11, 4 + sway, Math.round(4 + Math.cos(k * 2)), 6, 11], "o")
  c.poly([3, 11, 4, Math.round(7 + Math.sin(k)), 5, 11], "y")
  c.px(4, 10, "w")
})

sprite("torch", { w: 13, h: 26, outline: "k" },
  rect(5, 12, 3, 12, "n"), rect(3, 11, 7, 2, "d"), vline(5, 13, 10, "s"),
  stamp("flame", 2, 0))
