// Effect + prop sprites, drawn procedurally.

import { OUTLINE, P, SKIN, mix } from './palette';
import { PixelCanvas, bayer, rng } from './pixel';

export interface SpriteSet {
  key: string;
  frames: PixelCanvas[];
}

function sparkSmall(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(20, 20);
    const c = 10;
    const len = [4, 8, 9, 7][f];
    const cols = [0xffffff, 0xfff3a0, 0xffd84a, 0xff9a3c];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + (f % 2) * 0.39;
      const l = k % 2 ? len * 0.6 : len;
      for (let s = f === 3 ? 4 : 0; s < l; s++) pc.set(c + Math.cos(a) * s, c + Math.sin(a) * s, cols[Math.min(3, Math.floor(s / 3) + (f > 1 ? 1 : 0))]);
    }
    if (f < 2) pc.ellipse(c, c, 2.5 - f * 0.5, 2.5 - f * 0.5, 0xffffff);
    frames.push(pc);
  }
  return { key: 'spark_s', frames };
}

function sparkLarge(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 5; f++) {
    const pc = new PixelCanvas(40, 40);
    const c = 20;
    const R = [5, 10, 14, 16, 17][f];
    // ring
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        const th = f < 3 ? 2.2 : 1.2;
        if (Math.abs(d - R) < th && (f < 4 || (x + y) % 2 === 0)) pc.set(x, y, f < 2 ? 0xffffff : f < 4 ? 0xffd84a : 0xff6a24);
      }
    }
    // rays
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const l0 = f < 2 ? 0 : R - 6;
      for (let s = l0; s < R + 4; s++) {
        pc.set(c + Math.cos(a) * s, c + Math.sin(a) * s, 0xffffff);
        pc.set(c + Math.cos(a) * s + 1, c + Math.sin(a) * s, 0xfff3a0);
      }
    }
    if (f < 2) pc.ellipse(c, c, 6 - f * 2, 6 - f * 2, 0xffffff);
    frames.push(pc);
  }
  return { key: 'spark_l', frames };
}

function dust(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 5; f++) {
    const pc = new PixelCanvas(40, 16);
    const spread = 4 + f * 4;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const cx = 20 + side * (spread - k * 2);
        const cy = 12 - k * 2 - f * 0.5;
        const r = 3 + k - f * 0.4;
        if (r <= 0.6) continue;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 40; x++) {
            const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.3) / r;
            if (d < 1 && (f < 3 || bayer(x, y) > 0.4)) pc.set(x, y, d < 0.5 ? 0xe8e0d0 : 0xc4b8a8);
          }
        }
      }
    }
    frames.push(pc);
  }
  return { key: 'dust', frames };
}

function smoke(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(24, 24);
    const r = 5 + f * 2.2;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 12) / r;
        const dens = (1 - d) * (1 - f * 0.18);
        if (dens > bayer(x, y) * 0.9) pc.set(x, y, d < 0.5 ? 0x6a5a70 : 0x4a3e58);
      }
    }
    frames.push(pc);
  }
  return { key: 'smoke', frames };
}

function flame(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(16, 22);
    const r = rng(f * 31 + 3);
    for (let y = 0; y < 22; y++) {
      const t = 1 - y / 22;
      const half = Math.sin(t * Math.PI * 0.95) * 6 * (0.6 + 0.4 * Math.sin(y * 0.6 + f * 1.7)) * (y > 4 ? 1 : 0.4);
      const cx = 8 + Math.sin(y * 0.4 + f) * 1.5;
      for (let x = 0; x < 16; x++) {
        const d = Math.abs(x + 0.5 - cx) / Math.max(0.5, half);
        if (d > 1) continue;
        const heat = (1 - d) * 0.6 + t * 0.6 + r() * 0.1;
        pc.set(x, y, heat > 1.0 ? 0xfff6c0 : heat > 0.75 ? 0xffd84a : heat > 0.5 ? 0xff9a3c : 0xe0443c);
      }
    }
    frames.push(pc);
  }
  return { key: 'flame', frames };
}

