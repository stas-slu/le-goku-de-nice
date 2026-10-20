// Frame data and stats. All timings are in 60 Hz ticks, distances in pixels.

export type EnemyKind = 'capuche' | 'trottinette' | 'lanceur' | 'pilleur' | 'costaud' | 'kickeur' | 'pilote';

export const VIEW_W = 384;
export const VIEW_H = 216;
export const GRAVITY = 0.3;

export interface Box {
  x: number; // forward offset of the box's near edge from the fighter's x (negative = behind)
  z: number; // bottom of the box above the ground
  w: number;
  h: number;
}

export interface HitDef {
  box: Box;
  depth: number;
  damage: number;
  stun: number;
  stop: number;
  push: number;
  launch?: number;
  knockdown?: boolean;
  heavy?: boolean;
  allAround?: boolean;
  glasses?: boolean; // knocks the hero's glasses off
}

/** One step of a move's animation: [anim, frameIndex, ticks]. */
export type Step = [string, number, number];

export interface MoveDef {
  steps: Step[];
  active: [number, number];
  hit: HitDef;
  cancel?: number;
  next?: string;
  lunge?: number;
  lungeAt?: [number, number];
  armor?: boolean;
  invuln?: boolean;
  hpCost?: number;
  jump?: { at: number; vz: number };
  air?: boolean;
  /** Set vertical speed when the move starts (dive attacks). */
  dive?: number;
  /** Multi-hit: re-arm the hitbox every N ticks while active. */
  rehit?: number;
  /** Automatically continue into this move when this one ends. */
  then?: string;
  /** Only hits the fighter currently held in a grab. */
  grabOnly?: boolean;
  spawn?: { at: number; what: 'bottle' };
  sfx?: 'light' | 'heavy' | 'whoosh';
}

const D = 10; // default depth tolerance (generous — Tribute-style)

