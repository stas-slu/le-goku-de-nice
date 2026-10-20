import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { Controls } from '../input/controls';
import { t } from '../i18n/strings';
import { sfx } from '../audio/audio';
import { music } from '../audio/music';

export class PauseScene extends Phaser.Scene {
  private controls!: Controls;
  private sel = 0;
  private items: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super('pause');
  }

  create(): void {
    this.controls = new Controls(this);
    this.sel = 0;
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.7).setOrigin(0);
    this.add.bitmapText(VIEW_W / 2, 70, 'fontY', t('paused')).setOrigin(0.5).setScale(2);
    this.items = [t('resume'), t('quit')].map((s, i) =>
      this.add.bitmapText(VIEW_W / 2, 110 + i * 16, 'font', s).setOrigin(0.5).setInteractive().on('pointerdown', () => this.choose(i)));
    // swallow the key that opened the menu
    this.controls.menu();
  }

  update(): void {
    const m = this.controls.menu();
    if (m.up || m.down) {
      this.sel = (this.sel + 1) % 2;
      sfx('ui');
    }
    if (m.back) this.choose(0);
    else if (m.confirm) this.choose(this.sel);
    this.items.forEach((it, i) => it.setTint(i === this.sel ? 0xffd84a : 0xffffff).setText((i === this.sel ? '> ' : '') + [t('resume'), t('quit')][i]));
  }

  private choose(i: number): void {
    sfx('select');
    if (i === 0) {
      this.scene.resume('stage');
      this.scene.stop();
    } else {
      music.stop();
      this.scene.stop('hud');
      this.scene.stop('stage');
      this.scene.start('title');
    }
  }
}
