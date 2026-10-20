// Procedural pixel-art backdrops: avenue Jean-Médecin at dusk, the shop,
// the basilica, the stalled tram and Place Masséna.

import { drawText } from './font';
import { OUTLINE, P, Ramp, SKY_DUSK, mix } from './palette';
import { PixelCanvas, bayer, rng } from './pixel';

export const GROUND_Y = 150; // where façades meet the pavement

// ---------------------------------------------------------------------------
// Building blocks

function sky(pc: PixelCanvas, x0: number, w: number, h: number): void {
  pc.gradient(x0, 0, w, h, SKY_DUSK);
  // a few early stars at the top
  const r = rng(x0 + 7);
  for (let i = 0; i < w / 18; i++) {
    const x = x0 + Math.floor(r() * w);
    const y = Math.floor(r() * h * 0.3);
    pc.set(x, y, r() < 0.5 ? 0xfff3d0 : 0xc8b8ff);
  }
}

function smokeColumn(pc: PixelCanvas, cx: number, top: number, bottom: number, seed: number): void {
  const r = rng(seed);
  for (let y = bottom; y > top; y--) {
    const t = (bottom - y) / (bottom - top);
    const width = 6 + t * 26 + Math.sin(y * 0.15 + seed) * 4;
    const sx = cx + Math.sin(y * 0.05 + seed) * 10 * t;
    for (let x = Math.floor(sx - width); x < sx + width; x++) {
      const d = Math.abs(x - sx) / width;
      const dens = (1 - d) * (1 - t * 0.6);
      if (dens > bayer(x, y) * 1.15 + r() * 0.05) {
        const c = mix(0x3a3048, 0x7a6478, 1 - d);
        pc.set(x, y, c);
      }
    }
  }
}

interface FacadeOpts {
  wall: Ramp;
  shutter: Ramp;
  floors: number;
  roofY: number;
  seed: number;
  lit?: number; // chance that a window is lit
  balconies?: boolean;
}

/** An Italianate Niçois façade: stucco, stone surrounds, louvred shutters, iron balconies. */
function facade(pc: PixelCanvas, x0: number, w: number, o: FacadeOpts): void {
  const r = rng(o.seed);
  const top = o.roofY;
  const shopTop = GROUND_Y - 36;
  // stucco with a soft vertical light falloff + dithering
  for (let y = top; y < shopTop; y++) {
    const t = (y - top) / (shopTop - top);
    for (let x = x0; x < x0 + w; x++) {
      const v = 0.85 - t * 0.9 + (bayer(x, y) - 0.5) * 0.3;
      const c = v > 0.5 ? o.wall[0] : v > 0 ? o.wall[1] : v > -0.4 ? o.wall[2] : o.wall[3];
      pc.set(x, y, c);
    }
  }
  // roof: terracotta edge + cornice
  for (let x = x0 - 2; x < x0 + w + 2; x++) {
    pc.set(x, top - 3, 0x8a3a2a);
    pc.set(x, top - 2, (x & 1) ? 0xb0523a : 0x9a4432);
    pc.set(x, top - 1, P.stone[0]);
    pc.set(x, top, P.stone[1]);
    pc.set(x, top + 1, P.stone[3]);
    pc.set(x, top + 2, mix(o.wall[3], 0x000000, 0.2));
  }
  // corner pilasters (quoins)
  for (let y = top + 3; y < shopTop; y++) {
    for (const px of [x0, x0 + w - 3]) {
      const q = Math.floor((y - top) / 4) % 2 === 0;
      pc.set(px, y, P.stone[q ? 1 : 2]);
      pc.set(px + 1, y, P.stone[q ? 1 : 2]);
      pc.set(px + 2, y, q ? P.stone[3] : o.wall[2]);
    }
  }
  // storeys
  const fh = Math.floor((shopTop - top - 6) / o.floors);
  const bays = Math.max(2, Math.floor((w - 8) / 22));
  const bayW = (w - 8) / bays;
  for (let f = 0; f < o.floors; f++) {
    const fy = top + 6 + f * fh;
    // string course
    if (f > 0) {
      for (let x = x0 + 3; x < x0 + w - 3; x++) {
        pc.set(x, fy - 3, P.stone[1]);
        pc.set(x, fy - 2, P.stone[3]);
      }
    }
    const balcony = o.balconies && (f === 1 || (f === o.floors - 1 && r() < 0.5));
    for (let b = 0; b < bays; b++) {
      const cx = Math.round(x0 + 4 + bayW * (b + 0.5));
      const ww = 8;
      const wh = Math.min(fh - 7, 15);
      const wx = cx - ww / 2;
      const wy = fy;
      // stone surround + lintel
      pc.rect(wx - 1, wy - 2, ww + 2, wh + 3, P.stone[2]);
      pc.rect(wx - 2, wy - 3, ww + 4, 2, P.stone[0]);
      pc.hline(wx - 2, wx + ww + 1, wy - 1, P.stone[3]);
      // glass / interior
      const lit = r() < (o.lit ?? 0.3);
      for (let y = 0; y < wh; y++) {
        for (let x = 0; x < ww; x++) {
          let c: number;
          if (lit) c = y < 3 ? 0xffe0a0 : (x + y) % 5 === 0 ? 0xffc870 : 0xf8b060;
          else c = y < wh * 0.4 ? 0x3a4a6a : 0x232a40;
          if (x === ww / 2) c = mix(c, 0x000000, 0.4); // mullion
          pc.set(wx + x, wy + y, c);
        }
      }
      if (!lit) pc.set(wx + 1, wy + 1, 0x8ab4d8);
      // shutters: open (beside the window) or closed (covering it)
      const closed = r() < 0.35;
      const sw = 4;
      const drawShutter = (sx: number) => {
        for (let y = 0; y < wh; y++) {
          for (let x = 0; x < sw; x++) {
            const slat = y % 2 === 0;
            const c = x === 0 ? o.shutter[3] : slat ? o.shutter[1] : o.shutter[2];
            pc.set(sx + x, wy + y, c);
          }
        }
      };
      if (closed) {
        drawShutter(wx);
        drawShutter(wx + sw);
        pc.vline(wx + sw, wy, wy + wh - 1, o.shutter[3]);
      } else {
        drawShutter(wx - sw - 1);
        drawShutter(wx + ww + 1);
      }
      // sill
      pc.hline(wx - 2, wx + ww + 1, wy + wh, P.stone[0]);
      pc.hline(wx - 2, wx + ww + 1, wy + wh + 1, P.stone[3]);
      if (balcony) {
        const by = wy + wh + 2;
        pc.hline(wx - 4, wx + ww + 3, by, P.stone[1]);
        pc.hline(wx - 4, wx + ww + 3, by + 1, P.stone[3]);
        pc.hline(wx - 4, wx + ww + 3, by - 6, 0x2a2430);
        for (let x = wx - 4; x <= wx + ww + 3; x += 2) pc.vline(x, by - 6, by - 1, 0x2a2430);
        // shadow under the balcony
        for (let x = wx - 4; x <= wx + ww + 3; x++) pc.set(x, by + 2, mix(o.wall[3], 0, 0.3));
      }
    }
  }
}

