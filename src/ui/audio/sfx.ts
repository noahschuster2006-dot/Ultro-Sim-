/**
 * Sound effects, synthesized on the same AudioContext and SFX bus as the music (see ./synth.ts).
 * Nothing here touches `window` at import time; `play` is a no-op until `music.unlock()` has run.
 */

import {
  type Ctx,
  type Graph,
  biquad,
  brass,
  clamp,
  clap,
  core,
  drone,
  fmBell,
  gain,
  getPrefs,
  kick,
  marimba,
  mtof,
  noiseHit,
  noiseSrc,
  noteSfxActivity,
  osc,
  pad,
  perc,
  pluck,
  rampParam,
  run,
  setPrefs,
  sfxGain,
  startNoise,
  swell,
} from './synth';

export type Sfx =
  | 'tap'
  | 'open'
  | 'back'
  | 'notify'
  | 'ageUp'
  | 'good'
  | 'bad'
  | 'sting'
  | 'alien'
  | 'explosion'
  | 'siren'
  | 'cash'
  | 'heart'
  | 'bell'
  | 'death'
  | 'birth'
  | 'cheer'
  | 'magic'
  | 'dark'
  | 'lock';

interface Bus {
  dry: AudioNode;
  /** A little room. */
  room: AudioNode;
  /** A big hall. */
  hall: AudioNode;
}

const buses = new WeakMap<Graph, Bus>();

function busFor(g: Graph): Bus {
  let b = buses.get(g);
  if (!b) {
    const room = gain(g.ctx, 0.18);
    const hall = gain(g.ctx, 0.5);
    room.connect(g.sfxWet);
    hall.connect(g.sfxWet);
    // Sends also feed the dry path so a sound routed to "hall" is not only reverb.
    room.connect(g.sfxDry);
    hall.connect(g.sfxDry);
    b = { dry: g.sfxDry, room, hall };
    buses.set(g, b);
  }
  return b;
}

/** Pitch glide on a sine/other oscillator with a percussive envelope. */
function blip(ctx: Ctx, dest: AudioNode, t: number, f0: number, f1: number, len: number, peak: number, type: OscillatorType = 'sine'): number {
  const o = osc(ctx, type, f0);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.8);
  const g = gain(ctx);
  const end = perc(g.gain, t, peak, 0.004, len);
  o.connect(g);
  g.connect(dest);
  return run([o], [g], t, end + 0.01);
}

type Maker = (ctx: Ctx, b: Bus, t: number) => void;

const N = (name: string): number => {
  // 'C5' → Hz
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] ? 1 : 0);
  return mtof(12 * (Number(m[3]) + 1) + pc);
};