function beam(): SpriteSet[] {
  const body: PixelCanvas[] = [];
  const head: PixelCanvas[] = [];
  for (let f = 0; f < 3; f++) {
    const pc = new PixelCanvas(16, 36);
    for (let y = 0; y < 36; y++) {
      const d = Math.abs(y + 0.5 - 18) / (14 + Math.sin(f * 2.1) * 1.5);
      for (let x = 0; x < 16; x++) {
        const wob = Math.sin((x + f * 5) * 0.8) * 0.08;
        const dd = d + wob;
        if (dd > 1) continue;
        pc.set(x, y, dd < 0.3 ? 0xffffff : dd < 0.55 ? 0xc8fff8 : dd < 0.8 ? 0x6ef0f0 : 0x2fb8d0);
      }
    }
    body.push(pc);
    const hp = new PixelCanvas(40, 48);
    const R = 17 + f;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 40; x++) {
        const d = Math.hypot(x + 0.5 - 18, y + 0.5 - 24) / R;
        if (d > 1) continue;
        hp.set(x, y, d < 0.35 ? 0xffffff : d < 0.6 ? 0xc8fff8 : d < 0.85 ? 0x6ef0f0 : 0x2fb8d0);
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + f;
      hp.set(18 + Math.cos(a) * (R + 2), 24 + Math.sin(a) * (R + 2), 0xffffff);
    }
    head.push(hp);
  }
  return [{ key: 'beam', frames: body }, { key: 'beamhead', frames: head }];
}

function chargeOrb(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(20, 20);
    const R = 4 + (f % 2) * 1.5 + f * 0.8;
    pc.ellipse(10, 10, R, R, 0x6ef0f0);
    pc.ellipse(10, 10, R * 0.6, R * 0.6, 0xffffff);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + f * 0.7;
      pc.set(10 + Math.cos(a) * (R + 3), 10 + Math.sin(a) * (R + 3), 0xc8fff8);
    }
    frames.push(pc);
  }
  return { key: 'orb', frames };
}

function single(key: string, w: number, h: number, draw: (pc: PixelCanvas) => void, outline = true): SpriteSet {
  const pc = new PixelCanvas(w, h);
  draw(pc);
  if (outline) pc.outline(OUTLINE);
  return { key, frames: [pc] };
}

function scooterSmall(): SpriteSet {
  return single('scooter_s', 30, 26, (pc) => {
    // deck, stem, handlebar, wheels (electric trottinette)
    pc.rect(6, 20, 16, 2, P.black[1]);
    pc.hline(6, 21, 20, P.charcoal[0]);
    pc.line(21, 20, 24, 3, P.charcoal[1]);
    pc.line(22, 20, 25, 3, P.black[2]);
    pc.rect(21, 2, 6, 2, P.black[1]);
    pc.ellipse(6, 22, 3, 3, [P.charcoal[0], P.black[1], P.black[2], P.black[3]]);
    pc.ellipse(23, 22, 3, 3, [P.charcoal[0], P.black[1], P.black[2], P.black[3]]);
    pc.set(6, 22, P.grey[1]);
    pc.set(23, 22, P.grey[1]);
    pc.set(25, 5, 0xfff3a0);
  });
}

function scooterBig(): SpriteSet {
  return single('scooter_b', 56, 34, (pc) => {
    // maxi-scooter: fairing, seat, windscreen, fat wheels
    for (let y = 12; y < 28; y++) {
      for (let x = 6; x < 50; x++) {
        const body = (y > 20 && x > 8 && x < 46) || (y > 12 && x > 34 && x < 48) || (y > 16 && x > 8 && x < 22);
        if (!body) continue;
        const t = (y - 12) / 16;
        pc.set(x, y, t < 0.2 ? 0x8a94a8 : t < 0.55 ? 0x4a5468 : 0x2a3040);
      }
    }
    pc.rect(12, 14, 18, 4, P.black[2]);
    pc.hline(12, 29, 14, P.black[0]);
    pc.line(44, 12, 50, 2, 0x8fd3ff);
    pc.line(45, 12, 51, 2, 0x4ca3f0);
    pc.ellipse(13, 28, 5.5, 5.5, [P.charcoal[0], P.black[1], P.black[2], P.black[3]]);
    pc.ellipse(43, 28, 5.5, 5.5, [P.charcoal[0], P.black[1], P.black[2], P.black[3]]);
    pc.ellipse(13, 28, 2, 2, P.steel[1]);
    pc.ellipse(43, 28, 2, 2, P.steel[1]);
    pc.rect(48, 18, 3, 2, 0xfff3a0);
    pc.rect(6, 20, 2, 2, 0xe0443c);
  });
}