interface ShopOpts {
  sign: string;
  signBg: number;
  signFg: number;
  kind: 'shop' | 'shutter' | 'cafe' | 'pharmacie' | 'smashed';
  seed: number;
}

/** Ground-floor shop front between x0 and x0+w. */
function shopfront(pc: PixelCanvas, x0: number, w: number, o: ShopOpts): void {
  const r = rng(o.seed);
  const top = GROUND_Y - 36;
  // stone base
  pc.rect(x0, top, w, 36, P.stone[2]);
  pc.hline(x0, x0 + w - 1, top, P.stone[0]);
  // sign band
  const sy = top + 2;
  pc.rect(x0 + 3, sy, w - 6, 9, o.signBg);
  pc.hline(x0 + 3, x0 + w - 4, sy + 9, mix(o.signBg, 0, 0.5));
  if (o.sign) {
    const tw = o.sign.length * 6;
    drawText(pc, o.sign, Math.round(x0 + w / 2 - tw / 2), sy + 1, o.signFg);
  }
  const by = sy + 11;
  const bh = GROUND_Y - by;
  if (o.kind === 'shutter') {
    // rolling metal shutter with a few abstract tags
    for (let y = by; y < GROUND_Y; y++) {
      for (let x = x0 + 3; x < x0 + w - 3; x++) {
        const c = (y - by) % 3 === 0 ? P.shutterGrey[3] : (y - by) % 3 === 1 ? P.shutterGrey[1] : P.shutterGrey[2];
        pc.set(x, y, c);
      }
    }
    const tagCols = [0x6ef0f0, 0xff6b9a, 0xffd84a, 0xffffff];
    for (let i = 0; i < 3; i++) {
      const tx = x0 + 6 + r() * (w - 24);
      const ty = by + 4 + r() * (bh - 12);
      const col = tagCols[Math.floor(r() * tagCols.length)];
      let px = tx;
      let py = ty;
      for (let k = 0; k < 26; k++) {
        px += r() * 2 - 0.4;
        py += Math.sin(k * 0.9 + i) * 1.4;
        pc.set(px, py, col);
        pc.set(px + 1, py, col);
      }
    }
    return;
  }
  // windows + door
  const doorW = 14;
  const doorX = Math.round(x0 + w / 2 - doorW / 2);
  const glass = (gx: number, gw: number, lit: boolean, smashed: boolean) => {
    for (let y = by; y < GROUND_Y - 3; y++) {
      for (let x = gx; x < gx + gw; x++) {
        let c = lit ? (y < by + 3 ? 0xfff0c8 : 0xf8d890) : 0x2a3450;
        if (lit && (x + y * 2) % 11 === 0) c = 0xffffff;
        pc.set(x, y, c);
      }
    }
    if (lit) {
      // merchandise on shelves
      for (let sh = 0; sh < 3; sh++) {
        const yy = by + 6 + sh * 8;
        if (yy > GROUND_Y - 6) break;
        pc.hline(gx, gx + gw - 1, yy + 5, 0x9a7a50);
        for (let x = gx + 1; x < gx + gw - 2; x += 3) {
          const cc = [0xe0443c, 0x2f6fc4, 0x3c9a3c, 0xffd84a, 0xffffff, 0x843246][Math.floor(r() * 6)];
          pc.rect(x, yy, 2, 5, cc);
          pc.set(x, yy, mix(cc, 0xffffff, 0.5));
        }
      }
    }
    // frame
    pc.rect(gx - 1, by - 1, gw + 2, 1, 0x1a1424);
    pc.vline(gx - 1, by, GROUND_Y - 3, 0x1a1424);
    pc.vline(gx + gw, by, GROUND_Y - 3, 0x1a1424);
    pc.hline(gx - 1, gx + gw, GROUND_Y - 3, 0x1a1424);
    if (smashed) {
      // a hole with radial cracks
      const hx = gx + gw * 0.5;
      const hy = by + bh * 0.45;
      for (let y = by; y < GROUND_Y - 3; y++) {
        for (let x = gx; x < gx + gw; x++) {
          const d = Math.hypot((x - hx) / (gw * 0.36), (y - hy) / (bh * 0.42));
          if (d < 1 + Math.sin(Math.atan2(y - hy, x - hx) * 7) * 0.15) pc.set(x, y, lit ? 0x5a3a28 : 0x141020);
        }
      }
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + r() * 0.3;
        let px = hx + Math.cos(a) * gw * 0.34;
        let py = hy + Math.sin(a) * bh * 0.4;
        for (let s = 0; s < 14; s++) {
          px += Math.cos(a) * 1.2 + (r() - 0.5);
          py += Math.sin(a) * 1.2 + (r() - 0.5);
          if (px < gx || px >= gx + gw || py < by || py >= GROUND_Y - 3) break;
          pc.set(px, py, 0xe8fbff);
        }
      }
    } else {
      // reflection streaks
      for (let k = 0; k < gw; k += 9) pc.line(gx + k, GROUND_Y - 5, gx + k + 6, by + 1, mix(lit ? 0xffffff : 0x8ab4d8, 0xffffff, 0.3));
    }
  };
  const lit = o.kind !== 'smashed' ? r() < 0.8 : true;
  glass(x0 + 5, doorX - x0 - 8, lit, o.kind === 'smashed');
  glass(doorX + doorW + 3, x0 + w - (doorX + doorW + 3) - 5, lit, false);
  // door
  pc.rect(doorX, by, doorW, GROUND_Y - by, 0x1a1424);
  pc.rect(doorX + 2, by + 2, doorW - 4, GROUND_Y - by - 2, lit ? 0xd8b070 : 0x2a3450);
  pc.vline(doorX + doorW / 2, by + 2, GROUND_Y - 1, 0x1a1424);
  if (o.kind === 'cafe') {
    // striped awning
    for (let y = 0; y < 7; y++) {
      for (let x = x0 + 1; x < x0 + w - 1; x++) {
        const stripe = Math.floor((x - x0) / 4) % 2 === 0;
        pc.set(x, by - 1 + y, stripe ? (y < 5 ? 0xe0443c : 0xb02a32) : y < 5 ? 0xf8f0e0 : 0xc4c2d0);
      }
    }
    for (let x = x0 + 1; x < x0 + w - 1; x += 4) pc.set(x + 1, by + 6, 0xb02a32);
  }
  if (o.kind === 'pharmacie') {
    const cx = x0 + w - 10;
    const cy = top - 8;
    const g = 0x4cff7a;
    pc.rect(cx - 1, cy - 4, 3, 9, g);
    pc.rect(cx - 4, cy - 1, 9, 3, g);
    pc.set(cx, cy, 0xd8ffe0);
  }
}

