// Character looks + animation poses. Everything here is data for the rig.

import { P, SKIN, Ramp } from './palette';
import { BUILD_BIG, BUILD_HEAVY, BUILD_HERO, BUILD_SLIM, Build, Look, Pose } from './rig';
import { rng } from './pixel';
import type { EnemyKind } from '../game/defs';

export interface CharDef {
  key: string;
  look: Look;
  build: Build;
  anims: Record<string, Pose[]>;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const TAU = Math.PI * 2;

const GUARD: Pose = { lean: 6, aF: [38, 100], aB: [22, 118], lF: [16, 12], lB: [-14, 8], hand: 'fist' };

function withP(base: Pose, o: Pose): Pose {
  return { ...base, ...o };
}

// ---------------------------------------------------------------------------
// Shared humanoid animation set

function baseAnims(style: 'hero' | 'thug' | 'heavy'): Record<string, Pose[]> {
  const g = style === 'thug' ? withP(GUARD, { lean: 10, aF: [30, 95], aB: [10, 110] }) : style === 'heavy' ? withP(GUARD, { lean: 8, aF: [30, 80], aB: [12, 95], lF: [20, 14], lB: [-18, 10] }) : GUARD;
  const A: Record<string, Pose[]> = {};

  A.idle = range(4).map((i) => {
    const s = Math.sin((i / 4) * TAU);
    return withP(g, { lean: (g.lean ?? 0) + s * 1.2, lF: [g.lF![0], g.lF![1] + 3 + s * 3], lB: [g.lB![0], g.lB![1] + 2 + s * 2], aF: [g.aF![0] + s * 3, g.aF![1]], aB: [g.aB![0] - s * 2, g.aB![1]] });
  });

  A.walk = range(8).map((i) => {
    const ph = (i / 8) * TAU;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    return withP(g, {
      lF: [s * 24, 8 + Math.max(0, c) * 26],
      lB: [-s * 24, 8 + Math.max(0, -c) * 26],
      aF: [g.aF![0] - s * 6, g.aF![1]],
      aB: [g.aB![0] + s * 6, g.aB![1]],
      lean: (g.lean ?? 0) + 2,
    });
  });

  A.run = range(6).map((i) => {
    const ph = (i / 6) * TAU;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    return {
      lean: 20,
      lF: [s * 40, 14 + Math.max(0, c) * 60],
      lB: [-s * 40, 14 + Math.max(0, -c) * 60],
      aF: [-s * 45 + 10, 85],
      aB: [s * 45 + 10, 85],
      hand: 'fist',
      face: 'grit',
    };
  });

  A.jab = [
    withP(g, { aF: [32, 110], lean: 4 }),
    withP(g, { aF: [90, 2], lean: 12, lF: [24, 10], face: 'grit' }),
    withP(g, { aF: [72, 40], lean: 9 }),
  ];
  A.cross = [
    withP(g, { aB: [10, 120], lean: 2, aF: [40, 110] }),
    withP(g, { aB: [92, 0], armBFront: true, aF: [20, 120], lean: 18, lF: [28, 14], lB: [-20, 4], face: 'grit' }),
    withP(g, { aB: [70, 50], armBFront: true, lean: 12 }),
  ];
  A.kick = [
    withP(g, { lF: [70, 105], lean: -2, aF: [40, 100] }),
    withP(g, { lF: [94, 2], lB: [-10, 4], lean: -16, aF: [-10, 60], aB: [40, 90], face: 'grit' }),
    withP(g, { lF: [94, 2], lB: [-10, 4], lean: -14, aF: [-10, 60], aB: [40, 90], face: 'grit' }),
    withP(g, { lF: [60, 95], lean: 0 }),
  ];
  A.uppercut = [
    withP(g, { lean: 22, aF: [10, 60], lF: [30, 50], lB: [-20, 40] }),
    withP(g, { lean: -8, aF: [160, 15], lF: [10, 6], lB: [-14, 4], face: 'shout' }),
    withP(g, { lean: -4, aF: [130, 40] }),
  ];
  A.elbow = [
    withP(g, { aB: [-40, 100], lean: -4 }),
    withP(g, { aB: [-85, 140], lean: -12, face: 'grit' }),
  ];
  A.jump = [
    { lean: 14, lF: [40, 70], lB: [-10, 60], aF: [20, 70], aB: [0, 70], hand: 'fist' },
    { lean: 4, lF: [45, 85], lB: [0, 80], aF: [60, 80], aB: [30, 90], hand: 'fist', plant: false },
    { lean: 2, lF: [20, 30], lB: [-10, 25], aF: [80, 40], aB: [50, 60], hand: 'fist', plant: false },
  ];
  A.jumpkick = [
    { lean: -6, lF: [60, 100], lB: [-10, 90], aF: [60, 80], aB: [-30, 60], hand: 'fist', plant: false },
    { lean: -14, lF: [98, 0], lB: [-15, 100], aF: [-20, 50], aB: [60, 80], hand: 'fist', plant: false, face: 'grit' },
  ];
  A.hurt = [
    withP(g, { lean: -20, headTilt: -18, aF: [-10, 50], aB: [-30, 40], face: 'hurt', lF: [20, 10], lB: [-6, 18] }),
    withP(g, { lean: 28, headTilt: 12, aF: [30, 70], aB: [10, 80], face: 'hurt', lF: [12, 30], lB: [-14, 26] }),
  ];
  A.knockdown = [
    { lean: -40, lF: [40, 20], lB: [20, 30], aF: [-60, 30], aB: [-90, 20], plant: false, face: 'hurt' },
    { rot: -60, lean: -10, lF: [50, 30], lB: [30, 40], aF: [-120, 20], aB: [-150, 20], plant: false, face: 'hurt' },
    { rot: -88, lean: 0, lF: [20, 10], lB: [10, 20], aF: [-150, 10], aB: [-170, 20], face: 'hurt' },
  ];
  A.down = [{ rot: -90, lean: 0, lF: [6, 4], lB: [2, 10], aF: [-160, 10], aB: [-175, 20], face: 'hurt' }];
  A.getup = [
    { rot: -70, lean: 10, lF: [70, 110], lB: [40, 120], aF: [20, 10], aB: [-10, 10], face: 'grit' },
    { lean: 30, lF: [75, 115], lB: [-30, 125], aF: [50, 20], aB: [10, 40], face: 'grit' },
    withP(g, { lean: 18, lF: [35, 50], lB: [-20, 40] }),
  ];
  A.grab = [withP(g, { aF: [78, 38], aB: [70, 48], armBFront: true, lean: 10, lF: [20, 12] })];
  A.knee = [
    withP(g, { aF: [78, 38], aB: [70, 48], armBFront: true, lean: 14, lF: [80, 120], face: 'grit' }),
    withP(g, { aF: [78, 38], aB: [70, 48], armBFront: true, lean: 10, lF: [30, 30] }),
  ];
  A.throw = [
    withP(g, { aF: [120, 30], aB: [110, 40], armBFront: true, lean: -14, lF: [30, 20], lB: [-30, 10] }),
    withP(g, { aF: [-150, 20], aB: [-160, 30], lean: -30, lF: [10, 20], lB: [-30, 30], face: 'shout' }),
    withP(g, { aF: [-60, 40], aB: [-80, 40], lean: -6 }),
  ];
  A.special = range(4).map((i) => {
    const ph = (i / 4) * TAU;
    return {
      lean: 4,
      aF: [90 + Math.sin(ph) * 30, 0] as [number, number],
      aB: [-90 - Math.sin(ph) * 30, 0] as [number, number],
      lF: [20 + Math.cos(ph) * 15, 20],
      lB: [-20 + Math.cos(ph) * 15, 20],
      hand: 'fist' as const,
      face: 'shout' as const,
    };
  });
  A.grabbed = [{ lean: -14, headTilt: -10, aF: [20, 40], aB: [0, 40], lF: [10, 20], lB: [-10, 30], face: 'hurt', plant: false }];
  A.thrown = [
    { rot: -100, lean: 0, lF: [30, 20], lB: [10, 40], aF: [-140, 20], aB: [-170, 40], plant: false, face: 'hurt' },
    { rot: -200, lean: 0, lF: [30, 20], lB: [10, 40], aF: [-140, 20], aB: [-170, 40], plant: false, face: 'hurt' },
  ];
  A.taunt = [
    withP(g, { aF: [120, 70], hand: 'open', lean: -6, face: 'smirk' }),
    withP(g, { aF: [140, 50], hand: 'open', lean: -6, face: 'smirk' }),
  ];
  A.victory = [
    withP(g, { aF: [175, 10], lean: -4, face: 'smirk', lF: [10, 6], lB: [-10, 4] }),
    withP(g, { aF: [170, 25], lean: -6, face: 'grit', lF: [10, 6], lB: [-10, 4] }),
  ];
  return A;
}

// ---------------------------------------------------------------------------
// Hero: "le Goku de Nice"

// Long salt-and-pepper hair, grey beard, glasses, big build, black tee with a
// rainbow print, tattooed forearms, black sweatpants with a white number.
export const HERO_LOOK: Look = {
  skin: SKIN[0],
  hair: P.hairSalt,
  longHair: P.hairSalt,
  beard: P.beard,
  shirt: P.black,
  sleeves: 'short',
  pants: P.black,
  shoes: P.charcoal,
  sole: P.white[1],
  head: 'long',
  glasses: true,
  tattoo: true,
  rainbowLogo: true,
  pantsPrint: true,
  belly: true,
};

function heroAnims(): Record<string, Pose[]> {
  const A = baseAnims('hero');
  // The meme: arms crossed, planted in the doorway, unbothered.
  A.cross_arms = range(2).map((i) => ({
    lean: -2 + i * 0.6,
    aF: [38, -128] as [number, number],
    aB: [48, -140] as [number, number],
    armBFront: true,
    lF: [10, 4 + i],
    lB: [-10, 4],
    hand: 'fist' as const,
    face: 'neutral' as const,
  }));
  A.pickup = [{ lean: 34, lF: [65, 100], lB: [-25, 95], aF: [60, 10], aB: [20, 40], hand: 'open', face: 'neutral' }];
  A.blind = range(2).map((i) => withP(GUARD, { lean: 20, aF: [60 + i * 20, 20], aB: [40 - i * 10, 30], hand: 'open', face: 'hurt' }));
  // combo finishers + special moves
  A.charge = [
    withP(GUARD, { lean: 12, aF: [40, 100], aB: [20, 110], lF: [30, 40], lB: [-20, 30] }),
    withP(GUARD, { lean: 38, aF: [-15, 95], aB: [10, 100], lF: [42, 18], lB: [-42, 8], face: 'shout' }),
    withP(GUARD, { lean: 28, aF: [10, 90], aB: [10, 100], lF: [36, 20], lB: [-30, 10] }),
  ];
  A.sweepkick = [
    { lean: 30, lF: [50, 95], lB: [-20, 100], aF: [40, 80], aB: [20, 90], hand: 'fist' },
    { lean: 40, lF: [88, 0], lB: [-12, 125], aF: [50, 30], aB: [-40, 30], hand: 'fist', face: 'grit' },
    { lean: 34, lF: [60, 60], lB: [-15, 115], aF: [40, 60], aB: [-20, 50], hand: 'fist' },
  ];
  A.dropkick = [
    { lean: -18, lF: [60, 90], lB: [45, 90], aF: [40, 70], aB: [20, 80], hand: 'fist', plant: false },
    { rot: -72, lean: 0, lF: [14, 0], lB: [4, 6], aF: [-160, 20], aB: [-150, 30], hand: 'fist', plant: false, face: 'shout' },
    { lean: -30, lF: [40, 40], lB: [20, 40], aF: [-60, 30], aB: [-80, 30], hand: 'fist', plant: false },
  ];
  A.diveelbow = [{ lean: 34, aF: [55, -150], aB: [20, 90], lF: [50, 90], lB: [10, 100], hand: 'fist', plant: false, face: 'shout' }];
  A.headbutt = [
    withP(GUARD, { aF: [78, 38], aB: [70, 48], armBFront: true, lean: -18, headTilt: -16, lF: [20, 12] }),
    withP(GUARD, { aF: [78, 38], aB: [70, 48], armBFront: true, lean: 32, headTilt: 22, lF: [30, 20], face: 'shout' }),
  ];
  A.rafale = [
    withP(GUARD, { aF: [92, 2], aB: [30, 110], lean: 14, lF: [26, 12], face: 'shout' }),
    withP(GUARD, { aF: [60, 60], aB: [92, 0], armBFront: true, lean: 16, lF: [26, 12], face: 'shout' }),
    withP(GUARD, { aF: [94, -2], aB: [40, 100], lean: 15, lF: [26, 12], face: 'shout' }),
    withP(GUARD, { aF: [50, 70], aB: [90, 4], armBFront: true, lean: 17, lF: [26, 12], face: 'shout' }),
  ];
  A.command = [
    withP(GUARD, { aF: [96, -6], hand: 'open', lean: 8, face: 'shout', lF: [26, 14] }),
    withP(GUARD, { aF: [100, -8], hand: 'open', lean: 10, face: 'shout', lF: [26, 14] }),
  ];
  return A;
}

// ---------------------------------------------------------------------------
// The cardboard standee (spiky-haired anime hero, orange gi)

export const STANDEE_LOOK: Look = {
  skin: SKIN[0],
  hair: P.hairBlack,
  shirt: P.orange,
  sleeves: 'short',
  pants: P.orange,
  shoes: P.blue,
  head: 'spiky',
  belt: P.blue,
  wrist: P.blue,
  undershirt: P.blue,
};

function standeeAnims(): Record<string, Pose[]> {
  const g: Pose = { lean: 0, aF: [20, 10], aB: [-15, 10], lF: [10, 4], lB: [-10, 4], hand: 'fist' };
  return {
    stand: [{ ...g, aF: [150, 30], face: 'smirk' }],
    charge: range(2).map((i) => ({ lean: -8 - i, aF: [-50, 70], aB: [-40, 80], lF: [35, 30], lB: [-30, 20], hand: 'open' as const, face: 'grit' as const })),
    fire: range(2).map((i) => ({ lean: 14 + i, aF: [90, 0], aB: [88, 4], armBFront: true, lF: [38, 20], lB: [-32, 10], hand: 'open' as const, face: 'shout' as const })),
  };
}

// ---------------------------------------------------------------------------
// Casseurs

const HOODIES: Ramp[] = [P.black, P.charcoal, P.grey, P.navy, P.khaki, P.olive, P.burgundy];
const PANTS: Ramp[] = [P.black, P.charcoal, P.denimDark, P.grey, P.denim];
const SHOES: Ramp[] = [P.white, P.black, P.grey];
const GAITERS: Ramp[] = [P.black, P.charcoal, P.navy];

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}


