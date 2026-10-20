// Stage layouts + the director that runs waves, holds and camera locks.

import { EnemyKind, VIEW_W } from './defs';
import type { Hold } from './types';
import type { World } from './world';

export interface Spawn {
  kind: EnemyKind;
  at: number;
  side: 'L' | 'R' | 'B';
  y?: number;
  boss?: boolean;
  variant?: number;
}

export interface Wave {
  spawns: Spawn[];
  tokens?: number;
}

export interface Segment {
  camX: number;
  waves: Wave[];
  /** Holds (door, fountain...) only matter while this segment is active. */
  holds?: string[];
  music?: 'stage' | 'boss';
  banner?: string;
}

export interface StageDef {
  key: 'boutique' | 'avenue';
  width: number;
  bandTop: number;
  bandBottom: number;
  treasure: 'stock' | 'heritage';
  holds: Hold[];
  standee?: { x: number; y: number };
  heroStart: { x: number; y: number; cross?: boolean };
  segments: Segment[];
}

export class Director {
  seg = 0;
  wave = -1;
  waveT = 0;
  active = false;
  pending: Spawn[] = [];
  go = false;
  holdsActive: string[] = [];
  private stage: StageDef;

  constructor(stage: StageDef) {
    this.stage = stage;
  }

  get segment(): Segment | undefined {
    return this.stage.segments[this.seg];
  }

  update(w: World): void {
    const seg = this.segment;
    if (!seg || w.stageClear) return;
    if (!this.active) {
      if (w.camX >= seg.camX - 0.5) {
        this.active = true;
        this.go = false;
        this.holdsActive = seg.holds ?? [];
        w.holds = w.stage.holds.filter((h) => this.holdsActive.includes(h.id));
        this.startWave(w, 0);
        if (seg.banner) w.emit({ type: 'text', key: seg.banner, x: w.camX + VIEW_W / 2, y: 60 });
      }
      return;
    }
    this.waveT++;
    for (const s of this.pending) {
      if (s.at <= this.waveT) {
        w.spawnEnemy(s.kind, s.side, s.y, { boss: s.boss, variant: s.variant });
        s.at = Infinity;
      }
    }
    this.pending = this.pending.filter((s) => s.at !== Infinity);
    if (this.pending.length === 0 && w.aliveEnemies().length === 0) {
      if (this.wave + 1 < seg.waves.length) this.startWave(w, this.wave + 1);
      else this.clearSegment(w);
    }
  }

  private startWave(w: World, i: number): void {
    const seg = this.segment!;
    this.wave = i;
    this.waveT = 0;
    const wave = seg.waves[i];
    this.pending = wave.spawns.map((s) => ({ ...s }));
    w.maxTokens = wave.tokens ?? 2;
  }

  /** Extra spawns mid-wave (boss reinforcements). */
  inject(w: World, spawns: Spawn[]): void {
    for (const s of spawns) this.pending.push({ ...s, at: this.waveT + s.at });
    void w;
  }

  private clearSegment(w: World): void {
    this.active = false;
    w.holds = [];
    if (this.seg + 1 >= this.stage.segments.length) {
      w.stageClear = true;
      w.emit({ type: 'stageClear' });
      return;
    }
    this.seg++;
    this.go = true;
    w.emit({ type: 'go' });
  }

  /** Where the camera wants to be: locked on a fight, or following the hero up to the next lock. */
  cameraTarget(w: World): number {
    const seg = this.segment;
    const maxX = this.stage.width - VIEW_W;
    if (!seg) return Math.min(maxX, w.camX);
    if (this.active) return seg.camX;
    const follow = w.hero.x - VIEW_W * 0.42;
    return Math.max(w.camX, Math.min(seg.camX, follow, maxX));
  }
}

// ---------------------------------------------------------------------------