function pavement(pc: PixelCanvas, x0: number, w: number, seed: number, checker = false): void {
  const r = rng(seed);
  const top = GROUND_Y;
  const h = pc.h - top;
  for (let y = top; y < pc.h; y++) {
    const t = (y - top) / h;
    for (let x = x0; x < x0 + w; x++) {
      if (checker) {
        // Place Masséna's black & white checkerboard, foreshortened
        const persp = 1 / (0.35 + t * 0.9);
        const u = Math.floor(((x - (x0 + w / 2)) / (14 + t * 10)) + 1000);
        const v = Math.floor((y - top) * persp * 0.18);
        const black = (u + v) % 2 === 0;
        const base = black ? (t < 0.3 ? 0x3a3448 : 0x2c2838) : t < 0.3 ? 0xd8d0c8 : 0xc4bcb4;
        pc.set(x, y, (x + y) % 7 === 0 ? mix(base, 0x000000, 0.08) : base);
        continue;
      }
      const v = 0.6 - t * 0.9 + (bayer(x, y) - 0.5) * 0.25;
      pc.set(x, y, v > 0.35 ? P.pave[0] : v > -0.05 ? P.pave[1] : v > -0.4 ? P.pave[2] : P.pave[3]);
    }
  }
  if (!checker) {
    // slab joints with a hint of perspective
    let rowY = top + 4;
    let rowH = 5;
    let row = 0;
    while (rowY < pc.h) {
      pc.hline(x0, x0 + w - 1, rowY, P.pave[3]);
      const slabW = 16 + row * 3;
      const off = (row * 7) % slabW;
      for (let x = x0 - off; x < x0 + w; x += slabW) {
        for (let y = rowY + 1; y < Math.min(pc.h, rowY + rowH); y++) {
          const lean = Math.round(((x - (x0 + w / 2)) / 200) * (y - top) * 0.3);
          pc.set(x + lean, y, P.pave[3]);
        }
      }
      // occasional stain / dark slab
      if (r() < 0.6) {
        const sx = x0 + Math.floor(r() * w);
        pc.rect(sx, rowY + 1, 3, 1, P.pave[2]);
      }
      rowY += rowH;
      rowH += 2;
      row++;
    }
    // kerb highlight against the buildings + shadow
    pc.hline(x0, x0 + w - 1, top, P.stone[0]);
    pc.hline(x0, x0 + w - 1, top + 1, P.pave[3]);
    for (let x = x0; x < x0 + w; x++) if ((x + top) % 2 === 0) pc.set(x, top + 2, P.pave[2]);
  }
  // tram rails inlaid in the paving (two pairs)
  for (const ry of [188, 196, 206, 214]) {
    if (ry >= pc.h) continue;
    for (let x = x0; x < x0 + w; x++) {
      pc.set(x, ry, P.steel[1]);
      pc.set(x, ry + 1, P.steel[3]);
    }
  }
}