/** Expanding shock ring for finishers. */
function ring(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 6; f++) {
    const pc = new PixelCanvas(64, 40);
    const R = 6 + f * 5;
    const th = f < 2 ? 3 : f < 4 ? 2 : 1;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 64; x++) {
        // squashed ellipse: reads as a ground-plane shockwave in a side view
        const d = Math.hypot(x + 0.5 - 32, (y + 0.5 - 20) * 1.6);
        if (Math.abs(d - R) < th && (f < 4 || (x + y) % 2 === 0)) pc.set(x, y, f < 2 ? 0xffffff : f < 4 ? 0xfff3a0 : 0xffb040);
      }
    }
    frames.push(pc);
  }
  return { key: 'ring', frames };
}

/** Speed streaks flying off a heavy hit (drawn pointing right; flipped for left). */
function streak(): SpriteSet {
  const frames: PixelCanvas[] = [];
  for (let f = 0; f < 4; f++) {
    const pc = new PixelCanvas(44, 24);
    const r = rng(77 + f);
    for (let k = 0; k < 7; k++) {
      const y = 2 + Math.floor(r() * 20);
      const x0 = 2 + f * 6 + Math.floor(r() * 6);
      const len = 8 + Math.floor(r() * 14) - f * 2;
      for (let x = x0; x < Math.min(44, x0 + len); x++) pc.set(x, y, x < x0 + 3 ? 0xffffff : f < 2 ? 0xfff3a0 : 0xffd84a);
    }
    frames.push(pc);
  }
  return { key: 'streak', frames };
}

export function allFx(): SpriteSet[] {
  const sets: SpriteSet[] = [sparkSmall(), sparkLarge(), dust(), smoke(), flame(), ...beam(), chargeOrb(), scooterSmall(), scooterBig(), ring(), streak()];
  sets.push(single('shadow', 28, 7, (pc) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 28; x++) {
      const d = Math.hypot((x + 0.5 - 14) / 14, (y + 0.5 - 3.5) / 3.5);
      if (d < 1) pc.set(x, y, 0x140c1c, d < 0.7 ? 150 : 100);
    }
  }, false));
  sets.push(single('glasses', 11, 6, (pc) => {
    pc.rect(1, 1, 4, 3, OUTLINE);
    pc.rect(6, 1, 4, 3, OUTLINE);
    pc.rect(2, 2, 2, 1, P.glass[0]);
    pc.rect(7, 2, 2, 1, P.glass[1]);
    pc.hline(5, 6, 1, OUTLINE);
    pc.set(0, 1, OUTLINE);
    pc.set(10, 1, OUTLINE);
  }, false));
  sets.push({
    key: 'bottle',
    frames: [0, 45, 90, 135].map((deg) => {
      const pc = new PixelCanvas(12, 12);
      const a = (deg * Math.PI) / 180;
      for (let s = -4; s <= 4; s++) {
        const x = 6 + Math.sin(a) * s;
        const y = 6 - Math.cos(a) * s;
        pc.set(x, y, s > 2 ? P.green[0] : P.green[2]);
        pc.set(x + Math.cos(a), y + Math.sin(a), s > 2 ? P.green[1] : P.green[3]);
      }
      pc.outline(OUTLINE);
      return pc;
    }),
  });
  sets.push(single('shard', 3, 3, (pc) => {
    pc.set(1, 0, 0xffffff);
    pc.set(0, 1, 0xa8e4f4);
    pc.set(1, 1, 0xe8fbff);
    pc.set(2, 2, 0x6cb4d4);
  }, false));
  sets.push(single('warn', 14, 18, (pc) => {
    pc.ellipse(7, 9, 6.5, 8.5, [0xff6b5a, 0xe0443c, 0xb02a32, 0x7a1a2a]);
    pc.rect(6, 3, 3, 8, 0xffffff);
    pc.rect(6, 13, 3, 3, 0xffffff);
  }));
  sets.push(single('socca', 16, 9, (pc) => {
    pc.ellipse(8, 5, 7, 3.5, [0xfff6b0, 0xffd24a, 0xd89a28, 0x9a5e1c]);
    for (let i = 0; i < 6; i++) pc.set(3 + i * 2, 4 + (i % 2), 0x7c4a1c);
    pc.hline(1, 14, 8, P.white[1]);
  }));
  sets.push(single('panbagnat', 16, 11, (pc) => {
    pc.ellipse(8, 3.5, 7, 3.5, [0xffe0a0, 0xe8b060, 0xc48840, 0x8a5a28]);
    pc.hline(1, 14, 6, 0x6ccc4a);
    pc.hline(2, 13, 7, 0xe0443c);
    pc.ellipse(8, 8.5, 7, 2, [0xe8b060, 0xe8b060, 0xc48840, 0x8a5a28]);
  }));
  sets.push(single('bin', 16, 20, (pc) => {
    for (let y = 4; y < 20; y++) for (let x = 1; x < 15; x++) pc.set(x, y, x < 4 ? P.olive[1] : x > 11 ? P.olive[3] : (y % 4 === 0 ? P.olive[3] : P.olive[2]));
    pc.rect(0, 2, 16, 3, P.olive[1]);
    pc.hline(0, 15, 2, P.olive[0]);
  }));
  sets.push(single('figure', 12, 16, (pc) => {
    // kneeling figure for "Conversation à Nice" (tinted at runtime)
    pc.ellipse(7, 3, 2.5, 3, 0xffffff);
    pc.rect(5, 6, 5, 6, 0xffffff);
    pc.rect(3, 11, 7, 3, 0xffffff);
    pc.rect(2, 13, 3, 3, 0xffffff);
    pc.line(9, 7, 11, 11, 0xffffff);
  }, false));
  sets.push(single('pixel', 1, 1, (pc) => pc.set(0, 0, 0xffffff), false));
  // radial halo for flares (additive)
  sets.push(single('halo', 32, 32, (pc) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16;
      if (d < 1) pc.set(x, y, 0xffffff, Math.round(200 * (1 - d) * (1 - d)));
    }
  }, false));
  // soft light falloff (used with additive blending for police lights / glows)
  sets.push(single('glow', 64, 1, (pc) => {
    for (let x = 0; x < 64; x++) pc.set(x, 0, 0xffffff, Math.round(255 * Math.pow(1 - x / 64, 2)));
  }, false));
  sets.push(heroPortrait());
  return sets;
}

