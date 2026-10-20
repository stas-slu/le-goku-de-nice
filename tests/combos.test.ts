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

const go = (w: World, n: number, i: Partial<Intent> = {}) => {
  for (let k = 0; k < n; k++) w.step({ ...NO_INTENT, ...i });
};

describe('SoR2-style combo string', () => {
  it('mashing attack plays jab, jab, hook, long roundhouse — whatever direction is held', () => {
    for (const held of [{}, { mx: 1 }, { my: -1 }, { my: 1 }]) {
      const { w, e } = setup();
      const seen: string[] = [];
      for (let i = 0; i < 160 && !(e.state === 'fall' && seen.length >= 4); i++) {
        w.step({ ...NO_INTENT, ...(seen.includes('cross') ? held : {}), attack: i % 4 === 0 });
        if (w.hero.state === 'attack' && seen[seen.length - 1] !== w.hero.moveId) seen.push(w.hero.moveId);
      }
      expect(seen.slice(0, 4)).toEqual(['jab1', 'jab2', 'cross', 'kick']);
      expect(e.state).toBe('fall');
    }
  });

  it('finishers emit an impact event and the victim shakes in hitstop', () => {
    const { w, e } = setup();
    let impacts = 0;
    let shook = 0;
    for (let i = 0; i < 160; i++) {
      w.step({ ...NO_INTENT, attack: i % 4 === 0 });
      impacts += w.events.filter((ev) => ev.type === 'impact').length;
      w.events.length = 0;
      if (e.freeze > 0) shook = Math.max(shook, e.shake);
    }
    expect(impacts).toBeGreaterThan(0);
    expect(shook).toBe(2);
  });
});

describe('classic move set', () => {
  it('run + attack is a shoulder charge (Golden Axe dash)', () => {
    const { w } = setup();
    w.hero.x = 60;
    go(w, 5, { mx: 1, run: true });
    w.step({ ...NO_INTENT, mx: 1, run: true, attack: true });
    go(w, 3, { mx: 1, run: true });
    expect(w.hero.moveId).toBe('charge');
  });

  it('attack + jump together is a back elbow', () => {
    const { w } = setup();
    w.step({ ...NO_INTENT, attack: true });
    w.step({ ...NO_INTENT, jump: true });
    go(w, 2);
    expect(w.hero.moveId).toBe('elbow');
  });

  it('jump attacks: straight up = knee, forward = flying kick, running = dropkick, down = dive', () => {
    const cases: Array<[Partial<Intent>, Partial<Intent>, string]> = [
      [{}, {}, 'jumpknee'],
      [{ mx: 1 }, { mx: 1 }, 'jumpkick'],
      [{ mx: 1, run: true }, { mx: 1 }, 'dropkick'],
      [{}, { my: 1 }, 'diveelbow'],
    ];
    for (const [pre, air, id] of cases) {
      const { w } = setup();
      w.hero.x = 60;
      go(w, 6, pre);
      w.step({ ...NO_INTENT, ...pre, jump: true });
      go(w, 8, pre);
      expect(w.hero.state).toBe('jump');
      w.step({ ...NO_INTENT, ...air, attack: true });
      expect(w.hero.moveId).toBe(id);
    }
  });

  it('jumps are high and floaty, and the hero lands in a crouch', () => {
    const { w } = setup();
    w.step({ ...NO_INTENT, jump: true });
    let peak = 0;
    let air = 0;
    let sawLand = false;
    for (let i = 0; i < 120; i++) {
      w.step(NO_INTENT);
      peak = Math.max(peak, w.hero.z);
      if (w.hero.z > 0) air++;
      if (w.hero.state === 'land') sawLand = true;
    }
    expect(peak).toBeGreaterThan(65);
    expect(air).toBeGreaterThan(40);
    expect(sawLand).toBe(true);
  });

  it('grab: knee, knee, then a headbutt; jump vaults behind while holding on', () => {
    const { w, e } = setup();
    for (let i = 0; i < 20 && w.hero.state !== 'grab'; i++) w.step({ ...NO_INTENT, mx: 1 });
    expect(w.hero.state).toBe('grab');
    const before = Math.sign(e.x - w.hero.x);
    w.step({ ...NO_INTENT, jump: true });
    go(w, 30);
    expect(w.hero.state).toBe('grab');
    expect(Math.sign(e.x - w.hero.x)).toBe(-before);
    const ids: string[] = [];
    for (let k = 0; k < 3; k++) {
      w.step({ ...NO_INTENT, attack: true });
      ids.push(w.hero.moveId);
      go(w, 26);
    }
    expect(ids).toEqual(['knee', 'knee', 'headbutt']);
    expect(['fall', 'down']).toContain(e.state);
  });

  it('forward + special is the Rafale flurry: many hits, then a launcher', () => {
    const { w, e } = setup();
    w.step({ ...NO_INTENT, mx: 1, special: true });
    expect(w.hero.moveId).toBe('rafale');
    let hits = 0;
    let sawEnd = false;
    for (let i = 0; i < 120; i++) {
      const hp = e.hp;
      w.step(NO_INTENT);
      if (e.hp < hp) hits++;
      if (w.hero.moveId === 'rafale_end') sawEnd = true;
    }
    expect(hits).toBeGreaterThanOrEqual(6);
    expect(sawEnd).toBe(true);
  });

  it('special with a full Aura meter is the super instead of the spin', () => {
    const { w } = setup();
    w.resolve = 100;
    w.step({ ...NO_INTENT, special: true });
    expect(w.hero.state).toBe('super');
  });
});
