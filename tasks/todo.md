# Le Goku de Nice — Phase A (vertical slice)

Plan: ~/.claude/plans/giggly-singing-nautilus.md

- [x] Scaffold Vite + TS + Phaser 4 + Vitest
- [x] Core logic: space/hit detection, fighter state machine, moves, hitstop
- [x] AI: attack tokens, archetypes (Capuche, Trottinette, Lanceur, Pilleur, Costaud, Kickeur boss, Pilote mini-boss)
- [x] Stage data + wave spawner + stock meter + holds
- [x] Art: palette, pixel font (FR accents), rig renderer, hero + enemies + standee
- [x] Art: backgrounds (Jean-Médecin shop front, avenue/basilica/tram, Place Masséna), FX
- [x] Scenes: Boot, Title (FR/EN), Intro, Stage, HUD, Pause, Results/ending, GameOver, SpriteDebug
- [x] Signature mechanics: glasses blur, retour au poste, aura meter, standee super
- [x] Audio: SFX synth + music tracker (title, stage, boss)
- [x] Input: keyboard (QWERTY/AZERTY), gamepad, touch
- [x] Tests green (20), tsc clean, build clean
- [x] Browser verification (headless Chrome screenshots of every screen, touch emulation, prod bundle)
- [x] CLAUDE.md

## Review

- Both stages are completable; the bot (`scripts/bot.ts`) clears stage 1 in ~110 s losing ~1 life, stage 2 in ~3 min.
- Boot generates all art in ~1 s (trimmed atlases; `addCanvas` read-back was 10 s).
- Not verified: real audio output (headless has no speakers), real-GPU frame rate, physical gamepad.
- chrome-devtools MCP was unavailable (profile locked by another browser), so verification used puppeteer-core.

## Next (Phase B/C roadmap)
- [ ] Promenade des Anglais (pebble throwers), Vieux-Nice / Opéra, Cimiez museum
- [ ] Paris manga boulevard, Limoges belfry timed hold, Grand Musée finale
- [ ] Local 2-player co-op
- [ ] Deploy (itch.io / GitHub Pages) — ask first
