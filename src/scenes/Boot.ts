import Phaser from 'phaser';
import { allCharDefs } from '../art/characters';
import { allFx } from '../art/fx';
import { packChar, packSet, single, Sheet } from '../art/atlas';
import { bakeFont, bigText } from '../art/font';
import { drawAvenue, drawBoutique } from '../art/backgrounds';
import { AVENUE } from '../game/stage';

export function addSheet(scene: Phaser.Scene, sheet: Sheet): void {
  if (scene.textures.exists(sheet.key)) scene.textures.remove(sheet.key);
  // addImage avoids CanvasTexture's full getImageData read-back (very slow on big sheets)
  const tex = scene.textures.addImage(sheet.key, sheet.canvas as unknown as HTMLImageElement)!;
  for (const f of sheet.frames) {
    const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h);
    if (fr && f.trim) fr.setTrim(f.trim.sourceW, f.trim.sourceH, f.trim.x, f.trim.y, f.w, f.h);
  }
}

function registerFont(scene: Phaser.Scene, key: string, fill: number, shade: number): void {
  const fs = bakeFont(fill, shade);
  const cv = fs.canvas.toCanvas();
  scene.textures.addImage(key, cv as unknown as HTMLImageElement);
  const W = cv.width;
  const H = cv.height;
  const chars: Record<number, unknown> = {};
  for (const c of fs.cells) {
    chars[c.ch.charCodeAt(0)] = {
      x: c.x, y: c.y, width: c.w, height: c.h, centerX: Math.floor(c.w / 2), centerY: Math.floor(c.h / 2),
      xOffset: 0, yOffset: 0, xAdvance: c.adv, data: {}, kerning: {},
      u0: c.x / W, v0: 1 - c.y / H, u1: (c.x + c.w) / W, v1: 1 - (c.y + c.h) / H,
    };
  }
  const data = { font: key, size: fs.lineHeight, lineHeight: fs.lineHeight, chars };
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Centred bitmap text with an odd pixel width lands on a half pixel, and
 * nearest sampling then drops 1px strokes (T, +, V lose their stems). Snap
 * every BitmapText's display origin to whole pixels.
 */
function snapBitmapTextOrigins(): void {
  type WithOrigin = { _displayOriginX: number; _displayOriginY: number };
  const proto = Phaser.GameObjects.BitmapText.prototype as unknown as { updateDisplayOrigin: (this: WithOrigin) => unknown };
  const original = proto.updateDisplayOrigin;
  proto.updateDisplayOrigin = function (this: WithOrigin) {
    const r = original.call(this);
    this._displayOriginX = Math.round(this._displayOriginX);
    this._displayOriginY = Math.round(this._displayOriginY);
    return r;
  };
}
snapBitmapTextOrigins();

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerFont(this, 'font', 0xffffff, 0xc8c0e0);
    const { width: W, height: H } = this.scale;
    const label = this.add.bitmapText(W / 2, H / 2 - 16, 'font', 'LE GOKU DE NICE').setOrigin(0.5).setTint(0xffd84a);
    const bar = this.add.rectangle(W / 2 - 80, H / 2 + 4, 0, 4, 0xffd84a).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2 + 4, 162, 6).setStrokeStyle(1, 0xffffff);
    void label;
    this.generate((p) => (bar.width = 160 * p)).catch((e) => console.error("boot failed", e?.stack ?? e));
  }

  private async generate(progress: (p: number) => void): Promise<void> {
    const defs = allCharDefs();
    const total = defs.length + 4;
    let done = 0;
    const tick = async () => {
      progress(++done / total);
      await nextFrame();
    };
    for (const set of allFx()) addSheet(this, packSet(set));
    await tick();
    for (const d of defs) {
      addSheet(this, packChar(d));
      await tick();
    }
    const b = drawBoutique();
    addSheet(this, single('bg_boutique', b.main));
    await tick();
    const a = drawAvenue(AVENUE.width);
    addSheet(this, single('bg_avenue', a.main));
    if (a.far) addSheet(this, single('bg_avenue_far', a.far));
    await tick();
    addSheet(this, single('logo1', bigText('LE GOKU', 4, [0xfff3a0, 0xffd84a, 0xffb040, 0xff8a2a, 0xe0582a])));
    addSheet(this, single('logo2', bigText('DE NICE', 3, [0xc8fff8, 0x8fd3ff, 0x4ca3f0, 0x2f6fc4], 0x140c1c, 0x1d233d)));
    addSheet(this, single('t_clear', bigText('BRAVO !', 3, [0xfff3a0, 0xffd84a, 0xff9a3c])));
    addSheet(this, single('t_go', bigText('GO →', 2, [0xffffff, 0xfff3a0, 0xffd84a])));
    addSheet(this, single('t_gameover', bigText('GAME OVER', 3, [0xff6b5a, 0xe0443c, 0xb02a32])));
    registerFont(this, 'fontY', 0xfff3a0, 0xffb040);
    await tick();
    this.makeAnims();

    const q = new URLSearchParams(location.search);
    if (q.get('debug') === 'sprites') this.scene.start('spritedebug');
    else if (q.get('stage')) this.scene.start('stage', { stage: q.get('stage'), score: 0, lives: 3 });
    else this.scene.start('title');
  }

  private makeAnims(): void {
    const mk = (key: string, n: number, rate: number, repeat = 0) => {
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: Array.from({ length: n }, (_, i) => ({ key, frame: String(i) })), frameRate: rate, repeat });
    };
    mk('spark_s', 4, 40);
    mk('spark_l', 5, 30);
    mk('dust', 5, 20);
    mk('smoke', 4, 6);
    mk('flame', 4, 12, -1);
    mk('beam', 3, 20, -1);
    mk('beamhead', 3, 20, -1);
    mk('orb', 4, 16, -1);
    mk('bottle', 4, 16, -1);
    mk('ring', 6, 30);
    mk('streak', 4, 24);
  }
}
