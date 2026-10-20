import Phaser from 'phaser';
import { World } from '../game/world';
import { STAGES, StageDef } from '../game/stage';
import { VIEW_H, VIEW_W } from '../game/defs';
import type { Fighter, GameEvent } from '../game/types';
import { Controls } from '../input/controls';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y } from '../art/rig';
import { hasFlare } from '../art/characters';
import { sfx, unlockAudio, toggleMute } from '../audio/audio';
import { BOSS_SONG, STAGE_SONG, music } from '../audio/music';
import { t } from '../i18n/strings';

export interface StageData {
  stage: 'boutique' | 'avenue';
  score: number;
  lives: number;
}

interface View {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  scooter: Phaser.GameObjects.Image | null;
  halo: Phaser.GameObjects.Image | null;
}

const STEP_MS = 1000 / 60;

export class StageScene extends Phaser.Scene {
  world!: World;
  controls!: Controls;
  stageKey: StageData['stage'] = 'boutique';
  private def!: StageDef;
  private views = new Map<number, View>();
  private pickupViews = new Map<number, Phaser.GameObjects.Image>();
  private bottleViews = new Map<number, Phaser.GameObjects.Sprite>();
  private acc = 0;
  private blur: Phaser.Filters.Blur | null = null;
  private standeeProp: Phaser.GameObjects.Sprite | null = null;
  private standeeLive: Phaser.GameObjects.Sprite | null = null;
  private orb: Phaser.GameObjects.Sprite | null = null;
  private beam: Phaser.GameObjects.Sprite[] = [];
  private beamHead: Phaser.GameObjects.Sprite | null = null;
  private flash!: Phaser.GameObjects.Rectangle;
  private dim!: Phaser.GameObjects.Rectangle;
  private police: Phaser.GameObjects.Image[] = [];
  private figures: Phaser.GameObjects.Image[] = [];
  private goArrow!: Phaser.GameObjects.Image;
  private clearT = -1;
  private slowmo = 0;
  private frameN = 0;
  private ambientT = 0;
  elapsed = 0;

  constructor() {
    super('stage');
  }

  init(data: StageData): void {
    this.stageKey = data.stage ?? 'boutique';
    this.def = STAGES[this.stageKey];
    this.world = new World(this.def, (Date.now() & 0xffff) + 1);
    this.world.score = data.score ?? 0;
    this.world.lives = data.lives ?? 3;
    this.views.clear();
    this.pickupViews.clear();
    this.bottleViews.clear();
    this.beam = [];
    this.police = [];
    this.figures = [];
    this.acc = 0;
    this.slowmo = 0;
    this.clearT = -1;
    this.elapsed = 0;
  }

  create(): void {
    const W = VIEW_W;
    this.controls = new Controls(this);
    this.cameras.main.setBounds(0, 0, this.def.width, VIEW_H);
    this.add.image(0, 0, this.stageKey === 'boutique' ? 'bg_boutique' : 'bg_avenue').setOrigin(0, 0).setDepth(-100);

    const cam = this.cameras.main;
    this.blur = cam.filters.internal.addBlur(0, 1, 1, 0.8);
    this.blur.setActive(false);

    this.flash = this.add.rectangle(0, 0, W, VIEW_H, 0xffffff).setOrigin(0).setScrollFactor(0).setDepth(5000).setAlpha(0);
    this.dim = this.add.rectangle(0, 0, W, VIEW_H, 0x0d0716).setOrigin(0).setScrollFactor(0).setDepth(900).setAlpha(0);
    this.goArrow = this.add.image(W - 40, 70, 't_go').setScrollFactor(0).setDepth(4000).setVisible(false);

    if (this.def.standee) {
      this.standeeProp = this.add.sprite(this.def.standee.x, this.def.standee.y, 'standee_card', 'stand_0')
        .setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H).setDepth(this.def.standee.y - 1);
    }
    this.setupAmbience();

    this.scene.launch('hud', { stage: this });
    this.events.once('shutdown', () => {
      this.scene.stop('hud');
    });

