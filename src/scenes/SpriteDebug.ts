import Phaser from 'phaser';
import { VIEW_H } from '../game/defs';
import { allCharDefs } from '../art/characters';

/** ?debug=sprites — every generated sheet stacked vertically; arrows / wheel to scroll. */
export class SpriteDebugScene extends Phaser.Scene {
  constructor() {
    super('spritedebug');
  }

  create(): void {
    let y = 4;
    const keys = [...allCharDefs().map((d) => d.key), 'spark_s', 'spark_l', 'dust', 'smoke', 'flame', 'beam', 'beamhead', 'orb', 'scooter_s', 'scooter_b', 'glasses', 'bottle', 'warn', 'socca', 'panbagnat', 'bin', 'portrait', 'logo1', 'logo2', 't_go', 't_clear'];
    for (const k of keys) {
      const tex = this.textures.get(k);
      const src = tex.getSourceImage() as HTMLCanvasElement;
      this.add.bitmapText(4, y, 'font', k);
      y += 12;
      this.add.image(4, y, k, '__BASE').setOrigin(0);
      y += src.height + 4;
    }
    this.cameras.main.setBackgroundColor('#5c6e78');
    this.cameras.main.setBounds(0, 0, 4000, y);
    const kb = this.input.keyboard!;
    const cur = kb.createCursorKeys();
    this.events.on('update', () => {
      const c = this.cameras.main;
      if (cur.down.isDown) c.scrollY += 8;
      if (cur.up.isDown) c.scrollY -= 8;
      if (cur.right.isDown) c.scrollX += 8;
      if (cur.left.isDown) c.scrollX -= 8;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => {
      this.cameras.main.scrollY += dy * 0.5;
      this.cameras.main.scrollX += dx * 0.5;
    });
    void VIEW_H;
  }
}
