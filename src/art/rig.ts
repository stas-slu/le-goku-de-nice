// Skeletal pose renderer that rasterises characters straight into pixel art.
// Sprites face right; the engine flips them for left.

import { OUTLINE, P, Ramp } from './palette';
import { PixelCanvas, makeDarkener } from './pixel';

export const FRAME_W = 96;
export const FRAME_H = 88;
export const ORIGIN_X = 48;
export const ORIGIN_Y = 84;

export type HeadKind = 'hero' | 'long' | 'balaclava' | 'hood' | 'cap' | 'beanie' | 'bald' | 'spiky' | 'helmet';
export type Face = 'neutral' | 'grit' | 'hurt' | 'shout' | 'smirk';

export interface Look {
  skin: Ramp;
  hair: Ramp;
  shirt: Ramp;
  sleeves: 'short' | 'long';
  pants: Ramp;
  shoes: Ramp;
  sole?: number;
  head: HeadKind;
  headCloth?: Ramp; // balaclava / hood / cap / beanie colour
  glasses?: boolean;
  lanyard?: boolean;
  logo?: number;
  hoodie?: boolean; // kangaroo pocket + strings + hood bunched at the neck
  backpack?: Ramp;
  belt?: Ramp;
  wrist?: Ramp; // wristbands (standee)
  undershirt?: Ramp; // visible collar colour (standee)
  goggles?: boolean;
  stubble?: boolean;
  gaiter?: Ramp; // neck gaiter pulled over nose + mouth
  cardboard?: boolean; // standee: thick cardboard rim
  longHair?: Ramp; // hair falling past the shoulders
  beard?: Ramp; // full beard + moustache
  tattoo?: boolean; // ink on the forearms
  rainbowLogo?: boolean; // multicolour chest print
  pantsPrint?: boolean; // white number print on the front thigh + drawstring
  belly?: boolean;
}

export interface Build {
  thigh: number;
  shin: number;
  torso: number;
  shoulderW: number;
  hipW: number;
  upperArm: number;
  forearm: number;
  armR: number;
  legR: number;
  fistR: number;
  headR: number;
}

export const BUILD_HERO: Build = {
  thigh: 12, shin: 12, torso: 19, shoulderW: 17, hipW: 12, upperArm: 10, forearm: 9.5, armR: 3.1, legR: 3.9, fistR: 3.1, headR: 6,
};
export const BUILD_SLIM: Build = {
  thigh: 12, shin: 12, torso: 18, shoulderW: 15, hipW: 11, upperArm: 9.5, forearm: 9, armR: 2.8, legR: 3.6, fistR: 2.9, headR: 5.8,
};
export const BUILD_BIG: Build = {
  thigh: 12, shin: 11.5, torso: 20, shoulderW: 22, hipW: 17, upperArm: 10.5, forearm: 10, armR: 3.9, legR: 4.7, fistR: 3.5, headR: 6.8,
};
export const BUILD_HEAVY: Build = {
  thigh: 12, shin: 11, torso: 21, shoulderW: 23, hipW: 17, upperArm: 11, forearm: 10, armR: 4.4, legR: 5, fistR: 4, headR: 6.2,
};

export interface Pose {
  hx?: number;
  hy?: number;
  lean?: number;
  headTilt?: number;
  aF?: [number, number];
  aB?: [number, number];
  lF?: [number, number];
  lB?: [number, number];
  hand?: 'fist' | 'open';
  armBFront?: boolean; // draw the back arm in front of the torso (crossed arms)
  plant?: boolean; // auto-plant feet on the ground (default true)
  face?: Face;
  prop?: 'sack' | 'bottle' | 'bat' | 'glassesHand' | 'flare';
  rot?: number; // whole-body rotation (deg), for spins / lying down
  squash?: number;
}

const DEG = Math.PI / 180;
const LIGHT = normalize3(-0.55, -0.62, 0.56);

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function dirOf(angleDeg: number): [number, number] {
  return [Math.sin(angleDeg * DEG), Math.cos(angleDeg * DEG)];
}

function rampAt(r: Ramp, lit: number, shift: number): number {
  let i: number;
  if (lit > 0.7) i = 0;
  else if (lit > 0.25) i = 1;
  else if (lit > -0.25) i = 2;
  else i = 3;
  return r[Math.min(3, i + shift)];
}

/** Shaded capsule between two points with radius interpolated r0 -> r1. */
export function capsule(
  pc: PixelCanvas, ax: number, ay: number, bx: number, by: number, r0: number, r1: number,
  ramp: Ramp | ((t: number) => Ramp), layer: number, shift = 0,
): void {
  const minX = Math.floor(Math.min(ax, bx) - Math.max(r0, r1) - 1);
  const maxX = Math.ceil(Math.max(ax, bx) + Math.max(r0, r1) + 1);
  const minY = Math.floor(Math.min(ay, by) - Math.max(r0, r1) - 1);
  const maxY = Math.ceil(Math.max(ay, by) + Math.max(r0, r1) + 1);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const vx = px - cx;
      const vy = py - cy;
      const r = r0 + (r1 - r0) * t;
      const d = Math.hypot(vx, vy);
      if (d > r) continue;
      const nx = vx / r;
      const ny = vy / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      const rr = typeof ramp === 'function' ? ramp(t) : ramp;
      pc.set(x, y, rampAt(rr, lit * 1.25 - 0.15, shift), 255, layer);
    }
  }
}

