import { describe, expect, it } from 'vitest';
import { hits, pushDir } from '../src/game/combat';
import { MOVES } from '../src/game/defs';

const body = { w: 18, h: 54 };
const jab = MOVES.jab1.hit;

describe('depth-tolerant hit detection', () => {
  it('hits a target in front on the same lane', () => {
    expect(hits({ x: 100, y: 170, z: 0, facing: 1, body }, jab, { x: 118, y: 170, z: 0, facing: -1, body })).toBe(true);
  });

  it('misses a target behind the attacker', () => {
    expect(hits({ x: 100, y: 170, z: 0, facing: 1, body }, jab, { x: 80, y: 170, z: 0, facing: 1, body })).toBe(false);
  });

  it('mirrors the attack box when facing left', () => {
    expect(hits({ x: 100, y: 170, z: 0, facing: -1, body }, jab, { x: 82, y: 170, z: 0, facing: 1, body })).toBe(true);
    expect(hits({ x: 100, y: 170, z: 0, facing: -1, body }, jab, { x: 118, y: 170, z: 0, facing: 1, body })).toBe(false);
  });

  it('is generous within the depth tolerance but not beyond it', () => {
    const a = { x: 100, y: 170, z: 0, facing: 1 as const, body };
    expect(hits(a, jab, { x: 118, y: 170 + jab.depth, z: 0, facing: -1, body })).toBe(true);
    expect(hits(a, jab, { x: 118, y: 170 + jab.depth + 1, z: 0, facing: -1, body })).toBe(false);
  });

  it('respects height: a sweep does not hit an airborne target', () => {
    const sweep = MOVES.sweep.hit;
    const a = { x: 100, y: 170, z: 0, facing: 1 as const, body };
    expect(hits(a, sweep, { x: 115, y: 170, z: 0, facing: -1, body })).toBe(true);
    expect(hits(a, sweep, { x: 115, y: 170, z: 30, facing: -1, body })).toBe(false);
  });

  it('all-around attacks hit both sides', () => {
    const spin = MOVES.special.hit;
    const a = { x: 100, y: 170, z: 0, facing: 1 as const, body };
    expect(hits(a, spin, { x: 75, y: 170, z: 0, facing: 1, body })).toBe(true);
    expect(hits(a, spin, { x: 125, y: 170, z: 0, facing: -1, body })).toBe(true);
    expect(pushDir(a, { x: 75, y: 170, z: 0, facing: 1, body })).toBe(-1);
  });
});