const MAKERS: Record<Sfx, Maker> = {
  tap: (c, b, t) => {
    noiseHit(c, b.dry, t, 'highpass', 3500, 0.8, 0.18, 0.001, 0.025);
    blip(c, b.dry, t, 1900, 1500, 0.04, 0.08);
  },
  open: (c, b, t) => {
    blip(c, b.room, t, 520, 1150, 0.13, 0.5);
    blip(c, b.room, t + 0.05, 780, 1560, 0.12, 0.28, 'triangle');
  },
  back: (c, b, t) => {
    blip(c, b.room, t, 1100, 560, 0.13, 0.45);
  },
  lock: (c, b, t) => {
    noiseHit(c, b.dry, t, 'bandpass', 2400, 2, 0.3, 0.001, 0.02);
    noiseHit(c, b.dry, t + 0.045, 'bandpass', 1500, 2, 0.25, 0.001, 0.03);
    blip(c, b.dry, t, 180, 90, 0.08, 0.25);
  },
  notify: (c, b, t) => {
    fmBell(c, b.room, t, N('E6'), 0.8, 0.7, 3.5, 1.1, 0.5);
    fmBell(c, b.room, t + 0.13, N('A6'), 0.9, 0.9, 3.5, 1.1, 0.5);
  },
  ageUp: (c, b, t) => {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => marimba(c, b.room, t + i * 0.065, N(n), 0.3, 1));
    fmBell(c, b.room, t + 0.33, N('C7'), 0.8, 0.8, 3.5, 0.8, 0.3);
  },
  good: (c, b, t) => {
    ['C6', 'E6', 'G6'].forEach((n, i) => fmBell(c, b.room, t + i * 0.035, N(n), 0.8, 1.1, 3.5, 0.9, 0.32));
  },
  bad: (c, b, t) => {
    marimba(c, b.room, t, N('A2'), 0.4, 1);
    marimba(c, b.room, t + 0.09, N('C3'), 0.4, 0.8);
    noiseHit(c, b.dry, t, 'lowpass', 400, 0.7, 0.2, 0.002, 0.18);
  },
  sting: (c, b, t) => {
    for (const n of ['D2', 'A2', 'D3', 'F3']) brass(c, b.hall, t, N(n), 0.75, 0.9);
    noiseHit(c, b.hall, t, 'lowpass', 1600, 0.6, 0.35, 0.002, 0.5);
    kick(c, b.dry, t, 0.9);
  },
  alien: (c, b, t) => {
    // Theremin: sine with vibrato, gliding up and down, plus a detuned shadow voice.
    const len = 2.1;
    for (const [mult, lvl] of [
      [1, 0.16],
      [1.501, 0.05],
    ] as const) {
      const o = osc(c, 'sine', 420 * mult);
      o.frequency.setValueAtTime(420 * mult, t);
      o.frequency.exponentialRampToValueAtTime(980 * mult, t + 0.7);
      o.frequency.exponentialRampToValueAtTime(560 * mult, t + 1.4);
      o.frequency.exponentialRampToValueAtTime(820 * mult, t + len);
      const lfo = osc(c, 'sine', 6.2);
      const depth = gain(c, 28 * mult);
      lfo.connect(depth);
      depth.connect(o.frequency);
      const g = gain(c);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.15);
      g.gain.setValueAtTime(lvl, t + len - 0.3);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g);
      g.connect(b.hall);
      run([o, lfo], [depth, g], t, t + len + 0.02);
    }
  },
  explosion: (c, b, t) => {
    const n = noiseSrc(c);
    const lp = biquad(c, 'lowpass', 2200, 0.8);
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(110, t + 1.3);
    const g = gain(c);
    const end = perc(g.gain, t, 0.85, 0.005, 1.4);
    n.connect(lp);
    lp.connect(g);
    g.connect(b.hall);
    startNoise(n, t, end + 0.02, [lp, g]);
    blip(c, b.dry, t, 90, 32, 0.6, 0.7);
  },
  siren: (c, b, t) => {
    const len = 2.3;
    const o = osc(c, 'sawtooth', 650);
    const o2 = osc(c, 'square', 650, 8);
    for (const x of [o, o2]) {
      x.frequency.setValueAtTime(640, t);
      for (let k = 0; k < 3; k++) {
        x.frequency.linearRampToValueAtTime(960, t + k * 0.8 + 0.4);
        x.frequency.linearRampToValueAtTime(640, t + k * 0.8 + 0.8);
      }
    }
    const lp = biquad(c, 'lowpass', 2200, 1);
    const g = gain(c);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.08);
    g.gain.setValueAtTime(0.13, t + len - 0.35);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(b.room);
    run([o, o2], [lp, g], t, t + len + 0.02);
  },
  cash: (c, b, t) => {
    noiseHit(c, b.dry, t, 'bandpass', 5200, 3, 0.25, 0.001, 0.05);
    noiseHit(c, b.dry, t + 0.05, 'bandpass', 3800, 3, 0.18, 0.001, 0.05);
    fmBell(c, b.room, t + 0.09, N('C7'), 1, 1.1, 2.76, 1.6, 0.4);
    fmBell(c, b.room, t + 0.09, N('E7'), 0.8, 1.0, 2.76, 1.6, 0.28);
  },
  heart: (c, b, t) => {
    ['C5', 'E5', 'G5', 'B5', 'D6', 'E6', 'G6'].forEach((n, i) => pluck(c, b.hall, t + i * 0.055, N(n), 0.6, 0.55 + i * 0.04, 0.4));
  },
  bell: (c, b, t) => {
    fmBell(c, b.hall, t, N('E4'), 1, 2.4, 1.4, 2.4, 0.18);
    fmBell(c, b.hall, t, N('E5'), 0.7, 1.6, 2.0, 1.2, 0.08);
    fmBell(c, b.hall, t + 0.6, N('B3'), 0.8, 1.8, 1.4, 2.2, 0.12);
  },
  death: (c, b, t) => {
    pad(c, b.hall, t, [N('A2'), N('C3'), N('E3'), N('A3')], 1.3, 1, 900, 0.25, 0.9);
    fmBell(c, b.hall, t, N('A4'), 0.5, 1.8, 1.4, 1.6, 0.08);
  },
  birth: (c, b, t) => {
    ['G6', 'E6', 'C6', 'D6', 'G6', 'C7'].forEach((n, i) => fmBell(c, b.room, t + i * 0.13, N(n), 0.75, 0.8, 5.0, 0.6, 0.4));
  },
  cheer: (c, b, t) => {
    // A crowd: several band-limited noise voices swelling with uneven amplitude, plus claps.
    for (const [f, d] of [
      [700, 0],
      [1150, 0.05],
      [1700, 0.1],
      [2400, 0.03],
    ] as const) {
      const n = noiseSrc(c);
      const bp = biquad(c, 'bandpass', f, 1.4);
      const g = gain(c);
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.12, t + d + 0.25);
      g.gain.setTargetAtTime(0.07, t + d + 0.3, 0.3);
      g.gain.linearRampToValueAtTime(0, t + 1.5);
      const wob = osc(c, 'sine', 7 + f / 400);
      const wd = gain(c, 0.04);
      wob.connect(wd);
      wd.connect(g.gain);
      n.connect(bp);
      bp.connect(g);
      g.connect(b.hall);
      startNoise(n, t + d, t + 1.55, [bp, g]);
      run([wob], [wd], t + d, t + 1.55);
    }
    for (let k = 0; k < 7; k++) clap(c, b.room, t + 0.1 + k * 0.17 + (k % 2) * 0.03, 0.5);
  },
  magic: (c, b, t) => {
    ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'].forEach((n, i) => fmBell(c, b.hall, t + i * 0.045, N(n), 0.5 + i * 0.05, 0.7, 4.0, 0.8, 0.2));
    swell(c, b.hall, t, 0.6, 0.45);
  },
  dark: (c, b, t) => {
    drone(c, b.hall, t, N('A1'), 1.2, 1);
    const o = osc(c, 'triangle', N('D#2'));
    const g = gain(c);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.6);
    g.gain.linearRampToValueAtTime(0, t + 2.2);
    o.connect(g);
    g.connect(b.hall);
    run([o], [g], t, t + 2.25);
  },
};

