import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { BOUTIQUE, StageDef } from '../src/game/stage';
import { NO_INTENT, Intent } from '../src/game/types';
import { MOVES } from '../src/game/defs';

// A quiet test arena: no scripted waves.
const ARENA: StageDef = { ...BOUTIQUE, segments: [{ camX: 0, holds: ['door', 'window'], waves: [{ spawns: [{ kind: 'capuche', at: 1e9, side: 'L' }] }] }] };

function arena(): World {
  const w = new World(ARENA, 7);
  w.step(NO_INTENT); // let the director arm the segment
  w.hero.state = 'idle';
  w.hero.x = 150;
  w.hero.y = 180;
  return w;
}

function press(over: Partial<Intent>): Intent {
  return { ...NO_INTENT, ...over };
}

function run(w: World, n: number, intent: Intent = NO_INTENT): void {
  for (let i = 0; i < n; i++) w.step(intent);
}

function placeEnemy(w: World, kind: Parameters<World['spawnEnemy']>[0], x: number, y: number) {
  const e = w.spawnEnemy(kind, 'R', y);
  e.x = x;
  e.y = y;
  e.entered = true;
  e.ai!.cd = 1e9; // passive
  return e;
}

describe('hero combat', () => {
  it('a jab connects, damages and triggers hitstop on both fighters', () => {
    const w = arena();
    const e = placeEnemy(w, 'capuche', 168, 180);
    e.facing = -1;
    w.hero.facing = 1;
    w.step(press({ attack: true }));
    let frozeAt = -1;
    for (let i = 0; i < 12 && frozeAt < 0; i++) {
      w.step(NO_INTENT);
      if (e.hp < e.maxHp) frozeAt = i;
    }
    expect(e.hp).toBe(e.maxHp - MOVES.jab1.hit.damage);
    expect(w.hero.freeze).toBe(MOVES.jab1.hit.stop);
    expect(e.freeze).toBe(MOVES.jab1.hit.stop);
    expect(e.state).toBe('hurt');
  });

  it('chains jab -> jab -> cross -> kick and the finisher knocks down', () => {
    const w = arena();
    const e = placeEnemy(w, 'capuche', 168, 180);
    e.hp = e.maxHp = 999;
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      // mash attack every 4 ticks
      w.step(i % 4 === 0 ? press({ attack: true }) : NO_INTENT);
      if (w.hero.state === 'attack') seen.add(w.hero.moveId);
      if (e.state === 'fall') break;
    }
    expect([...seen]).toEqual(['jab1', 'jab2', 'cross', 'kick']);
    expect(e.state).toBe('fall');
    expect(w.combo).toBe(4);
  });

  it('special costs recoverable health which comes back by landing hits', () => {
    const w = arena();
    w.step(press({ special: true }));
    expect(w.hero.hp).toBe(100 - MOVES.special.hpCost!);
    expect(w.hero.recover).toBe(MOVES.special.hpCost);
    run(w, 40);
    const e = placeEnemy(w, 'capuche', 168, 180);
    e.hp = e.maxHp = 999;
    w.step(press({ attack: true }));
    run(w, 20);
    expect(w.hero.hp).toBeGreaterThan(100 - MOVES.special.hpCost!);
  });

  it('getting hit drops the recoverable health', () => {
    const w = arena();
    w.step(press({ special: true }));
    run(w, 40);
    const e = placeEnemy(w, 'capuche', 172, 180);
    e.facing = -1;
    w.startMove(e, 'punch');
    run(w, 30);
    expect(w.hero.recover).toBe(0);
  });

  it('walking into an enemy grabs, knees twice then throws', () => {
    const w = arena();
    const e = placeEnemy(w, 'capuche', 168, 180);
    e.hp = e.maxHp = 999;
    for (let i = 0; i < 20 && w.hero.state !== 'grab'; i++) w.step(press({ mx: 1 }));
    expect(w.hero.state).toBe('grab');
    expect(e.state).toBe('grabbed');
    for (let k = 0; k < 2; k++) {
      w.step(press({ attack: true }));
      run(w, 24);
      expect(w.hero.state).toBe('grab');
    }
    w.step(press({ attack: true }));
    expect(e.state).toBe('thrown');
  });
});