/** Filled convex quad (a,b,c,d in order), shaded across its width. */
function quad(
  pc: PixelCanvas, pts: Array<[number, number]>, ramp: Ramp, layer: number,
  shadeFn: (x: number, y: number) => number,
): void {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!insidePoly(x + 0.5, y + 0.5, pts)) continue;
      pc.set(x, y, rampAt(ramp, shadeFn(x + 0.5, y + 0.5), 0), 255, layer);
    }
  }
}

function insidePoly(x: number, y: number, pts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface Joints {
  hip: [number, number];
  chest: [number, number];
  neck: [number, number];
  head: [number, number];
  shF: [number, number];
  shB: [number, number];
  elF: [number, number];
  elB: [number, number];
  haF: [number, number];
  haB: [number, number];
  hipF: [number, number];
  hipB: [number, number];
  knF: [number, number];
  knB: [number, number];
  anF: [number, number];
  anB: [number, number];
  up: [number, number];
  side: [number, number];
}

function add(a: [number, number], d: [number, number], s: number): [number, number] {
  return [a[0] + d[0] * s, a[1] + d[1] * s];
}

export function solve(b: Build, p: Pose, ox: number, oy: number): Joints {
  const lean = p.lean ?? 0;
  const aF = p.aF ?? [10, 30];
  const aB = p.aB ?? [-10, 30];
  const lF = p.lF ?? [6, 6];
  const lB = p.lB ?? [-6, 4];
  const up = dirOf(180 + lean) as [number, number]; // torso direction (towards the head)
  const side: [number, number] = [-up[1], up[0]]; // perpendicular, pointing forward
  const sideFix: [number, number] = [side[0] < 0 ? -side[0] : side[0], side[0] < 0 ? -side[1] : side[1]];

  const legPos = (hipPt: [number, number], l: [number, number]) => {
    const kd = dirOf(l[0]);
    const kn = add(hipPt, kd, b.thigh);
    const sd = dirOf(l[0] - l[1]);
    const an = add(kn, sd, b.shin);
    return { kn, an };
  };

  let hip: [number, number] = [ox + (p.hx ?? 0), oy - (b.thigh + b.shin) + (p.hy ?? 0)];
  const hipF0 = add(hip, sideFix, 1.5);
  const hipB0 = add(hip, sideFix, -2.5);
  if (p.plant !== false) {
    const f = legPos(hipF0, lF);
    const k = legPos(hipB0, lB);
    const lowest = Math.max(f.an[1], k.an[1]);
    hip = [hip[0], hip[1] + (oy - 2.5 - lowest)];
  }
  const hipF = add(hip, sideFix, 1.5);
  const hipB = add(hip, sideFix, -2.5);
  const F = legPos(hipF, lF);
  const B = legPos(hipB, lB);
  const chest = add(hip, up, b.torso);
  const neck = add(chest, up, 1.5);
  const head = add(neck, up, b.headR + 1.5);
  const shF = add(add(chest, sideFix, b.shoulderW * 0.18), up, -2.2);
  const shB = add(add(chest, sideFix, -b.shoulderW * 0.42), up, -2.2);
  const arm = (sh: [number, number], a: [number, number]) => {
    const ed = dirOf(a[0] + lean * 0.3);
    const el = add(sh, ed, b.upperArm);
    const hd = dirOf(a[0] + a[1] + lean * 0.3);
    const ha = add(el, hd, b.forearm);
    return { el, ha };
  };
  const AF = arm(shF, aF);
  const AB = arm(shB, aB);
  return {
    hip, chest, neck, head, shF, shB, elF: AF.el, elB: AB.el, haF: AF.ha, haB: AB.ha,
    hipF, hipB, knF: F.kn, knB: B.kn, anF: F.an, anB: B.an, up, side: sideFix,
  };
}

const DARKEN = makeDarkener([...Object.values(P), ...[]] as Ramp[]);

export function renderFrame(look: Look, b: Build, p: Pose): PixelCanvas {
  // Draw upright into a scratch canvas, then rotate if needed.
  const pc = new PixelCanvas(FRAME_W, FRAME_H);
  const j = solve(b, p, ORIGIN_X, ORIGIN_Y);

  const L_BACKLEG = 1, L_BACKARM = 2, L_TORSO = 3, L_FRONTLEG = 4, L_HEAD = 5, L_FRONTARM = 6, L_TOP = 7;

  if (look.backpack) drawBackpack(pc, j, b, look.backpack, L_BACKLEG);
  if (look.longHair) drawBackHair(pc, j, b, look.longHair, L_BACKLEG);

  // Back leg + shoe (one shade darker for depth)
  drawLeg(pc, j.hipB, j.knB, j.anB, b, look, L_BACKLEG, 1, p.lB?.[0] ?? -6);
  if (!p.armBFront) drawArm(pc, j.shB, j.elB, j.haB, b, look, L_BACKARM, 1, p.hand, false, p);

  drawTorso(pc, j, b, look, L_TORSO, p);

  drawLeg(pc, j.hipF, j.knF, j.anF, b, look, L_FRONTLEG, 0, p.lF?.[0] ?? 6);
  drawHead(pc, j.head[0], j.head[1], b, look, p.face ?? 'neutral', L_HEAD, (p.lean ?? 0) * 0.15 + (p.headTilt ?? 0));
  if (look.longHair) {
    // a lock of hair falling over the front shoulder
    const a = add(add(j.head, j.side, -2.6), j.up, -b.headR * 0.5);
    const c = add(add(j.shF, j.side, -0.5), j.up, -8);
    capsule(pc, a[0], a[1], c[0], c[1], 1.9, 1.1, look.longHair, L_HEAD, 0);
  }
  if (p.armBFront) drawArm(pc, j.shB, j.elB, j.haB, b, look, L_FRONTARM - 1, 1, p.hand, false, p);
  drawArm(pc, j.shF, j.elF, j.haF, b, look, L_FRONTARM, 0, p.hand, true, p);
  if (p.prop) drawProp(pc, j, p.prop, L_TOP);

  pc.contour(DARKEN);
  let out = pc;
  if (p.rot) {
    out = rotate(pc, p.rot, ORIGIN_X, ORIGIN_Y - (b.thigh + b.shin) * 0.9);
    if (p.plant !== false) out = settle(out);
  }
  out.cleanOrphans();
  if (look.cardboard) {
    out.outline(P.cardboard[2]);
    out.outline(P.cardboard[3]);
  }
  out.outline(OUTLINE);
  return out;
}

function drawLeg(
  pc: PixelCanvas, hip: [number, number], kn: [number, number], an: [number, number], b: Build, look: Look,
  layer: number, shift: number, _hipAngle: number,
): void {
  capsule(pc, hip[0], hip[1], kn[0], kn[1], b.legR + 0.4, b.legR, look.pants, layer, shift);
  capsule(pc, kn[0], kn[1], an[0], an[1], b.legR, b.legR - 0.6, look.pants, layer, shift);
  if (look.pantsPrint && shift === 0) {
    // white "23"-style print on the front thigh
    const qx = Math.round(hip[0] + (kn[0] - hip[0]) * 0.45 + 0.5);
    const qy = Math.round(hip[1] + (kn[1] - hip[1]) * 0.45);
    for (const [dx, dy] of [[-1, 0], [0, 0], [0, 1], [-1, 2], [1, 0], [2, 0], [2, 1], [1, 2], [2, 2]]) pc.set(qx + dx, qy + dy, P.white[1], 255, layer);
  }
  // shoe: forward from the ankle, roughly perpendicular to the shin
  const sx = an[0] - kn[0];
  const sy = an[1] - kn[1];
  const l = Math.hypot(sx, sy) || 1;
  let fx = -sy / l;
  let fy = sx / l;
  if (fx < 0) {
    fx = -fx;
    fy = -fy;
  }
  const toe: [number, number] = [an[0] + fx * 4.5, an[1] + fy * 4.5 + 0.8];
  capsule(pc, an[0] - fx * 0.8, an[1] + 0.8, toe[0], toe[1], 2.3, 1.9, look.shoes, layer, shift);
  if (look.sole !== undefined) {
    const y = Math.round(Math.max(an[1], toe[1]) + 2.2);
    if (Math.abs(fy) < 0.35) pc.hline(Math.round(an[0] - 1.5), Math.round(toe[0] + 1), y, look.sole);
  }
}

function drawArm(
  pc: PixelCanvas, sh: [number, number], el: [number, number], ha: [number, number], b: Build, look: Look,
  layer: number, shift: number, hand: Pose['hand'], front: boolean, p: Pose,
): void {
  const sleeveEnd = look.sleeves === 'short' ? 0.55 : 1.0;
  capsule(pc, sh[0], sh[1], el[0], el[1], b.armR + 0.5, b.armR, (t) => (t < sleeveEnd ? look.shirt : look.skin), layer, shift);
  const fore: Ramp = look.sleeves === 'long' ? look.shirt : look.skin;
  capsule(pc, el[0], el[1], ha[0], ha[1], b.armR, b.armR - 0.3, fore, layer, shift);
  if (look.tattoo && fore === look.skin) inkArm(pc, el, ha, b.armR, look.skin, layer);
  if (look.wrist) {
    const wx = el[0] + (ha[0] - el[0]) * 0.78;
    const wy = el[1] + (ha[1] - el[1]) * 0.78;
    capsule(pc, wx, wy, ha[0], ha[1], b.armR + 0.4, b.armR + 0.4, look.wrist, layer, shift);
  } else if (look.sleeves === 'long') {
    // cuff
    const wx = el[0] + (ha[0] - el[0]) * 0.85;
    const wy = el[1] + (ha[1] - el[1]) * 0.85;
    capsule(pc, wx, wy, ha[0], ha[1], b.armR + 0.2, b.armR + 0.2, look.shirt, layer, Math.min(3, shift + 1));
  }
  const fr = hand === 'open' ? b.fistR - 0.4 : b.fistR;
  capsule(pc, ha[0], ha[1], ha[0] + (ha[0] - el[0]) * 0.12, ha[1] + (ha[1] - el[1]) * 0.12, fr, fr - 0.2, look.skin, layer, shift);
  if (front && p.prop === 'glassesHand') {
    pc.set(Math.round(ha[0]) + 1, Math.round(ha[1]) - 2, OUTLINE, 255, layer);
    pc.set(Math.round(ha[0]) + 2, Math.round(ha[1]) - 2, P.glass[0], 255, layer);
  }
}

function drawTorso(pc: PixelCanvas, j: Joints, b: Build, look: Look, layer: number, p: Pose): void {
  const { hip, chest, up, side } = j;
  const sw = b.shoulderW;
  const hw = b.hipW;
  // 3/4 view: torso extends a bit more behind the spine line than in front.
  const pts: Array<[number, number]> = [
    add(add(hip, side, -hw * 0.55), up, -1),
    add(add(hip, side, hw * 0.45), up, -1),
    add(add(chest, side, sw * 0.38), up, -1.5),
    add(add(chest, side, sw * 0.18), up, 1.2),
    add(add(chest, side, -sw * 0.48), up, 1.0),
    add(add(chest, side, -sw * 0.62), up, -1.5),
  ];
  const shadeFn = (x: number, y: number) => {
    // project onto the side axis -> -1 (back) .. 1 (front)
    const rx = x - hip[0];
    const ry = y - hip[1];
    const s = (rx * side[0] + ry * side[1]) / (sw * 0.55);
    const v = (rx * up[0] + ry * up[1]) / b.torso; // 0 hip .. 1 chest
    return 0.55 - Math.abs(s + 0.25) * 0.9 + (v - 0.5) * 0.5 - (s < -0.55 ? 0.4 : 0);
  };
  quad(pc, pts, look.shirt, layer, shadeFn);
  if (look.belly) {
    const bc = add(add(hip, side, hw * 0.28), up, b.torso * 0.34);
    pc.ellipse(bc[0], bc[1], hw * 0.52 + 1.5, b.torso * 0.3, look.shirt as unknown as number[], layer);
  }

  // waistband / belt
  const beltR = look.belt ?? look.pants;
  for (let i = -hw * 0.55; i <= hw * 0.45; i += 0.5) {
    const q = add(add(hip, side, i), up, 0.2);
    pc.set(q[0], q[1], i > 0 ? beltR[1] : beltR[2], 255, layer);
    const q2 = add(add(hip, side, i), up, 1.2);
    pc.set(q2[0], q2[1], i > 0 ? beltR[2] : beltR[3], 255, layer);
  }
  // collar
  const collar = look.undershirt ?? look.shirt;
  for (let i = -2; i <= 2; i += 0.5) {
    const q = add(add(chest, side, i - 0.5), up, 0.5);
    pc.set(q[0], q[1], collar[3], 255, layer);
  }
  if (look.hoodie) {
    // kangaroo pocket + drawstrings
    const pk0 = add(add(hip, side, -2), up, 3);
    const pk1 = add(add(hip, side, 3.5), up, 3);
    const pk2 = add(add(hip, side, 3), up, 7.5);
    const pk3 = add(add(hip, side, -1.5), up, 7.5);
    pc.line(pk3[0], pk3[1], pk2[0], pk2[1], look.shirt[3], layer);
    pc.line(pk0[0], pk0[1], pk3[0], pk3[1], look.shirt[3], layer);
    pc.line(pk1[0], pk1[1], pk2[0], pk2[1], look.shirt[3], layer);
    const s0 = add(add(chest, side, 1.5), up, -1);
    pc.line(s0[0], s0[1], s0[0] + up[0] * -5, s0[1] + up[1] * -5, P.white[2], layer);
    // hood bunched behind the neck
    if (look.head !== 'hood') {
      const hb = add(add(chest, side, -3), up, 1);
      capsule(pc, hb[0], hb[1], hb[0] + side[0] * 3, hb[1] + side[1] * 3, 2.6, 2.4, look.shirt, layer, 1);
    }
  }
  if (look.lanyard) {
    const a = add(add(chest, side, -1.5), up, 0.5);
    const bb = add(add(chest, side, 1.5), up, -6);
    const c = add(add(chest, side, 3.2), up, 0.2);
    pc.line(a[0], a[1], bb[0], bb[1], P.red[1], layer);
    pc.line(c[0], c[1], bb[0], bb[1], P.red[2], layer);
    pc.rect(Math.round(bb[0]) - 1, Math.round(bb[1]), 3, 3, P.white[1], 255);
    pc.set(Math.round(bb[0]), Math.round(bb[1]) + 1, P.blue[2], 255, layer);
  }
  if (look.rainbowLogo) {
    const q = add(add(chest, side, 1.5), up, -6);
    const cx = Math.round(q[0]);
    const cy = Math.round(q[1]);
    const ring = [0xff5a5a, 0xff9a3c, 0xffd84a, 0x6ccc4a, 0x4ca3f0, 0x8a6af0];
    const perim: Array<[number, number]> = [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-2, -1]];
    perim.forEach(([dx, dy], i) => pc.set(cx + dx, cy + dy, ring[Math.floor((i / perim.length) * ring.length)], 255, layer));
    pc.set(cx, cy, 0xffd84a, 255, layer);
    pc.set(cx - 1, cy, 0x6ccc4a, 255, layer);
    pc.set(cx, cy - 1, 0xff5a5a, 255, layer);
  }
  if (look.pantsPrint) {
    const d = add(add(hip, side, 1.5), up, -0.5);
    pc.set(d[0], d[1], P.white[0], 255, layer);
    pc.set(d[0] + 1, d[1] + 1, P.white[1], 255, layer);
    pc.set(d[0] + 1, d[1] + 2, P.white[2], 255, layer);
  }
  if (look.logo !== undefined) {
    const q = add(add(chest, side, 2.5), up, -4);
    pc.set(q[0], q[1], look.logo, 255, layer);
    pc.set(q[0] + 1, q[1], look.logo, 255, layer);
    pc.set(q[0], q[1] + 1, look.logo, 255, layer);
  }
  void p;
}