let lastAt: Partial<Record<Sfx, number>> = {};

/** Offline/testing helper: render one effect into any graph at time t. */
export function renderSfxInto(g: Graph, id: Sfx, t: number): void {
  MAKERS[id](g.ctx, busFor(g), t);
}

export const sfx = {
  play(id: Sfx): void {
    const g = core.graph;
    if (!g || getPrefs().sfxMuted) return;
    const now = g.ctx.currentTime;
    // Don't stack the same effect within a few frames.
    if ((lastAt[id] ?? -1) > now - 0.06) return;
    lastAt[id] = now;
    noteSfxActivity();
    try {
      MAKERS[id](g.ctx, busFor(g), now + 0.01);
    } catch {
      /* audio must never break the game */
    }
  },
  setVolume(v: number): void {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const p = setPrefs({ sfxVolume: clamp(v, 0, 1) });
    const g = core.graph;
    if (g) rampParam(g.sfxVol.gain, g.ctx, sfxGain(p), 0.08);
  },
  setMuted(m: boolean): void {
    const p = setPrefs({ sfxMuted: !!m });
    const g = core.graph;
    if (g) rampParam(g.sfxVol.gain, g.ctx, sfxGain(p), 0.08);
    if (m) lastAt = {};
  },
  get state(): { volume: number; muted: boolean } {
    const p = getPrefs();
    return { volume: p.sfxVolume, muted: p.sfxMuted };
  },
};
