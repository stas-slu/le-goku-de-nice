# Lessons

- Enemy design: realistic casseurs are fine; never use national/religious/ethnic identity markers (e.g. flags) on enemies.
- Phaser 4: register generated canvases with `textures.addImage`, not `addCanvas` (CanvasTexture getImageData read-back is ~10x slower at boot).
- Phaser key `_justDown` is cleared on key-up: latch `down` events yourself or fast taps get dropped between fixed ticks.
- In menu update loops, `return` right after a choice that rebuilds the panel, or the same frame overwrites the new widgets.
- Controls: for browser brawlers use arrows to move + ONE adjacent letter cluster for actions (A/S/D/W, AZERTY Q/Z equivalents). Don't spread actions over J/K/L/I + X/C/V/B.