function drawBackHair(pc: PixelCanvas, j: Joints, b: Build, hair: Ramp, layer: number): void {
  const r = b.headR;
  const p0 = add(add(j.head, j.side, -r * 0.45), j.up, r * 0.15);
  const p1 = add(add(j.head, j.side, -r * 0.95), j.up, -r * 1.2);
  const p2 = add(add(j.chest, j.side, -b.shoulderW * 0.45), j.up, -9);
  capsule(pc, p0[0], p0[1], p1[0], p1[1], r * 0.95, r * 0.85, hair, layer, 0);
  capsule(pc, p1[0], p1[1], p2[0], p2[1], r * 0.85, 2.6, hair, layer, 0);
  // strand lines
  for (const o of [-1.5, 1.2]) {
    const a = add(p1, j.side, o);
    const c = add(p2, j.side, o * 0.6);
    pc.line(a[0], a[1], c[0], c[1], hair[3], layer);
  }
}

/** Sleeve tattoos: a dense ink pattern over the forearm's skin pixels. */
function inkArm(pc: PixelCanvas, el: [number, number], ha: [number, number], r: number, skin: Ramp, layer: number): void {
  const minX = Math.floor(Math.min(el[0], ha[0]) - r);
  const maxX = Math.ceil(Math.max(el[0], ha[0]) + r);
  const minY = Math.floor(Math.min(el[1], ha[1]) - r);
  const maxY = Math.ceil(Math.max(el[1], ha[1]) + r);
  const dx = ha[0] - el[0];
  const dy = ha[1] - el[1];
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pc.inside(x, y) || pc.layer[y * pc.w + x] !== layer) continue;
      const t = ((x + 0.5 - el[0]) * dx + (y + 0.5 - el[1]) * dy) / len2;
      if (t < 0.05 || t > 0.82) continue;
      const c = pc.get(x, y);
      const idx = skin.indexOf(c);
      if (idx < 0) continue;
      if ((x * 3 + y * 2) % 7 === 0 || (x + y * 3) % 11 < 2) pc.set(x, y, idx < 2 ? 0x5a6676 : 0x3a4250, 255, layer);
    }
  }
}