export const MOVES: Record<string, MoveDef> = {
  // ---- hero ----
  jab1: {
    steps: [['jab', 0, 3], ['jab', 1, 5], ['jab', 2, 6]],
    active: [3, 7], cancel: 6, next: 'jab2', sfx: 'light',
    hit: { box: { x: 4, z: 30, w: 24, h: 14 }, depth: D, damage: 4, stun: 20, stop: 4, push: 0.5 },
  },
  jab2: {
    steps: [['jab', 0, 2], ['jab', 1, 5], ['jab', 2, 6]],
    active: [2, 6], cancel: 5, next: 'cross', sfx: 'light',
    hit: { box: { x: 4, z: 30, w: 24, h: 14 }, depth: D, damage: 4, stun: 20, stop: 4, push: 0.5 },
  },
  cross: {
    steps: [['cross', 0, 4], ['cross', 1, 6], ['cross', 2, 8]],
    active: [4, 9], cancel: 8, next: 'finisher', lunge: 0.8, lungeAt: [3, 8], sfx: 'light',
    hit: { box: { x: 4, z: 28, w: 26, h: 16 }, depth: D, damage: 6, stun: 24, stop: 6, push: 0.9 },
  },
  // ---- finishers (picked by the direction held on the 4th press) ----
  kick: {
    steps: [['kick', 0, 5], ['kick', 1, 4], ['kick', 2, 6], ['kick', 3, 9]],
    active: [5, 13], lunge: 1.2, lungeAt: [4, 9], sfx: 'heavy',
    hit: { box: { x: 4, z: 14, w: 30, h: 20 }, depth: D, damage: 10, stun: 30, stop: 12, push: 2.8, launch: 3.2, knockdown: true, heavy: true },
  },
  charge: {
    steps: [['charge', 0, 6], ['charge', 1, 10], ['charge', 2, 12]],
    active: [6, 16], lunge: 3.4, lungeAt: [4, 16], sfx: 'heavy',
    hit: { box: { x: 0, z: 12, w: 26, h: 36 }, depth: D, damage: 11, stun: 30, stop: 13, push: 4.6, launch: 2.2, knockdown: true, heavy: true },
  },
  uppercut: {
    steps: [['uppercut', 0, 5], ['uppercut', 1, 8], ['uppercut', 2, 12]],
    active: [5, 13], lunge: 1.2, lungeAt: [0, 10], sfx: 'heavy',
    hit: { box: { x: 0, z: 22, w: 26, h: 34 }, depth: D, damage: 10, stun: 30, stop: 12, push: 0.8, launch: 6, knockdown: true, heavy: true },
  },
  sweepkick: {
    steps: [['sweepkick', 0, 5], ['sweepkick', 1, 8], ['sweepkick', 2, 10]],
    active: [5, 13], lunge: 0.6, lungeAt: [3, 10], sfx: 'heavy',
    hit: { box: { x: 0, z: 0, w: 34, h: 16 }, depth: D, damage: 9, stun: 30, stop: 11, push: 1.4, launch: 2.8, knockdown: true, heavy: true },
  },
  // ---- other hero moves ----
  dropkick: {
    steps: [['dropkick', 0, 5], ['dropkick', 1, 18], ['dropkick', 2, 12]],
    active: [5, 23], lunge: 3.8, lungeAt: [0, 23], jump: { at: 3, vz: 2.6 }, sfx: 'heavy',
    hit: { box: { x: 0, z: 10, w: 30, h: 26 }, depth: D, damage: 12, stun: 30, stop: 13, push: 4.2, launch: 3.6, knockdown: true, heavy: true },
  },
  diveelbow: {
    steps: [['diveelbow', 0, 80]],
    active: [2, 80], air: true, dive: -3.6, sfx: 'heavy',
    hit: { box: { x: -6, z: -8, w: 28, h: 28 }, depth: D, damage: 11, stun: 30, stop: 13, push: 0.8, launch: 4.8, knockdown: true, heavy: true },
  },
  headbutt: {
    steps: [['headbutt', 0, 9], ['headbutt', 1, 14]],
    active: [9, 13], grabOnly: true, sfx: 'heavy',
    hit: { box: { x: 0, z: 30, w: 24, h: 26 }, depth: 14, damage: 14, stun: 30, stop: 14, push: 3.6, launch: 3.4, knockdown: true, heavy: true },
  },
  rafale: {
    steps: [
      ['rafale', 0, 3], ['rafale', 1, 3], ['rafale', 2, 3], ['rafale', 3, 3], ['rafale', 0, 3], ['rafale', 1, 3], ['rafale', 2, 3], ['rafale', 3, 3],
      ['rafale', 0, 3], ['rafale', 1, 3], ['rafale', 2, 3], ['rafale', 3, 3], ['rafale', 0, 3], ['rafale', 1, 3], ['rafale', 2, 3], ['rafale', 3, 3],
    ],
    active: [3, 45], rehit: 5, lunge: 0.35, hpCost: 5, then: 'rafale_end', sfx: 'whoosh',
    hit: { box: { x: 2, z: 24, w: 28, h: 22 }, depth: 12, damage: 2, stun: 16, stop: 2, push: 0.12 },
  },
  rafale_end: {
    steps: [['uppercut', 0, 3], ['uppercut', 1, 10], ['uppercut', 2, 12]],
    active: [3, 11], lunge: 1.5, lungeAt: [0, 8], sfx: 'heavy',
    hit: { box: { x: 0, z: 20, w: 28, h: 34 }, depth: 12, damage: 9, stun: 30, stop: 14, push: 3.4, launch: 4.6, knockdown: true, heavy: true },
  },
  jumpkick: {
    steps: [['jumpkick', 0, 4], ['jumpkick', 1, 60]],
    active: [4, 64], air: true, sfx: 'heavy',
    hit: { box: { x: 2, z: 6, w: 28, h: 22 }, depth: D, damage: 9, stun: 28, stop: 10, push: 2.4, launch: 2.8, knockdown: true, heavy: true },
  },
  elbow: {
    steps: [['elbow', 0, 4], ['elbow', 1, 12]],
    active: [4, 10], sfx: 'heavy',
    hit: { box: { x: -28, z: 26, w: 26, h: 16 }, depth: D, damage: 7, stun: 26, stop: 6, push: 2, launch: 2.6, knockdown: true, heavy: true },
  },
  knee: {
    steps: [['knee', 0, 5], ['knee', 1, 9]],
    active: [5, 9], grabOnly: true, sfx: 'light',
    hit: { box: { x: 0, z: 10, w: 22, h: 30 }, depth: 14, damage: 5, stun: 40, stop: 5, push: 0 },
  },
  special: {
    steps: [['special', 0, 3], ['special', 1, 3], ['special', 2, 3], ['special', 3, 3], ['special', 0, 3], ['special', 1, 3], ['special', 2, 3], ['special', 3, 5]],
    active: [2, 22], invuln: true, hpCost: 6, sfx: 'whoosh',
    hit: { box: { x: -30, z: 10, w: 60, h: 34 }, depth: 14, damage: 7, stun: 30, stop: 6, push: 2.8, launch: 3, knockdown: true, heavy: true, allAround: true },
  },

  // ---- casseurs ----
  punch: {
    steps: [['punch', 0, 14], ['punch', 1, 6], ['punch', 2, 12]],
    active: [14, 19], lunge: 0.6, lungeAt: [12, 18], sfx: 'light',
    hit: { box: { x: 4, z: 30, w: 22, h: 14 }, depth: 8, damage: 6, stun: 20, stop: 4, push: 1 },
  },
  punch2: {
    steps: [['punch', 0, 6], ['cross', 1, 7], ['cross', 2, 12]],
    active: [6, 12], lunge: 0.8, lungeAt: [5, 11], sfx: 'light',
    hit: { box: { x: 4, z: 30, w: 24, h: 14 }, depth: 8, damage: 7, stun: 24, stop: 5, push: 1.6, launch: 2.4, knockdown: true },
  },
  haymaker: {
    steps: [['windup', 0, 12], ['windup', 1, 14], ['haymaker', 0, 8], ['haymaker', 1, 16]],
    active: [26, 33], armor: true, lunge: 1.8, lungeAt: [24, 32], sfx: 'heavy',
    hit: { box: { x: 4, z: 26, w: 30, h: 20 }, depth: 10, damage: 14, stun: 30, stop: 10, push: 3, launch: 3.6, knockdown: true, heavy: true, glasses: true },
  },
  flykick: {
    steps: [['flykick', 0, 22], ['flykick', 1, 6], ['flykick', 2, 30]],
    active: [27, 54], lunge: 4.2, lungeAt: [22, 54], jump: { at: 22, vz: 3.2 }, sfx: 'heavy',
    hit: { box: { x: 0, z: 8, w: 30, h: 26 }, depth: 10, damage: 13, stun: 30, stop: 10, push: 3.4, launch: 3.6, knockdown: true, heavy: true, glasses: true },
  },
  sweep: {
    steps: [['kick', 0, 10], ['kick', 1, 6], ['kick', 3, 14]],
    active: [10, 16], sfx: 'light',
    hit: { box: { x: 4, z: 0, w: 28, h: 16 }, depth: 9, damage: 8, stun: 26, stop: 6, push: 2, launch: 2, knockdown: true },
  },
  throwobj: {
    steps: [['throwobj', 0, 22], ['throwobj', 1, 18]],
    active: [0, 0], spawn: { at: 22, what: 'bottle' },
    hit: { box: { x: 0, z: 0, w: 0, h: 0 }, depth: 0, damage: 0, stun: 0, stop: 0, push: 0 },
  },
};

