// Enemy brains. Each archetype is a small mode machine on top of the shared
// fighter states; an attack-token pool keeps the crowd from mobbing unfairly.

import { ENEMY, EnemyKind, RAM, RAM_BIG, VIEW_W } from './defs';
import type { AiState, Fighter } from './types';
import type { World } from './world';

export function newAi(f: Fighter, side: 1 | -1): AiState {
  const mode =
    f.kind === 'pilleur' ? 'toHold'
    : f.kind === 'trottinette' ? 'ride'
    : f.kind === 'pilote' ? 'ride'
    : f.kind === 'lanceur' ? 'range'
    : 'brawl';
  if (mode === 'ride') f.scooter = f.kind === 'pilote' ? 'big' : 'small';
  return { mode, t: 0, cd: 30 + ((f.id * 17) % 40), offY: 0, side, passes: 0, rideY: f.y, summoned: false, stealT: 0, holdId: null };
}

const ACTIONABLE = new Set(['idle', 'walk', 'run', 'taunt', 'steal', 'carry', 'ride']);

export function updateEnemy(w: World, f: Fighter): void {
  const ai = f.ai;
  if (!ai || !ACTIONABLE.has(f.state)) return;
  ai.t++;
  if (ai.cd > 0) ai.cd--;
  const stats = ENEMY[f.kind as EnemyKind];

  // the boss calls for backup once
  if (f.boss && !ai.summoned && f.hp < f.maxHp * 0.5) {
    ai.summoned = true;
    w.director.inject(w, [
      { kind: 'capuche', at: 0, side: 'L' },
      { kind: 'capuche', at: 40, side: 'R' },
    ]);
    w.emit({ type: 'text', key: 'renforts', x: f.x, y: f.y - 70 });
  }

  switch (ai.mode) {
    case 'ride':
      return ride(w, f, ai);
    case 'toHold':
    case 'steal':
      return pilleur(w, f, ai);
    case 'carry':
    case 'flee':
      return flee(w, f, ai);
    case 'range':
      return ranged(w, f, ai, stats.speed);
    default:
      return brawl(w, f, ai, stats.speed, stats.moves);
  }
}

function walkTo(f: Fighter, tx: number, ty: number, speed: number, faceX?: number): boolean {
  const dx = tx - f.x;
  const dy = ty - f.y;
  const near = Math.abs(dx) < 3 && Math.abs(dy) < 2;
  if (near) {
    f.vx = 0;
    f.vy = 0;
    if (f.state !== 'idle') {
      f.state = 'idle';
      f.t = 0;
    }
    f.anim = 'idle';
    f.frame = Math.floor(f.t / 10) % 4;
  } else {
    const l = Math.hypot(dx, dy * 1.6) || 1;
    f.vx = (dx / l) * speed;
    f.vy = ((dy * 1.6) / l) * speed * 0.65;
    if (f.state !== 'walk') {
      f.state = 'walk';
      f.t = 0;
    }
    f.anim = 'walk';
    f.frame = Math.floor(f.t / 7) % 8;
  }
  const fx = faceX ?? tx;
  if (Math.abs(fx - f.x) > 2) f.facing = fx > f.x ? 1 : -1;
  return near;
}

function heroBusy(w: World): boolean {
  const s = w.hero.state;
  return s === 'dead' || s === 'down' || s === 'respawn' || s === 'super' || s === 'getup';
}

