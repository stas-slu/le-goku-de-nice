// The simulation. Pure TypeScript, stepped at a fixed 60 Hz by the scene.

import { hits, pushDir } from './combat';
import {
  BEAM, BOTTLE, ENEMY, EnemyKind, GRAVITY, HERO, HitDef, MOVES, MoveDef, RESOLVE, SHOCKWAVE, THROWN, VIEW_W,
} from './defs';
import { NO_INTENT } from './types';
import type { Fighter, GameEvent, Hold, Intent, Pickup, PickupKind, Projectile, Standee } from './types';
import { updateEnemy, newAi } from './ai';
import { Director, StageDef } from './stage';
import { rng } from './rng';

const BUFFER = 9;
type BufKey = 'attack' | 'jump' | 'special' | 'super';

export class World {
  tick = 0;
  fighters: Fighter[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  events: GameEvent[] = [];
  hero: Fighter;
  camX = 0;
  readonly stage: StageDef;
  readonly director: Director;
  holds: Hold[];
  treasure = 100;
  resolve = 0;
  score = 0;
  combo = 0;
  comboT = 0;
  maxCombo = 0;
  kos = 0;
  lives = HERO.lives;
  glassesOff = false;
  blindT = 0;
  retourT = 0;
  tokens = new Set<number>();
  maxTokens = 2;
  standee: Standee | null = null;
  standeeProp: { x: number; y: number } | null;
  stageClear = false;
  gameOver = false;
  boss: Fighter | null = null;
  rand: () => number;
  private nextId = 1;
  private buf = { attack: 0, jump: 0, special: 0, super: 0 };
  /** Most recent input, used to branch combo finishers on the held direction. */
  lastIntent: Intent = NO_INTENT;
  private deadT = 0;

  constructor(stage: StageDef, seed = 1234) {
    this.stage = stage;
    this.rand = rng(seed);
    this.holds = stage.holds.map((h) => ({ ...h }));
    this.standeeProp = stage.standee ? { ...stage.standee } : null;
    this.hero = this.makeFighter('hero', 'hero', 0, stage.heroStart.x, stage.heroStart.y);
    this.hero.hp = this.hero.maxHp = HERO.hp;
    this.hero.body = { ...HERO.body };
    this.fighters.push(this.hero);
    if (stage.heroStart.cross) {
      this.hero.state = 'cross';
      this.hero.anim = 'cross_arms';
    }
    this.director = new Director(stage);
    this.camX = stage.segments[0]?.camX ?? 0;
  }

  get bandTop(): number {
    return this.stage.bandTop;
  }
  get bandBottom(): number {
    return this.stage.bandBottom;
  }

  makeFighter(team: 'hero' | 'enemy', kind: Fighter['kind'], variant: number, x: number, y: number): Fighter {
    const stats = kind === 'hero' ? null : ENEMY[kind];
    return {
      id: this.nextId++, team, kind, variant, x, y, z: 0, vx: 0, vy: 0, vz: 0, facing: 1,
      hp: stats?.hp ?? 100, maxHp: stats?.hp ?? 100, recover: 0,
      state: 'idle', t: 0, stun: 0, move: null, moveId: '', moveT: 0, hitIds: new Set(), queued: null,
      anim: 'idle', frame: 0, freeze: 0, flash: 0, invuln: 0, juggle: 0, grabT: 0, grabOther: 0, grabHits: 0,
      body: stats ? { ...stats.body } : { ...HERO.body }, armor: false, ai: null, loot: 0, boss: false,
      entered: false, remove: false, scooter: null, rideHits: new Set(), idleT: 0, shake: 0,
    };
  }

  spawnEnemy(kind: EnemyKind, side: 'L' | 'R' | 'B', y?: number, opts: { boss?: boolean; variant?: number } = {}): Fighter {
    let s: 1 | -1 = side === 'L' ? -1 : 1;
    if (side === 'B') s = this.hero.facing === 1 ? -1 : 1;
    const x = s === -1 ? this.camX - 36 : this.camX + VIEW_W + 36;
    const yy = y ?? this.bandTop + 6 + this.rand() * (this.bandBottom - this.bandTop - 12);
    const v = opts.variant ?? Math.floor(this.rand() * 3);
    const f = this.makeFighter('enemy', kind, kind === 'kickeur' || kind === 'pilote' ? 0 : v, x, yy);
    f.facing = s === -1 ? 1 : -1;
    f.ai = newAi(f, s);
    f.boss = !!opts.boss;
    if (f.boss) {
      this.boss = f;
      this.events.push({ type: 'boss', key: kind });
    }
    if (kind === 'costaud' || kind === 'pilote') f.armor = false;
    this.fighters.push(f);
    return f;
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  // -------------------------------------------------------------------------

  step(intent: Intent): void {
    this.tick++;
    this.lastIntent = intent;
    this.bufferInput(intent);
    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;
    if (this.retourT > 0) this.retourT--;
    if (this.glassesOff) {
      this.blindT++;
      if (this.blindT > 360) this.glassesBack();
    }

    this.updateStandee();
    for (const f of this.fighters) this.updateFighter(f, intent);
    this.updateProjectiles();
    this.updatePickups();
    this.resolveHits();
    this.director.update(this);
    this.updateCamera();
    this.fighters = this.fighters.filter((f) => !f.remove);
    this.projectiles = this.projectiles.filter((p) => !p.remove);
    this.pickups = this.pickups.filter((p) => !p.remove);
    if (this.boss?.remove) this.boss = null;
  }

  private bufferInput(i: Intent): void {
    const b = this.buf;
    b.attack = i.attack ? BUFFER : Math.max(0, b.attack - 1);
    b.jump = i.jump ? BUFFER : Math.max(0, b.jump - 1);
    b.special = i.special ? BUFFER : Math.max(0, b.special - 1);
    b.super = i.super ? BUFFER : Math.max(0, b.super - 1);
  }

  private consume(k: BufKey): boolean {
    if (this.buf[k] > 0) {
      this.buf[k] = 0;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Fighters

  private updateFighter(f: Fighter, intent: Intent): void {
    if (f.flash > 0) f.flash--;
    if (f.freeze > 0) {
      if (--f.freeze === 0) f.shake = 0;
      return;
    }
    if (f.invuln > 0) f.invuln--;
    f.t++;

    switch (f.state) {
      case 'attack':
        this.updateMove(f);
        break;
      case 'hurt':
        f.vx *= 0.82;
        f.anim = 'hurt';
        if (f.t >= f.stun) this.toIdle(f);
        break;
      case 'fall':
        f.anim = 'knockdown';
        f.frame = f.vz > 0.5 ? 0 : 1;
        break;
      case 'down':
        f.anim = 'down';
        f.frame = 0;
        f.vx *= 0.7;
        if (f.t >= (f.team === 'hero' ? 34 : 44)) {
          if (f.hp <= 0) this.kill(f);
          else this.setState(f, 'getup');
        }
        break;
      case 'getup':
        f.anim = 'getup';
        f.frame = Math.min(2, Math.floor(f.t / 9));
        f.invuln = 2;
        if (f.t >= 26) {
          this.toIdle(f);
          f.invuln = f.team === 'hero' ? 50 : 14;
          if (f.team === 'hero') this.retourT = 200;
        }
        break;
      case 'dead':
        f.anim = 'down';
        if (f.team === 'hero') {
          this.updateHeroDeath();
        } else if (f.t > 50) f.remove = true;
        break;
      case 'grabbed': {
        f.anim = 'grabbed';
        const g = this.byId(f.grabOther);
        const held = g && (g.state === 'grab' || (g.state === 'attack' && !!g.move?.grabOnly));
        if (f.t > 110 || !held) {
          this.setState(f, 'hurt');
          f.stun = 10;
          f.vx = -f.facing * 1.2;
        }
        break;
      }
      case 'thrown':
        f.anim = 'thrown';
        f.frame = Math.floor(f.t / 6) % 2;
        this.thrownCollide(f);
        break;
      default:
        if (f.team === 'hero') this.controlHero(f, intent);
        else updateEnemy(this, f);
    }

    this.integrate(f);
  }

  setState(f: Fighter, s: Fighter['state']): void {
    if (f.state === 'attack' && f.team === 'enemy') this.tokens.delete(f.id);
    f.state = s;
    f.t = 0;
    f.move = null;
    f.armor = false;
  }

  toIdle(f: Fighter): void {
    this.setState(f, 'idle');
    f.anim = 'idle';
    f.juggle = 0;
  }

  startMove(f: Fighter, id: string): void {
    const m = MOVES[id];
    if (f.state === 'attack' && f.team === 'enemy') this.tokens.delete(f.id);
    f.state = 'attack';
    f.t = 0;
    f.move = m;
    f.moveId = id;
    f.moveT = 0;
    f.hitIds.clear();
    f.queued = null;
    f.armor = !!m.armor;
    if (m.invuln) f.invuln = Math.max(f.invuln, m.steps.reduce((a, s) => a + s[2], 0));
    if (m.hpCost && f.team === 'hero') {
      const cost = Math.min(m.hpCost, f.hp - 1);
      f.hp -= cost;
      f.recover += cost;
    }
    if (!m.air) {
      f.vx = 0;
      f.vy = 0;
    }
    if (m.dive !== undefined) {
      f.vz = m.dive;
      f.vx *= 0.5;
    }
    if (m.sfx === 'whoosh' || m.sfx === 'heavy') this.emit({ type: 'whoosh', heavy: m.sfx === 'heavy' });
    if (m.steps[0][0] === 'flykick') this.emit({ type: 'warn', x: f.x, y: f.y, side: f.facing });
  }

  /** 4th hit of the chain: neutral kick, toward = shoulder charge, up = launcher, down = sweep. */
  private pickFinisher(f: Fighter): string {
    const i = this.lastIntent;
    if (i.my < 0) return 'uppercut';
    if (i.my > 0) return 'sweepkick';
    if (i.mx === f.facing) return 'charge';
    return 'kick';
  }

  private moveLength(m: MoveDef): number {
    return m.steps.reduce((a, s) => a + s[2], 0);
  }

  private updateMove(f: Fighter): void {
    const m = f.move!;
    const t = f.moveT++;
    // multi-hit moves re-arm once per advanced tick (never while frozen in hitstop)
    if (m.rehit && t > m.active[0] && (t - m.active[0]) % m.rehit === 0) f.hitIds.clear();
    // which step are we on
    let acc = 0;
    for (const [anim, fr, ticks] of m.steps) {
      if (t < acc + ticks) {
        f.anim = anim;
        f.frame = fr;
        break;
      }
      acc += ticks;
    }
    if (m.lunge && (!m.lungeAt || (t >= m.lungeAt[0] && t < m.lungeAt[1]))) f.vx = f.facing * m.lunge;
    else if (!m.air) f.vx *= 0.6;
    if (m.jump && t === m.jump.at) {
      f.vz = m.jump.vz;
      f.z = Math.max(f.z, 0.5);
    }
    if (m.spawn && t === m.spawn.at) this.spawnBottle(f);

    // combo chaining for the hero
    if (f.team === 'hero' && m.next && m.cancel !== undefined && t >= m.cancel && this.consume('attack')) {
      f.queued = m.next === 'finisher' ? this.pickFinisher(f) : m.next;
    }
    if (f.queued && f.hitIds.size >= 0 && t >= (m.cancel ?? 999) + 1) {
      const next = f.queued;
      // only continue the chain if the previous hit connected or we are still close
      this.startMove(f, next);
      return;
    }
    if (m.air) {
      if (f.z <= 0 && t > 2) {
        this.toIdle(f);
        this.emit({ type: 'land', x: f.x, y: f.y, big: false });
      }
      return;
    }
    if (t + 1 >= this.moveLength(m)) {
      if (m.then) {
        const keep = f.invuln;
        this.startMove(f, m.then);
        f.invuln = Math.max(f.invuln, keep);
        return;
      }
      if (f.moveId === 'knee' && this.byId(f.grabOther)?.state === 'grabbed') {
        f.state = 'grab';
        f.move = null;
        f.t = 30;
        return;
      }
      this.toIdle(f);
      if (f.team === 'enemy') this.tokens.delete(f.id);
    }
  }

  private integrate(f: Fighter): void {
    if (f.state === 'grabbed') return;
    f.x += f.vx;
    f.y += f.vy;
    const airborne = f.z > 0 || f.vz !== 0;
    if (airborne) {
      f.z += f.vz;
      f.vz -= GRAVITY;
      if (f.z <= 0) {
        f.z = 0;
        this.land(f);
      }
    }
    // lane bounds
    if (f.y < this.bandTop) f.y = this.bandTop;
    if (f.y > this.bandBottom) f.y = this.bandBottom;
    // horizontal bounds
    if (f.team === 'hero') {
      const lo = this.camX + 12;
      const hi = this.camX + VIEW_W - 12;
      if (f.x < lo) f.x = lo;
      if (f.x > hi) f.x = hi;
    } else {
      const onScreen = f.x > this.camX + 8 && f.x < this.camX + VIEW_W - 8;
      if (onScreen) f.entered = true;
      const escaping = f.state === 'carry' || f.state === 'ride' || f.ai?.mode === 'flee';
      if (f.entered && !escaping) {
        const lo = this.camX + 6;
        const hi = this.camX + VIEW_W - 6;
        if (f.x < lo) {
          f.x = lo;
          if (f.state === 'fall' || f.state === 'thrown') this.wallBounce(f, 1);
        }
        if (f.x > hi) {
          f.x = hi;
          if (f.state === 'fall' || f.state === 'thrown') this.wallBounce(f, -1);
        }
      }
    }
  }

  private wallBounce(f: Fighter, dir: 1 | -1): void {
    if (Math.abs(f.vx) > 1.5) {
      f.vx = dir * Math.abs(f.vx) * 0.5;
      f.vz = Math.max(f.vz, 2.4);
      f.hp = Math.max(0, f.hp - 4);
      f.freeze = 6;
      f.shake = 2;
      this.emit({ type: 'wall', x: f.x, y: f.y, z: f.z + 24 });
    }
  }

  private land(f: Fighter): void {
    if (f.state === 'fall' || f.state === 'thrown') {
      if (f.state === 'thrown') {
        f.hp -= 6;
        this.setState(f, 'fall');
      }
      if (f.vz < -2.2 && f.juggle < 3) {
        f.vz = -f.vz * 0.32;
        f.vx *= 0.6;
        f.z = 0.1;
        f.juggle = Math.max(f.juggle, 1);
        this.emit({ type: 'land', x: f.x, y: f.y, big: true });
        return;
      }
      f.vz = 0;
      this.setState(f, 'down');
      f.juggle = 0;
      this.emit({ type: 'land', x: f.x, y: f.y, big: true });
      return;
    }
    f.vz = 0;
    if (f.state === 'jump') {
      this.toIdle(f);
      this.emit({ type: 'land', x: f.x, y: f.y, big: false });
    }
  }

  kill(f: Fighter): void {
    this.setState(f, 'dead');
    f.vx = 0;
    if (f.team === 'enemy') {
      this.kos++;
      this.score += ENEMY[f.kind as EnemyKind].score;
      this.emit({ type: 'ko', x: f.x, y: f.y, kind: f.kind, boss: f.boss });
      this.tokens.delete(f.id);
      if (f.kind === 'costaud' && this.rand() < 0.6) this.dropPickup('socca', f.x, f.y);
      if (f.boss) this.dropPickup('panbagnat', f.x, f.y);
    } else {
      this.emit({ type: 'heroDown' });
    }
  }

  // -------------------------------------------------------------------------
  // Hero control

  private controlHero(h: Fighter, i: Intent): void {
    const st = h.state;
    if (st === 'super') {
      h.anim = 'command';
      h.frame = Math.floor(h.t / 8) % 2;
      h.vx = 0;
      h.vy = 0;
      h.invuln = 2;
      if (!this.standee) this.toIdle(h);
      return;
    }
    if (st === 'pickup') {
      h.anim = 'pickup';
      h.frame = 0;
      h.vx = h.vy = 0;
      if (h.t >= 12) this.toIdle(h);
      return;
    }
    if (st === 'respawn') {
      h.anim = 'jump';
      h.frame = 2;
      h.invuln = 90;
      if (h.z <= 0) {
        this.toIdle(h);
        this.shockwave(h);
      }
      return;
    }
    if (st === 'grab') {
      this.controlGrab(h, i);
      return;
    }
    if (st === 'jump') {
      h.anim = 'jump';
      h.frame = h.vz > 1 ? 1 : 2;
      if (this.consume('attack')) {
        this.startMove(h, i.my > 0 ? 'diveelbow' : 'jumpkick');
      }
      return;
    }

    // grounded, actionable: idle / walk / run / cross
    if (this.consume('super') && this.resolve >= 100) {
      this.startSuper(h);
      return;
    }
    if (this.consume('special')) {
      if (i.mx && i.mx !== h.facing) h.facing = i.mx > 0 ? 1 : -1;
      this.startMove(h, i.mx === h.facing ? 'rafale' : 'special');
      return;
    }
    if (this.consume('jump')) {
      this.setState(h, 'jump');
      h.vz = HERO.jumpVz;
      h.z = 0.5;
      h.vx = i.mx * (i.run ? HERO.runX * 0.8 : HERO.walkX * 1.1);
      h.vy = i.my * HERO.walkY * 0.6;
      if (i.mx) h.facing = i.mx > 0 ? 1 : -1;
      this.emit({ type: 'jump' });
      return;
    }
    if (this.consume('attack')) {
      if (st === 'run') {
        this.startMove(h, 'dropkick');
        return;
      }
      const behind = this.nearestEnemy(h, -h.facing, 34, 8);
      if (behind && i.mx === -h.facing) {
        this.startMove(h, 'elbow');
        return;
      }
      if (i.mx) h.facing = i.mx > 0 ? 1 : -1;
      this.startMove(h, 'jab1');
      return;
    }

    const moving = i.mx !== 0 || i.my !== 0;
    if (moving) {
      if (i.mx) h.facing = i.mx > 0 ? 1 : -1;
      const sp = i.run && i.mx ? HERO.runX : HERO.walkX;
      h.vx = i.mx * sp;
      h.vy = i.my * HERO.walkY;
      const s = i.run && i.mx ? 'run' : 'walk';
      if (h.state !== s) {
        h.state = s;
        h.t = 0;
      }
      h.anim = s;
      h.frame = Math.floor(h.t / (s === 'run' ? 4 : 6)) % (s === 'run' ? 6 : 8);
      h.idleT = 0;
      this.tryGrab(h, i);
    } else {
      h.vx = 0;
      h.vy = 0;
      h.idleT++;
      const inHold = this.heroHold() !== null;
      if (inHold && h.idleT > 40) {
        if (h.state !== 'cross') {
          h.state = 'cross';
          h.t = 0;
        }
        h.anim = 'cross_arms';
        h.frame = Math.floor(h.t / 30) % 2;
        this.addResolve(RESOLVE.crossArmsPerTick);
      } else {
        if (h.state !== 'idle') {
          h.state = 'idle';
          h.t = 0;
        }
        h.anim = 'idle';
        h.frame = Math.floor(h.t / 10) % 4;
      }
    }
    // "Retour au poste": get knocked down, get back up, return to the door.
    if (this.retourT > 0 && this.heroHold()) {
      this.retourT = 0;
      this.addResolve(RESOLVE.retourAuPoste);
      this.emit({ type: 'text', key: 'retour', x: h.x, y: h.y - 70 });
    }
  }

  heroHold(): Hold | null {
    const h = this.hero;
    for (const hd of this.holds) if (Math.abs(h.x - hd.x) < hd.r && Math.abs(h.y - hd.y) < 12) return hd;
    return null;
  }

  private tryGrab(h: Fighter, i: Intent): void {
    if (!i.mx) {
      h.grabT = 0;
      return;
    }
    const e = this.nearestEnemy(h, h.facing, 22, 5);
    if (!e || !ENEMY[e.kind as EnemyKind].grabbable || e.z > 0 || e.scooter) {
      h.grabT = 0;
      return;
    }
    if (!['idle', 'walk', 'hurt', 'taunt', 'steal', 'carry'].includes(e.state)) return;
    if (++h.grabT < 5) return;
    h.grabT = 0;
    this.setState(h, 'grab');
    h.anim = 'grab';
    h.grabOther = e.id;
    h.grabHits = 0;
    h.vx = h.vy = 0;
    this.setState(e, 'grabbed');
    e.grabOther = h.id;
    e.facing = -h.facing as 1 | -1;
    e.vx = e.vy = 0;
    this.tokens.delete(e.id);
    if (e.loot > 0) this.returnLoot(e);
  }

  private controlGrab(h: Fighter, i: Intent): void {
    const e = this.byId(h.grabOther);
    if (!e || e.state !== 'grabbed') {
      this.toIdle(h);
      return;
    }
    h.anim = 'grab';
    h.frame = 0;
    e.x = h.x + h.facing * 15;
    e.y = h.y + 0.5;
    e.z = 0;
    if (h.t > 100 || this.consume('jump')) {
      this.setState(e, 'hurt');
      e.stun = 12;
      e.vx = h.facing * 1.5;
      this.toIdle(h);
      return;
    }
    if (this.consume('attack')) {
      if ((i.mx && i.mx === -h.facing) || h.grabHits >= 2) {
        this.doThrow(h, e, (i.mx && i.mx === -h.facing ? -h.facing : h.facing) as 1 | -1);
        return;
      }
      h.grabHits++;
      // knee (or the up+attack headbutt): attacks that only target the held enemy
      const keep = h.grabOther;
      this.startMove(h, i.my < 0 ? 'headbutt' : 'knee');
      h.grabOther = keep;
      e.t = 0;
    }
  }

  private doThrow(h: Fighter, e: Fighter, dir: 1 | -1): void {
    h.facing = dir as 1 | -1;
    this.setState(h, 'attack');
    h.move = { steps: [['throw', 0, 6], ['throw', 1, 8], ['throw', 2, 10]], active: [0, 0], hit: THROWN };
    h.moveId = 'throw';
    h.moveT = 0;
    this.setState(e, 'thrown');
    e.x = h.x + dir * 8;
    e.z = 6;
    e.vz = 3.2;
    e.vx = dir * 3.6;
    e.facing = -dir as 1 | -1;
    e.hitIds.clear();
    e.invuln = 0;
    this.emit({ type: 'throw' });
    this.emit({ type: 'whoosh', heavy: true });
  }

  private thrownCollide(f: Fighter): void {
    for (const o of this.fighters) {
      if (o === f || o.team !== f.team || f.hitIds.has(o.id)) continue;
      if (['dead', 'down', 'thrown', 'grabbed'].includes(o.state) || o.invuln > 0) continue;
      if (hits(f, THROWN, o)) {
        f.hitIds.add(o.id);
        this.applyHit(this.hero, o, THROWN, f.vx > 0 ? 1 : -1, f);
      }
    }
  }

  private startSuper(h: Fighter): void {
    this.resolve = 0;
    // aim at the bigger crowd
    const foes = this.aliveEnemies();
    const right = foes.filter((e) => e.x > h.x).length;
    if (right !== foes.length - right) h.facing = right > foes.length - right ? 1 : -1;
    this.setState(h, 'super');
    h.invuln = 300;
    const prop = this.standeeProp;
    const fromProp = !!prop && Math.abs(prop.x - h.x) < VIEW_W;
    const startX = fromProp ? prop!.x : h.x - h.facing * 220;
    this.standee = {
      phase: 'wake', t: 0, x: startX, y: fromProp ? prop!.y : h.y, homeX: startX, homeY: fromProp ? prop!.y : h.y,
      facing: h.facing, fromProp,
    };
    this.emit({ type: 'super' });
    this.emit({ type: 'text', key: 'kamenice', x: h.x, y: h.y - 80 });
  }

  private updateStandee(): void {
    const s = this.standee;
    if (!s) return;
    s.t++;
    const h = this.hero;
    // freeze the world for the cinematic
    if (s.phase !== 'fire' && s.phase !== 'back') {
      for (const f of this.fighters) if (f.team === 'enemy') f.freeze = Math.max(f.freeze, 2);
    }
    const tx = h.x - s.facing * 26;
    const ty = h.y - 2;
    switch (s.phase) {
      case 'wake':
        if (s.t > 30) {
          s.phase = 'leap';
          s.t = 0;
        }
        break;
      case 'leap': {
        const k = Math.min(1, s.t / 18);
        s.x = s.homeX + (tx - s.homeX) * k;
        s.y = s.homeY + (ty - s.homeY) * k;
        if (s.t >= 18) {
          s.phase = 'charge';
          s.t = 0;
        }
        break;
      }
      case 'charge':
        s.x = tx;
        s.y = ty;
        if (s.t >= 46) {
          s.phase = 'fire';
          s.t = 0;
          this.emit({ type: 'beam' });
          this.fireBeam(s);
        }
        break;
      case 'fire':
        if (s.t % 10 === 0 && s.t > 0 && s.t < 40) this.fireBeam(s, true);
        if (s.t >= 50) {
          s.phase = 'back';
          s.t = 0;
        }
        break;
      case 'back': {
        const k = Math.min(1, s.t / 18);
        s.x = tx + (s.homeX - tx) * k;
        s.y = ty + (s.homeY - ty) * k;
        if (s.t >= 18) {
          this.standee = null;
          if (h.state === 'super') this.toIdle(h);
        }
        break;
      }
    }
  }

  private fireBeam(s: Standee, chip = false): void {
    const src = { x: s.x + s.facing * 10, y: s.y, z: 0, facing: s.facing, body: { w: 10, h: 50 } };
    const hit: HitDef = chip ? { ...BEAM, damage: 4, launch: 2, push: 1 } : BEAM;
    for (const e of this.fighters) {
      if (e.team !== 'enemy' || e.state === 'dead') continue;
      if (hits(src, hit, e)) {
        e.freeze = 0;
        this.applyHit(this.hero, e, hit, s.facing, null, true);
      }
    }
    for (const p of this.projectiles) p.remove = true;
  }

  private shockwave(h: Fighter): void {
    for (const e of this.fighters) {
      if (e.team !== 'enemy' || e.state === 'dead') continue;
      if (hits(h, SHOCKWAVE, e)) this.applyHit(h, e, SHOCKWAVE, pushDir(h, e), null, true);
    }
    this.emit({ type: 'respawn' });
  }

  private updateHeroDeath(): void {
    if (++this.deadT !== 70) return;
    if (this.lives > 1) {
      this.lives--;
      this.respawnHero();
    } else {
      this.lives = 0;
      this.gameOver = true;
      this.emit({ type: 'gameOver' });
    }
  }

  private respawnHero(): void {
    const h = this.hero;
    h.hp = h.maxHp;
    h.recover = 0;
    h.x = Math.max(this.camX + 40, Math.min(this.camX + VIEW_W - 40, h.x));
    this.setState(h, 'respawn');
    h.z = 140;
    h.vz = -1;
    this.glassesBack();
    this.deadT = 0;
  }

  /** Arcade continue: full lives, score reset. */
  continueGame(): void {
    this.gameOver = false;
    this.lives = HERO.lives;
    this.score = 0;
    this.respawnHero();
  }

  // -------------------------------------------------------------------------
  // Hits

  private resolveHits(): void {
    for (const a of this.fighters) {
      if (a.state !== 'attack' || !a.move || a.freeze > 0) continue;
      const m = a.move;
      const t = a.moveT - 1;
      if (t < m.active[0] || t >= m.active[1] || m.hit.damage <= 0 && !m.hit.knockdown) continue;
      for (const v of this.fighters) {
        if (v.team === a.team || a.hitIds.has(v.id)) continue;
        if (v.state === 'dead' || v.state === 'down' || v.state === 'getup' || v.invuln > 0) continue;
        if (v.state === 'grabbed' && v.grabOther !== a.id) continue;
        if (m.grabOnly && v.id !== a.grabOther) continue;
        if (!hits(a, m.hit, v)) continue;
        a.hitIds.add(v.id);
        this.applyHit(a, v, m.hit, m.hit.allAround ? pushDir(a, v) : a.moveId === 'elbow' ? (-a.facing as 1 | -1) : a.facing);
      }
    }
  }

  /** Riding enemies call this every tick for contact damage. */
  contactHit(a: Fighter, hit: HitDef): void {
    const v = this.hero;
    if (a.rideHits.has(v.id) || v.invuln > 0 || ['dead', 'down', 'getup', 'super'].includes(v.state)) return;
    if (!hits(a, hit, v)) return;
    a.rideHits.add(v.id);
    this.applyHit(a, v, hit, a.facing);
  }

  applyHit(a: Fighter, v: Fighter, hit: HitDef, dir: 1 | -1, thrown: Fighter | null = null, noFreezeAttacker = false): void {
    if (v.team === 'hero' && (v.state === 'super' || v.invuln > 0)) return;
    const toHero = v.team === 'hero';
    v.hp = Math.max(0, v.hp - hit.damage);
    if (toHero) {
      v.recover = 0;
      this.combo = 0;
      this.comboT = 0;
    } else if (a.team === 'hero') {
      this.combo++;
      this.comboT = 100;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 10 * this.combo;
      this.addResolve(RESOLVE.perHit);
      // SoR4-style: landing hits wins back health spent on specials
      if (this.hero.recover > 0) {
        const r = Math.min(this.hero.recover, 2);
        this.hero.recover -= r;
        this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + r);
      }
      if (this.combo > 0 && this.combo % 8 === 0) {
        this.emit({ type: 'cheer' });
        this.addResolve(RESOLVE.cheer);
      }
      this.emit({ type: 'combo', n: this.combo });
      if ([10, 20, 30, 50].includes(this.combo)) {
        this.emit({ type: 'text', key: `rate_${this.combo}`, x: this.hero.x, y: this.hero.y - 74 });
      }
    }
    if (v.loot > 0) this.returnLoot(v);

    const wasGrabbed = v.state === 'grabbed';
    const knock = (hit.knockdown && !(wasGrabbed && a.moveId === 'knee')) || v.z > 0 || v.hp <= 0 || v.state === 'fall';
    if (!thrown && !noFreezeAttacker) a.freeze = hit.stop;
    v.freeze = hit.stop;
    v.flash = 6;
    v.shake = hit.heavy ? 2 : 1;
    if (a.team === 'hero' && hit.heavy && knock) {
      this.emit({ type: 'impact', x: v.x, y: v.y, z: v.z + v.body.h * 0.55, dir });
    }
    this.emit({ type: 'hit', x: v.x, y: v.y, z: v.z + Math.min(v.body.h - 10, hit.box.z + hit.box.h / 2), heavy: !!hit.heavy, toHero, dmg: hit.damage });

    if (v.scooter) {
      this.emit({ type: 'scooter', x: v.x, y: v.y, big: v.scooter === 'big' });
      v.scooter = null;
      if (v.ai) v.ai.mode = 'brawl';
    }
    if (v.armor && v.hp > 0 && !thrown) return;

    if (knock) {
      if (v.state === 'fall') v.juggle++;
      this.setState(v, 'fall');
      const j = v.juggle > 1 ? 0.55 : 1;
      v.vz = (hit.launch ?? 2.6) * j;
      v.z = Math.max(v.z, 0.5);
      v.vx = dir * hit.push * 0.9;
      v.vy = 0;
      if (v.juggle >= 3) v.invuln = 30;
      if (toHero && hit.glasses && !this.glassesOff) this.knockGlasses(v, dir);
    } else {
      if (wasGrabbed) {
        v.t = 0;
        v.flash = 6;
        return;
      }
      this.setState(v, 'hurt');
      v.stun = hit.stun;
      v.vx = dir * hit.push * 0.6;
      v.vy = 0;
      v.frame = hit.box.z > 22 ? 0 : 1;
    }
    v.facing = -dir as 1 | -1;
    if (v.team === 'enemy') this.tokens.delete(v.id);
  }

  private returnLoot(v: Fighter): void {
    this.treasure = Math.min(100, this.treasure + v.loot);
    this.emit({ type: 'loot', x: v.x, y: v.y, amount: v.loot });
    v.loot = 0;
    if (v.ai && v.ai.mode === 'carry') v.ai.mode = 'flee';
  }

  addResolve(n: number): void {
    this.resolve = Math.min(100, this.resolve + n);
  }

  // -------------------------------------------------------------------------
  // Glasses

  private knockGlasses(h: Fighter, dir: number): void {
    this.glassesOff = true;
    this.blindT = 0;
    const p = this.dropPickup('glasses', h.x, h.y);
    p.vx = dir * (1.2 + this.rand());
    p.vz = 3.4;
    p.z = 40;
    this.emit({ type: 'glassesOff', x: h.x, y: h.y });
  }

  private glassesBack(): void {
    if (!this.glassesOff) return;
    this.glassesOff = false;
    for (const p of this.pickups) if (p.kind === 'glasses') p.remove = true;
    this.emit({ type: 'glassesOn' });
  }

  dropPickup(kind: PickupKind, x: number, y: number): Pickup {
    const p: Pickup = { id: this.nextId++, kind, x, y, z: 10, vx: 0, vz: 2, t: 0, remove: false };
    this.pickups.push(p);
    return p;
  }

  private updatePickups(): void {
    const h = this.hero;
    for (const p of this.pickups) {
      p.t++;
      if (p.z > 0 || p.vz > 0) {
        p.x += p.vx;
        p.z += p.vz;
        p.vz -= GRAVITY;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = Math.abs(p.vz) > 1.5 ? -p.vz * 0.35 : 0;
          p.vx *= 0.5;
        }
      }
      p.x = Math.max(this.camX + 10, Math.min(this.camX + VIEW_W - 10, p.x));
      if (p.kind === 'scooter') {
        p.vx *= 0.96;
        if (p.t > 240) p.remove = true;
        continue;
      }
      const grounded = ['idle', 'walk', 'run', 'cross'].includes(h.state);
      if (grounded && p.t > 20 && Math.abs(p.x - h.x) < 12 && Math.abs(p.y - h.y) < 8) {
        p.remove = true;
        this.setState(h, 'pickup');
        if (p.kind === 'glasses') this.glassesBack();
        else {
          const heal = p.kind === 'socca' ? 30 : 60;
          h.hp = Math.min(h.maxHp, h.hp + heal);
          h.recover = 0;
          this.emit({ type: 'text', key: p.kind, x: h.x, y: h.y - 70 });
        }
        this.emit({ type: 'pickup', kind: p.kind });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Projectiles

  private spawnBottle(f: Fighter): void {
    const h = this.hero;
    const dx = h.x - f.x;
    const T = Math.max(30, Math.min(70, Math.abs(dx) / 2.6));
    const g = GRAVITY * 0.8;
    this.projectiles.push({
      id: this.nextId++, kind: 'bottle', x: f.x + f.facing * 8, y: f.y, z: 44,
      vx: dx / T, vz: (g * T) / 2 - 44 / T, owner: f.id, remove: false,
    });
  }

  private updateProjectiles(): void {
    const h = this.hero;
    for (const p of this.projectiles) {
      p.x += p.vx;
      p.z += p.vz;
      p.vz -= GRAVITY * 0.8;
      if (p.z <= 0) {
        p.remove = true;
        this.emit({ type: 'glass', x: p.x, y: p.y, z: 0 });
        continue;
      }
      if (h.invuln > 0 || ['dead', 'down', 'getup', 'super', 'fall'].includes(h.state)) continue;
      const src = { x: p.x, y: p.y, z: p.z, facing: (p.vx >= 0 ? 1 : -1) as 1 | -1, body: { w: 6, h: 6 } };
      if (hits(src, BOTTLE, h)) {
        p.remove = true;
        this.applyHit(h, h, BOTTLE, src.facing, null, true);
        this.emit({ type: 'glass', x: p.x, y: p.y, z: p.z });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers

  byId(id: number): Fighter | undefined {
    return this.fighters.find((f) => f.id === id);
  }

  nearestEnemy(h: Fighter, dir: number, range: number, depth: number): Fighter | null {
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const e of this.fighters) {
      if (e.team === h.team || e.state === 'dead' || e.state === 'down') continue;
      const dx = (e.x - h.x) * dir;
      if (dx < 0 || dx > range || Math.abs(e.y - h.y) > depth) continue;
      if (dx < bd) {
        bd = dx;
        best = e;
      }
    }
    return best;
  }

  aliveEnemies(): Fighter[] {
    return this.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead');
  }

  requestToken(f: Fighter): boolean {
    if (this.tokens.has(f.id)) return true;
    if (this.tokens.size >= this.maxTokens) return false;
    this.tokens.add(f.id);
    return true;
  }

  private updateCamera(): void {
    const target = this.director.cameraTarget(this);
    if (target > this.camX) this.camX = Math.min(target, this.camX + 2.4);
  }
}
