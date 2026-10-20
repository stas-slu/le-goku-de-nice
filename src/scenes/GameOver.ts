import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { Controls } from '../input/controls';
import { t } from '../i18n/strings';
import { sfx } from '../audio/audio';
import { music, STAGE_SONG } from '../audio/music';
import type { StageScene } from './Stage';

export class GameOverScene extends Phaser.Scene {
  private controls!: Controls;
  private stage!: StageScene;
  private count = 9;
  private label!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('gameover');
  }

  init(data: { stage: StageScene }): void {
    this.stage = data.stage;
    this.count = 9;
  }

  create(): void {
    music.stop();
    this.controls = new Controls(this);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.75).setOrigin(0);
    this.add.image(VIEW_W / 2, 70, 't_gameover');
    this.add.bitmapText(VIEW_W / 2, 110, 'font', t('continue_q')).setOrigin(0.5);
    this.label = this.add.bitmapText(VIEW_W / 2, 130, 'fontY', '9').setOrigin(0.5).setScale(3);
    this.add.bitmapText(VIEW_W / 2, 176, 'font', t('quote')).setOrigin(0.5).setTint(0x9a96b0);
    this.time.addEvent({
      delay: 1000, repeat: 9, callback: () => {
        this.count--;
        sfx('ui');
        if (this.count < 0) this.quit();
      },
    });
    this.input.on('pointerdown', () => this.cont());
    this.controls.menu();
  }

  update(): void {
    this.label.setText(String(Math.max(0, this.count)));
    const m = this.controls.menu();
    if (m.confirm) this.cont();
    if (m.back) this.quit();
  }

  private cont(): void {
    sfx('select');
    this.stage.world.continueGame();
    music.play(STAGE_SONG);
    this.scene.resume('stage');
    this.scene.stop();
  }

  private quit(): void {
    this.scene.stop('hud');
    this.scene.stop('stage');
    this.scene.start('title');
  }
}
