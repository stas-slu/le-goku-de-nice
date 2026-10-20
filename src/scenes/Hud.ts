import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { TouchPad } from '../input/controls';
import { t } from '../i18n/strings';
import type { StageScene } from './Stage';

export class HudScene extends Phaser.Scene {
  private stage!: StageScene;
  private g!: Phaser.GameObjects.Graphics;
  private score!: Phaser.GameObjects.BitmapText;
  private lives!: Phaser.GameObjects.BitmapText;
  private treasureLabel!: Phaser.GameObjects.BitmapText;
  private treasurePct!: Phaser.GameObjects.BitmapText;
  private combo!: Phaser.GameObjects.BitmapText;
  private bossName!: Phaser.GameObjects.BitmapText;
  private superHint!: Phaser.GameObjects.BitmapText;
  private touch!: TouchPad;
  private shownHp = 100;
  private comboShown = 0;
  private comboT = 0;
  private tick = 0;

  constructor() {
    super('hud');
  }

  init(data: { stage: StageScene }): void {
    this.stage = data.stage;
    this.shownHp = 100;
  }

  create(): void {
    this.g = this.add.graphics();
    this.add.image(4, 4, 'portrait').setOrigin(0);
    this.add.bitmapText(30, 2, 'fontY', 'LE GOKU DE NICE').setOrigin(0);
    this.lives = this.add.bitmapText(134, 9, 'font', 'x3').setOrigin(0);
    this.add.bitmapText(30, 20, 'font', t('resolve')).setOrigin(0).setTint(0x6ef0f0);
    this.score = this.add.bitmapText(VIEW_W - 4, 2, 'font', '0').setOrigin(1, 0);
    this.treasureLabel = this.add.bitmapText(VIEW_W - 92, 13, 'font', '').setOrigin(1, 0);
    this.treasurePct = this.add.bitmapText(VIEW_W - 4, 22, 'font', '').setOrigin(1, 0);
    this.combo = this.add.bitmapText(VIEW_W - 8, 60, 'fontY', '').setOrigin(1, 0).setScale(2);
    this.bossName = this.add.bitmapText(VIEW_W / 2 - 100, VIEW_H - 22, 'fontY', '').setOrigin(0, 0);
    this.superHint = this.add.bitmapText(30, 30, 'font', '').setOrigin(0).setTint(0xffd84a);
    this.touch = new TouchPad(this, VIEW_W, VIEW_H);
    this.stage.controls.touch = this.touch;
  }

  update(): void {
    const w = this.stage.world;
    if (!w) return;
    this.tick++;
    const g = this.g;
    g.clear();
    const h = w.hero;
    // health: drains smoothly; recoverable chunk blinks
    this.shownHp += (h.hp - this.shownHp) * 0.15;
    const bx = 30;
    const by = 12;
    const bw = 100;
    g.fillStyle(0x140c1c).fillRect(bx - 1, by - 1, bw + 2, 7);
    g.fillStyle(0x3a1430).fillRect(bx, by, bw, 5);
    const hpW = Math.round((h.hp / h.maxHp) * bw);
    const lagW = Math.round((Math.max(h.hp, this.shownHp) / h.maxHp) * bw);
    g.fillStyle(0xffffff).fillRect(bx, by, lagW, 5);
    if (h.recover > 0 && this.tick % 20 < 12) {
      g.fillStyle(0x9a96b0).fillRect(bx + hpW, by, Math.round((h.recover / h.maxHp) * bw), 5);
    }
    const pct = h.hp / h.maxHp;
    const col = pct > 0.5 ? 0x6ccc4a : pct > 0.25 ? 0xffd84a : 0xe0443c;
    g.fillStyle(col).fillRect(bx, by, hpW, 5);
    g.fillStyle(0xffffff, 0.35).fillRect(bx, by, hpW, 1);
    this.lives.setText(`x${w.lives}`);

    // aura (super meter)
    const ax = 62;
    const ay = 22;
    const aw = 68;
    g.fillStyle(0x140c1c).fillRect(ax - 1, ay - 1, aw + 2, 5);
    const full = w.resolve >= 100;
    g.fillStyle(full ? (this.tick % 10 < 5 ? 0xffffff : 0x6ef0f0) : 0x2fb8d0).fillRect(ax, ay, Math.round((w.resolve / 100) * aw), 3);
    this.superHint.setText(full ? t('super_ready') : '').setVisible(this.tick % 40 < 30);

    this.score.setText(String(w.score).padStart(7, '0'));

    // stock / heritage meter
    const showTreasure = w.stage.key === 'boutique' || w.holds.length > 0 || w.treasure < 100;
    this.treasureLabel.setVisible(showTreasure);
    this.treasurePct.setVisible(showTreasure);
    if (showTreasure) {
      this.treasureLabel.setText(t(w.stage.treasure));
      const tx = VIEW_W - 88;
      const ty = 15;
      const tw = 84;
      g.fillStyle(0x140c1c).fillRect(tx - 1, ty - 1, tw + 2, 6);
      g.fillStyle(0x3a1430).fillRect(tx, ty, tw, 4);
      const tp = w.treasure / 100;
      g.fillStyle(tp > 0.6 ? 0xffd84a : tp > 0.3 ? 0xff9a3c : 0xe0443c).fillRect(tx, ty, Math.round(tp * tw), 4);
      this.treasurePct.setText(`${Math.ceil(w.treasure)}%`);
      if (this.stage.world.fighters.some((f) => f.state === 'steal') && this.tick % 16 < 8) this.treasureLabel.setTint(0xff6b5a);
      else this.treasureLabel.clearTint();
    }

    // combo
    if (w.combo >= 2) {
      if (w.combo !== this.comboShown) {
        // pop on every new hit
        this.combo.setScale(3);
        this.tweens.add({ targets: this.combo, scale: 2, duration: 120, ease: 'Back.out' });
      }
      this.comboShown = w.combo;
      this.comboT = 60;
    } else if (this.comboT > 0) this.comboT--;
    this.combo.setText(this.comboT > 0 ? `${this.comboShown} HITS` : '').setAlpha(Math.min(1, this.comboT / 20));

    // boss bar
    const boss = w.boss;
    if (boss && boss.state !== 'dead') {
      const x = VIEW_W / 2 - 100;
      const y = VIEW_H - 10;
      this.bossName.setText(t(`boss_${boss.kind}`)).setVisible(true);
      g.fillStyle(0x140c1c).fillRect(x - 1, y - 1, 202, 7);
      g.fillStyle(0x3a1430).fillRect(x, y, 200, 5);
      g.fillStyle(0xe0443c).fillRect(x, y, Math.round((boss.hp / boss.maxHp) * 200), 5);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, Math.round((boss.hp / boss.maxHp) * 200), 1);
    } else this.bossName.setVisible(false);

    this.touch.draw();
  }
}
