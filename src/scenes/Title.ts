import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../game/defs';
import { Controls } from '../input/controls';
import { getLang, setLang, t } from '../i18n/strings';
import { sfx, unlockAudio } from '../audio/audio';
import { TITLE_SONG, music } from '../audio/music';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y } from '../art/rig';

type Panel = 'press' | 'menu' | 'controls' | 'credits';

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private panel: Panel = 'press';
  private sel = 0;
  private texts: Phaser.GameObjects.BitmapText[] = [];
  private press!: Phaser.GameObjects.BitmapText;
  private hero!: Phaser.GameObjects.Sprite;
  private tick = 0;
  private police: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('title');
  }

  create(): void {
    this.controls = new Controls(this);
    this.panel = 'press';
    this.sel = 0;
    this.add.image(0, 0, 'bg_boutique').setOrigin(0);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d0716, 0.35).setOrigin(0);
    this.add.sprite(226, 155, 'standee_card', 'stand_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H);
    this.hero = this.add.sprite(192, 160, 'hero', 'cross_arms_0').setOrigin(ORIGIN_X / FRAME_W, ORIGIN_Y / FRAME_H);
    this.add.image(352, 172, 'bin').setOrigin(0.5, 1);
    this.add.sprite(352, 156, 'flame').play('flame').setOrigin(0.5, 1);
    const l = this.add.image(0, 0, 'glow').setOrigin(0).setDisplaySize(90, VIEW_H).setTint(0x2f6fc4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const r = this.add.image(VIEW_W - 90, 0, 'glow').setOrigin(0).setFlipX(true).setDisplaySize(90, VIEW_H).setTint(0xe0443c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.police = [l, r];
    this.add.rectangle(0, 0, VIEW_W, 96, 0x0d0716, 0.55).setOrigin(0);

    const l1 = this.add.image(VIEW_W / 2, 30, 'logo1');
    const l2 = this.add.image(VIEW_W / 2, 62, 'logo2');
    l1.y = -40;
    l2.x = VIEW_W + 120;
    this.tweens.add({ targets: l1, y: 30, duration: 600, ease: 'Bounce.out' });
    this.tweens.add({ targets: l2, x: VIEW_W / 2, duration: 500, delay: 350, ease: 'Back.out' });
    this.add.bitmapText(VIEW_W / 2, 82, 'font', t('title_sub')).setOrigin(0.5, 0).setTint(0xfff3a0);

    const touch = this.sys.game.device.input.touch;
    this.press = this.add.bitmapText(VIEW_W / 2, 196, 'fontY', touch ? t('tap_start') : t('press_start')).setOrigin(0.5);
    this.input.on('pointerdown', () => {
      if (this.panel === 'press') this.toMenu();
    });
    this.add.bitmapText(VIEW_W - 3, VIEW_H - 3, 'font', 'V0.1').setOrigin(1, 1).setAlpha(0.4);
    if (music.playing) this.toMenu();
  }

  private toMenu(): void {
    unlockAudio();
    sfx('select');
    music.play(TITLE_SONG);
    this.panel = 'menu';
    this.press.setVisible(false);
    this.build();
  }

  private clear(): void {
    for (const x of this.texts) x.destroy();
    this.texts = [];
  }

  private items(): string[] {
    return [t('menu_play'), t('menu_lang'), t('menu_controls'), t('menu_credits')];
  }

  private build(): void {
    this.clear();
    const cx = VIEW_W / 2;
    if (this.panel === 'menu') {
      this.texts.push(this.add.rectangle(0, 166, VIEW_W, 50, 0x0d0716, 0.8).setOrigin(0) as unknown as Phaser.GameObjects.BitmapText);
      this.items().forEach((s, i) => {
        const bt = this.add.bitmapText(cx, 168 + i * 12, 'font', s).setOrigin(0.5, 0).setInteractive();
        bt.on('pointerdown', () => {
          this.sel = i;
          this.choose();
        });
        this.texts.push(bt);
      });
      return;
    }
    const lines =
      this.panel === 'controls'
        ? [t('controls_title'), t('c_move'), t('c_run'), t('c_attack'), t('c_jump'), t('c_special'), t('c_super'), t('c_grab'), t('c_pause'), t('c_tip')]
        : [t('credits_title'), t('credits_1'), '', t('credits_2'), t('credits_3'), t('credits_4')];
    this.texts.push(this.add.rectangle(0, 100, VIEW_W, 116, 0x0d0716, 0.85).setOrigin(0) as unknown as Phaser.GameObjects.BitmapText);
    lines.forEach((s, i) => {
      const bt = this.add.bitmapText(cx, 104 + i * 10, i === 0 ? 'fontY' : 'font', s).setOrigin(0.5, 0);
      this.texts.push(bt);
    });
    const back = this.add.bitmapText(cx, 204, 'fontY', `< ${t('back')}`).setOrigin(0.5, 0).setInteractive();
    back.on('pointerdown', () => this.backToMenu());
    this.texts.push(back);
  }

  private backToMenu(): void {
    sfx('ui');
    this.panel = 'menu';
    this.build();
  }

  private choose(): void {
    sfx('select');
    if (this.sel === 0) {
      this.cameras.main.fadeOut(400, 13, 7, 22);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('intro'));
      this.panel = 'press';
    } else if (this.sel === 1) {
      setLang(getLang() === 'fr' ? 'en' : 'fr');
      this.scene.restart();
    } else {
      this.panel = this.sel === 2 ? 'controls' : 'credits';
      this.build();
    }
  }

  update(): void {
    this.tick++;
    const ph = Math.floor(this.tick / 12) % 4;
    this.police[0].setAlpha(ph === 0 ? 0.45 : 0);
    this.police[1].setAlpha(ph === 1 ? 0.4 : 0);
    this.hero.setFrame(`cross_arms_${Math.floor(this.tick / 40) % 2}`);
    const m = this.controls.menu();
    if (this.panel === 'press') {
      this.press.setVisible(this.tick % 50 < 34);
      if (m.confirm) this.toMenu();
      return;
    }
    if (this.panel === 'menu') {
      if (m.up) {
        this.sel = (this.sel + 3) % 4;
        sfx('ui');
      }
      if (m.down) {
        this.sel = (this.sel + 1) % 4;
        sfx('ui');
      }
      if (((m.left || m.right) && this.sel === 1) || m.confirm) {
        this.choose();
        return;
      }
      this.texts.slice(1).forEach((bt, i) => {
        const on = i === this.sel;
        bt.setText((on ? '> ' : '') + this.items()[i] + (on ? ' <' : '')).setTint(on ? 0xffd84a : 0xffffff);
      });
      return;
    }
    if (m.confirm || m.back) this.backToMenu();
  }
}