/** Dusk colour grade: cool purple falloff toward the street, warm pools under the lamps. */
export function grade(pc: PixelCanvas, x0: number, w: number, lamps: number[]): void {
  for (let y = 0; y < pc.h; y++) {
    const t = y / pc.h;
    const k = y < GROUND_Y ? 0.06 + t * 0.26 : 0.26 + (y - GROUND_Y) / (pc.h - GROUND_Y) * 0.22;
    for (let x = x0; x < x0 + w; x++) {
      const i = y * pc.w + x;
      if (!pc.alpha[i]) continue;
      let c = mix(pc.color[i], 0x2a1a48, k);
      for (const lx of lamps) {
        const d = Math.hypot((x - lx - 6) / 34, (y - (GROUND_Y + 4)) / 22);
        if (d < 1) c = mix(c, 0xffd890, (1 - d) * 0.28);
      }
      pc.color[i] = c;
    }
  }
}

function palm(pc: PixelCanvas, x: number, baseY: number, h: number, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < h; i++) {
    const y = baseY - i;
    const bend = Math.sin(i / h * 1.4) * 4;
    const c = i % 4 === 0 ? P.trunk[3] : i % 4 === 1 ? P.trunk[1] : P.trunk[2];
    pc.rect(Math.round(x + bend - 1), y, 3, 1, c);
    pc.set(Math.round(x + bend - 2), y, P.trunk[3]);
  }
  const tx = x + Math.sin(1.4) * 4;
  const ty = baseY - h;
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI + (k / 8) * Math.PI + (r() - 0.5) * 0.2;
    const len = 14 + r() * 8;
    for (let s = 0; s < len; s++) {
      const px = tx + Math.cos(a) * s;
      const py = ty + Math.sin(a) * s * 0.6 + (s * s) / (len * 2.2);
      pc.set(px, py, s < len * 0.5 ? P.palm[1] : P.palm[2]);
      pc.set(px, py + 1, P.palm[3]);
      if (s % 3 === 0) pc.set(px + Math.sin(a) * 2, py + 2, P.palm[2]);
    }
  }
  pc.ellipse(tx, ty, 2.5, 2, [P.trunk[1], P.trunk[1], P.trunk[2], P.trunk[3]]);
}

function lamp(pc: PixelCanvas, x: number, baseY: number): void {
  pc.vline(x, baseY - 50, baseY, 0x2a2430);
  pc.vline(x + 1, baseY - 50, baseY, 0x3e3648);
  pc.rect(x - 3, baseY - 2, 7, 2, 0x2a2430);
  pc.hline(x, x + 6, baseY - 50, 0x2a2430);
  pc.rect(x + 4, baseY - 49, 5, 4, 0x2a2430);
  pc.rect(x + 5, baseY - 46, 3, 2, 0xfff0b0);
}

// ---------------------------------------------------------------------------
// Stage 1: la boutique

export interface Backdrop {
  main: PixelCanvas;
  far?: PixelCanvas;
  farFactor?: number;
}

