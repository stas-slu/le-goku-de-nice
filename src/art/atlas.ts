// Packs generated pixel canvases into sheets the renderer can register.

import type { CharDef } from './characters';
import type { SpriteSet } from './fx';
import { FRAME_H, FRAME_W, renderFrame } from './rig';
import type { PixelCanvas } from './pixel';

export interface SheetFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** When trimmed: where the cut-out sits inside the original frame. */
  trim?: { sourceW: number; sourceH: number; x: number; y: number };
}

export interface Sheet {
  key: string;
  canvas: HTMLCanvasElement;
  frames: SheetFrame[];
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

function bounds(pc: PixelCanvas): { x: number; y: number; w: number; h: number } {
  let x0 = pc.w, y0 = pc.h, x1 = -1, y1 = -1;
  for (let y = 0; y < pc.h; y++) {
    for (let x = 0; x < pc.w; x++) {
      if (!pc.alpha[y * pc.w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * One texture per character, frames named `${anim}_${i}`. Frames are trimmed
 * to their opaque pixels and shelf-packed, which keeps GPU uploads small.
 */
export function packChar(def: CharDef): Sheet {
  const items: Array<{ name: string; pc: PixelCanvas; b: ReturnType<typeof bounds> }> = [];
  for (const [name, poses] of Object.entries(def.anims)) {
    poses.forEach((pose, i) => {
      const pc = renderFrame(def.look, def.build, pose);
      items.push({ name: `${name}_${i}`, pc, b: bounds(pc) });
    });
  }
  const maxW = 1024;
  const sorted = [...items].sort((a, b) => b.b.h - a.b.h);
  let x = 0, y = 0, rowH = 0;
  const placed = new Map<string, { x: number; y: number }>();
  for (const it of sorted) {
    if (x + it.b.w > maxW) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    placed.set(it.name, { x, y });
    x += it.b.w + 1;
    rowH = Math.max(rowH, it.b.h);
  }
  const [cv, ctx] = canvasOf(maxW, y + rowH);
  const frames: SheetFrame[] = [];
  for (const it of items) {
    const at = placed.get(it.name)!;
    const img = ctx.createImageData(it.b.w, it.b.h);
    for (let yy = 0; yy < it.b.h; yy++) {
      for (let xx = 0; xx < it.b.w; xx++) {
        const i = (it.b.y + yy) * it.pc.w + it.b.x + xx;
        const o = (yy * it.b.w + xx) * 4;
        const c = it.pc.color[i];
        img.data[o] = (c >> 16) & 255;
        img.data[o + 1] = (c >> 8) & 255;
        img.data[o + 2] = c & 255;
        img.data[o + 3] = it.pc.alpha[i];
      }
    }
    ctx.putImageData(img, at.x, at.y);
    frames.push({ name: it.name, x: at.x, y: at.y, w: it.b.w, h: it.b.h, trim: { sourceW: FRAME_W, sourceH: FRAME_H, x: it.b.x, y: it.b.y } });
  }
  return { key: def.key, canvas: cv, frames };
}

/** One texture per effect set, frames named 0..n-1. */
export function packSet(set: SpriteSet): Sheet {
  const w = Math.max(...set.frames.map((f) => f.w));
  const h = Math.max(...set.frames.map((f) => f.h));
  const [cv, ctx] = canvasOf(w * set.frames.length, h);
  const frames: SheetFrame[] = set.frames.map((pc, i) => {
    pc.drawTo(ctx, i * w, 0);
    return { name: String(i), x: i * w, y: 0, w: pc.w, h: pc.h };
  });
  return { key: set.key, canvas: cv, frames };
}

export function single(key: string, pc: PixelCanvas): Sheet {
  return { key, canvas: pc.toCanvas(), frames: [] };
}
