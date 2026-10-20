// Keyboard (QWERTY + AZERTY), gamepad and on-screen touch controls, merged
// into one Intent per tick.

import Phaser from 'phaser';
import type { Intent } from '../game/types';

type Btn = 'attack' | 'jump' | 'special' | 'pause' | 'confirm';

export class Controls {
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prev: Record<Btn, boolean> = { attack: false, jump: false, special: false, pause: false, confirm: false };
  private lastTap = { dir: 0, tick: -100 };
  private running = false;
  private prevMx = 0;
  private tick = 0;
  touch: TouchPad | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      const names = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'A', 'S', 'D', 'Q', 'P', 'ESC', 'ENTER', 'SPACE', 'M'];
      for (const n of names) this.keys[n] = kb.addKey(n, true, false);
      // Latch presses ourselves: Phaser clears _justDown on key-up, so a tap
      // that starts and ends between two polls would otherwise be lost.
      for (const b of Object.keys(Controls.KEYS) as Btn[]) {
        for (const n of Controls.KEYS[b]) this.keys[n]?.on('down', () => (this.latch[b] = true));
      }
      const dirs: Record<'up' | 'down' | 'left' | 'right', string[]> = { up: ['UP'], down: ['DOWN'], left: ['LEFT'], right: ['RIGHT'] };
      for (const [d, ks] of Object.entries(dirs)) for (const n of ks) this.keys[n]?.on('down', () => (this.dirLatch[d as keyof typeof dirs] = true));
    }
  }

  private down(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown);
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.getPad(0) ?? null;
  }

  private static readonly KEYS: Record<Btn, string[]> = {
    // arrows move; three action buttons side by side. AZERTY: Q is the physical A.
    attack: ['A', 'Q'],
    jump: ['S', 'SPACE'],
    special: ['D'],
    pause: ['ESC', 'P'],
    confirm: ['ENTER'],
  };

  private latch: Partial<Record<Btn, boolean>> = {};
  private dirLatch: Partial<Record<'up' | 'down' | 'left' | 'right', boolean>> = {};

  private justPressed(b: Btn): boolean {
    const hit = !!this.latch[b];
    this.latch[b] = false;
    return hit;
  }

  private held(): Record<Btn, boolean> & { mx: number; my: number } {
    const p = this.pad();
    const t = this.touch?.state();
    let mx = (this.down('RIGHT') ? 1 : 0) - (this.down('LEFT') ? 1 : 0);
    let my = (this.down('DOWN') ? 1 : 0) - (this.down('UP') ? 1 : 0);
    const b = (i: number) => !!p && !!p.buttons[i]?.pressed;
    if (p) {
      const ax = p.axes.length > 0 ? p.axes[0].getValue() : 0;
      const ay = p.axes.length > 1 ? p.axes[1].getValue() : 0;
      if (Math.abs(ax) > 0.4) mx = Math.sign(ax);
      if (Math.abs(ay) > 0.4) my = Math.sign(ay);
      if (b(14)) mx = -1;
      if (b(15)) mx = 1;
      if (b(12)) my = -1;
      if (b(13)) my = 1;
    }
    if (t) {
      if (t.mx) mx = t.mx;
      if (t.my) my = t.my;
    }
    // non-keyboard sources are edge-detected against the previous tick
    return {
      mx,
      my,
      attack: b(2) || !!t?.attack,
      jump: b(0) || !!t?.jump,
      special: b(1) || b(3) || b(4) || b(5) || !!t?.special,
      pause: b(9),
      confirm: b(9) || b(0),
    };
  }

  private edges(h: Record<Btn, boolean>): Record<Btn, boolean> {
    const out = {} as Record<Btn, boolean>;
    for (const k of Object.keys(Controls.KEYS) as Btn[]) out[k] = this.justPressed(k) || (h[k] && !this.prev[k]);
    this.prev = { ...h };
    return out;
  }

  /** Edge-triggered menu actions. */
  menu(): { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean } {
    const h = this.held();
    const e = this.edges(h);
    const dl = this.dirLatch;
    const r = {
      up: !!dl.up || (h.my < 0 && this.prevMy >= 0),
      down: !!dl.down || (h.my > 0 && this.prevMy <= 0),
      left: !!dl.left || (h.mx < 0 && this.prevMx2 >= 0),
      right: !!dl.right || (h.mx > 0 && this.prevMx2 <= 0),
      confirm: e.confirm || e.attack,
      back: e.pause,
    };
    this.dirLatch = {};
    this.prevMy = h.my;
    this.prevMx2 = h.mx;
    return r;
  }
  private prevMy = 0;
  private prevMx2 = 0;

  /** Per-tick game intent with pressed-edges and double-tap run detection. */
  intent(): Intent & { pause: boolean } {
    this.tick++;
    const h = this.held();
    if (h.mx !== 0 && this.prevMx === 0) {
      if (this.lastTap.dir === h.mx && this.tick - this.lastTap.tick < 16) this.running = true;
      this.lastTap = { dir: h.mx, tick: this.tick };
    }
    if (h.mx === 0) this.running = false;
    if (this.touch?.state().run) this.running = true;
    this.prevMx = h.mx;
    const e = this.edges(h);
    return { mx: h.mx, my: h.my, run: this.running, attack: e.attack, jump: e.jump, special: e.special, pause: e.pause };
  }

  muteKey(): boolean {
    return !!this.keys.M && Phaser.Input.Keyboard.JustDown(this.keys.M);
  }
}