    this.input.keyboard?.on('keydown', () => unlockAudio());
    this.input.on('pointerdown', () => unlockAudio());
    unlockAudio();
    music.play(STAGE_SONG);

    this.banner(t(this.stageKey === 'boutique' ? 'stage1' : 'stage2'), this.stageKey === 'boutique' ? t('ready') : '');
  }

  // -------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.controls.muteKey()) toggleMute();
    // slow-motion on the last KO of a wave / the boss
    const scale = this.slowmo > 0 ? 0.33 : 1;
    if (this.slowmo > 0) this.slowmo -= delta;
    this.acc += Math.min(delta, 100) * scale;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < 5) {
      this.acc -= STEP_MS;
      steps++;
      const intent = this.controls.intent();
      if (intent.pause && !this.world.gameOver) {
        this.scene.launch('pause', { stage: this });
        this.scene.pause();
        return;
      }
      if (this.world.gameOver) break;
      this.world.step(intent);
      this.elapsed++;
      this.handleEvents(this.world.events);
      this.world.events.length = 0;
      this.ambientTick();
      if (this.clearT >= 0 && ++this.clearT > 150) {
        this.finishStage();
        return;
      }
    }
    this.render();
  }

  private handleEvents(evs: GameEvent[]): void {
    const cam = this.cameras.main;
    for (const e of evs) {
      switch (e.type) {
        case 'hit': {
          const key = e.heavy ? 'spark_l' : 'spark_s';
          const s = this.add.sprite(e.x + (Math.random() - 0.5) * 6, e.y - e.z, key).setDepth(e.y + 2);
          s.play(key);
          s.once('animationcomplete', () => s.destroy());
          if (e.heavy) cam.shake(90, 0.006);
          else if (e.toHero) cam.shake(60, 0.004);
          sfx(e.toHero ? 'heroHit' : e.heavy ? 'hitHeavy' : 'hit');
          break;
        }
        case 'whoosh':
          sfx(e.heavy ? 'whooshHeavy' : 'whoosh');
          break;
        case 'land': {
          const d = this.add.sprite(e.x, e.y + 1, 'dust').setDepth(e.y + 1).setOrigin(0.5, 1);
          d.play('dust');
          d.once('animationcomplete', () => d.destroy());
          if (e.big) {
            sfx('land');
            cam.shake(50, 0.003);
          }
          break;
        }
        case 'ko':
          sfx('ko');
          if (e.boss || (this.world.aliveEnemies().length === 0 && this.world.director.pending.length === 0)) this.slowmo = 650;
          if (e.boss) {
            this.flashScreen(0.8, 400);
            cam.shake(300, 0.01);
            this.popup('K.O. !', e.x, e.y - 70, 0xffd84a, true);
          }
          break;
        case 'glassesOff':
          sfx('glassesOff');
          this.popup(t('glasses_off'), e.x, e.y - 74, 0xa8e4f4);
          break;
        case 'glassesOn':
          sfx('pickup');
          break;
        case 'glass':
          sfx('glass');
          this.shards(e.x, e.y, e.z);
          break;
        case 'loot':
          sfx('loot');
          this.popup(`${t('saved')} +${Math.round(e.amount)}%`, e.x, e.y - 66, 0x6ccc4a);
          break;
        case 'stolen':
          sfx('stolen');
          this.popup(`${t('stolen')} -${Math.round(e.amount)}%`, this.world.camX + VIEW_W / 2, 80, 0xff6b5a, true);
          break;
        case 'stealing':
          sfx('stealing');
          break;
        case 'text':
          if (e.key === 'tram' || e.key === 'massena') this.banner(t(e.key), '');
          else this.popup(t(e.key), e.x, e.y, e.key === 'kamenice' ? 0x6ef0f0 : 0xfff3a0, e.key === 'kamenice');
          break;
        case 'cheer':
          sfx('cheer');
          this.cheer();
          break;
        case 'warn':
          sfx('warn');
          this.warnIcon(e.x, e.y);
          break;
        case 'super':
          sfx('charge');
          this.tweens.add({ targets: this.dim, alpha: 0.55, duration: 200 });
          this.flashScreen(0.6, 200);
          break;
        case 'beam':
          sfx('beam');
          cam.shake(700, 0.012);
          this.flashScreen(0.55, 120);
          this.tweens.add({ targets: this.dim, alpha: 0, duration: 600, delay: 400 });
          break;
        case 'scooter':
          sfx('shutter');
          this.scooterDebris(e.x, e.y, e.big);
          break;
        case 'pickup':
          sfx('pickup');
          break;
        case 'respawn': {
          this.flashScreen(0.7, 250);
          const d = this.add.sprite(this.world.hero.x, this.world.hero.y, 'spark_l').setDepth(999).setScale(2);
          d.play('spark_l');
          d.once('animationcomplete', () => d.destroy());
          cam.shake(200, 0.008);
          break;
        }
        case 'go':
          sfx('go');
          this.goArrow.setVisible(true);
          break;
        case 'boss':
          music.play(BOSS_SONG);
          this.banner(t(`boss_${e.key}`), '');
          break;
        case 'stageClear':
          this.clearT = 0;
          music.stop();
          sfx('select');
          break;
        case 'gameOver':
          this.time.delayedCall(600, () => {
            this.scene.launch('gameover', { stage: this });
            this.scene.pause();
          });
          break;
        case 'throw':
          sfx('throw');
          break;
        case 'impact': {
          sfx('crunch');
          const ring = this.add.sprite(e.x, e.y, 'ring').setDepth(e.y + 0.2);
          ring.play('ring');
          ring.once('animationcomplete', () => ring.destroy());
          const st = this.add.sprite(e.x, e.y - e.z, 'streak').setOrigin(e.dir > 0 ? 0.1 : 0.9, 0.5).setFlipX(e.dir < 0).setDepth(e.y + 3);
          st.play('streak');
          st.once('animationcomplete', () => st.destroy());
          // impact frame: a dark beat, then white
          this.dim.setAlpha(0.45);
          this.time.delayedCall(34, () => {
            this.dim.setAlpha(0);
            this.flashScreen(0.35, 90);
          });
          cam.shake(170, 0.012);
          break;
        }
        case 'wall': {
          sfx('wall');
          const sp = this.add.sprite(e.x, e.y - e.z, 'spark_l').setDepth(e.y + 2).setScale(1.3);
          sp.play('spark_l');
          sp.once('animationcomplete', () => sp.destroy());
          cam.shake(140, 0.01);
          break;
        }
        case 'combo':
          break;
        case 'jump':
          sfx('jump');
          break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rendering

  private render(): void {
    this.frameN++;
    const w = this.world;
    const cam = this.cameras.main;
    cam.scrollX = Math.round(w.camX);
    const alive = new Set<number>();
    for (const f of w.fighters) {
      alive.add(f.id);
      this.renderFighter(f);
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        v.spr.destroy();
        v.shadow.destroy();
        v.scooter?.destroy();
        v.halo?.destroy();
        this.views.delete(id);
      }
    }
    // pickups
    const seenP = new Set<number>();
    for (const p of w.pickups) {
      seenP.add(p.id);
      let img = this.pickupViews.get(p.id);
      if (!img) {
        const key = p.kind === 'scooter' ? 'scooter_s' : p.kind;
        img = this.add.image(p.x, p.y, key).setOrigin(0.5, 1);
        this.pickupViews.set(p.id, img);
      }
      const bob = p.z <= 0 && p.kind !== 'glasses' ? Math.round(Math.sin(p.t / 8)) : 0;
      img.setPosition(Math.round(p.x), Math.round(p.y - p.z - bob)).setDepth(p.y);
      img.setVisible(p.t < 600 || p.t % 8 < 5);
    }
    for (const [id, img] of this.pickupViews) if (!seenP.has(id)) {
      img.destroy();
      this.pickupViews.delete(id);
    }
    // bottles
    const seenB = new Set<number>();
    for (const b of w.projectiles) {
      seenB.add(b.id);
      let s = this.bottleViews.get(b.id);
      if (!s) {
        s = this.add.sprite(b.x, b.y, 'bottle').play('bottle');
        this.bottleViews.set(b.id, s);
      }
      s.setPosition(Math.round(b.x), Math.round(b.y - b.z)).setDepth(b.y + 1);
    }
    for (const [id, s] of this.bottleViews) if (!seenB.has(id)) {
      s.destroy();
      this.bottleViews.delete(id);
    }
    this.renderStandee();
    // glasses blur
    if (this.blur) {
      const on = w.glassesOff;
      this.blur.setActive(on);
      if (on) this.blur.strength = 0.75 + Math.sin(this.elapsed / 14) * 0.2;
    }
    if (!this.world.director.go) this.goArrow.setVisible(false);
    else this.goArrow.setVisible(Math.floor(this.elapsed / 20) % 2 === 0);
  }

  private textureFor(f: Fighter): string {
    return f.kind === 'hero' ? 'hero' : `${f.kind}_${f.variant}`;
  }

  private renderFighter(f: Fighter): void {
    let v = this.views.get(f.id);
    if (!v) {
      const spr = this.add.sprite(f.x, f.y, this.textureFor(f), 'idle_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H);
      const shadow = this.add.image(f.x, f.y, 'shadow').setAlpha(0.9);
      v = { spr, shadow, scooter: null, halo: null };
      this.views.set(f.id, v);
    }
    const tex = this.textureFor(f);
    let frame = `${f.anim}_${f.frame}`;
    const texture = this.textures.get(tex);
    if (!texture.has(frame)) frame = texture.has(`${f.anim}_0`) ? `${f.anim}_0` : 'idle_0';
    v.spr.setFrame(frame);
    v.spr.setFlipX(f.facing === -1);
    let yOff = 0;
    if (f.scooter) {
      const key = f.scooter === 'big' ? 'scooter_b' : 'scooter_s';
      if (!v.scooter) v.scooter = this.add.image(f.x, f.y, key).setOrigin(0.5, 1);
      v.scooter.setFlipX(f.facing === -1).setPosition(Math.round(f.x), Math.round(f.y + 2)).setDepth(f.y + 0.4).setVisible(true);
      yOff = f.scooter === 'big' ? -12 : -4;
    } else if (v.scooter) {
      v.scooter.destroy();
      v.scooter = null;
    }
    // impact: the victim trembles while frozen in hitstop
    const jitter = f.freeze > 0 && f.shake ? (this.frameN % 2 === 0 ? f.shake : -f.shake) : 0;
    v.spr.setPosition(Math.round(f.x + jitter), Math.round(f.y - f.z + yOff));
    // dust while sliding from knockback
    if (f.z === 0 && Math.abs(f.vx) > 1.3 && (f.state === 'hurt' || f.state === 'fall' || f.state === 'down') && this.frameN % 4 === 0) {
      const d = this.add.sprite(f.x - Math.sign(f.vx) * 6, f.y + 1, 'dust').setOrigin(0.5, 1).setScale(0.6).setDepth(f.y - 0.5);
      d.play('dust');
      d.once('animationcomplete', () => d.destroy());
    }
    // lit flares: red glow + smoke
    const flare = f.team === 'enemy' && hasFlare(f.kind, f.variant) && ['idle', 'walk', 'taunt'].includes(f.anim);
    if (flare) {
      if (!v.halo) v.halo = this.add.image(0, 0, 'halo').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff4a3a).setScale(1.6);
      const hx = f.x + f.facing * 12;
      const hy = f.y - f.z - 58;
      v.halo.setVisible(true).setPosition(Math.round(hx), Math.round(hy)).setDepth(f.y + 1).setAlpha(0.55 + Math.sin(this.frameN * 0.5) * 0.15);
      if (this.frameN % 9 === 0) {
        const sm = this.add.sprite(hx, hy, 'smoke').setDepth(f.y + 0.9).setAlpha(0.7).setTint(0xd8a0a0);
        sm.play('smoke');
        this.tweens.add({ targets: sm, y: hy - 30, x: hx + (Math.random() - 0.5) * 16, alpha: 0, duration: 1200, onComplete: () => sm.destroy() });
      }
    } else v.halo?.setVisible(false);
    v.spr.setDepth(f.y + (f.team === 'hero' ? 0.5 : 0));
    const s = Math.max(0.4, 1 - f.z / 120);
    v.shadow.setPosition(Math.round(f.x), Math.round(f.y)).setDepth(f.y - 0.6).setScale(s, s).setVisible(f.state !== 'dead' || f.t % 4 < 2);
    // hit flash / blink
    if (f.flash > 0 && f.flash % 3 !== 0) v.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (f.armor && f.state === 'attack' && this.elapsed % 6 < 3) v.spr.setTint(0xff8a8a).setTintMode(Phaser.TintModes.MULTIPLY);
    else v.spr.clearTint();
    let alpha = 1;
    if (f.state === 'dead' && f.team === 'enemy') alpha = f.t % 6 < 3 ? 1 : 0.2;
    else if (f.team === 'hero' && f.invuln > 0 && f.state !== 'super' && f.state !== 'getup') alpha = this.elapsed % 6 < 3 ? 1 : 0.45;
    v.spr.setAlpha(alpha);
  }

  private renderStandee(): void {
    const s = this.world.standee;
    if (this.standeeProp) this.standeeProp.setVisible(!s || !s.fromProp);
    if (!s) {
      this.standeeLive?.setVisible(false);
      this.orb?.setVisible(false);
      this.beamHead?.setVisible(false);
      for (const b of this.beam) b.setVisible(false);
      return;
    }
    if (!this.standeeLive) {
      this.standeeLive = this.add.sprite(s.x, s.y, 'standee', 'stand_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H);
      this.orb = this.add.sprite(0, 0, 'orb').play('orb');
      this.beamHead = this.add.sprite(0, 0, 'beamhead').play('beamhead');
    }
    const live = this.standeeLive;
    live.setVisible(true).setFlipX(s.facing === -1).setDepth(s.y + 0.6);
    let frame = 'stand_0';
    let hop = 0;
    if (s.phase === 'wake') {
      frame = 'stand_0';
      if (s.t % 6 < 3) live.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else live.clearTint();
    } else {
      live.clearTint();
      if (s.phase === 'leap' || s.phase === 'back') hop = Math.sin(Math.min(1, s.t / 18) * Math.PI) * 30;
      if (s.phase === 'charge') frame = `charge_${Math.floor(s.t / 6) % 2}`;
      if (s.phase === 'fire') frame = `fire_${Math.floor(s.t / 4) % 2}`;
    }
    live.setFrame(frame).setPosition(Math.round(s.x), Math.round(s.y - hop));
    const handX = s.x + s.facing * 14;
    const handY = s.y - 36;
    this.orb!.setVisible(s.phase === 'charge').setPosition(Math.round(s.x - s.facing * 8), Math.round(s.y - 30)).setDepth(s.y + 1).setScale(1 + s.t / 50);
    const firing = s.phase === 'fire';
    this.beamHead!.setVisible(firing).setPosition(Math.round(handX + s.facing * 8), Math.round(handY)).setDepth(s.y + 2).setFlipX(s.facing === -1);
    const end = s.facing === 1 ? this.world.camX + VIEW_W + 16 : this.world.camX - 16;
    const n = Math.ceil(Math.abs(end - handX) / 16);
    while (this.beam.length < n) this.beam.push(this.add.sprite(0, 0, 'beam').play('beam'));
    this.beam.forEach((b, i) => {
      const on = firing && i < n;
      b.setVisible(on);
      if (on) {
        const sc = s.t > 40 ? Math.max(0.1, 1 - (s.t - 40) / 10) : 1;
        b.setPosition(Math.round(handX + s.facing * (16 + i * 16)), Math.round(handY)).setDepth(s.y + 1.5).setScale(1, sc);
      }
    });
  }

  // -------------------------------------------------------------------------
  // FX helpers

  popup(text: string, x: number, y: number, tint: number, big = false): void {
    const bt = this.add.bitmapText(Math.round(x), Math.round(y), 'font', text).setOrigin(0.5, 1).setTint(tint).setDepth(4500);
    if (big) bt.setScale(2);
    const sx = Phaser.Math.Clamp(x, this.world.camX + bt.width / 2 + 4, this.world.camX + VIEW_W - bt.width / 2 - 4);
    bt.setX(Math.round(sx));
    this.tweens.add({ targets: bt, y: y - 18, duration: 900, ease: 'Cubic.out', onComplete: () => bt.destroy() });
    this.tweens.add({ targets: bt, alpha: 0, delay: 650, duration: 250 });
  }

  banner(title: string, sub: string): void {
    const cx = VIEW_W / 2;
    const bar = this.add.rectangle(0, 54, VIEW_W, sub ? 30 : 20, 0x140c1c, 0.82).setOrigin(0, 0).setScrollFactor(0).setDepth(4800);
    const a = this.add.bitmapText(cx, 59, 'fontY', title).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4801);
    const b = sub ? this.add.bitmapText(cx, 71, 'font', sub).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4801) : null;
    const items = [bar, a, ...(b ? [b] : [])];
    for (const o of items) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 200 });
      this.tweens.add({ targets: o, alpha: 0, delay: 2200, duration: 400, onComplete: () => o.destroy() });
    }
    a.x = cx - 40;
    this.tweens.add({ targets: a, x: cx, duration: 300, ease: 'Back.out' });
  }

  private flashScreen(alpha: number, ms: number): void {
    this.flash.setAlpha(alpha);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: ms });
  }

  private shards(x: number, y: number, z: number): void {
    for (let i = 0; i < 7; i++) {
      const s = this.add.image(x, y - z, 'shard').setDepth(y + 1);
      const dx = (Math.random() - 0.5) * 30;
      const dy = -6 - Math.random() * 14;
      this.tweens.add({ targets: s, x: x + dx, y: y - z + dy, duration: 180, ease: 'Quad.out' });
      this.tweens.add({ targets: s, y: y + Math.random() * 4, delay: 180, duration: 220, ease: 'Bounce.out' });
      this.tweens.add({ targets: s, alpha: 0, delay: 700, duration: 300, onComplete: () => s.destroy() });
    }
  }

  private warnIcon(x: number, y: number): void {
    const s = this.add.image(Math.round(Phaser.Math.Clamp(x, this.world.camX + 10, this.world.camX + VIEW_W - 10)), Math.round(y - 40), 'warn').setDepth(4600);
    this.tweens.add({ targets: s, alpha: { from: 1, to: 0.2 }, yoyo: true, repeat: 4, duration: 90, onComplete: () => s.destroy() });
  }

  private scooterDebris(x: number, y: number, big: boolean): void {
    const s = this.add.image(x, y, big ? 'scooter_b' : 'scooter_s').setOrigin(0.5, 1).setDepth(y - 1);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.tweens.add({ targets: s, x: x + dir * 50, duration: 600, ease: 'Cubic.out' });
    this.tweens.add({ targets: s, alpha: 0, delay: 2500, duration: 500, onComplete: () => s.destroy() });
  }

  private cheer(): void {
    // neighbours lean out of their windows to cheer
    const W = this.world.camX;
    const msgs = [t('cheer_1'), t('cheer_2'), '♥'];
    for (let i = 0; i < 4; i++) {
      const x = W + 40 + Math.random() * (VIEW_W - 80);
      const y = 30 + Math.floor(Math.random() * 3) * 26;
      const fig = this.add.image(x, y + 8, 'figure').setTint([0xf2bf98, 0xbc8155, 0x835434, 0xe5ab7e][i]).setDepth(-50);
      this.tweens.add({ targets: fig, y: y, duration: 200, yoyo: true, hold: 1200, onComplete: () => fig.destroy() });
      const m = this.add.bitmapText(x, y - 6, 'font', msgs[i % 3]).setOrigin(0.5, 1).setTint(i % 2 ? 0xffd84a : 0xff6b9a).setDepth(-49);
      this.tweens.add({ targets: m, y: y - 16, alpha: 0, duration: 1400, delay: 200, onComplete: () => m.destroy() });
    }
  }

  private setupAmbience(): void {
    if (this.stageKey === 'boutique') {
      this.add.image(352, 172, 'bin').setOrigin(0.5, 1).setDepth(172);
      this.add.sprite(352, 156, 'flame').play('flame').setOrigin(0.5, 1).setDepth(172.1);
      // police lights flickering just offscreen
      const l = this.add.image(0, 0, 'glow').setOrigin(0).setDisplaySize(90, VIEW_H).setTint(0x2f6fc4).setBlendMode(Phaser.BlendModes.ADD).setDepth(950).setAlpha(0);
      const r = this.add.image(VIEW_W, 0, 'glow').setOrigin(0).setFlipX(true).setDisplaySize(90, VIEW_H).setTint(0xe0443c).setBlendMode(Phaser.BlendModes.ADD).setDepth(950).setAlpha(0);
      r.x = VIEW_W - 90;
      this.police = [l, r];
    } else {
      const x0 = this.def.width - VIEW_W - 40;
      for (let i = 0; i < 7; i++) {
        this.figures.push(this.add.image(x0 + 40 + i * 52 + 1, 48, 'figure').setOrigin(0.5, 1).setDepth(-90));
      }
      for (const bx of [520, 1180, 1900, 2350]) {
        this.add.image(bx, 168, 'bin').setOrigin(0.5, 1).setDepth(168);
        this.add.sprite(bx, 152, 'flame').play('flame').setOrigin(0.5, 1).setDepth(168.1);
      }
    }
  }

  private ambientTick(): void {
    this.ambientT++;
    if (this.police.length) {
      const ph = Math.floor(this.ambientT / 12) % 4;
      this.police[0].setAlpha(ph === 0 ? 0.5 : ph === 2 ? 0.25 : 0);
      this.police[1].setAlpha(ph === 1 ? 0.45 : ph === 3 ? 0.22 : 0);
    }
    if (this.figures.length) {
      this.figures.forEach((f, i) => {
        const c = Phaser.Display.Color.HSVToRGB(((this.ambientT / 240 + i / 7) % 1), 0.7, 1) as Phaser.Types.Display.ColorObject;
        f.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      });
    }
    // smoke from the burning bins
    if (this.ambientT % 18 === 0) {
      const xs = this.stageKey === 'boutique' ? [352] : [520, 1180, 1900, 2350];
      for (const x of xs) {
        if (Math.abs(x - this.world.camX - VIEW_W / 2) > VIEW_W) continue;
        const s = this.add.sprite(x + (Math.random() - 0.5) * 6, 150, 'smoke').setDepth(-40).setAlpha(0.8);
        s.play('smoke');
        this.tweens.add({ targets: s, y: 60, x: s.x + 20 + Math.random() * 20, alpha: 0, duration: 2600, onComplete: () => s.destroy() });
      }
    }
  }

  private finishStage(): void {
    const w = this.world;
    const secs = Math.floor(this.elapsed / 60);
    this.scene.stop('hud');
    this.scene.start('results', {
      stage: this.stageKey,
      treasure: w.treasure,
      treasureLabel: this.def.treasure,
      maxCombo: w.maxCombo,
      kos: w.kos,
      time: secs,
      score: w.score,
      lives: w.lives,
    });
  }
}