export function drawBoutique(): Backdrop {
  const W = 384;
  const pc = new PixelCanvas(W, 216);
  sky(pc, 0, W, GROUND_Y);
  smokeColumn(pc, 330, 0, 60, 3);
  smokeColumn(pc, 40, 4, 50, 9);
  // left neighbour: pharmacie
  facade(pc, -4, 88, { wall: P.rose, shutter: P.shutterGreen, floors: 4, roofY: 22, seed: 11, balconies: true });
  shopfront(pc, -4, 88, { sign: 'PHARMACIE', signBg: 0x26663a, signFg: 0xd8ffe0, kind: 'pharmacie', seed: 2 });
  // the shop's building: cream stone, tan louvred shutters, iron balconies
  facade(pc, 84, 220, { wall: P.cream, shutter: P.shutterWood, floors: 4, roofY: 14, seed: 5, balconies: true, lit: 0.35 });
  // right neighbour: closed shutter
  facade(pc, 304, 84, { wall: P.ochre, shutter: P.shutterGrey, floors: 4, roofY: 26, seed: 21, balconies: true });
  shopfront(pc, 304, 84, { sign: '', signBg: 0x45405a, signFg: 0xffffff, kind: 'shutter', seed: 4 });

  // MÉGAMANIA storefront (after the real entrance: green dotted sign, metal
  // shutter down, a narrow open doorway with an anime poster on the door)
  const x0 = 84;
  const w = 220;
  const top = GROUND_Y - 42;
  // rusticated cream stone ground floor
  for (let y = top; y < GROUND_Y; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const joint = (y - top) % 9 === 0 || ((x - x0 + (Math.floor((y - top) / 9) % 2) * 14) % 28 === 0);
      pc.set(x, y, joint ? P.cream[2] : (x + y) % 5 === 0 ? P.cream[0] : P.cream[1]);
    }
  }
  // dark metal awning ledge with its shadow
  pc.rect(x0 - 2, top - 5, w + 4, 3, 0x3a3644);
  pc.hline(x0 - 2, x0 + w + 1, top - 5, 0x6a6878);
  for (let x = x0; x < x0 + w; x++) {
    pc.set(x, top - 2, P.cream[3]);
    if (x % 2 === 0) pc.set(x, top - 1, P.cream[2]);
  }
  // green sign with a halftone dot gradient on its left end
  const sx0 = x0 + 4;
  const sw = 132;
  for (let y = top + 1; y < top + 15; y++) {
    for (let x = sx0; x < sx0 + sw; x++) {
      const t = (x - sx0) / 46;
      const dot = (x % 3 === 0 && y % 3 === 0) || ((x + 1) % 3 === 0 && (y + 1) % 3 === 0 && t < 0.6);
      let c = 0x3cb043;
      if (t < 1 && dot) c = t < 0.45 ? 0x2a4a9a : 0x2f8a6a;
      else if (t < 0.35) c = 0x2f7a5a;
      pc.set(x, y, c);
    }
  }
  pc.hline(sx0, sx0 + sw - 1, top + 1, 0x7ee08a);
  pc.hline(sx0, sx0 + sw - 1, top + 15, 0x1e5a2a);
  const tw = drawTextWidth('MÉGAMANIA');
  drawText(pc, 'MÉGAMANIA', sx0 + 52 + 1, top + 6, 0x1e5a2a);
  drawText(pc, 'MÉGAMANIA', sx0 + 52, top + 5, 0xffffff, 0xd8ffe0);
  void tw;
  // drain pipe running down the façade
  pc.vline(232, 13, top - 6, P.cream[0]);
  pc.vline(233, 13, top - 6, P.cream[2]);
  for (let y = 10; y < top; y += 26) pc.hline(231, 234, y, P.cream[3]);
  const by = top + 17;
  // rolling metal shutter, pried up at its right corner
  const shX = x0 + 6;
  const shW = 84;
  for (let y = by; y < GROUND_Y; y++) {
    for (let x = shX; x < shX + shW; x++) {
      const k = (y - by) % 3;
      pc.set(x, y, k === 0 ? P.shutterGrey[3] : k === 1 ? P.shutterGrey[0] : P.shutterGrey[1]);
    }
  }
  pc.rect(shX - 2, by - 2, shW + 4, 2, P.shutterGrey[3]);
  pc.vline(shX - 1, by, GROUND_Y - 1, P.shutterGrey[3]);
  pc.vline(shX + shW, by, GROUND_Y - 1, P.shutterGrey[3]);
  // the pried gap: a dark wedge with bent slats
  for (let y = GROUND_Y - 14; y < GROUND_Y; y++) {
    const half = (y - (GROUND_Y - 14)) * 1.5;
    for (let x = Math.round(shX + shW - 26 - half); x < shX + shW - 2; x++) pc.set(x, y, y > GROUND_Y - 3 ? 0x1a1424 : 0x24142a);
  }
  pc.line(shX + shW - 30, GROUND_Y - 2, shX + shW - 4, GROUND_Y - 15, P.shutterGrey[0]);
  pc.line(shX + shW - 28, GROUND_Y - 1, shX + shW - 3, GROUND_Y - 13, P.shutterGrey[2]);
  // stone pilaster between shutter and door
  pc.rect(shX + shW + 2, by - 2, 6, GROUND_Y - by + 2, P.cream[2]);
  pc.vline(shX + shW + 2, by - 2, GROUND_Y - 1, P.cream[0]);
  // the doorway: dark interior, faint shelves, poster on the open door panel
  const dx = 176;
  const dw = 32;
  pc.rect(dx - 2, by - 3, dw + 4, GROUND_Y - by + 3, 0xd8d0c4);
  pc.rect(dx - 1, by - 2, dw + 2, GROUND_Y - by + 2, OUTLINE);
  for (let y = by; y < GROUND_Y; y++) {
    for (let x = dx; x < dx + dw; x++) {
      const t = (y - by) / (GROUND_Y - by);
      pc.set(x, y, mix(0x2a2238, 0x16101e, t) + ((x + y) % 7 === 0 ? 0x050505 : 0));
    }
  }
  for (let sh = 0; sh < 3; sh++) {
    const yy = by + 5 + sh * 8;
    pc.hline(dx + 2, dx + 20, yy + 6, 0x3a3048);
    for (let x = dx + 3; x < dx + 19; x += 3) pc.rect(x, yy + 2, 2, 4, mix([0xe0443c, 0x2f6fc4, 0xffd84a, 0x3c9a3c][(x + sh) % 4], 0x16101e, 0.55));
  }
  // open door panel on the right with an orange-gi anime poster
  const px0 = dx + 22;
  for (let y = by + 1; y < GROUND_Y - 1; y++) for (let x = px0; x < dx + dw; x++) pc.set(x, y, (x + y) % 4 === 0 ? 0x2a5aa8 : 0x2f6fc4);
  pc.ellipse(px0 + 5, by + 9, 3, 3.2, 0xf2bf98);
  for (const [sx, sy, ex, ey] of [[px0 + 2, by + 7, px0 - 1, by + 3], [px0 + 5, by + 6, px0 + 5, by + 1], [px0 + 8, by + 7, px0 + 10, by + 3]]) pc.line(sx, sy, ex, ey, 0x1f1a24);
  pc.rect(px0 + 2, by + 12, 7, 10, 0xff9a3c);
  pc.rect(px0 + 3, by + 16, 5, 2, 0x2f6fc4);
  pc.rect(px0 + 2, by + 22, 3, 8, 0xff9a3c);
  pc.rect(px0 + 6, by + 22, 3, 8, 0xe06a24);
  pc.vline(px0 - 1, by, GROUND_Y - 1, 0x9a96a8);
  // right part: stone wall with a small display niche
  pc.rect(214, by + 2, 36, 22, 0x2a2238);
  pc.rect(215, by + 3, 34, 20, 0x4a3e58);
  poster(pc, 218, by + 4, 0x3c9a3c, 0xffffff);
  // blue blade sign hanging off the right pilaster
  pc.hline(286, 292, by - 6, 0x2a2430);
  pc.rect(288, by - 5, 12, 16, 0x22468a);
  pc.rect(289, by - 4, 10, 14, 0x2f6fc4);
  pc.hline(290, 297, by + 1, 0xd8ffe0);
  pc.rect(291, by + 5, 6, 2, 0x3cb043);
  pavement(pc, 0, W, 77);
  // light spill from the shop onto the pavement
  for (let y = GROUND_Y + 1; y < GROUND_Y + 22; y++) {
    const t = (y - GROUND_Y) / 22;
    for (let x = x0; x < x0 + w; x++) {
      const k = Math.max(0, 1 - Math.abs(x - (x0 + w / 2)) / (w * 0.55)) * (1 - t);
      if (k > bayer(x, y) * 1.3 + 0.12) pc.set(x, y, mix(pc.get(x, y), 0xffd890, 0.35));
    }
  }
  // debris: glass, a toppled bin, dropped game boxes, cardboard
  const r = rng(321);
  for (let i = 0; i < 40; i++) {
    const gx = x0 + 50 + r() * 60;
    const gy = GROUND_Y + 2 + r() * 20;
    pc.set(gx, gy, r() < 0.5 ? 0xffffff : 0xa8e4f4);
  }
  for (let i = 0; i < 6; i++) {
    const bx = 40 + r() * 300;
    const byy = GROUND_Y + 14 + r() * 40;
    const cc = [0xe0443c, 0x2f6fc4, 0x3c9a3c, 0xffd84a][i % 4];
    pc.rect(bx, byy, 4, 3, cc);
    pc.hline(bx, bx + 3, byy + 3, OUTLINE);
  }
  // paper + plastic debris spilling out of the door
  const rr = rng(4242);
  for (let i = 0; i < 26; i++) {
    const gx = 156 + rr() * 70;
    const gy = GROUND_Y + 1 + rr() * 16;
    pc.rect(gx, gy, 2 + Math.floor(rr() * 3), 1 + Math.floor(rr() * 2), rr() < 0.6 ? 0xf0eef4 : 0xc8d8e8);
  }

  pc.rect(318, GROUND_Y + 8, 10, 6, P.cardboard[1]);
  pc.hline(318, 327, GROUND_Y + 8, P.cardboard[0]);
  pc.hline(318, 327, GROUND_Y + 14, P.cardboard[3]);
  lamp(pc, 72, GROUND_Y + 2);
  lamp(pc, 312, GROUND_Y + 2);
  grade(pc, 0, W, [72, 312, 140, 230]);
  return { main: pc };
}

