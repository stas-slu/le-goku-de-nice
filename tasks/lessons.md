# Lessons

- Enemy design: realistic casseurs are fine; never use national/religious/ethnic identity markers (e.g. flags) on enemies.
- Phaser 4: register generated canvases with `textures.addImage`, not `addCanvas` (CanvasTexture getImageData read-back is ~10x slower at boot).
- Phaser key `_justDown` is cleared on key-up: latch `down` events yourself or fast taps get dropped between fixed ticks.
- In menu update loops, `return` right after a choice that rebuilds the panel, or the same frame overwrites the new widgets.
- Controls: for browser brawlers use arrows to move + ONE adjacent letter cluster for actions (A/S/D/W, AZERTY Q/Z equivalents). Don't spread actions over J/K/L/I + X/C/V/B.
- Before publishing a repo: check package-lock.json for internal registry URLs (npm.dev.wixpress.com) and pin a public .npmrc; CI can't reach internal mirrors.
- Pixel fonts: centred BitmapText with odd width lands on x.5 and drops 1px strokes. Snap display origins; avoid built-in multi-line centre align. Pad font atlas cells.
- Keep controls to 3 action buttons (attack/jump/special) like SoR2/Golden Axe; put variety in context (run, air, chords, grab), not extra keys.
- Boss "get behind the hero" AI must handle the hero standing at the screen edge (otherwise it walks into the wall forever). The bot playtest caught it.
