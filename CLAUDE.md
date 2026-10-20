# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Le Goku de Nice** is a free, FR/EN, browser pixel-art beat 'em up (Phaser 4 + TypeScript + Vite). It is based on the viral 17 Oct 2026 "Goku de Nice" clip of a game-store clerk holding his shop's doorway against looters. Background research and the design brief live in `RESEARCH.md` (local only, gitignored: it names the real person).

## Commands

- `npm run dev`: Vite dev server
  - `?stage=boutique` or `?stage=avenue` jumps straight into a stage
  - `?debug=sprites` shows every generated sprite sheet (arrow keys / mouse wheel to scroll)
- `npm test`: Vitest, logic only
- `npx vitest run tests/world.test.ts -t "grabs"`: run a single test
- `npm run typecheck`: `tsc --noEmit` (TypeScript 7)
- `npm run build`: typecheck, then build a static bundle into `dist/`. It uses relative paths (`base: './'`), so it works zipped on itch.io.
- `npx tsx scripts/bot.ts boutique 5`: headless balance playtest. A bot plays N seeds of a stage against the real simulation and prints clear time, deaths, stock and KOs. Re-run it after touching waves, stats or frame data.
- `npx tsx scripts/preview-chars.ts hero idle jab kick`: render character frames to a PNG contact sheet
  - Env vars: `OUT=`, `SCALE=`, and `GALLERY=1` for one column per character
  - `npx tsx scripts/preview-bg.ts boutique|avenue [x0] [w]` does the same for backdrops
  - Use these to iterate on art without a browser
- `node scripts/drive.mjs <url> <outDir> '<json actions>'`: headless Chrome (puppeteer-core plus the system Chrome) for in-browser checks
  - Actions: `{"wait":ms}`, `{"key":"KeyJ"}`, `{"down"/"up":...}`, `{"shot":"name"}`, `{"eval":"js"}`
  - The game instance is `window.__game`; the sim is `__game.scene.getScene('stage').world`
  - `scripts/drive-touch.mjs` does the same with phone emulation and touch input

## Architecture

**Simulation and rendering are strictly separated.**

`src/game/` is pure TypeScript with no Phaser imports. It is stepped at a fixed 60 Hz.
- `world.ts`: `World.step(intent)` runs:
  - the hero state machine
  - generic fighter states (hurt, fall, down, getup, grab, thrown)
  - physics on `x / y(depth lane) / z(height)`
  - hit resolution, pickups, projectiles
  - the standee super
  - It pushes `GameEvent`s into `world.events`. The scene drains them each tick for SFX and FX.
- `combat.ts`: hit detection. An attack box must overlap the body on x and z, and `|Δy| <= depth`. The depth tolerance is deliberately generous.
- `defs.ts`: all frame data (`MOVES`: steps/active/cancel/lunge/armor), enemy stats and hero constants. Tuning happens here.
  - Combo string is fixed: `jab1 → jab2 → cross → kick` (long 5-frame roundhouse).
  - Run + A = charge. Jump attacks are picked in `controlHero`: ↓ = dive elbow, run-jump = dropkick, forward jump = jumpkick, vertical = jumpknee. The hero jumps with lighter gravity (`HERO.jumpGravity`).
  - A + S within `CHORD` ticks = back elbow, so single A/S presses wait a few ticks before acting.
  - Grab: A, A = knees, 3rd A = headbutt (`grabOnly`), direction + A = throw, S = vault behind.
  - D = spin, → + D = Rafale (multi-hit via `rehit`, auto-chains via `then`), D with full Aura = super.
  - Impact: heavy hero knockdowns emit `impact` (ring, streaks, dark→white flash, crunch). Victims jitter by `Fighter.shake` while frozen in hitstop.
- `ai.ts`: one mode machine per enemy archetype.
  - The attack-token pool (`world.maxTokens`, set per wave) caps how many enemies can attack at once.
  - Pilleurs ignore the hero and steal from active `holds` (door, window, fountain). The hero standing in a hold blocks it.
  - Hitting a carrier returns the loot to `world.treasure`.
- `stage.ts`: `StageDef` data and the `Director`.
  - Each segment has a camera lock (`camX`), sequential waves, and the holds active during that segment.
  - The next wave starts when there are no pending spawns and no alive enemies.

`src/scenes/` are the Phaser scenes.
- `Stage` owns the `World`, runs the fixed-step accumulator, maps fighters to sprites, and spawns FX from events.
- `Hud` is a **separate parallel scene**, so the camera blur used for the "glasses knocked off" effect doesn't blur the HUD.
- Flow: `Boot` → `Title` → `Intro` → `Stage` → `Results` → next stage / ending. `Pause` and `GameOver` are overlays.

`src/art/` contains no image assets. All art is generated procedurally at boot.
- `palette.ts`: shared colour ramps. `pixel.ts`: the `PixelCanvas` framebuffer.
- `rig.ts`: skeletal pose renderer.
  - Draws shaded limb capsules, procedural heads/faces, interior contour lines, and an outline.
  - Sprites face right, origin at the feet (`ORIGIN_X/Y` inside a `FRAME_W×FRAME_H` frame).
- `characters.ts`: looks and pose tables. An animation is just an array of `Pose`s, so add frames there.
- `backgrounds.ts`, `fx.ts`, `font.ts`: backdrops, effects, and the bitmap font (uppercase plus French accents, outline baked in).
- `atlas.ts` trims and shelf-packs frames. `Boot.addSheet` registers them using `textures.addImage` plus `frame.setTrim`.
  - Don't switch this to `addCanvas`: `CanvasTexture` reads back every pixel and made boot about 10× slower.

`src/audio/` is all WebAudio synthesis: SFX in `audio.ts`, and a 16th-note tracker plus three songs in `music.ts`. Audio must be unlocked from a user gesture (`unlockAudio`).

`src/input/controls.ts` merges keyboard, gamepad and the touch pad into one `Intent` per tick.
- Keyboard: arrows move; A attack, S jump, D special (AZERTY: Q = A). Space jumps, Esc pauses. Only three action buttons, on purpose (SoR2 / Golden Axe).
- Key presses are latched from Phaser key `down` events, because Phaser clears `_justDown` on key-up and quick taps would be lost between ticks.

`src/i18n/strings.ts` holds the FR/EN tables. `tests/i18n.test.ts` enforces that:
- both languages have the same keys
- every character is drawable by the bitmap font

The font is uppercase-only. Add a glyph to `font.ts` before using a new symbol.

Pixel-crisp text: `Boot.snapBitmapTextOrigins` rounds every BitmapText display origin, because odd-width centred text otherwise lands on a half pixel and loses 1px strokes. Avoid Phaser's multi-line `setCenterAlign` (it offsets lines by half pixels); wrap manually like `Intro.showTyped`.

## Content rules (decided with the user)

- The hero is "le Goku de Nice". Never use the real person's name. The art is a stylised pixel caricature of the meme look: long salt-and-pepper hair, grey beard, glasses, big build, black tee with a rainbow print, tattooed forearms, black "23" sweatpants. The store is the parody "MÉGAMANIA".
- Enemies are realistic street casseurs (hoodies, balaclavas, scooters). **No national, religious or ethnic identity markers** (e.g. flags) on enemies. Skin tones are randomised across the full range.