function drawBackpack(pc: PixelCanvas, j: Joints, b: Build, r: Ramp, layer: number): void {
  const c = add(add(j.hip, j.side, -b.hipW * 0.6 - 1), j.up, b.torso * 0.62);
  capsule(pc, c[0], c[1] - 3, c[0] - 0.5, c[1] + 3, 4.2, 3.8, r, layer, 1);
}

function drawProp(pc: PixelCanvas, j: Joints, prop: NonNullable<Pose['prop']>, layer: number): void {
  if (prop === 'sack') {
    const h = j.haB;
    pc.ellipse(h[0] - 3, h[1] + 4, 6, 7, P.white as unknown as number[], layer);
    pc.ellipse(h[0] - 3, h[1] + 5, 5, 5.5, [P.blue[1], P.blue[1], P.blue[2], P.blue[3]], layer);
    pc.rect(Math.round(h[0] - 6), Math.round(h[1] + 2), 3, 2, P.yellow[1]);
    pc.rect(Math.round(h[0] - 1), Math.round(h[1] + 6), 2, 3, P.red[1]);
  } else if (prop === 'bottle') {
    const h = j.haF;
    capsule(pc, h[0], h[1] - 2, h[0] + 1, h[1] - 8, 1.5, 1.2, P.green, layer, 0);
  } else if (prop === 'bat') {
    const h = j.haF;
    const d = [j.haF[0] - j.elF[0], j.haF[1] - j.elF[1]];
    const l = Math.hypot(d[0], d[1]) || 1;
    capsule(pc, h[0], h[1], h[0] + (d[0] / l) * 14, h[1] + (d[1] / l) * 14, 1.2, 2.2, P.trunk, layer, 0);
  } else if (prop === 'flare') {
    const h = j.haF;
    capsule(pc, h[0], h[1], h[0] + 1, h[1] - 6, 1.2, 1.2, P.red, layer, 0);
    pc.ellipse(h[0] + 1, h[1] - 8, 2, 2, [0xffffff, 0xfff3a0, 0xffd84a, 0xff9a3c], layer);
  }
}