describe('crowd control', () => {
  it('never lets more enemies attack at once than the token budget', () => {
    const w = arena();
    w.maxTokens = 2;
    for (let i = 0; i < 6; i++) {
      const e = w.spawnEnemy('capuche', i % 2 ? 'L' : 'R', 170 + i * 4);
      e.hp = e.maxHp = 9999;
    }
    w.hero.hp = w.hero.maxHp = 1e9;
    let peak = 0;
    for (let i = 0; i < 1500; i++) {
      w.step(NO_INTENT);
      const attacking = w.fighters.filter((f) => f.team === 'enemy' && f.state === 'attack').length;
      peak = Math.max(peak, attacking);
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('pilleurs and the shop stock', () => {
  it('a pilleur steals from an unguarded entrance and hitting him returns the loot', () => {
    const w = arena();
    w.hero.x = 330; // away from both entrances
    const p = placeEnemy(w, 'pilleur', 60, 170);
    p.ai!.cd = 0;
    for (let i = 0; i < 400 && p.state !== 'steal'; i++) w.step(NO_INTENT);
    expect(p.state).toBe('steal');
    run(w, 60);
    expect(w.treasure).toBeLessThan(100);
    const stolen = p.loot;
    expect(stolen).toBeGreaterThan(0);
    const before = w.treasure;
    w.applyHit(w.hero, p, MOVES.jab1.hit, 1);
    expect(p.loot).toBe(0);
    expect(w.treasure).toBeCloseTo(before + stolen, 5);
  });

  it('standing in the doorway blocks the steal', () => {
    const w = arena();
    const door = w.holds.find((h) => h.id === 'door')!;
    const win = w.holds.find((h) => h.id === 'window')!;
    w.hero.x = door.x;
    w.hero.y = door.y + 2;
    w.holds = [door]; // only the door is open
    void win;
    const p = placeEnemy(w, 'pilleur', 300, 170);
    p.ai!.cd = 0;
    run(w, 400);
    expect(p.state).not.toBe('steal');
    expect(w.treasure).toBe(100);
  });

  it('an escaping carrier takes the stock for good', () => {
    const w = arena();
    w.hero.x = 330;
    const p = placeEnemy(w, 'pilleur', 100, 170);
    for (let i = 0; i < 1200 && !p.remove; i++) w.step(NO_INTENT);
    expect(p.remove).toBe(true);
    expect(w.treasure).toBeLessThan(100);
  });
});

describe('glasses', () => {
  it('a heavy hit knocks the glasses off, and they come back on their own', () => {
    const w = arena();
    const e = placeEnemy(w, 'costaud', 178, 180);
    e.facing = -1;
    w.startMove(e, 'haymaker');
    run(w, 60);
    expect(w.glassesOff).toBe(true);
    expect(w.pickups.some((p) => p.kind === 'glasses')).toBe(true);
    e.remove = true;
    run(w, 400);
    expect(w.glassesOff).toBe(false);
  });
});

describe('director', () => {
  it('runs every wave of the boutique and declares the stage clear', () => {
    const w = new World(BOUTIQUE, 3);
    let waves = new Set<number>();
    for (let i = 0; i < 20000 && !w.stageClear; i++) {
      w.step(NO_INTENT);
      waves.add(w.director.wave);
      // god mode: KO anything that has entered
      w.hero.hp = w.hero.maxHp;
      for (const f of w.fighters) if (f.team === 'enemy' && f.state !== 'dead' && f.entered) w.kill(f);
    }
    expect(w.stageClear).toBe(true);
    expect(waves.size).toBe(BOUTIQUE.segments[0].waves.length);
  });

  it('the super clears the screen', () => {
    const w = arena();
    const es = [placeEnemy(w, 'capuche', 220, 180), placeEnemy(w, 'capuche', 260, 170), placeEnemy(w, 'capuche', 300, 190)];
    w.resolve = 100;
    w.hero.facing = 1;
    w.step(press({ super: true }));
    expect(w.hero.state).toBe('super');
    run(w, 200);
    for (const e of es) expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.standee).toBeNull();
    expect(w.resolve).toBeLessThan(100);
  });
});