export const ENEMY_VARIANTS = 3;

function thugLook(kind: EnemyKind, v: number): Look {
  const r = rng(1000 + v * 97 + kind.length * 13 + kind.charCodeAt(0));
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const hoodie = pick(r, HOODIES);
  const base: Look = {
    skin,
    hair: pick(r, [P.hairBlack, P.hairBrown, P.hairDark]),
    shirt: hoodie,
    sleeves: 'long',
    pants: pick(r, PANTS),
    shoes: pick(r, SHOES),
    sole: P.white[1],
    head: 'hood',
    headCloth: hoodie,
    hoodie: true,
    gaiter: pick(r, GAITERS),
  };
  switch (kind) {
    case 'capuche':
      return { ...base, head: v === 2 ? 'balaclava' : 'hood', headCloth: v === 2 ? P.black : hoodie };
    case 'trottinette':
      return { ...base, head: 'cap', headCloth: pick(r, [P.red, P.white, P.black]), backpack: P.black };
    case 'lanceur':
      return { ...base, backpack: pick(r, [P.olive, P.black, P.navy]), goggles: v === 1 };
    case 'pilleur':
      return { ...base, head: 'cap', headCloth: pick(r, [P.black, P.navy, P.burgundy]), backpack: P.grey };
    case 'costaud':
      return { ...base, head: 'balaclava', headCloth: P.black, shirt: pick(r, [P.khaki, P.black, P.olive]), hoodie: false, gaiter: undefined };
    case 'kickeur':
      return { ...base, head: 'hood', headCloth: P.black, shirt: P.black, pants: P.black, shoes: P.white, gaiter: P.black, goggles: true };
    case 'pilote':
      return { ...base, head: 'helmet', headCloth: P.black, shirt: P.charcoal, hoodie: false, gaiter: undefined, pants: P.black, shoes: P.black, sole: P.grey[1] };
  }
}

