// Render character frames to a scaled PNG contact sheet: npx tsx scripts/preview-chars.ts <key> [anims...]
import { allCharDefs } from '../src/art/characters';
import { renderFrame, FRAME_W, FRAME_H, ORIGIN_Y } from '../src/art/rig';
import { writePng } from './png';

const [key = 'hero', ...animFilter] = process.argv.slice(2);
const out = process.env.OUT ?? '/tmp/preview.png';
const S = Number(process.env.SCALE ?? 3);
const keys = key.split(',');
const defs = allCharDefs().filter((d) => key === 'all' || keys.some((k) => d.key === k || d.key.startsWith(k)));
const rows: Array<{ frames: ReturnType<typeof renderFrame>[] }> = [];
if (process.env.GALLERY) {
  // one row per requested anim, one column per character (first frame)
  for (const a of animFilter) {
    rows.push({ frames: defs.filter((d) => d.anims[a]).map((d) => renderFrame(d.look, d.build, d.anims[a][0])) });
  }
} else {
  for (const d of defs) {
    for (const [name, poses] of Object.entries(d.anims)) {
      if (animFilter.length && !animFilter.includes(name)) continue;
      rows.push({ frames: poses.map((p) => renderFrame(d.look, d.build, p)) });
    }
  }
}
const cols = Math.max(...rows.map((r) => r.frames.length));
const W = cols * FRAME_W * S;
const H = rows.length * FRAME_H * S;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  img[i * 4] = 92; img[i * 4 + 1] = 110; img[i * 4 + 2] = 120; img[i * 4 + 3] = 255;
}
rows.forEach((row, ry) => {
  row.frames.forEach((pc, cx) => {
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      const i = y * FRAME_W + x;
      let c = -1;
      if (pc.alpha[i]) c = pc.color[i];
      else if (y === ORIGIN_Y) c = 0x808890;
      else if ((x + y) % 2 === 0 && (x === 0 || y === 0)) c = 0x404050;
      if (c < 0) continue;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const X = (cx * FRAME_W + x) * S + sx;
        const Y = (ry * FRAME_H + y) * S + sy;
        const o = (Y * W + X) * 4;
        img[o] = (c >> 16) & 255; img[o + 1] = (c >> 8) & 255; img[o + 2] = c & 255; img[o + 3] = 255;
      }
    }
  });
});
writePng(out, W, H, img);
console.log(`wrote ${out} ${W}x${H} rows=${rows.length}`);
