import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { BOUTIQUE, StageDef } from '../src/game/stage';
import { NO_INTENT, Intent } from '../src/game/types';

const ARENA: StageDef = { ...BOUTIQUE, segments: [{ camX: 0, holds: [], waves: [{ spawns: [{ kind: 'capuche', at: 1e9, side: 'L' }] }] }] };

function setup() {
  const w = new World(ARENA, 11);
  w.step(NO_INTENT);
  w.hero.state = 'idle';
  w.hero.x = 150;
  w.hero.y = 180;
  w.hero.facing = 1;
  const e = w.spawnEnemy('capuche', 'R', 180);
  e.x = 168;
  e.y = 180;
  e.entered = true;
  e.ai!.cd = 1e9;
  e.hp = e.maxHp = 999;
  return { w, e };
}

/** Mash attack through the chain while holding a direction; return the move ids seen. */
function chain(dir: Partial<Intent>): { moves: string[]; w: World; e: ReturnType<typeof setup>['e'] } {
  const { w, e } = setup();
  const seen: string[] = [];
  for (let i = 0; i < 140; i++) {
    const press = i % 4 === 0;
    // only hold the direction for the finisher press, so the hero doesn't walk away early
    const held = seen.includes('cross') ? dir : {};
    w.step({ ...NO_INTENT, ...held, attack: press });
    if (w.hero.state === 'attack' && seen[seen.length - 1] !== w.hero.moveId) seen.push(w.hero.moveId);
    if (e.state === 'fall' && seen.length >= 4) break;
  }
  return { moves: seen, w, e };
}

describe('combo finishers branch on the held direction', () => {
  it('neutral -> roundhouse kick', () => {
    expect(chain({}).moves).toEqual(['jab1', 'jab2', 'cross', 'kick']);
  });
  it('toward the enemy -> shoulder charge', () => {
    expect(chain({ mx: 1 }).moves.slice(0, 4)).toEqual(['jab1', 'jab2', 'cross', 'charge']);
  });
  it('up -> uppercut launcher sends the enemy high', () => {
    const { moves, w, e } = chain({ my: -1 });
    expect(moves.slice(0, 4)).toEqual(['jab1', 'jab2', 'cross', 'uppercut']);
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      w.step(NO_INTENT);
      peak = Math.max(peak, e.z);
    }
    expect(peak).toBeGreaterThan(40);
  });
  it('down -> low sweep', () => {
    expect(chain({ my: 1 }).moves.slice(0, 4)).toEqual(['jab1', 'jab2', 'cross', 'sweepkick']);
  });
  it('finishers emit an impact event', () => {
    const { w } = setup();
    let impacts = 0;
    for (let i = 0; i < 140; i++) {
      w.step({ ...NO_INTENT, attack: i % 4 === 0 });
      impacts += w.events.filter((e) => e.type === 'impact').length;
      w.events.length = 0;
    }
    expect(impacts).toBeGreaterThan(0);
  });
});

describe('other moves', () => {
  it('forward + special is the Rafale flurry: many hits, then a launcher', () => {
    const { w, e } = setup();
    w.step({ ...NO_INTENT, mx: 1, special: true });
    expect(w.hero.moveId).toBe('rafale');
    let hits = 0;
    let sawEnd = false;
    for (let i = 0; i < 120; i++) {
      const before = e.hp;
      w.step(NO_INTENT);
      if (e.hp < before) hits++;
      if (w.hero.moveId === 'rafale_end') sawEnd = true;
    }
    expect(hits).toBeGreaterThanOrEqual(6);
    expect(sawEnd).toBe(true);
  });

  it('grab + up + attack is a headbutt that knocks down', () => {
    const { w, e } = setup();
    for (let i = 0; i < 20 && w.hero.state !== 'grab'; i++) w.step({ ...NO_INTENT, mx: 1 });
    expect(w.hero.state).toBe('grab');
    w.step({ ...NO_INTENT, my: -1, attack: true });
    expect(w.hero.moveId).toBe('headbutt');
    for (let i = 0; i < 30 && e.state !== 'fall'; i++) w.step(NO_INTENT);
    expect(e.state).toBe('fall');
  });

  it('running attack is a dropkick; air + down attack is a dive elbow', () => {
    const { w } = setup();
    w.hero.x = 60;
    for (let i = 0; i < 5; i++) w.step({ ...NO_INTENT, mx: 1, run: true });
    w.step({ ...NO_INTENT, mx: 1, run: true, attack: true });
    expect(w.hero.moveId).toBe('dropkick');
    const s2 = setup();
    s2.w.step({ ...NO_INTENT, jump: true });
    for (let i = 0; i < 6; i++) s2.w.step(NO_INTENT);
    s2.w.step({ ...NO_INTENT, my: 1, attack: true });
    expect(s2.w.hero.moveId).toBe('diveelbow');
    expect(s2.w.hero.vz).toBeLessThan(0);
  });

  it('heavy hits make the victim shake during hitstop, and it stops after', () => {
    const { w, e } = setup();
    let shook = 0;
    for (let i = 0; i < 140; i++) {
      w.step({ ...NO_INTENT, attack: i % 4 === 0 });
      if (e.freeze > 0) shook = Math.max(shook, e.shake);
    }
    expect(shook).toBe(2);
    expect(e.freeze === 0 ? e.shake : 0).toBe(0);
  });
});
