// Hand-authored arcade bitmap font (uppercase + French accents), baked with a
// dark outline so text reads on any background.

import { OUTLINE } from './palette';
import { PixelCanvas } from './pixel';

// 7 rows per glyph. Accents are drawn in two extra rows above (see ACCENTS).
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['....#', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  Œ: ['.####', '#.#..', '#.#..', '#.###', '#.#..', '#.#..', '.####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  ';': ['..', '.#', '..', '..', '..', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '’': ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '“': ['.#.#', '#.#.', '#.#.', '....', '....', '....', '....'],
  '”': ['.#.#', '.#.#', '#.#.', '....', '....', '....', '....'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '&': ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '«': ['......', '..#..#', '.#..#.', '#..#..', '.#..#.', '..#..#', '......'],
  '»': ['......', '#..#..', '.#..#.', '..#..#', '.#..#.', '#..#..', '......'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '=': ['....', '....', '####', '....', '####', '....', '....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '←': ['.......', '..#....', '.#.....', '#######', '.#.....', '..#....', '.......'],
  '→': ['.......', '....#..', '.....#.', '#######', '.....#.', '....#..', '.......'],
};

// Accented letters: base glyph + accent mark (2 rows, centred).
const ACCENTS: Record<string, [string, string[]]> = {
  À: ['A', ['.#...', '..#..']],
  Â: ['A', ['..#..', '.#.#.']],
  Ä: ['A', ['.#.#.', '.....']],
  Ç: ['C', []],
  É: ['E', ['...#.', '..#..']],
  È: ['E', ['.#...', '..#..']],
  Ê: ['E', ['..#..', '.#.#.']],
  Ë: ['E', ['.#.#.', '.....']],
  Î: ['I', ['.#.', '#.#']],
  Ï: ['I', ['#.#', '...']],
  Ô: ['O', ['..#..', '.#.#.']],
  Ö: ['O', ['.#.#.', '.....']],
  Ù: ['U', ['.#...', '..#..']],
  Û: ['U', ['..#..', '.#.#.']],
  Ü: ['U', ['.#.#.', '.....']],
};

export const GLYPH_H = 7;
const TOP = 2; // accent rows
const CELL_H = GLYPH_H + TOP + 3; // + cedilla row + outline

export interface Glyph {
  ch: string;
  rows: string[]; // TOP + 7 + 1 rows
  w: number;
}

function buildGlyphs(): Glyph[] {
  const out: Glyph[] = [];
  const pad = (rows: string[], w: number) => rows.map((r) => r.padEnd(w, '.'));
  for (const [ch, rows] of Object.entries(G)) {
    const w = rows[0].length;
    out.push({ ch, rows: [...pad(['', ''], w), ...rows, '.'.repeat(w)], w });
  }
  for (const [ch, [base, acc]] of Object.entries(ACCENTS)) {
    const rows = G[base];
    const w = rows[0].length;
    const top = acc.length ? acc.map((r) => r.slice(0, w).padEnd(w, '.')) : ['.'.repeat(w), '.'.repeat(w)];
    const ced = ch === 'Ç' ? '..#..'.slice(0, w) : '.'.repeat(w);
    out.push({ ch, rows: [...top, ...rows, ced], w });
  }
  return out;
}

export const GLYPHS = buildGlyphs();
export const FONT_CHARS = GLYPHS.map((g) => g.ch).join('');

export interface FontSheet {
  canvas: PixelCanvas;
  cells: Array<{ ch: string; x: number; y: number; w: number; h: number; adv: number }>;
  lineHeight: number;
}

/** Bake the font into a sheet: fill colour + 1px outline, one glyph per cell. */
export function bakeFont(fill: number, shade: number, outline = OUTLINE): FontSheet {
  const cellW = 9;
  const perRow = 16;
  const rows = Math.ceil(GLYPHS.length / perRow);
  const pc = new PixelCanvas(perRow * cellW, rows * CELL_H);
  const cells: FontSheet['cells'] = [];
  GLYPHS.forEach((g, i) => {
    const cx = (i % perRow) * cellW;
    const cy = Math.floor(i / perRow) * CELL_H;
    const tmp = new PixelCanvas(g.w + 2, CELL_H);
    g.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '#') continue;
        // lower rows of the glyph body get the shade colour for a 2-tone arcade look
        const c = y >= TOP + 4 && y < TOP + GLYPH_H ? shade : fill;
        tmp.set(x + 1, y + 1, c);
      }
    });
    tmp.outline(outline);
    pc.blit(tmp, cx, cy);
    cells.push({ ch: g.ch, x: cx, y: cy, w: g.w + 2, h: CELL_H, adv: g.w + 1 });
  });
  return { canvas: pc, cells, lineHeight: CELL_H };
}

/** Measure a string in font pixels. */
export function measure(text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS.find((x) => x.ch === ch);
    w += g ? g.w + 1 : 4;
  }
  return w + 1;
}

/**
 * Big decorative text (title logo, "STAGE CLEAR"): glyphs scaled up with a
 * vertical gradient fill, a thick outline and a drop shadow.
 */
export function bigText(text: string, scale: number, gradient: number[], outline = OUTLINE, shadow = 0x3a1430): PixelCanvas {
  const glyphs = [...text.toUpperCase()].map((ch) => GLYPHS.find((g) => g.ch === ch) ?? GLYPHS.find((g) => g.ch === ' ')!);
  const w = glyphs.reduce((a, g) => a + (g.w + 1) * scale, 0) + 8;
  const h = (TOP + GLYPH_H + 1) * scale + 10;
  const pc = new PixelCanvas(w, h);
  let x = 4;
  for (const g of glyphs) {
    g.rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const py = ry * scale + sy;
            const t = Math.max(0, Math.min(1, (py - TOP * scale) / (GLYPH_H * scale)));
            const gi = Math.min(gradient.length - 1, Math.floor(t * gradient.length));
            pc.set(x + rx * scale + sx, 3 + py, gradient[gi]);
          }
        }
      }
    });
    x += (g.w + 1) * scale;
  }
  // highlight line on the top edge of each stroke
  const hl: number[] = [];
  for (let y = 1; y < h; y++) for (let xx = 0; xx < w; xx++) if (pc.has(xx, y) && !pc.has(xx, y - 1)) hl.push(y * w + xx);
  for (const i of hl) pc.color[i] = 0xffffff;
  const thick = Math.max(1, Math.round(scale / 2));
  for (let i = 0; i < thick; i++) pc.outline(outline);
  // drop shadow
  const out = new PixelCanvas(w + 3, h + 3);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (pc.has(xx, y)) out.set(xx + 3, y + 3, shadow);
  out.blit(pc, 0, 0);
  return out;
}

/** Draw plain (un-outlined) text straight into a pixel canvas, e.g. shop signs. */
export function drawText(pc: PixelCanvas, text: string, x: number, y: number, color: number, shade?: number, scale = 1): number {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS.find((q) => q.ch === ch);
    if (!g) {
      cx += 4 * scale;
      continue;
    }
    g.rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] !== '#') continue;
        const c = shade !== undefined && ry >= TOP + 4 ? shade : color;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) pc.set(cx + rx * scale + sx, y + (ry - TOP) * scale + sy, c);
      }
    });
    cx += (g.w + 1) * scale;
  }
  return cx - x;
}
