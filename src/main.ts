import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './game/defs';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { IntroScene } from './scenes/Intro';
import { StageScene } from './scenes/Stage';
import { HudScene } from './scenes/Hud';
import { PauseScene } from './scenes/Pause';
import { ResultsScene } from './scenes/Results';
import { GameOverScene } from './scenes/GameOver';
import { SpriteDebugScene } from './scenes/SpriteDebug';

// Keep the canvas at an integer multiple of the native resolution when the
// window is big enough, so every pixel is the same size.
const host = document.getElementById('game')!;
function fitHost(): void {
  const k = Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H));
  if (k >= 2) {
    host.style.width = `${VIEW_W * k}px`;
    host.style.height = `${VIEW_H * k}px`;
  } else {
    host.style.width = '100%';
    host.style.height = '100%';
  }
  host.style.margin = 'auto';
  host.style.position = 'absolute';
  host.style.inset = '0';
}
fitHost();
window.addEventListener('resize', fitHost);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: VIEW_W,
  height: VIEW_H,
  parent: host,
  backgroundColor: '#0d0716',
  pixelArt: true,
  input: { gamepad: true, activePointers: 4 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60 },
  scene: [BootScene, TitleScene, IntroScene, StageScene, HudScene, PauseScene, ResultsScene, GameOverScene, SpriteDebugScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