export const BOUTIQUE: StageDef = {
  key: 'boutique',
  width: VIEW_W,
  bandTop: 154,
  bandBottom: 206,
  treasure: 'stock',
  holds: [
    { id: 'door', x: 192, y: 156, r: 16 },
    { id: 'window', x: 158, y: 156, r: 14 },
  ],
  standee: { x: 226, y: 155 },
  heroStart: { x: 192, y: 158, cross: true },
  segments: [
    {
      camX: 0,
      holds: ['door', 'window'],
      waves: [
        {
          tokens: 2,
          spawns: [
            { kind: 'capuche', at: 90, side: 'L' },
            { kind: 'capuche', at: 130, side: 'R' },
            { kind: 'pilleur', at: 260, side: 'R' },
            { kind: 'capuche', at: 380, side: 'L' },
          ],
        },
        {
          tokens: 2,
          spawns: [
            { kind: 'lanceur', at: 30, side: 'R' },
            { kind: 'capuche', at: 60, side: 'L' },
            { kind: 'pilleur', at: 140, side: 'L' },
            { kind: 'trottinette', at: 220, side: 'R' },
            { kind: 'pilleur', at: 320, side: 'R' },
            { kind: 'capuche', at: 380, side: 'R' },
          ],
        },
        {
          tokens: 3,
          spawns: [
            { kind: 'trottinette', at: 20, side: 'L' },
            { kind: 'capuche', at: 60, side: 'R' },
            { kind: 'pilleur', at: 90, side: 'R' },
            { kind: 'capuche', at: 120, side: 'L' },
            { kind: 'lanceur', at: 180, side: 'R' },
            { kind: 'pilleur', at: 240, side: 'L' },
            { kind: 'trottinette', at: 300, side: 'R' },
            { kind: 'capuche', at: 340, side: 'L' },
          ],
        },
        {
          tokens: 3,
          spawns: [
            { kind: 'costaud', at: 40, side: 'R' },
            { kind: 'capuche', at: 80, side: 'L' },
            { kind: 'pilleur', at: 120, side: 'L' },
            { kind: 'lanceur', at: 200, side: 'L' },
            { kind: 'pilleur', at: 260, side: 'R' },
            { kind: 'trottinette', at: 340, side: 'L' },
            { kind: 'capuche', at: 420, side: 'R' },
          ],
        },
        {
          tokens: 3,
          spawns: [{ kind: 'kickeur', at: 60, side: 'B', boss: true }, { kind: 'pilleur', at: 400, side: 'R' }, { kind: 'pilleur', at: 900, side: 'L' }],
        },
      ],
    },
  ],
};

export const AVENUE: StageDef = {
  key: 'avenue',
  width: 2880,
  bandTop: 150,
  bandBottom: 206,
  treasure: 'heritage',
  holds: [{ id: 'fountain', x: 2880 - VIEW_W / 2, y: 152, r: 30 }],
  heroStart: { x: 60, y: 176 },
  segments: [
    {
      camX: 220,
      waves: [
        { tokens: 2, spawns: [
          { kind: 'capuche', at: 20, side: 'R' }, { kind: 'capuche', at: 60, side: 'R' }, { kind: 'lanceur', at: 120, side: 'R' },
        ] },
        { tokens: 2, spawns: [
          { kind: 'trottinette', at: 20, side: 'R' }, { kind: 'capuche', at: 90, side: 'L' }, { kind: 'capuche', at: 140, side: 'R' },
        ] },
      ],
    },
    {
      camX: 860,
      banner: 'tram',
      waves: [
        { tokens: 2, spawns: [
          { kind: 'capuche', at: 10, side: 'R' }, { kind: 'costaud', at: 60, side: 'R' }, { kind: 'lanceur', at: 100, side: 'L' },
        ] },
        { tokens: 3, spawns: [
          { kind: 'trottinette', at: 20, side: 'L' }, { kind: 'trottinette', at: 160, side: 'R' }, { kind: 'capuche', at: 60, side: 'R' }, { kind: 'capuche', at: 100, side: 'L' },
        ] },
      ],
    },
    {
      camX: 1560,
      waves: [
        { tokens: 3, spawns: [
          { kind: 'capuche', at: 10, side: 'R' }, { kind: 'capuche', at: 40, side: 'L' }, { kind: 'lanceur', at: 70, side: 'R' }, { kind: 'costaud', at: 140, side: 'R' },
        ] },
        { tokens: 3, spawns: [
          { kind: 'costaud', at: 10, side: 'L' }, { kind: 'capuche', at: 40, side: 'R' }, { kind: 'trottinette', at: 120, side: 'R' }, { kind: 'lanceur', at: 160, side: 'L' },
        ] },
      ],
    },
    {
      camX: 2880 - VIEW_W,
      holds: ['fountain'],
      banner: 'massena',
      waves: [
        { tokens: 2, spawns: [
          { kind: 'pilleur', at: 30, side: 'L' }, { kind: 'capuche', at: 50, side: 'R' }, { kind: 'pilleur', at: 150, side: 'R' }, { kind: 'lanceur', at: 200, side: 'L' }, { kind: 'pilleur', at: 300, side: 'L' },
        ] },
        { tokens: 3, spawns: [
          { kind: 'costaud', at: 20, side: 'R' }, { kind: 'pilleur', at: 60, side: 'L' }, { kind: 'capuche', at: 90, side: 'L' }, { kind: 'pilleur', at: 200, side: 'R' }, { kind: 'trottinette', at: 260, side: 'L' },
        ] },
        { tokens: 2, spawns: [{ kind: 'pilote', at: 60, side: 'R', boss: true }] },
      ],
      music: 'boss',
    },
  ],
};

export const STAGES = { boutique: BOUTIQUE, avenue: AVENUE };