function drawTextWidth(s: string): number {
  return s.length * 6 - 1;
}


function poster(pc: PixelCanvas, x: number, y: number, bg: number, fg: number): void {
  pc.rect(x, y, 16, 22, bg);
  pc.rect(x, y, 16, 1, mix(bg, 0xffffff, 0.4));
  pc.ellipse(x + 8, y + 9, 4, 5, fg);
  pc.rect(x + 3, y + 17, 10, 2, fg);
  pc.rect(x - 1, y - 1, 18, 1, OUTLINE);
}

// ---------------------------------------------------------------------------
// Stage 2: l'avenue -> Place Masséna

const SIGNS = ['BOULANGERIE', 'TABAC', 'OPTIQUE', 'CAFÉ', 'LIBRAIRIE', 'FLEURS', 'SOCCA', 'GLACIER', 'BIJOUX', 'MANGAS'];

export function drawAvenue(width: number): Backdrop {
  const pc = new PixelCanvas(width, 216);
  sky(pc, 0, width, GROUND_Y);
  for (let i = 0; i < 6; i++) smokeColumn(pc, 200 + i * 470, 0, 70, i * 13);

  const r = rng(2024);
  let x = 0;
  let n = 0;
  const walls = [P.ochre, P.rouge, P.jaune, P.rose];
  const shutters = [P.shutterGreen, P.shutterGrey, P.shutterGreen];
  const placeMassena = width - 384;
  let church = false;
  let galeries = false;
  while (x < placeMassena - 40) {
    // landmarks along the avenue
    if (!church && x >= 600) {
      church = true;
      basilica(pc, x, 200);
      x += 200;
      continue;
    }
    if (!galeries && x >= 1460) {
      galeries = true;
      department(pc, x, 300);
      x += 300;
      continue;
    }
    const w = 96 + Math.floor(r() * 3) * 24;
    facade(pc, x, w, { wall: walls[n % walls.length], shutter: shutters[n % 3], floors: 4 + (n % 2), roofY: 16 + Math.floor(r() * 16), seed: 40 + n, balconies: true, lit: 0.35 });
    const kind: ShopOpts['kind'] = r() < 0.25 ? 'shutter' : r() < 0.3 ? 'cafe' : r() < 0.25 ? 'smashed' : 'shop';
    const sign = SIGNS[n % SIGNS.length];
    const bg = [0x22468a, 0x612336, 0x26663a, 0x433f28, 0x1d233d][n % 5];
    shopfront(pc, x, w, { sign: kind === 'shutter' ? '' : sign, signBg: kind === 'shutter' ? 0x45405a : bg, signFg: 0xfff3d0, kind, seed: 70 + n });
    x += w;
    n++;
  }
  massena(pc, placeMassena - 40, width - placeMassena + 40);
  pavement(pc, 0, placeMassena, 5);
  pavement(pc, placeMassena, width - placeMassena, 6, true);
  // stalled tram in front of the façades, mid-avenue
  tram(pc, 930, 300);
  // street furniture
  const lamps: number[] = [];
  for (let px = 120; px < placeMassena - 60; px += 230) {
    lamp(pc, px, GROUND_Y + 2);
    lamps.push(px);
  }
  for (let px = 300; px < placeMassena - 60; px += 460) palm(pc, px, GROUND_Y + 2, 60, px);
  grade(pc, 0, width, lamps);

  const far = new PixelCanvas(Math.ceil(384 + (width - 384) * 0.3), 90);
  sky(far, 0, far.w, 90);
  return { main: pc, far, farFactor: 0.3 };
}