// ---------------------------------------------------------------------------
// Heads

function drawHead(pc: PixelCanvas, cx: number, cy: number, b: Build, look: Look, face: Face, layer: number, tilt: number): void {
  const r = b.headR;
  const sk = look.skin;
  const tmp = new PixelCanvas(24, 24);
  const hx = 12;
  const hy = 12;

  // neck
  capsule(tmp, hx - 0.5, hy + r - 1, hx - 0.8, hy + r + 3, 2.2, 2.4, sk, 1, 1);

  const hoodCol = look.headCloth ?? look.shirt;
  if (look.head === 'hood') {
    tmp.ellipse(hx - 0.8, hy - 0.3, r + 1.8, r + 1.7, hoodCol as unknown as number[], 1);
  }

  // skull + jaw
  tmp.ellipse(hx, hy, r, r * 1.02, sk as unknown as number[], 2);
  tmp.ellipse(hx + 1.6, hy + r * 0.5, r * 0.62, r * 0.45, sk as unknown as number[], 2);
  // nose
  tmp.set(Math.round(hx + r), Math.round(hy + 0.2), sk[1], 255, 2);
  tmp.set(Math.round(hx + r), Math.round(hy + 1.2), sk[2], 255, 2);
  // ear
  tmp.ellipse(hx - 1.2, hy + 0.6, 1.3, 1.8, sk[2], 2);
  tmp.set(Math.round(hx - 1.2), Math.round(hy + 0.6), sk[3], 255, 2);

  const eyeX = Math.round(hx + r * 0.5);
  const eyeY = Math.round(hy - 0.4);

  const hairMask = (x: number, y: number, slope: number, line: number) => {
    const nx = (x + 0.5 - hx) / (r + 0.7);
    const ny = (y + 0.5 - hy) / (r + 0.8);
    if (nx * nx + ny * ny > 1) return false;
    return y + 0.5 < hy - line + (hx - (x + 0.5)) * slope;
  };

  const fillMask = (ramp: Ramp, pred: (x: number, y: number) => boolean) => {
    for (let y = 0; y < tmp.h; y++) {
      for (let x = 0; x < tmp.w; x++) {
        if (!pred(x, y)) continue;
        const nx = (x + 0.5 - hx) / r;
        const ny = (y + 0.5 - hy) / r;
        const lit = -nx * 0.6 - ny * 0.7 + 0.2;
        tmp.set(x, y, rampAt(ramp, lit, 0), 255, 3);
      }
    }
  };

  switch (look.head) {
    case 'hero':
    case 'bald':
    case 'cap':
    case 'beanie':
    case 'spiky': {
      if (look.head !== 'bald') {
        fillMask(look.hair, (x, y) => hairMask(x, y, 0.75, 1.6));
        // sideburn
        tmp.set(Math.round(hx + 0.5), Math.round(hy - 0.5), look.hair[2], 255, 3);
        tmp.set(Math.round(hx + 0.5), Math.round(hy + 0.5), look.hair[3], 255, 3);
      }
      if (look.head === 'hero') {
        // tousled tufts on top
        const tufts: Array<[number, number, number, number]> = [
          [hx - 3, hy - r + 0.5, hx - 4.5, hy - r - 2],
          [hx, hy - r, hx + 0.5, hy - r - 2.6],
          [hx + 2.5, hy - r + 0.8, hx + 4.8, hy - r - 1.2],
        ];
        for (const [ax, ay, bx, by] of tufts) capsule(tmp, ax, ay, bx, by, 1.6, 0.6, look.hair, 3, 0);
        // fringe
        capsule(tmp, hx + 1, hy - r + 1.5, hx + r + 0.2, hy - r + 2.6, 1.3, 0.9, look.hair, 3, 0);
      }
      if (look.head === 'spiky') {
        const spikes: Array<[number, number, number, number]> = [
          [hx - 4, hy - 2, hx - 10, hy - 1],
          [hx - 4, hy - 4, hx - 9.5, hy - 6.5],
          [hx - 2.5, hy - 5, hx - 6, hy - 10.5],
          [hx, hy - 5.5, hx + 0.5, hy - 11.5],
          [hx + 2.5, hy - 5, hx + 5.5, hy - 10],
          [hx + 4, hy - 3.5, hx + 8.5, hy - 5.5],
          [hx + 4, hy - 2, hx + 6.5, hy + 0.5],
          [hx - 4.5, hy, hx - 8.5, hy + 3.5],
        ];
        for (const [ax, ay, bx, by] of spikes) capsule(tmp, ax, ay, bx, by, 2.4, 0.4, look.hair, 3, 0);
      }
      if (look.head === 'cap') {
        fillMask(hoodCol, (x, y) => hairMask(x, y, 0.15, 2.2));
        capsule(tmp, hx + 1, hy - r + 2.6, hx + r + 3.2, hy - r + 3.2, 1.2, 1.0, hoodCol, 3, 1);
      }
      if (look.head === 'beanie') {
        fillMask(hoodCol, (x, y) => hairMask(x, y, 0.2, 1.4) || (y < hy - r + 1.5 && Math.abs(x - hx) < 4));
        tmp.hline(Math.round(hx - r + 1), Math.round(hx + r - 1), Math.round(hy - 1.6), hoodCol[3]);
      }
      break;
    }
    case 'long': {
      // hair cap with a centre part, covering the ears and falling behind
      fillMask(look.longHair ?? look.hair, (x, y) => {
        const nx = (x + 0.5 - hx) / (r + 0.8);
        const ny = (y + 0.5 - hy) / (r + 0.9);
        if (nx * nx + ny * ny > 1) return false;
        return y + 0.5 < hy - 2.6 + (hx - (x + 0.5)) * 0.5 || x + 0.5 < hx - 2.4;
      });
      const hr = look.longHair ?? look.hair;
      for (let x = Math.round(hx - 2); x <= Math.round(hx + 2); x++) tmp.set(x, Math.round(hy - r - 0.2), hr[0], 255, 3);
      // side lock in front of the ear
      for (let y = Math.round(hy - 2); y <= Math.round(hy + 2); y++) tmp.set(Math.round(hx - 1.5), y, hr[2], 255, 3);
      break;
    }
    case 'balaclava':
    case 'helmet': {
      fillMask(hoodCol, (x, y) => {
        const nx = (x + 0.5 - hx) / (r + 0.3);
        const ny = (y + 0.5 - hy) / (r + 0.4);
        const jaw = ((x + 0.5 - hx - 1.6) / (r * 0.62)) ** 2 + ((y + 0.5 - hy - r * 0.5) / (r * 0.45)) ** 2 <= 1;
        return nx * nx + ny * ny <= 1 || jaw;
      });
      // eye slit (skin shows)
      for (let x = eyeX - 3; x <= eyeX + 2; x++) {
        tmp.set(x, eyeY - 1, sk[2], 255, 3);
        tmp.set(x, eyeY, sk[1], 255, 3);
      }
      if (look.head === 'helmet') {
        // motorbike helmet visor
        for (let x = eyeX - 4; x <= eyeX + 3; x++) for (let y = eyeY - 2; y <= eyeY + 1; y++) tmp.set(x, y, y < eyeY ? 0x3a4a6a : 0x1d233d, 255, 3);
        tmp.set(eyeX + 1, eyeY - 2, 0xa8e4f4, 255, 3);
      }
      break;
    }
    case 'hood': {
      fillMask(look.hair, (x, y) => hairMask(x, y, 0.8, 2.6));
      // hood rim over the forehead
      for (let x = Math.round(hx - r); x <= Math.round(hx + r - 0.5); x++) {
        tmp.set(x, Math.round(hy - r + 0.6), hoodCol[2], 255, 3);
        tmp.set(x, Math.round(hy - r + 1.6), hoodCol[3], 255, 3);
      }
      // side of hood covering the ear/back
      fillMask(hoodCol, (x, y) => {
        const nx = (x + 0.5 - hx + 0.8) / (r + 1.8);
        const ny = (y + 0.5 - hy + 0.3) / (r + 1.7);
        return nx * nx + ny * ny <= 1 && x + 0.5 < hx + 0.2;
      });
      break;
    }
  }

  if (look.head !== 'balaclava' && look.head !== 'helmet') {
    // eyebrow
    tmp.set(eyeX - 1, eyeY - 2, look.hair[3], 255, 4);
    tmp.set(eyeX, eyeY - 2, look.hair[3], 255, 4);
    tmp.set(eyeX + 1, eyeY - 2, face === 'grit' || face === 'shout' ? look.hair[3] : look.hair[2], 255, 4);
  }
  if (look.head !== 'helmet') {
    // eye
    if (face === 'hurt') {
      tmp.set(eyeX, eyeY, OUTLINE, 255, 4);
      tmp.set(eyeX - 1, eyeY - 1, OUTLINE, 255, 4);
    } else {
      tmp.set(eyeX - 1, eyeY, P.white[1], 255, 4);
      tmp.set(eyeX, eyeY, OUTLINE, 255, 4);
      tmp.set(eyeX, eyeY + 1, OUTLINE_EYE, 255, 4);
    }
  }
  if (look.glasses) {
    const g = 0x1a1424;
    for (let x = eyeX - 2; x <= eyeX + 2; x++) {
      tmp.set(x, eyeY - 1, g, 255, 4);
      tmp.set(x, eyeY + 2, g, 255, 4);
    }
    tmp.set(eyeX - 2, eyeY, g, 255, 4);
    tmp.set(eyeX - 2, eyeY + 1, g, 255, 4);
    tmp.set(eyeX + 2, eyeY, g, 255, 4);
    tmp.set(eyeX + 2, eyeY + 1, g, 255, 4);
    tmp.set(eyeX + 1, eyeY, P.glass[0], 255, 4);
    tmp.set(eyeX + 1, eyeY + 1, P.glass[2], 255, 4);
    // temple arm back to the ear
    tmp.line(eyeX - 3, eyeY, Math.round(hx - 1), Math.round(hy - 0.2), g, 4);
  }
  if (look.goggles) {
    for (let x = eyeX - 3; x <= eyeX + 2; x++) {
      tmp.set(x, eyeY - 1, 0x2a2a3a, 255, 4);
      tmp.set(x, eyeY, x > eyeX - 1 ? 0xffb050 : 0xe06a24, 255, 4);
    }
  }
  if (look.stubble && look.head !== 'balaclava' && look.head !== 'helmet') {
    for (let x = Math.round(hx); x <= Math.round(hx + r); x++) {
      if ((x & 1) === 0) tmp.set(x, Math.round(hy + r * 0.85), sk[3], 255, 4);
    }
  }
  if (look.beard) {
    // full beard over cheeks + jaw, a little below the chin, and a moustache
    const bd = look.beard;
    for (let y = eyeY + 2; y < tmp.h; y++) {
      for (let x = 0; x < tmp.w; x++) {
        if (!tmp.alpha[y * tmp.w + x] || x + 0.5 < hx - 1.2 || y > hy + r + 3) continue;
        if (tmp.layer[y * tmp.w + x] !== 2) continue; // only over skin
        // keep the cheek + nose bare: jaw line and moustache only
        const jaw = y + 0.5 > hy + r * 0.38;
        const stache = y === eyeY + 3 && x + 0.5 > hx + r * 0.35;
        if (!jaw && !stache) continue;
        const lit = -((x + 0.5 - hx) / r) * 0.5 - ((y + 0.5 - hy) / r) * 0.6 + 0.15;
        tmp.set(x, y, rampAt(bd, lit, (x + y) % 3 === 0 ? 1 : 0), 255, 3);
      }
    }
    // full beard volume: protrudes past the jaw and hangs below the chin
    for (let k = 0; k < 3; k++) {
      for (let x = Math.round(hx - 0.5 + k); x <= Math.round(hx + r + 0.5 - k); x++) tmp.set(x, Math.round(hy + r + k), bd[Math.min(3, 1 + k)], 255, 3);
    }
    for (let y = Math.round(hy + r * 0.45); y < Math.round(hy + r + 1); y++) tmp.set(Math.round(hx + r + 0.6), y, bd[1], 255, 3);
  }
  if (look.head !== 'balaclava' && look.head !== 'helmet') {
    const mx = Math.round(hx + r * 0.62);
    const my = Math.round(hy + r * 0.62);
    if (face === 'shout' || face === 'hurt') {
      tmp.set(mx, my, OUTLINE, 255, 4);
      tmp.set(mx + 1, my, OUTLINE, 255, 4);
      tmp.set(mx, my + 1, P.red[2], 255, 4);
      tmp.set(mx + 1, my + 1, OUTLINE, 255, 4);
    } else if (face === 'grit') {
      tmp.set(mx, my, P.white[1], 255, 4);
      tmp.set(mx + 1, my, P.white[2], 255, 4);
      tmp.set(mx - 1, my, sk[3], 255, 4);
    } else if (face === 'smirk') {
      tmp.set(mx, my, sk[3], 255, 4);
      tmp.set(mx + 1, my - 1, sk[3], 255, 4);
    } else {
      tmp.set(mx, my, sk[3], 255, 4);
      tmp.set(mx + 1, my, sk[3], 255, 4);
    }
  }

  if (look.gaiter) {
    const g = look.gaiter;
    for (let y = eyeY + 2; y < tmp.h; y++) {
      for (let x = 0; x < tmp.w; x++) {
        if (!tmp.alpha[y * tmp.w + x] || x + 0.5 < hx - 2.5) continue;
        if (y > hy + r + 3) continue;
        const lit = -((x + 0.5 - hx) / r) * 0.6 - ((y + 0.5 - hy) / r) * 0.5 + 0.1;
        tmp.set(x, y, rampAt(g, lit, 0), 255, 3);
      }
    }
    tmp.hline(Math.round(hx - 1), Math.round(hx + r), eyeY + 2, g[0]);
  }

  const src = tilt ? rotate(tmp, tilt, hx, hy + r) : tmp;
  // composite
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x;
      if (!src.alpha[i]) continue;
      pc.set(Math.round(cx - hx + x), Math.round(cy - hy + y), src.color[i], 255, layer);
    }
  }
}

