import type { HitDef } from './defs';

export interface Body {
  x: number;
  y: number;
  z: number;
  facing: 1 | -1;
  body: { w: number; h: number };
}

/** World-space x-range of an attack box for an attacker facing left or right. */
export function attackRange(a: Body, hit: HitDef): [number, number] {
  const { x, w } = hit.box;
  if (hit.allAround) return [a.x + x, a.x + x + w];
  return a.facing === 1 ? [a.x + x, a.x + x + w] : [a.x - x - w, a.x - x];
}

/**
 * Depth-tolerant beat 'em up hit test: the attack box must overlap the
 * victim's body on x and z, and the two must stand on roughly the same lane.
 */
export function hits(a: Body, hit: HitDef, v: Body): boolean {
  if (Math.abs(a.y - v.y) > hit.depth) return false;
  const [ax0, ax1] = attackRange(a, hit);
  const vx0 = v.x - v.body.w / 2;
  const vx1 = v.x + v.body.w / 2;
  if (ax1 < vx0 || ax0 > vx1) return false;
  const az0 = a.z + hit.box.z;
  const az1 = az0 + hit.box.h;
  const vz0 = v.z;
  const vz1 = v.z + v.body.h;
  return !(az1 < vz0 || az0 > vz1);
}

/** Direction the victim gets pushed. */
export function pushDir(a: Body, v: Body): 1 | -1 {
  const d = v.x - a.x;
  if (Math.abs(d) < 0.01) return a.facing;
  return d > 0 ? 1 : -1;
}