function basilica(pc: PixelCanvas, x0: number, w: number): void {
  // Notre-Dame de Nice: twin square towers, rose window, pointed portal
  const s = P.stone;
  const top = 6;
  for (let y = top + 24; y < GROUND_Y; y++) {
    for (let x = x0 + 20; x < x0 + w - 20; x++) {
      const v = 0.7 - (y - top) / 160 + (bayer(x, y) - 0.5) * 0.25;
      pc.set(x, y, v > 0.5 ? s[0] : v > 0.15 ? s[1] : v > -0.2 ? s[2] : s[3]);
    }
  }
  for (const tx of [x0 + 20, x0 + w - 56]) {
    for (let y = top; y < GROUND_Y; y++) {
      for (let x = tx; x < tx + 36; x++) {
        const edge = x === tx || x === tx + 35;
        pc.set(x, y, edge ? s[3] : (x - tx) < 6 ? s[0] : s[1]);
      }
    }
    // crenellations + lancet windows
    for (let x = tx; x < tx + 36; x += 6) pc.rect(x, top - 4, 3, 4, s[1]);
    for (const wy of [top + 14, top + 44, top + 74]) {
      pc.rect(tx + 12, wy, 4, 18, 0x232a40);
      pc.rect(tx + 20, wy, 4, 18, 0x232a40);
      pc.set(tx + 13, wy - 1, 0x232a40);
      pc.set(tx + 21, wy - 1, 0x232a40);
    }
  }
  // gable + rose window
  const cx = x0 + w / 2;
  for (let y = top + 10; y < top + 30; y++) {
    const half = (y - top - 10) * 1.6;
    for (let x = Math.round(cx - half); x <= cx + half; x++) pc.set(x, y, s[1]);
  }
  pc.ellipse(cx, top + 50, 14, 14, s[3]);
  pc.ellipse(cx, top + 50, 12, 12, 0x6a2a6a);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    pc.line(cx, top + 50, cx + Math.cos(a) * 11, top + 50 + Math.sin(a) * 11, k % 2 ? 0xe8a020 : 0x2f6fc4);
  }
  pc.ellipse(cx, top + 50, 3, 3, 0xffd84a);
  // portal
  for (let y = GROUND_Y - 40; y < GROUND_Y; y++) {
    const half = y < GROUND_Y - 28 ? Math.sqrt(Math.max(0, 1 - ((GROUND_Y - 28 - y) / 12) ** 2)) * 12 : 12;
    for (let x = Math.round(cx - half); x <= cx + half; x++) pc.set(x, y, y > GROUND_Y - 26 ? 0x3a2418 : 0x232a40);
  }
  pc.vline(Math.round(cx), GROUND_Y - 26, GROUND_Y - 1, 0x1a1020);
}