function brawl(w: World, f: Fighter, ai: AiState, speed: number, moves: string[]): void {
  const h = w.hero;
  const dx = h.x - f.x;
  const side = dx > 0 ? -1 : 1; // which side of the hero we're on
  if (ai.t % 90 === 1) ai.offY = (w.rand() - 0.5) * 30;

  if (heroBusy(w)) {
    w.tokens.delete(f.id);
    walkTo(f, h.x + side * 80, h.y + ai.offY, speed * 0.6, h.x);
    return;
  }

  if (f.state === 'taunt') {
    f.anim = 'taunt';
    f.frame = Math.floor(f.t / 10) % 2;
    f.vx = f.vy = 0;
    if (f.t > 50) {
      f.state = 'idle';
      f.t = 0;
    }
    return;
  }

  const hasToken = ai.cd <= 0 && w.requestToken(f);
  if (hasToken) {
    // the Kickeur prefers to strike from behind
    if (f.kind === 'kickeur') {
      const dist = Math.abs(dx);
      const aligned = Math.abs(h.y - f.y) < 5;
      if (aligned && dist > 46 && dist < 100 && w.rand() < 0.08) {
        f.facing = dx > 0 ? 1 : -1;
        w.startMove(f, 'flykick');
        ai.cd = 70;
        return;
      }
      const behind = -h.facing;
      const want = h.x + behind * 70;
      const slotX = clamp(want, w.camX + 24, w.camX + VIEW_W - 24);
      if (Math.abs(slotX - want) > 12) {
        // the hero has his back to the wall: no way round, fight from the front
        const side = dx > 0 ? -1 : 1;
        if (walkTo(f, h.x + side * 26, h.y, speed, h.x) || (Math.abs(dx) < 30 && aligned)) {
          f.facing = dx > 0 ? 1 : -1;
          attack(w, f, ai, ['punch2', 'sweep', 'punch']);
        }
        return;
      }
      if (Math.sign(f.x - h.x) !== behind || Math.abs(f.x - h.x) < 40) {
        walkTo(f, slotX, h.y + (Math.abs(f.y - h.y) < 14 ? (f.y < h.y ? -18 : 18) : 0), speed * 1.25, h.x);
        if (Math.abs(dx) < 26 && aligned) attack(w, f, ai, ['punch2', 'sweep', 'punch']);
        return;
      }
      if (walkTo(f, slotX, h.y, speed, h.x)) {
        f.facing = dx > 0 ? 1 : -1;
        w.startMove(f, 'flykick');
        ai.cd = 80;
      }
      return;
    }
    const reach = f.kind === 'costaud' || f.kind === 'pilote' ? 30 : 24;
    const slotX = h.x + side * reach;
    if (walkTo(f, slotX, h.y, speed, h.x) || (Math.abs(f.x - slotX) < 6 && Math.abs(f.y - h.y) < 3)) {
      f.facing = dx > 0 ? 1 : -1;
      attack(w, f, ai, moves);
    }
    return;
  }

  // no token: circle at a respectful distance, sometimes taunt
  const ring = 70 + (f.id % 3) * 14;
  walkTo(f, h.x + side * ring, h.y + ai.offY, speed * 0.55, h.x);
  if (f.state === 'idle' && w.rand() < 0.004) {
    f.state = 'taunt';
    f.t = 0;
  }
}

function attack(w: World, f: Fighter, ai: AiState, moves: string[]): void {
  const id = moves[Math.floor(w.rand() * moves.length)];
  w.startMove(f, id);
  ai.cd = 50 + Math.floor(w.rand() * 50);
}

function ranged(w: World, f: Fighter, ai: AiState, speed: number): void {
  const h = w.hero;
  const dx = h.x - f.x;
  const dist = Math.abs(dx);
  if (heroBusy(w)) {
    walkTo(f, f.x, f.y, speed);
    return;
  }
  if (dist < 36 && Math.abs(h.y - f.y) < 8) {
    if (ai.cd <= 0) attack(w, f, ai, ['punch']);
    else walkTo(f, h.x - Math.sign(dx) * 120, f.y, speed * 1.2, h.x);
    return;
  }
  // keep 100-150px away on whichever side has more room
  const left = h.x - w.camX;
  const pref = left > VIEW_W / 2 ? -1 : 1;
  const tx = clamp(h.x + pref * 130, w.camX + 24, w.camX + VIEW_W - 24);
  const ty = h.y + (ai.t % 200 < 100 ? -4 : 4);
  const there = walkTo(f, tx, ty, speed, h.x);
  if ((there || dist > 80) && ai.cd <= 0 && Math.abs(h.y - f.y) < 14 && dist < 220 && f.entered) {
    f.facing = dx > 0 ? 1 : -1;
    w.startMove(f, 'throwobj');
    ai.cd = 110 + Math.floor(w.rand() * 70);
  }
}

