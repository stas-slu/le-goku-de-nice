import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { Controls } from '../input/controls';
import { t } from '../i18n/strings';
import { sfx } from '../audio/audio';
import { TITLE_SONG, music } from '../audio/music';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y } from '../art/rig';
import { measure } from '../art/font';

const LINES = 9;
const NEWS_LINES = 4; // the France-wide exposition plays over the burning avenue
const TICKS_PER_CHAR = 3;
const HOLD = 150;

export class IntroScene extends Phaser.Scene {
  private controls!: Controls;
  private line = 0;
  private chars = 0;
  /** One centred BitmapText per wrapped line (Phaser's own centre-align lands on half pixels). */
  private rows: Phaser.GameObjects.BitmapText[] = [];
  private hero!: Phaser.GameObjects.Sprite;
  private news!: Phaser.GameObjects.Container;
  private shop!: Phaser.GameObjects.Container;
  private tick = 0;
  private hold = 0;
  private done = false;

  constructor() {
    super('intro');
  }

  create(): void {
    this.controls = new Controls(this);
    this.line = 0;
    this.chars = 0;
    this.tick = 0;
    this.hold = 0;
    this.done = false;
    music.play(TITLE_SONG);
    this.cameras.main.fadeIn(500, 13, 7, 22);

    // part 1: news montage, a slow pan along the avenue
    const avenue = this.add.image(0, 0, 'bg_avenue').setOrigin(0);
    const flames = [520, 1180, 1900].map((x) => this.add.sprite(x, 152, 'flame').play('flame').setOrigin(0.5, 1).setScale(2));
    const dark = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.55).setOrigin(0);
    const tag = this.add.rectangle(10, 34, 96, 12, 0xd02838).setOrigin(0);
    const tagText = this.add.bitmapText(14, 35, 'font', t('intro_news')).setOrigin(0);
    const rec = this.add.circle(VIEW_W - 16, 40, 3, 0xff3a3a);
    this.news = this.add.container(0, 0, [avenue, ...flames, dark, tag, tagText, rec]);
    this.tweens.add({ targets: [avenue, ...flames], x: '-=900', duration: 30000, ease: 'Linear' });
    this.tweens.add({ targets: rec, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });

    // part 2: the shop
    const bg = this.add.image(0, 0, 'bg_boutique').setOrigin(0);
    const standee = this.add.sprite(226, 155, 'standee_card', 'stand_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H);
    this.hero = this.add.sprite(VIEW_W + 30, 160, 'hero', 'walk_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H).setFlipX(true);
    this.shop = this.add.container(0, 0, [bg, standee, this.hero]).setVisible(false);

    this.add.rectangle(0, 0, VIEW_W, 26, 0x000000).setOrigin(0);
    this.add.rectangle(0, VIEW_H - 42, VIEW_W, 42, 0x000000).setOrigin(0);
    this.rows = [0, 1].map((k) => this.add.bitmapText(VIEW_W / 2, VIEW_H - 36 + k * 13, 'font', '').setOrigin(0, 0));
    this.add.bitmapText(VIEW_W - 4, 8, 'font', t('skip')).setOrigin(1, 0).setAlpha(0.5);
    this.input.on('pointerdown', () => this.advance());
  }

  /** Word-wrap the full line once, then reveal it character by character. */
  private showTyped(full: string, n: number): void {
    const lines: string[] = [];
    let cur = '';
    for (const word of full.split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (measure(next) > VIEW_W - 32 && cur) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    lines.push(cur);
    let left = n;
    this.rows.forEach((row, k) => {
      const l = lines[k] ?? '';
      // anchor at the finished line's left edge so typing doesn't shift the text
      row.setX(Math.round(VIEW_W / 2 - measure(l) / 2));
      row.setText(l.slice(0, Math.max(0, left)));
      left -= l.length + 1;
    });
  }

  private current(): string {
    return t(`intro_${this.line + 1}`);
  }

  private advance(): void {
    if (this.chars < this.current().length) {
      this.chars = this.current().length;
      return;
    }
    this.next();
  }

  private next(): void {
    this.line++;
    this.chars = 0;
    this.hold = 0;
    if (this.line === NEWS_LINES) {
      this.cameras.main.flash(250, 255, 255, 255);
      this.news.setVisible(false);
      this.shop.setVisible(true);
    }
    if (this.line >= LINES) this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(400, 13, 7, 22);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('stage', { stage: 'boutique', score: 0, lives: 3 }));
  }

  update(): void {
    this.tick++;
    const m = this.controls.menu();
    if (m.back) return this.finish();
    if (m.confirm) this.advance();
    if (this.line >= LINES) return;
    const L = this.current();
    if (this.chars < L.length) {
      if (this.tick % TICKS_PER_CHAR === 0) {
        this.chars++;
        if (this.chars % 3 === 0 && L[this.chars - 1] !== ' ') sfx('ui');
      }
    } else if (++this.hold > HOLD) this.next();
    if (this.line < LINES) this.showTyped(this.current(), this.chars);

    // the clerk walks to the doorway, turns, and crosses his arms
    const shopLine = this.line - NEWS_LINES;
    if (shopLine >= 2) {
      if (this.hero.x > 192) {
        this.hero.x -= 1.1;
        this.hero.setFrame(`walk_${Math.floor(this.tick / 6) % 8}`);
      } else {
        this.hero.x = 192;
        this.hero.setFlipX(false);
        this.hero.setFrame(shopLine >= 3 ? `cross_arms_${Math.floor(this.tick / 40) % 2}` : 'idle_0');
      }
    }
  }
}
