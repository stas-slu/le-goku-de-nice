// A tiny software framebuffer for authoring pixel art in code.
// Pixels are 0xRRGGBB with a separate alpha plane (0 = empty).

import { OUTLINE } from './palette';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function bayer(x: number, y: number): number {
  return (BAYER4[y & 3][x & 3] + 0.5) / 16;
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly color: Uint32Array;
  readonly alpha: Uint8Array;
  /** Layer id per pixel; used for interior contour lines between parts. */
  readonly layer: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.color = new Uint32Array(w * h);
    this.alpha = new Uint8Array(w * h);
    this.layer = new Uint8Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: number, a = 255, layer = 0): void {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.color[i] = c;
    this.alpha[i] = a;
    this.layer[i] = layer;
  }

  get(x: number, y: number): number {
    return this.color[y * this.w + x];
  }

  has(x: number, y: number): boolean {
    return this.inside(x, y) && this.alpha[y * this.w + x] > 0;
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }

  hline(x0: number, x1: number, y: number, c: number): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: number): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: number, layer = 0): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, 255, layer);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Filled ellipse with optional ramp shading (light from top-left). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number | readonly number[], layer = 0): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (typeof c === 'number') this.set(x, y, c, 255, layer);
        else {
          const lit = -nx * 0.55 - ny * 0.75 + (1 - d) * 0.35;
          this.set(x, y, shadeIndex(c, lit), 255, layer);
        }
      }
    }
  }

  /** Vertical gradient through a list of colors, ordered-dithered between bands. */
  gradient(x: number, y: number, w: number, h: number, colors: readonly number[]): void {
    const n = colors.length - 1;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * n;
      const i0 = Math.min(n, Math.floor(t));
      const f = t - i0;
      for (let i = 0; i < w; i++) {
        const c = f > bayer(x + i, y + j) && i0 < n ? colors[i0 + 1] : colors[i0];
        this.set(x + i, y + j, c);
      }
    }
  }

  /** Copy another canvas onto this one (alpha-tested). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = y * src.w + x;
        if (!src.alpha[i]) continue;
        const tx = flipX ? dx + src.w - 1 - x : dx + x;
        this.set(tx, dy + y, src.color[i], src.alpha[i], src.layer[i]);
      }
    }
  }

  /** Outer 1px outline around all opaque pixels. */
  outline(c = OUTLINE): void {
    const { w, h, alpha } = this;
    const mark: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (alpha[y * w + x]) continue;
        if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) mark.push(y * w + x);
      }
    }
    for (const i of mark) {
      this.color[i] = c;
      this.alpha[i] = 255;
      this.layer[i] = 0;
    }
  }

  /**
   * Interior contour: where a part sits in front of another part, darken the
   * front part's edge pixel so limbs read clearly against the body.
   */
  contour(darken: (c: number) => number): void {
    const { w, h, alpha, layer } = this;
    const out: Array<[number, number]> = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!alpha[i] || layer[i] < 2) continue;
        const L = layer[i];
        const behind = (xx: number, yy: number) =>
          this.has(xx, yy) && layer[yy * w + xx] > 0 && layer[yy * w + xx] < L - 0;
        if (behind(x - 1, y) || behind(x + 1, y) || behind(x, y - 1) || behind(x, y + 1)) {
          out.push([i, darken(this.color[i])]);
        }
      }
    }
    for (const [i, c] of out) this.color[i] = c;
  }

  /** Remove isolated single pixels (pixel-art "orphan" cleanup). */
  cleanOrphans(): void {
    const { w, h, alpha } = this;
    const kill: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!alpha[y * w + x]) continue;
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && this.has(x + i, y + j)) n++;
        if (n === 0) kill.push(y * w + x);
      }
    }
    for (const i of kill) alpha[i] = 0;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    this.drawTo(cv.getContext('2d')!, 0, 0);
    return cv;
  }

  drawTo(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.w * this.h; i++) {
      const c = this.color[i];
      d[i * 4] = (c >> 16) & 255;
      d[i * 4 + 1] = (c >> 8) & 255;
      d[i * 4 + 2] = c & 255;
      d[i * 4 + 3] = this.alpha[i];
    }
    ctx.putImageData(img, dx, dy);
  }
}

/** Pick a ramp color from a lighting value roughly in [-1, 1]. */
export function shadeIndex(r: readonly number[], lit: number): number {
  if (lit > 0.62) return r[0];
  if (lit > 0.12) return r[1];
  if (lit > -0.42) return r[2];
  return r[3];
}

/** Find which ramp a color belongs to and return its darker neighbour. */
export function makeDarkener(ramps: readonly (readonly number[])[]): (c: number) => number {
  const map = new Map<number, number>();
  for (const r of ramps) {
    for (let i = 0; i < r.length; i++) map.set(r[i], r[Math.min(r.length - 1, i + 2)]);
  }
  return (c) => map.get(c) ?? c;
}

export { rng } from '../game/rng';