function thugAnims(kind: EnemyKind): Record<string, Pose[]> {
  const style = kind === 'costaud' || kind === 'pilote' ? 'heavy' : 'thug';
  const A = baseAnims(style);
  A.punch = A.jab;
  A.windup = [withP(A.idle[0], { aF: [-50, 100], lean: -12, face: 'grit' }), withP(A.idle[0], { aF: [-60, 110], lean: -16, face: 'grit' })];
  A.haymaker = [withP(A.idle[0], { aF: [95, -4], lean: 24, lF: [32, 16], lB: [-26, 6], face: 'shout' }), withP(A.idle[0], { aF: [70, 30], lean: 14 })];
  A.throwobj = [
    withP(A.idle[0], { aF: [200, 30], lean: -14, prop: 'bottle' }),
    withP(A.idle[0], { aF: [100, 6], lean: 16, lF: [28, 14] }),
  ];
  A.steal = range(2).map((i) => ({ lean: 42 + i * 4, aF: [60 + i * 25, 30], aB: [50 - i * 20, 40], lF: [20, 30], lB: [-20, 25], hand: 'open' as const }));
  A.carry = A.run.map((p) => ({ ...p, aB: [-25, 15] as [number, number], prop: 'sack' as const, lean: 24 }));
  A.flykick = [
    { lean: 20, lF: [50, 90], lB: [-20, 80], aF: [20, 70], aB: [0, 70], hand: 'fist', plant: true },
    { lean: -10, lF: [70, 110], lB: [-10, 100], aF: [60, 70], aB: [-40, 50], hand: 'fist', plant: false },
    { lean: -26, lF: [100, -2], lB: [5, 110], aF: [-30, 50], aB: [80, 60], hand: 'fist', plant: false },
  ];
  A.crouch = [{ lean: 24, lF: [50, 90], lB: [-20, 90], aF: [40, 80], aB: [20, 90], hand: 'fist' }];
  A.ride = [{ lean: 8, lF: [30, 50], lB: [10, 40], aF: [60, 30], aB: [50, 40], hand: 'fist' }];
  A.flee = A.run;
  return A;
}

