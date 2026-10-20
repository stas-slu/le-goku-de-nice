# 🥋 Le Goku de Nice

**A free, French/English pixel-art beat 'em up that runs in your browser.**

### ▶ [Play it now](https://stas-slu.github.io/le-goku-de-nice/)

> *Nice, 17 October. The march is over and looters are heading up avenue Jean-Médecin.
> One game-store clerk steps into his shop's doorway, crosses his arms… and nobody gets in.*

A parody fan game inspired by the "Goku de Nice" meme. It's built in the style of the classic arcade brawlers (Streets of Rage, Final Fight), and you **defend** the shop instead of just clearing the screen.

## Features

- **Hold the door.**
  - Some looters ignore you and go straight for the stock.
  - Standing in the doorway blocks them.
  - Hit a looter who is carrying loot and he drops it.
- **Combos with weight.** Every press of **A** continues the chain:
  - Jab → jab → cross, then a finisher that depends on the arrow you hold: roundhouse, shoulder charge, uppercut launcher or low sweep.
  - Hits freeze the action for a moment and the enemy trembles.
  - Finishers add shockwaves, speed lines and screen shake.
  - Enemies bounce off the edge of the screen.
- **More moves:**
  - dropkick (attack while running)
  - diving elbow (down + attack in the air)
  - an 8-hit punch flurry (toward + special)
  - grab, then knees, throw or *coup de boule* (headbutt)
- **The meme mechanics:**
  - **Glasses:** a heavy hit knocks your glasses off and the screen goes blurry until you pick them up.
  - **"Back to my post!":** get knocked down, get up and return to the door for a bonus.
  - **The standee:** fill the Aura meter and the cardboard anime standee comes alive to fire **KAMÉ-NICE-HA!**
- **Two stages:**
  - **The shop** on avenue Jean-Médecin.
  - **The avenue:** past the basilica and a stalled tram, ending at Place Masséna, where you protect the fountain under the colour-changing statues.
- **No asset files.** Every sprite, backdrop, the bitmap font, the sound effects and the chiptune soundtrack are generated in code at load time.
- Keyboard, gamepad and touch controls, with **FR/EN** language switching.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows (double-tap to run) | Stick / D-pad |
| Attack | **A** (AZERTY: Q) | X |
| Jump | **S** / Space | A |
| Special (spin; → + D = flurry) | **D** | B / LB |
| Super (full Aura) | **W** (AZERTY: Z) | Y / RB |
| Grab | walk into an enemy | |
| Pause | Esc | Start |

On phones, play in landscape. The left half of the screen is a virtual stick; the buttons are on the right.

## Development

```bash
npm install
npm run dev        # http://localhost:5173  (?stage=avenue to jump in, ?debug=sprites to inspect art)
npm test           # simulation unit tests (Vitest)
npm run build      # static bundle in dist/
npx tsx scripts/bot.ts boutique 5   # headless bot playtest / balance check
```

**Stack:** Phaser 4, TypeScript and Vite.
- The game simulation is plain TypeScript, separate from Phaser, so it can be unit-tested and run headless.
- All art is drawn procedurally at load time from a skeletal pose rig.

See [`CLAUDE.md`](CLAUDE.md) for an architecture overview.

## Disclaimer

This is a free, non-commercial parody fan game inspired by an internet meme. It is not affiliated with any person, retailer, brand or licence. "MÉGAMANIA" is a made-up store.