function pilleur(w: World, f: Fighter, ai: AiState): void {
  const h = w.hero;
  if (w.holds.length === 0) {
    ai.mode = 'flee';
    return;
  }
  const blocked = (id: string) => {
    const hd = w.holds.find((x) => x.id === id)!;
    return Math.abs(h.x - hd.x) < hd.r + 10 && Math.abs(h.y - hd.y) < 18 && !heroBusy(w);
  };
  if (ai.mode === 'steal') {
    const hd = w.holds.find((x) => x.id === ai.holdId);
    if (!hd || blocked(hd.id)) {
      ai.mode = 'toHold';
      f.state = 'idle';
      return;
    }
    f.state = 'steal';
    f.anim = 'steal';
    f.frame = Math.floor(f.t / 8) % 2;
    f.vx = f.vy = 0;
    f.facing = hd.x >= f.x ? 1 : -1;
    const rate = 0.05;
    const take = Math.min(rate, w.treasure);
    w.treasure -= take;
    f.loot += take;
    if (ai.t % 30 === 0) w.emit({ type: 'stealing', x: f.x, y: f.y });
    if (++ai.stealT > 150 || w.treasure <= 0) {
      ai.mode = 'carry';
      f.state = 'carry';
      f.t = 0;
    }
    return;
  }
  // choose an unblocked target
  const free = w.holds.filter((hd) => !blocked(hd.id));
  if (!free.length) {
    // wait just out of reach, looking for an opening
    const hd = w.holds[0];
    const side = f.x < h.x ? -1 : 1;
    walkTo(f, hd.x + side * 60, hd.y + 10, 1.1, hd.x);
    return;
  }
  free.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x));
  const target = free[0];
  ai.holdId = target.id;
  const ty = target.y + 1;
  if (walkTo(f, target.x, ty, ENEMY.pilleur.speed, target.x)) {
    ai.mode = 'steal';
    ai.stealT = 0;
    f.t = 0;
  }
}

function flee(w: World, f: Fighter, ai: AiState): void {
  const toLeft = f.x - w.camX < VIEW_W / 2;
  const dir = toLeft ? -1 : 1;
  f.facing = dir;
  f.vx = dir * 2.0;
  f.vy = 0;
  f.state = ai.mode === 'carry' && f.loot > 0 ? 'carry' : 'run';
  f.anim = f.state === 'carry' ? 'carry' : 'run';
  f.frame = Math.floor(f.t / 4) % 6;
  if (f.x < w.camX - 30 || f.x > w.camX + VIEW_W + 30) {
    if (f.loot > 0) w.emit({ type: 'stolen', amount: f.loot });
    f.loot = 0;
    f.remove = true;
    w.tokens.delete(f.id);
  }
}

function ride(w: World, f: Fighter, ai: AiState): void {
  const big = f.scooter === 'big';
  const speed = big ? 3.8 : 3.4;
  f.state = 'ride';
  f.anim = 'ride';
  f.frame = 0;
  f.vy = 0;
  // pre-roll offscreen with a warning, then cross the screen
  if (ai.t === 1 || (ai.t > 1 && f.vx === 0)) {
    ai.rideY = clamp(w.hero.y, w.bandTop + 2, w.bandBottom - 2);
    f.y = ai.rideY;
    f.rideHits.clear();
    const fromLeft = f.x < w.camX + VIEW_W / 2;
    f.facing = fromLeft ? 1 : -1;
    w.emit({ type: 'warn', x: fromLeft ? w.camX + 12 : w.camX + VIEW_W - 12, y: f.y, side: fromLeft ? 1 : -1 });
    f.vx = 0.0001 * f.facing;
    ai.cd = big ? 70 : 55;
  }
  if (ai.cd > 0) {
    f.vx = 0.0001 * f.facing;
    return;
  }
  f.vx = f.facing * speed;
  w.contactHit(f, big ? RAM_BIG : RAM);
  const out = f.facing === 1 ? f.x > w.camX + VIEW_W + 40 : f.x < w.camX - 40;
  if (out) {
    ai.passes++;
    const maxPasses = big ? 3 : 2;
    if (ai.passes >= maxPasses) {
      // ditch the scooter offscreen and walk back in to fight
      f.scooter = null;
      ai.mode = 'brawl';
      f.state = 'idle';
      f.vx = 0;
      f.entered = false;
      return;
    }
    f.vx = 0;
    ai.t = 1;
    f.facing = (f.facing * -1) as 1 | -1;
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