export function heroDef(): CharDef {
  return { key: 'hero', look: HERO_LOOK, build: BUILD_BIG, anims: heroAnims() };
}

export function standeeDef(cardboard: boolean): CharDef {
  return {
    key: cardboard ? 'standee_card' : 'standee',
    look: { ...STANDEE_LOOK, cardboard },
    build: { ...BUILD_HERO, shoulderW: 15, armR: 3, legR: 3.5 },
    anims: standeeAnims(),
  };
}

/** Variants that walk around holding a lit flare (smoke + red glow in game). */
export function hasFlare(kind: string, v: number): boolean {
  return (kind === 'capuche' && v === 1) || (kind === 'lanceur' && v === 2);
}

export function enemyDef(kind: EnemyKind, v: number): CharDef {
  const build = kind === 'costaud' || kind === 'pilote' ? BUILD_HEAVY : BUILD_SLIM;
  const anims = thugAnims(kind);
  if (hasFlare(kind, v)) {
    for (const a of ['idle', 'walk', 'taunt']) anims[a] = anims[a].map((p) => ({ ...p, prop: 'flare' as const }));
  }
  return { key: `${kind}_${v}`, look: thugLook(kind, v), build, anims };
}

export const ENEMY_KINDS: EnemyKind[] = ['capuche', 'trottinette', 'lanceur', 'pilleur', 'costaud', 'kickeur', 'pilote'];

export function allCharDefs(): CharDef[] {
  const defs: CharDef[] = [heroDef(), standeeDef(true), standeeDef(false)];
  for (const k of ENEMY_KINDS) {
    const n = k === 'kickeur' || k === 'pilote' ? 1 : ENEMY_VARIANTS;
    for (let v = 0; v < n; v++) defs.push(enemyDef(k, v));
  }
  return defs;
}