// ---------------------------------------------------------------------------

export interface TouchState {
  mx: number;
  my: number;
  run: boolean;
  attack: boolean;
  jump: boolean;
  special: boolean;
}

/** Virtual stick (left half) + four buttons (right side). */
export class TouchPad {
  private scene: Phaser.Scene;
  private stickId = -1;
  private origin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private buttons: Array<{ key: keyof TouchState; x: number; y: number; r: number; down: boolean; label: string }>;
  private gfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  enabled: boolean;

  constructor(scene: Phaser.Scene, w: number, h: number) {
    this.scene = scene;
    this.enabled = scene.sys.game.device.input.touch;
    this.buttons = [
      { key: 'attack', x: w - 30, y: h - 28, r: 16, down: false, label: 'A' },
      { key: 'jump', x: w - 66, y: h - 18, r: 14, down: false, label: 'B' },
      { key: 'special', x: w - 50, y: h - 62, r: 13, down: false, label: 'SP' },
    ];
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(10000);
    for (const b of this.buttons) {
      this.labels.push(scene.add.bitmapText(b.x, b.y - 5, 'font', b.label).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10001).setAlpha(0.8));
    }
    scene.input.addPointer(3);
    scene.input.on('pointerdown', () => {
      this.enabled = true;
    });
    this.setVisible(this.enabled);
  }

  setVisible(v: boolean): void {
    this.gfx.setVisible(v);
    for (const l of this.labels) l.setVisible(v);
  }

  state(): TouchState {
    const s: TouchState = { mx: 0, my: 0, run: false, attack: false, jump: false, special: false };
    if (!this.enabled) return s;
    const cam = this.scene.cameras.main;
    const pointers = this.scene.input.manager.pointers.filter((p) => p.isDown);
    for (const b of this.buttons) b.down = false;
    let stickSeen = false;
    for (const p of pointers) {
      const x = p.x / cam.zoom;
      const y = p.y / cam.zoom;
      if (x < cam.width / cam.zoom / 2) {
        if (this.stickId !== p.id) {
          this.stickId = p.id;
          this.origin = { x, y };
        }
        stickSeen = true;
        this.vec = { x: x - this.origin.x, y: y - this.origin.y };
      } else {
        for (const b of this.buttons) if (Math.hypot(x - b.x, y - b.y) < b.r + 6) b.down = true;
      }
    }
    if (!stickSeen) {
      this.stickId = -1;
      this.vec = { x: 0, y: 0 };
    }
    const dz = 6;
    s.mx = this.vec.x > dz ? 1 : this.vec.x < -dz ? -1 : 0;
    s.my = this.vec.y > dz ? 1 : this.vec.y < -dz ? -1 : 0;
    s.run = Math.abs(this.vec.x) > 26;
    for (const b of this.buttons) (s as unknown as Record<string, boolean>)[b.key] = b.down;
    return s;
  }

  draw(): void {
    if (!this.enabled) return;
    this.setVisible(true);
    const g = this.gfx;
    g.clear();
    if (this.stickId >= 0) {
      g.lineStyle(1, 0xffffff, 0.35).strokeCircle(this.origin.x, this.origin.y, 24);
      const l = Math.min(24, Math.hypot(this.vec.x, this.vec.y));
      const a = Math.atan2(this.vec.y, this.vec.x);
      g.fillStyle(0xffffff, 0.35).fillCircle(this.origin.x + Math.cos(a) * l, this.origin.y + Math.sin(a) * l, 9);
    }
    for (const b of this.buttons) {
      g.fillStyle(b.key === 'special' ? 0xffd84a : b.key === 'attack' ? 0xe0443c : 0x2f6fc4, b.down ? 0.6 : 0.28).fillCircle(b.x, b.y, b.r);
      g.lineStyle(1, 0xffffff, 0.5).strokeCircle(b.x, b.y, b.r);
    }
  }
}
