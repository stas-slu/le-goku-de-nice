// Render a backdrop to PNG: npx tsx scripts/preview-bg.ts boutique|avenue [x0] [w]
import { drawAvenue, drawBoutique } from '../src/art/backgrounds';
import { writePng } from './png';

const [which = 'boutique', x0s = '0', ws] = process.argv.slice(2);
const S = Number(process.env.SCALE ?? 3);
const bd = which === 'boutique' ? drawBoutique() : drawAvenue(2880);
const pc = bd.main;
const x0 = Number(x0s);
const w = Math.min(pc.w - x0, Number(ws ?? 384));
const W = w * S;
const H = pc.h * S;
const img = new Uint8Array(W * H * 4);
for (let y = 0; y < pc.h; y++) for (let x = 0; x < w; x++) {
  const i = y * pc.w + x + x0;
  const c = pc.alpha[i] ? pc.color[i] : 0xff00ff;
  for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
    const o = ((y * S + sy) * W + x * S + sx) * 4;
    img[o] = (c >> 16) & 255; img[o + 1] = (c >> 8) & 255; img[o + 2] = c & 255; img[o + 3] = 255;
  }
}
writePng(process.env.OUT ?? '/tmp/bg.png', W, H, img);
console.log('ok', W, H);