const OUTLINE_EYE = 0x3a2a40;

/** Shift a frame so its lowest opaque pixel rests on the ground line. */
function settle(src: PixelCanvas): PixelCanvas {
  let maxY = -1;
  for (let y = src.h - 1; y >= 0 && maxY < 0; y--) {
    for (let x = 0; x < src.w; x++) if (src.alpha[y * src.w + x]) { maxY = y; break; }
  }
  if (maxY < 0) return src;
  let minX = src.w, maxX = 0;
  for (let i = 0; i < src.w * src.h; i++) {
    if (!src.alpha[i]) continue;
    const x = i % src.w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const dx = Math.round(ORIGIN_X - (minX + maxX) / 2);
  const dy = ORIGIN_Y - maxY;
  if (dy === 0 && dx === 0) return src;
  const out = new PixelCanvas(src.w, src.h);
  out.blit(src, dx, dy);
  return out;
}

/** Nearest-neighbour rotation about a pivot. */
export function rotate(src: PixelCanvas, deg: number, px: number, py: number): PixelCanvas {
  const out = new PixelCanvas(src.w, src.h);
  const c = Math.cos(-deg * DEG);
  const s = Math.sin(-deg * DEG);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const dx = x + 0.5 - px;
      const dy = y + 0.5 - py;
      const sx = Math.floor(px + dx * c - dy * s);
      const sy = Math.floor(py + dx * s + dy * c);
      if (!src.inside(sx, sy)) continue;
      const i = sy * src.w + sx;
      if (!src.alpha[i]) continue;
      out.set(x, y, src.color[i], src.alpha[i], src.layer[i]);
    }
  }
  return out;
}
