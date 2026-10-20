// All sound is synthesised at runtime with WebAudio: no audio files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

/** Must be called from a user gesture. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.42;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.7;
  return muted;
}

export function getCtx(): AudioContext | null {
  return ctx;
}

export function getMusicBus(): GainNode | null {
  return musicBus;
}

// ---------------------------------------------------------------------------
// Primitives

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  vol?: number;
  at?: number;
  attack?: number;
  bus?: AudioNode | null;
  filter?: number;
}

export function tone(o: ToneOpts): void {
  if (!ctx) return;
  const t = (o.at ?? ctx.currentTime) + 0.001;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  const g = ctx.createGain();
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(o.bus ?? sfxBus!);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  at?: number;
  hp?: number;
  lp?: number;
  lp1?: number;
  bus?: AudioNode | null;
}

export function noise(o: NoiseOpts): void {
  if (!ctx || !noiseBuf) return;
  const t = (o.at ?? ctx.currentTime) + 0.001;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  let node: AudioNode = src;
  if (o.hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = o.hp;
    node.connect(f);
    node = f;
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + o.dur);
    node.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
  node.connect(g).connect(o.bus ?? sfxBus!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.02);
}

// ---------------------------------------------------------------------------
// Sound effects

export type Sfx =
  | 'hit' | 'hitHeavy' | 'heroHit' | 'whoosh' | 'whooshHeavy' | 'land' | 'ko' | 'glass' | 'pickup' | 'cheer'
  | 'warn' | 'charge' | 'beam' | 'scooter' | 'stolen' | 'loot' | 'ui' | 'select' | 'jump' | 'throw'
  | 'glassesOff' | 'go' | 'stealing' | 'shutter' | 'crunch' | 'wall';

const last: Partial<Record<Sfx, number>> = {};

export function sfx(name: Sfx): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  // de-duplicate identical sounds within 30 ms
  if ((last[name] ?? -1) > now - 0.03) return;
  last[name] = now;
  switch (name) {
    case 'hit':
      tone({ type: 'square', f0: 220, f1: 70, dur: 0.07, vol: 0.28 });
      noise({ dur: 0.06, vol: 0.35, lp: 3500, lp1: 600 });
      break;
    case 'hitHeavy':
      tone({ type: 'square', f0: 160, f1: 40, dur: 0.14, vol: 0.32 });
      tone({ type: 'sine', f0: 90, f1: 35, dur: 0.18, vol: 0.5 });
      noise({ dur: 0.12, vol: 0.45, lp: 4000, lp1: 300 });
      break;
    case 'heroHit':
      tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.12, vol: 0.22, filter: 1800 });
      noise({ dur: 0.08, vol: 0.3, lp: 2500, lp1: 400 });
      break;
    case 'whoosh':
      noise({ dur: 0.09, vol: 0.12, hp: 900, lp: 5000, lp1: 1500 });
      break;
    case 'whooshHeavy':
      noise({ dur: 0.16, vol: 0.18, hp: 400, lp: 3000, lp1: 700 });
      break;
    case 'land':
      tone({ type: 'sine', f0: 120, f1: 40, dur: 0.12, vol: 0.4 });
      noise({ dur: 0.1, vol: 0.18, lp: 900 });
      break;
    case 'ko':
      tone({ type: 'square', f0: 440, f1: 110, dur: 0.3, vol: 0.18 });
      tone({ type: 'sine', f0: 70, f1: 30, dur: 0.35, vol: 0.5 });
      break;
    case 'glass':
      for (let i = 0; i < 5; i++) tone({ type: 'triangle', f0: 2400 + Math.random() * 2400, dur: 0.12 + Math.random() * 0.1, vol: 0.06, at: now + i * 0.018 });
      noise({ dur: 0.2, vol: 0.2, hp: 3000 });
      break;
    case 'glassesOff':
      for (let i = 0; i < 3; i++) tone({ type: 'triangle', f0: 3000 - i * 400, dur: 0.08, vol: 0.08, at: now + i * 0.06 });
      break;
    case 'pickup':
      [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.07, vol: 0.12, at: now + i * 0.05 }));
      break;
    case 'loot':
      [988, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.12, at: now + i * 0.07 }));
      break;
    case 'stolen':
      [392, 330, 262].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.12, at: now + i * 0.09 }));
      break;
    case 'stealing':
      noise({ dur: 0.07, vol: 0.06, hp: 2000, lp: 6000 });
      break;
    case 'cheer':
      for (let i = 0; i < 4; i++) noise({ dur: 0.6, vol: 0.06, hp: 600 + i * 300, lp: 3000, at: now + i * 0.05 });
      [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.15, vol: 0.06, at: now + 0.1 + i * 0.08 }));
      break;
    case 'warn':
      tone({ type: 'square', f0: 880, dur: 0.08, vol: 0.12 });
      tone({ type: 'square', f0: 880, dur: 0.08, vol: 0.12, at: now + 0.12 });
      break;
    case 'charge':
      tone({ type: 'sawtooth', f0: 120, f1: 1400, dur: 0.9, vol: 0.12, filter: 3000, attack: 0.3 });
      noise({ dur: 0.9, vol: 0.06, hp: 2000 });
      break;
    case 'beam':
      tone({ type: 'sawtooth', f0: 90, f1: 60, dur: 0.9, vol: 0.25, filter: 1200 });
      tone({ type: 'square', f0: 880, f1: 440, dur: 0.6, vol: 0.08 });
      noise({ dur: 0.9, vol: 0.3, lp: 3000, lp1: 500 });
      break;
    case 'scooter':
      tone({ type: 'sawtooth', f0: 180, f1: 260, dur: 0.6, vol: 0.08, filter: 900 });
      break;
    case 'ui':
      tone({ type: 'square', f0: 660, dur: 0.04, vol: 0.08 });
      break;
    case 'select':
      tone({ type: 'square', f0: 880, dur: 0.06, vol: 0.1 });
      tone({ type: 'square', f0: 1320, dur: 0.08, vol: 0.1, at: now + 0.06 });
      break;
    case 'jump':
      tone({ type: 'square', f0: 200, f1: 420, dur: 0.08, vol: 0.06 });
      break;
    case 'throw':
      tone({ type: 'square', f0: 300, f1: 120, dur: 0.15, vol: 0.12 });
      break;
    case 'go':
      [523, 784].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.12, at: now + i * 0.12 }));
      break;
    case 'crunch':
      // layered finisher: sub thump + bitcrushed snap + noise tail
      tone({ type: 'sine', f0: 120, f1: 28, dur: 0.32, vol: 0.75 });
      tone({ type: 'square', f0: 900, f1: 60, dur: 0.09, vol: 0.18 });
      noise({ dur: 0.22, vol: 0.5, lp: 5000, lp1: 250 });
      noise({ dur: 0.05, vol: 0.3, hp: 2500, at: now + 0.02 });
      break;
    case 'wall':
      tone({ type: 'sine', f0: 80, f1: 30, dur: 0.25, vol: 0.6 });
      noise({ dur: 0.18, vol: 0.35, lp: 1800, lp1: 200 });
      break;
    case 'shutter':
      noise({ dur: 0.4, vol: 0.12, hp: 300, lp: 2000 });
      break;
  }
}