/** HUD portrait: long salt-and-pepper hair, grey beard, glasses. */
function heroPortrait(): SpriteSet {
  const pc = new PixelCanvas(22, 22);
  const sk = SKIN[0];
  const hair = P.hairSalt;
  const bd = P.beard;
  pc.rect(0, 0, 22, 22, 0x2a1a33);
  pc.rect(1, 1, 20, 20, 0x5a2560);
  for (let y = 1; y < 21; y++) for (let x = 1; x < 21; x++) if ((x + y) % 4 === 0) pc.set(x, y, 0x6a2a6a);
  // hair falling on both sides
  for (let y = 2; y < 21; y++) for (let x = 2; x < 20; x++) {
    const top = Math.hypot((x - 11) / 8, (y - 9) / 7.5) < 1 && y < 8;
    const side = (x < 6 || x > 15) && y >= 5;
    if (top || side) pc.set(x, y, (x + y) % 3 === 0 ? hair[2] : y < 5 ? hair[0] : hair[1]);
  }
  pc.ellipse(11, 11, 5.2, 6.5, [sk[0], sk[1], sk[2], sk[3]]);
  // centre part
  pc.vline(11, 2, 5, hair[3]);
  // beard
  for (let y = 13; y < 21; y++) for (let x = 6; x < 17; x++) {
    const w = y < 18 ? 5.5 : 5.5 - (y - 17) * 1.2;
    if (Math.abs(x + 0.5 - 11.5) < w) pc.set(x, y, (x + y) % 3 === 0 ? bd[2] : bd[1]);
  }
  pc.hline(9, 13, 15, bd[3]);
  pc.hline(10, 12, 16, 0x5a2a2a);
  // glasses
  pc.rect(6, 9, 4, 3, OUTLINE);
  pc.rect(12, 9, 4, 3, OUTLINE);
  pc.hline(10, 11, 9, OUTLINE);
  pc.rect(7, 10, 2, 1, mix(P.glass[1], 0xffffff, 0.3));
  pc.rect(13, 10, 2, 1, P.glass[1]);
  pc.rect(0, 0, 22, 1, 0xffd84a);
  pc.rect(0, 21, 22, 1, 0x7a1a2a);
  return { key: 'portrait', frames: [pc] };
}