function department(pc: PixelCanvas, x0: number, w: number): void {
  // red-ochre department store with ground-floor arcades
  facade(pc, x0, w, { wall: P.rouge, shutter: P.shutterGrey, floors: 4, roofY: 10, seed: 808, balconies: false, lit: 0.8 });
  const top = GROUND_Y - 38;
  pc.rect(x0, top, w, 38, P.rouge[2]);
  for (let ax = x0 + 6; ax < x0 + w - 24; ax += 28) {
    for (let y = top + 6; y < GROUND_Y; y++) {
      const rr = 11;
      const cy = top + 6 + rr;
      for (let x = ax; x < ax + 22; x++) {
        const inArch = y > cy || Math.hypot(x - (ax + 11), y - cy) < rr;
        if (inArch) pc.set(x, y, y > cy + 4 ? (x + y) % 9 === 0 ? 0xffffff : 0xf8d890 : 0xfff0c8);
      }
    }
    pc.vline(ax - 1, top + 6, GROUND_Y - 1, P.rouge[3]);
  }
  drawText(pc, 'GALERIES', x0 + w / 2 - 24, top - 34, 0xfff3d0);
}

function tram(pc: PixelCanvas, x0: number, w: number): void {
  const top = 98;
  const bot = GROUND_Y + 6;
  for (let y = top; y < bot; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const t = (y - top) / (bot - top);
      let c = t < 0.08 ? P.steel[0] : t < 0.6 ? P.steel[1] : t < 0.85 ? P.steel[2] : 0x2a2430;
      if (t > 0.62 && t < 0.68) c = 0x7a1a2a;
      pc.set(x, y, c);
    }
  }
  // windows
  for (let wx = x0 + 6; wx < x0 + w - 16; wx += 22) {
    pc.rect(wx, top + 8, 18, 18, 0x232a40);
    pc.line(wx + 2, top + 24, wx + 12, top + 9, 0x5a6a9a);
    pc.vline(wx + 18, top + 4, bot - 6, P.steel[3]);
  }
  // doors with warning stripes, pantograph
  for (const dx of [x0 + 70, x0 + 200]) {
    pc.rect(dx, top + 6, 16, bot - top - 10, 0x3a4a6a);
    pc.vline(dx + 8, top + 6, bot - 5, P.steel[3]);
  }
  pc.line(x0 + 120, top, x0 + 140, top - 14, 0x2a2430);
  pc.line(x0 + 160, top, x0 + 140, top - 14, 0x2a2430);
  pc.hline(x0 + 130, x0 + 150, top - 14, 0x2a2430);
  // catenary wire
  for (let x = x0 - 200; x < x0 + w + 200; x++) pc.set(x, top - 14 + Math.round(Math.sin((x - x0) / 120) * 2), 0x2a2430);
  drawText(pc, 'LIGNE 1', x0 + 10, top + 30, 0xffffff);
  for (let x = x0; x < x0 + w; x++) pc.set(x, bot, OUTLINE);
}

function massena(pc: PixelCanvas, x0: number, w: number): void {
  // red Italianate arcaded façades, lower and further back
  facade(pc, x0, w, { wall: P.rouge, shutter: P.shutterGreen, floors: 4, roofY: 44, seed: 1860, balconies: true, lit: 0.5 });
  const top = GROUND_Y - 36;
  pc.rect(x0, top, w, 36, P.rouge[3]);
  for (let ax = x0 + 4; ax < x0 + w - 16; ax += 20) {
    for (let y = top + 4; y < GROUND_Y; y++) {
      for (let x = ax; x < ax + 15; x++) {
        const cy = top + 11;
        if (y > cy || Math.hypot(x - (ax + 7.5), y - cy) < 7.5) pc.set(x, y, y > cy + 8 ? 0x5a3a28 : 0x8a5a3a);
      }
    }
  }
  // Conversation à Nice: poles (figures are separate glowing sprites)
  for (let i = 0; i < 7; i++) {
    const px = x0 + 40 + i * 52;
    pc.vline(px, 48, GROUND_Y + 4, 0x6a6878);
    pc.vline(px + 1, 48, GROUND_Y + 4, 0x4a4858);
  }
  // Fontaine du Soleil
  const cx = x0 + 40 + w / 2 - 20;
  const bx0 = cx - 70;
  const bx1 = cx + 70;
  for (let y = GROUND_Y - 6; y < GROUND_Y + 2; y++) for (let x = bx0; x <= bx1; x++) pc.set(x, y, y === GROUND_Y - 6 ? 0xffffff : y < GROUND_Y - 2 ? P.white[1] : P.white[3]);
  for (let x = bx0 + 2; x < bx1 - 2; x++) pc.set(x, GROUND_Y - 7, (x % 5) ? 0x6ef0f0 : 0xffffff);
  // central statue on a plinth
  pc.rect(cx - 6, GROUND_Y - 40, 12, 34, P.white[2]);
  pc.rect(cx - 7, GROUND_Y - 40, 14, 2, P.white[0]);
  pc.ellipse(cx, GROUND_Y - 62, 5, 6, P.white as unknown as number[]);
  pc.rect(cx - 4, GROUND_Y - 56, 8, 16, P.white[1]);
  pc.line(cx - 4, GROUND_Y - 54, cx - 10, GROUND_Y - 66, P.white[1]);
  pc.line(cx + 4, GROUND_Y - 54, cx + 10, GROUND_Y - 62, P.white[2]);
  // bronze planets around the basin
  for (const k of [-55, -30, 30, 55]) {
    pc.ellipse(cx + k, GROUND_Y - 14, 6, 8, P.gold as unknown as number[]);
    pc.rect(cx + k - 2, GROUND_Y - 7, 4, 2, P.gold[3]);
  }
}
