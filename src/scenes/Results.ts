import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { Controls } from '../input/controls';
import { t } from '../i18n/strings';
import { sfx } from '../audio/audio';
import { TITLE_SONG, music } from '../audio/music';

export interface ResultsData {
  stage: 'boutique' | 'avenue';
  treasure: number;
  treasureLabel: 'stock' | 'heritage';
  maxCombo: number;
  kos: number;
  time: number;
  score: number;
  lives: number;
}

export function grade(treasure: number, maxCombo: number): string {
  const pts = treasure * 0.7 + Math.min(maxCombo, 20) * 1.5;
  return pts >= 95 ? 'S' : pts >= 80 ? 'A' : pts >= 62 ? 'B' : pts >= 42 ? 'C' : 'D';
}

export class ResultsScene extends Phaser.Scene {
  private controls!: Controls;
  private data0!: ResultsData;
  private rows: Array<{ label: string; value: string }> = [];
  private shown = 0;
  private tick = 0;
  private ending = false;

  constructor() {
    super('results');
  }

  init(d: ResultsData): void {
    this.data0 = d;
    this.shown = 0;
    this.tick = 0;
    this.ending = false;
  }

  create(): void {
    this.controls = new Controls(this);
    music.play(TITLE_SONG);
    const d = this.data0;
    this.add.image(0, 0, d.stage === 'boutique' ? 'bg_boutique' : 'bg_avenue').setOrigin(0).setCrop(0, 0, VIEW_W, VIEW_H);
    if (d.stage === 'avenue') this.cameras.main.setScroll(0, 0);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.72).setOrigin(0);
    this.add.image(VIEW_W / 2, 30, 't_clear');
    this.add.bitmapText(VIEW_W / 2, 50, 'fontY', t('stage_clear')).setOrigin(0.5, 0);
    const mm = Math.floor(d.time / 60);
    const ss = String(d.time % 60).padStart(2, '0');
    this.rows = [
      { label: t(d.treasureLabel === 'stock' ? 'r_stock' : 'r_heritage'), value: `${Math.ceil(d.treasure)}%` },
      { label: t('r_combo'), value: `${d.maxCombo}` },
      { label: t('r_kos'), value: `${d.kos}` },
      { label: t('r_time'), value: `${mm}:${ss}` },
      { label: t('score'), value: String(d.score).padStart(7, '0') },
    ];
    this.input.on('pointerdown', () => this.next());
  }

  update(): void {
    this.tick++;
    if (this.ending) {
      if (this.controls.menu().confirm) this.scene.start('title');
      return;
    }
    if (this.tick % 20 === 0 && this.shown < this.rows.length + 1) {
      const i = this.shown++;
      sfx(i === this.rows.length ? 'select' : 'ui');
      if (i < this.rows.length) {
        const r = this.rows[i];
        this.add.bitmapText(110, 74 + i * 14, 'font', r.label).setOrigin(0, 0);
        this.add.bitmapText(VIEW_W - 110, 74 + i * 14, 'fontY', r.value).setOrigin(1, 0);
      } else {
        const g = grade(this.data0.treasure, this.data0.maxCombo);
        this.add.bitmapText(110, 150, 'font', t('r_grade'));
        const gt = this.add.bitmapText(VIEW_W - 110, 144, 'fontY', g).setOrigin(1, 0).setScale(3);
        gt.setScale(6).setAlpha(0);
        this.tweens.add({ targets: gt, scale: 3, alpha: 1, duration: 300, ease: 'Back.out' });
        this.add.bitmapText(VIEW_W / 2, 190, 'font', t('r_continue')).setOrigin(0.5, 0).setAlpha(0.8);
      }
    }
    if (this.controls.menu().confirm) this.next();
  }

  private next(): void {
    if (this.shown <= this.rows.length) {
      this.shown = this.rows.length;
      this.tick = 19;
      return;
    }
    sfx('select');
    const d = this.data0;
    if (d.stage === 'boutique') {
      this.scene.start('stage', { stage: 'avenue', score: d.score, lives: d.lives });
    } else {
      this.showEnding();
    }
  }

  private showEnding(): void {
    this.ending = true;
    this.children.removeAll(true);
    this.add.image(0, 0, 'bg_avenue').setOrigin(0).setCrop(AVENUE_END, 0, VIEW_W, VIEW_H).setX(-AVENUE_END);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.6).setOrigin(0);
    this.add.image(VIEW_W / 2, 50, 'logo1');
    this.add.image(VIEW_W / 2, 82, 'logo2');
    this.add.bitmapText(VIEW_W / 2, 112, 'fontY', t('the_end')).setOrigin(0.5, 0);
    this.add.bitmapText(VIEW_W / 2, 130, 'font', t('the_end_2')).setOrigin(0.5, 0);
    this.add.bitmapText(VIEW_W / 2, 144, 'font', t('the_end_3')).setOrigin(0.5, 0);
    this.add.bitmapText(VIEW_W / 2, 170, 'font', t('quote')).setOrigin(0.5, 0).setTint(0x9a96b0);
    this.add.bitmapText(VIEW_W / 2, 196, 'font', `${t('score')} ${String(this.data0.score).padStart(7, '0')}`).setOrigin(0.5, 0);
  }
}

const AVENUE_END = 2880 - VIEW_W;