// Contact damage while riding a scooter.
export const RAM: HitDef = { box: { x: -12, z: 0, w: 34, h: 40 }, depth: 9, damage: 10, stun: 30, stop: 8, push: 3.4, launch: 3.6, knockdown: true, heavy: true, glasses: true };
export const RAM_BIG: HitDef = { ...RAM, box: { x: -20, z: 0, w: 46, h: 46 }, depth: 12, damage: 16 };
export const BOTTLE: HitDef = { box: { x: -4, z: -2, w: 8, h: 8 }, depth: 8, damage: 6, stun: 22, stop: 4, push: 1.2 };
export const THROWN: HitDef = { box: { x: -16, z: -4, w: 32, h: 24 }, depth: 12, damage: 10, stun: 30, stop: 6, push: 3, launch: 3, knockdown: true, heavy: true };
export const BEAM: HitDef = { box: { x: 0, z: -10, w: 600, h: 80 }, depth: 48, damage: 34, stun: 40, stop: 10, push: 4, launch: 5, knockdown: true, heavy: true };
export const SHOCKWAVE: HitDef = { box: { x: -80, z: -10, w: 160, h: 80 }, depth: 40, damage: 0, stun: 20, stop: 2, push: 4, launch: 3, knockdown: true, allAround: true };

export interface EnemyStats {
  hp: number;
  speed: number;
  body: { w: number; h: number };
  moves: string[];
  score: number;
  grabbable: boolean;
  armorAlways?: boolean;
}

export const ENEMY: Record<EnemyKind, EnemyStats> = {
  capuche: { hp: 26, speed: 1.05, body: { w: 18, h: 52 }, moves: ['punch', 'punch', 'punch2'], score: 100, grabbable: true },
  trottinette: { hp: 22, speed: 1.15, body: { w: 18, h: 52 }, moves: ['punch', 'sweep'], score: 150, grabbable: true },
  lanceur: { hp: 20, speed: 1.0, body: { w: 18, h: 52 }, moves: ['punch'], score: 150, grabbable: true },
  pilleur: { hp: 16, speed: 1.5, body: { w: 18, h: 50 }, moves: [], score: 200, grabbable: true },
  costaud: { hp: 70, speed: 0.7, body: { w: 26, h: 56 }, moves: ['haymaker', 'punch'], score: 300, grabbable: false },
  kickeur: { hp: 200, speed: 1.6, body: { w: 18, h: 52 }, moves: ['flykick', 'punch2', 'sweep', 'punch'], score: 2000, grabbable: true },
  pilote: { hp: 160, speed: 0.85, body: { w: 26, h: 56 }, moves: ['haymaker', 'punch2'], score: 2500, grabbable: false },
};

export const HERO = {
  hp: 100,
  walkX: 1.5,
  walkY: 0.95,
  runX: 3.1,
  jumpVz: 5.4,
  body: { w: 18, h: 54 },
  lives: 3,
};

export const RESOLVE = {
  perHit: 3,
  crossArmsPerTick: 0.03,
  retourAuPoste: 25,
  cheer: 12,
};
