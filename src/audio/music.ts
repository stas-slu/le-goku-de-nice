// A tiny 16th-note tracker. Patterns are space-separated tokens per step:
// a note (C4, F#3...), "." for rest, "-" to keep holding.

import { getCtx, getMusicBus, noise, tone } from './audio';

type Chan = 'lead' | 'bass' | 'arp' | 'drum';

interface Pattern {
  lead?: string;
  bass?: string;
  arp?: string;
  drum?: string; // k = kick, s = snare, h = hat, o = open hat, c = crash
}

export interface Song {
  bpm: number;
  patterns: Pattern[];
  order: number[];
}

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(n: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  const semis = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

function steps(s?: string): string[] {
  return s ? s.trim().split(/\s+/) : [];
}

// ---------------------------------------------------------------------------

const FOUR = 'k . h . s . h . k . h k s . h o';
const FOUR_B = 'k . h . s . h . k k h . s . h s';
const FILL = 'k . h . s . h s k s . s s s s s';

/** Stage theme: SoR2-flavoured street house in A minor. */
export const STAGE_SONG: Song = {
  bpm: 124,
  patterns: [
    {
      bass: 'A2 . A3 . A2 . A3 A2 G2 . G3 . G2 . G3 G2',
      arp: 'A4 C5 E5 C5 A4 C5 E5 C5 G4 B4 D5 B4 G4 B4 D5 B4',
      drum: FOUR,
    },
    {
      bass: 'F2 . F3 . F2 . F3 F2 E2 . E3 . E2 . G#2 B2',
      arp: 'F4 A4 C5 A4 F4 A4 C5 A4 E4 G#4 B4 G#4 E4 G#4 B4 E5',
      drum: FOUR_B,
    },
    {
      lead: 'E5 - - . E5 . D5 E5 - . C5 . D5 - B4 -',
      bass: 'A2 . A3 . A2 . A3 A2 G2 . G3 . G2 . G3 G2',
      arp: 'A4 . E5 . A4 . E5 . G4 . D5 . G4 . D5 .',
      drum: FOUR,
    },
    {
      lead: 'C5 - - . C5 . B4 C5 - . A4 . B4 - G#4 -',
      bass: 'F2 . F3 . F2 . F3 F2 E2 . E3 . E2 . G#2 B2',
      arp: 'F4 . C5 . F4 . C5 . E4 . B4 . E4 . B4 .',
      drum: FOUR_B,
    },
    {
      lead: 'A5 - G5 - E5 - D5 E5 - - C5 - D5 - E5 -',
      bass: 'D2 . D3 . D2 . D3 D2 E2 . E3 . E2 . E3 E2',
      arp: 'D5 F5 A5 F5 D5 F5 A5 F5 E5 G#5 B5 G#5 E5 G#5 B5 G#5',
      drum: FOUR,
    },
    {
      lead: 'A5 - - - - - . . A4 . C5 . E5 . G#5 .',
      bass: 'F2 . F3 . F2 . F3 F2 E2 . E3 . E2 E3 E2 E3',
      arp: 'F5 A5 C6 A5 F5 A5 C6 A5 E5 G#5 B5 G#5 E5 G#5 B5 G#5',
      drum: FILL,
    },
  ],
  order: [0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 2, 3, 4, 5],
};

/** Title theme: heroic, a little bittersweet. */
export const TITLE_SONG: Song = {
  bpm: 104,
  patterns: [
    {
      lead: 'E5 - - - D5 - C5 - D5 - - - G4 - - -',
      bass: 'C3 . G3 . C3 . G3 . G2 . D3 . G2 . D3 .',
      arp: 'C5 E5 G5 E5 C5 E5 G5 E5 B4 D5 G5 D5 B4 D5 G5 D5',
      drum: 'k . . . s . . . k . k . s . . h',
    },
    {
      lead: 'C5 - - - D5 - E5 - G5 - - - F5 E5 D5 -',
      bass: 'A2 . E3 . A2 . E3 . F2 . C3 . G2 . D3 .',
      arp: 'A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 G4 B4 D5 B4',
      drum: 'k . . . s . . . k . k . s . s s',
    },
  ],
  order: [0, 1],
};

/** Boss theme: driving D minor. */
export const BOSS_SONG: Song = {
  bpm: 146,
  patterns: [
    {
      bass: 'D2 D2 D3 D2 D2 D3 D2 D3 C2 C2 C3 C2 C#2 C#2 C#3 C#2',
      arp: 'D5 . A4 . F5 . A4 . E5 . A4 . G5 . A4 .',
      drum: 'k . h k s . h . k . h k s . h s',
    },
    {
      lead: 'D5 - F5 - A5 - G5 F5 E5 - C#5 - E5 - A4 -',
      bass: 'D2 D2 D3 D2 D2 D3 D2 D3 A#1 A#1 A#2 A#1 A1 A1 A2 C#3',
      arp: 'D5 . A4 . F5 . A4 . A#4 . F4 . A4 . E4 .',
      drum: 'k . h k s . h . k . h k s s s s',
    },
  ],
  order: [0, 0, 1, 1],
};

// ---------------------------------------------------------------------------

export class MusicPlayer {
  private song: Song | null = null;
  private step = 0;
  private pos = 0;
  private nextTime = 0;
  private timer: number | null = null;

  play(song: Song): void {
    if (this.song === song) return;
    this.stop();
    const ctx = getCtx();
    if (!ctx) return;
    this.song = song;
    this.step = 0;
    this.pos = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  get playing(): Song | null {
    return this.song;
  }

  private schedule(): void {
    const ctx = getCtx();
    const song = this.song;
    if (!ctx || !song) return;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const pat = song.patterns[song.order[this.pos]];
      this.playStep(pat, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.pos = (this.pos + 1) % song.order.length;
      }
    }
  }

  private playStep(p: Pattern, i: number, at: number, sd: number): void {
    const bus = getMusicBus();
    const chans: Chan[] = ['lead', 'bass', 'arp', 'drum'];
    for (const c of chans) {
      const st = steps(p[c]);
      const tok = st[i];
      if (!tok || tok === '.' || tok === '-') continue;
      if (c === 'drum') {
        if (tok === 'k') {
          tone({ type: 'sine', f0: 150, f1: 42, dur: 0.22, vol: 0.9, at, bus });
          tone({ type: 'square', f0: 90, f1: 40, dur: 0.04, vol: 0.12, at, bus });
        } else if (tok === 's') {
          noise({ dur: 0.16, vol: 0.38, hp: 900, lp: 6000, at, bus });
          tone({ type: 'triangle', f0: 220, f1: 160, dur: 0.08, vol: 0.25, at, bus });
        } else if (tok === 'h') {
          noise({ dur: 0.035, vol: 0.13, hp: 7000, at, bus });
        } else if (tok === 'o') {
          noise({ dur: 0.14, vol: 0.12, hp: 6000, at, bus });
        }
        continue;
      }
      // hold length: count following "-" tokens
      let len = 1;
      while (st[i + len] === '-') len++;
      const f = freq(tok);
      if (!f) continue;
      if (c === 'bass') {
        tone({ type: 'sawtooth', f0: f, dur: sd * len * 0.95, vol: 0.32, at, bus, filter: 700 });
        tone({ type: 'square', f0: f / 2, dur: sd * len * 0.9, vol: 0.12, at, bus, filter: 400 });
      } else if (c === 'arp') {
        tone({ type: 'triangle', f0: f, dur: sd * 0.9, vol: 0.13, at, bus });
      } else {
        tone({ type: 'square', f0: f, dur: sd * len * 0.98, vol: 0.13, at, bus, filter: 4200 });
        tone({ type: 'square', f0: f * 1.005, dur: sd * len * 0.98, vol: 0.06, at: at + 0.012, bus, filter: 2400 });
      }
    }
  }
}

export const music = new MusicPlayer();
