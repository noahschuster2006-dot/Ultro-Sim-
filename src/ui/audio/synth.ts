/**
 * Shared Web Audio core for LifeSim Ultra: one lazily-created AudioContext, the mixing graph
 * (music bus + SFX bus + reverb sends + limiter), persisted audio prefs, power management and a
 * small library of synthesized instruments. Everything is generated at runtime with oscillators,
 * noise and filters — no samples, no files, no network.
 *
 * Every instrument takes any BaseAudioContext (so tracks/SFX can be rendered with an
 * OfflineAudioContext), schedules its own `stop()` and disconnects its nodes when it ends.
 * Nothing here touches `window`/`document`/`localStorage` at import time.
 */

export type Ctx = BaseAudioContext;
export type Rng = () => number;

// ---------------------------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------------------------

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/** Swallow a promise rejection (resume/suspend can reject when the context is closing). */
function quiet(p: Promise<unknown> | undefined | void): void {
  if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => undefined);
}

/** Freeze an AudioParam at its current value so new ramps start from where it is now. */
export function holdParam(p: AudioParam, t: number): void {
  const anyP = p as AudioParam & { cancelAndHoldAtTime?: (time: number) => AudioParam };
  if (typeof anyP.cancelAndHoldAtTime === 'function') {
    anyP.cancelAndHoldAtTime(t);
  } else {
    const v = p.value;
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
  }
}

/** Linear ramp of a param from its current value to `v` over `dur` seconds, starting now. */
export function rampParam(p: AudioParam, ctx: Ctx, v: number, dur: number): void {
  const t = ctx.currentTime;
  holdParam(p, t);
  p.linearRampToValueAtTime(v, t + Math.max(0.005, dur));
}

function disconnectAll(nodes: AudioNode[]): void {
  for (const n of nodes) {
    try {
      n.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}

/** Start/stop a set of sources and disconnect `nodes` when the first source ends. */
export function run(sources: AudioScheduledSourceNode[], nodes: AudioNode[], t: number, end: number): number {
  for (const s of sources) {
    s.start(t);
    s.stop(end);
  }
  if (sources.length) sources[0].onended = () => disconnectAll([...sources, ...nodes]);
  return end;
}

export function osc(ctx: Ctx, type: OscillatorType, f: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  if (detune) o.detune.value = detune;
  return o;
}

export function gain(ctx: Ctx, v = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function biquad(ctx: Ctx, type: BiquadFilterType, f: number, q = 0.707, db = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  if (db) b.gain.value = db;
  return b;
}

/** Percussive envelope: fast linear attack, exponential decay to silence. Returns end time. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(Math.max(1e-4, peak), t + attack);
  p.exponentialRampToValueAtTime(1e-4, t + attack + decay);
  return t + attack + decay;
}

/** Key-tracking: higher notes a little quieter, low notes a little louder. */
const kt = (f: number): number => clamp(Math.pow(330 / f, 0.3), 0.55, 1.25);

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
export function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

export function noiseSrc(ctx: Ctx): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  return s;
}

export function startNoise(s: AudioBufferSourceNode, t: number, end: number, nodes: AudioNode[]): number {
  s.start(t, Math.random() * 1.5);
  s.stop(end);
  s.onended = () => disconnectAll([s, ...nodes]);
  return end;
}

/** Generated stereo room impulse (decaying, progressively darker noise). */
export function makeImpulse(ctx: Ctx, seconds: number, rt60: number, preDelay = 0.012): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      if (t < preDelay) {
        d[i] = 0;
        continue;
      }
      const env = Math.exp((-6.9 * (t - preDelay)) / rt60);
      const a = 0.75 - 0.6 * Math.min(1, t / seconds); // damping: darker tail
      lp += a * (Math.random() * 2 - 1 - lp);
      const fadeIn = Math.min(1, (t - preDelay) / 0.006);
      const fadeOut = Math.min(1, (len - i) / (sr * 0.05));
      d[i] = lp * env * fadeIn * fadeOut;
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// Persisted preferences (shared by music + sfx)
// ---------------------------------------------------------------------------------------------

export interface AudioPrefs {
  volume: number;
  muted: boolean;
  pinned: string | null;
  sfxVolume: number;
  sfxMuted: boolean;
}

export const STORAGE_KEY = 'lifesim-ultra:audio';
const DEFAULT_PREFS: AudioPrefs = { volume: 0.45, muted: false, pinned: null, sfxVolume: 0.7, sfxMuted: false };
let prefs: AudioPrefs | null = null;

const unit = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : d;

export function getPrefs(): AudioPrefs {
  if (prefs) return prefs;
  const p: AudioPrefs = { ...DEFAULT_PREFS };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown> | null;
      if (o && typeof o === 'object') {
        p.volume = unit(o.volume, p.volume);
        p.sfxVolume = unit(o.sfxVolume, p.sfxVolume);
        if (typeof o.muted === 'boolean') p.muted = o.muted;
        if (typeof o.sfxMuted === 'boolean') p.sfxMuted = o.sfxMuted;
        if (typeof o.pinned === 'string' || o.pinned === null) p.pinned = o.pinned;
      }
    }
  } catch {
    /* storage blocked or corrupt — use defaults */
  }
  prefs = p;
  return p;
}

export function setPrefs(patch: Partial<AudioPrefs>): AudioPrefs {
  prefs = { ...getPrefs(), ...patch };
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked or full — keep in memory only */
  }
  return prefs;
}

// ---------------------------------------------------------------------------------------------
// Mixing graph
// ---------------------------------------------------------------------------------------------

export interface Graph {
  ctx: Ctx;
  /** Track dry outputs connect here. */
  musicDry: GainNode;
  /** Track reverb sends connect here. */
  musicWet: GainNode;
  musicDuck: GainNode;
  /** Music volume (user volume × mute). */
  musicVol: GainNode;
  sfxDry: GainNode;
  sfxWet: GainNode;
  sfxVol: GainNode;
  master: GainNode;
}

/**
 *   tracks ─ dry ──────────────┐
 *          └ wet → convolver ──┴→ duck → highpass → high-shelf → lowpass → compressor → musicVol ─┐
 *   sfx ── dry ──────────────┐                                                                   ├→ master → limiter → out
 *        └ wet → convolver ──┴→ compressor → sfxVol ─────────────────────────────────────────────┘
 */
export function buildGraph(ctx: Ctx, dest: AudioNode = ctx.destination): Graph {
  const master = gain(ctx, 1);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(limiter);
  limiter.connect(dest);

  // Music bus
  const musicDry = gain(ctx, 1);
  const musicWet = gain(ctx, 1);
  const musicSum = gain(ctx, 1);
  const mVerb = ctx.createConvolver();
  mVerb.buffer = makeImpulse(ctx, 2.6, 2.2);
  musicDry.connect(musicSum);
  musicWet.connect(mVerb);
  mVerb.connect(musicSum);
  const musicDuck = gain(ctx, 1);
  const hp = biquad(ctx, 'highpass', 32, 0.7);
  const shelf = biquad(ctx, 'highshelf', 5200, 0.707, -3);
  const lp = biquad(ctx, 'lowpass', 11500, 0.5);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 14;
  comp.ratio.value = 3;
  comp.attack.value = 0.015;
  comp.release.value = 0.35;
  const musicVol = gain(ctx, 0);
  musicSum.connect(musicDuck);
  musicDuck.connect(hp);
  hp.connect(shelf);
  shelf.connect(lp);
  lp.connect(comp);
  comp.connect(musicVol);
  musicVol.connect(master);

  // SFX bus
  const sfxDry = gain(ctx, 1);
  const sfxWet = gain(ctx, 1);
  const sfxSum = gain(ctx, 1);
  const sVerb = ctx.createConvolver();
  sVerb.buffer = makeImpulse(ctx, 1.8, 1.5, 0.008);
  sfxDry.connect(sfxSum);
  sfxWet.connect(sVerb);
  sVerb.connect(sfxSum);
  const sComp = ctx.createDynamicsCompressor();
  sComp.threshold.value = -12;
  sComp.knee.value = 8;
  sComp.ratio.value = 4;
  sComp.attack.value = 0.003;
  sComp.release.value = 0.2;
  const sfxVol = gain(ctx, 0);
  sfxSum.connect(sComp);
  sComp.connect(sfxVol);
  sfxVol.connect(master);

  return { ctx, musicDry, musicWet, musicDuck, musicVol, sfxDry, sfxWet, sfxVol, master };
}

// ---------------------------------------------------------------------------------------------
// The shared real-time context + power management
// ---------------------------------------------------------------------------------------------

type CtxCtor = new (opts?: AudioContextOptions) => AudioContext;

export function audioContextCtor(): CtxCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: CtxCtor; webkitAudioContext?: CtxCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

export const core: { ctx: AudioContext | null; graph: Graph | null } = { ctx: null, graph: null };

let hidden = false;
let musicNeedsAudio: () => boolean = () => false;
const visibilityListeners = new Set<() => void>();
let lastSfxAt = -1e9;
let powerTimer: ReturnType<typeof setTimeout> | null = null;

export const musicGain = (p: AudioPrefs): number => (p.muted ? 0 : p.volume);
export const sfxGain = (p: AudioPrefs): number => (p.sfxMuted ? 0 : p.sfxVolume);

/** Create (once) the shared AudioContext + graph. Returns null when Web Audio is unavailable. */
export function initContext(): Graph | null {
  if (core.graph) return core.graph;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  let graph: Graph;
  try {
    graph = buildGraph(ctx);
  } catch {
    quiet(ctx.close());
    return null;
  }
  const p = getPrefs();
  graph.musicVol.gain.value = musicGain(p);
  graph.sfxVol.gain.value = sfxGain(p);
  core.ctx = ctx;
  core.graph = graph;
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    hidden = !!document.hidden;
    document.addEventListener('visibilitychange', () => {
      hidden = !!document.hidden;
      const c = core.ctx;
      if (c) {
        if (hidden) {
          if (c.state === 'running') quiet(c.suspend());
        } else if (musicNeedsAudio()) {
          wake();
        }
      }
      for (const fn of visibilityListeners) fn();
    });
  }
  return graph;
}

/** Called within a user gesture: resume the context and play one silent sample (iOS unlock). */
export function unlockContext(): void {
  const c = core.ctx;
  if (!c) return;
  try {
    if (c.state !== 'running') quiet(c.resume());
    const b = c.createBuffer(1, 1, c.sampleRate);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    s.onended = () => disconnectAll([s]);
  } catch {
    /* ignore */
  }
}

export const isHidden = (): boolean => hidden;
export function onVisibilityChange(fn: () => void): void {
  visibilityListeners.add(fn);
}
export function setMusicActivityProbe(fn: () => boolean): void {
  musicNeedsAudio = fn;
}

/** Make sure the context is running (no-op while the tab is hidden). */
export function wake(): void {
  const c = core.ctx;
  if (!c || hidden) return;
  if (powerTimer !== null) {
    clearTimeout(powerTimer);
    powerTimer = null;
  }
  if (c.state === 'suspended') quiet(c.resume());
}

/** Record SFX activity: wake the context and re-arm the idle check. */
export function noteSfxActivity(): void {
  lastSfxAt = nowMs();
  wake();
  schedulePowerCheck();
}

/** Suspend the context a few seconds after nothing audible is happening (music muted/stopped, no SFX). */
export function schedulePowerCheck(delayMs = 3000): void {
  if (powerTimer !== null) clearTimeout(powerTimer);
  powerTimer = setTimeout(() => {
    powerTimer = null;
    const c = core.ctx;
    if (!c || musicNeedsAudio()) return;
    if (nowMs() - lastSfxAt < 2500) {
      schedulePowerCheck(1500);
      return;
    }
    if (c.state === 'running') quiet(c.suspend());
  }, delayMs);
}

/** Briefly lower the music bus (e.g. under a dramatic sting). */
export function duckMusic(seconds = 1.2, depth = 0.3): void {
  const g = core.graph;
  if (!g) return;
  const p = g.musicDuck.gain;
  const t = g.ctx.currentTime;
  holdParam(p, t);
  p.linearRampToValueAtTime(depth, t + 0.06);
  p.setValueAtTime(depth, t + 0.06 + Math.max(0, seconds));
  p.linearRampToValueAtTime(1, t + 0.06 + Math.max(0, seconds) + 0.9);
}

// ---------------------------------------------------------------------------------------------
// Pitched instruments. Signature: (ctx, dest, startTime, freqHz, durationSec, velocity 0..1) → end time
// ---------------------------------------------------------------------------------------------

/** Electric piano: FM sine "tine" with a decaying index + detuned triangle body. */
export function ePiano(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number): number {
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f);
  const mg = gain(ctx);
  const dev = f * (0.35 + 1.0 * vel);
  mg.gain.setValueAtTime(dev, t);
  mg.gain.setTargetAtTime(dev * 0.08, t, 0.1 + 40 / (f + 150));
  const tri = osc(ctx, 'triangle', f, 7);
  const tg = gain(ctx, 0.28);
  const g = gain(ctx);
  const peak = 0.16 * Math.pow(vel, 1.3) * kt(f);
  const off = t + Math.max(0.08, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.setTargetAtTime(peak * 0.05, t + 0.004, 0.55 + 110 / f);
  g.gain.setTargetAtTime(0, off, 0.06);
  mod.connect(mg);
  mg.connect(car.frequency);
  car.connect(g);
  tri.connect(tg);
  tg.connect(g);
  g.connect(dest);
  return run([car, mod, tri], [mg, tg, g], t, off + 0.4);
}

/** Marimba (short) or vibraphone (long, damped at note-off): sine + 4th-harmonic mallet partial. */
export function marimba(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number, long = false): number {
  const base = clamp(Math.pow(260 / f, 0.55), 0.35, 1.5);
  const decay = long ? 2.2 * base + 0.6 : 0.9 * base;
  const peak = (long ? 0.2 : 0.26) * Math.pow(vel, 1.2) * kt(f);
  const o1 = osc(ctx, 'sine', f);
  const g1 = gain(ctx);
  const o2 = osc(ctx, 'sine', f * 4);
  const g2 = gain(ctx);
  let end: number;
  if (long) {
    const off = t + Math.max(0.15, dur);
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(peak, t + 0.002);
    g1.gain.setTargetAtTime(0, t + 0.002, decay / 4);
    g1.gain.setTargetAtTime(0, off, 0.12);
    end = Math.min(t + decay * 1.4, off + 0.6);
    perc(g2.gain, t, peak * 0.3, 0.001, 0.35);
  } else {
    end = perc(g1.gain, t, peak, 0.002, decay);
    perc(g2.gain, t, peak * 0.22, 0.001, Math.min(0.1, decay * 0.25));
  }
  o1.connect(g1);
  o2.connect(g2);
  g1.connect(dest);
  g2.connect(dest);
  return run([o1, o2], [g1, g2], t, end + 0.01);
}

/** Plucked string (nylon guitar / pizzicato): saw + triangle through a decaying lowpass. */
export function pluck(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number, tone = 0.6): number {
  const o1 = osc(ctx, 'sawtooth', f, 3);
  const o1g = gain(ctx, 0.5);
  const o2 = osc(ctx, 'triangle', f);
  const lp = biquad(ctx, 'lowpass', 1000, 0.9);
  lp.frequency.setValueAtTime(Math.min(15000, f * (2.5 + 9 * tone * vel)), t);
  lp.frequency.setTargetAtTime(f * 1.3, t, 0.03 + 0.12 * tone);
  const g = gain(ctx);
  const peak = 0.22 * Math.pow(vel, 1.2) * kt(f);
  const tc = clamp(0.32 * Math.pow(220 / f, 0.5), 0.1, 0.5);
  const off = t + Math.max(0.05, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.002, tc);
  g.gain.setTargetAtTime(0, off, 0.05);
  const end = Math.min(t + tc * 6, off + 0.3);
  o1.connect(o1g);
  o1g.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  g.connect(dest);
  return run([o1, o2], [o1g, lp, g], t, end);
}

/** FM bell / celesta / music box. `ratio` = modulator/carrier, `index` = peak deviation in multiples of f. */
export function fmBell(
  ctx: Ctx,
  dest: AudioNode,
  t: number,
  f: number,
  vel: number,
  decay: number,
  ratio = 3.5,
  index = 1.5,
  level = 0.15,
): number {
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f * ratio);
  const mg = gain(ctx);
  mg.gain.setValueAtTime(f * index * (0.5 + 0.5 * vel), t);
  mg.gain.exponentialRampToValueAtTime(f * index * 0.02 + 0.01, t + decay * 0.6);
  const g = gain(ctx);
  const end = perc(g.gain, t, level * Math.pow(vel, 1.1) * kt(f), 0.002, decay);
  mod.connect(mg);
  mg.connect(car.frequency);
  car.connect(g);
  g.connect(dest);
  return run([car, mod], [mg, g], t, end + 0.01);
}

/** Soft flute / whistle: sine + 2nd harmonic, delayed vibrato and a breathy "chiff". */
export function flute(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number): number {
  const o1 = osc(ctx, 'sine', f);
  const o2 = osc(ctx, 'sine', f * 2);
  const g2 = gain(ctx, 0.12);
  const lfo = osc(ctx, 'sine', 5.1);
  const lg = gain(ctx);
  lg.gain.setValueAtTime(0, t);
  lg.gain.setValueAtTime(0, t + 0.18);
  lg.gain.linearRampToValueAtTime(11, t + 0.65);
  lfo.connect(lg);
  lg.connect(o1.detune);
  lg.connect(o2.detune);
  const g = gain(ctx);
  const peak = 0.17 * Math.pow(vel, 1.1) * kt(f);
  const off = t + Math.max(0.12, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.06);
  g.gain.setTargetAtTime(peak * 0.78, t + 0.06, 0.35);
  g.gain.setTargetAtTime(0, off, 0.07);
  const end = off + 0.4;
  o1.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(dest);
  // breath chiff
  const n = noiseSrc(ctx);
  const bp = biquad(ctx, 'bandpass', Math.min(9000, f * 3), 1.2);
  const ng = gain(ctx);
  perc(ng.gain, t, 0.05 * vel, 0.005, 0.07);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(dest);
  startNoise(n, t, t + 0.09, [bp, ng]);
  return run([o1, o2, lfo], [g2, lg, g], t, end);
}

/** Brass section (two detuned saws, filter "blat"). `soft` = muted horn with vibrato. */
export function brass(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number, soft = false): number {
  const o1 = osc(ctx, 'sawtooth', f, -6);
  const o2 = osc(ctx, 'sawtooth', f, 6);
  const lp = biquad(ctx, 'lowpass', f, soft ? 0.7 : 1.4);
  const atk = soft ? 0.07 : 0.035;
  const top = Math.min(8000, f * (soft ? 2.2 + 2 * vel : 3 + 4 * vel));
  lp.frequency.setValueAtTime(f * 1.1, t);
  lp.frequency.linearRampToValueAtTime(top, t + atk + 0.02);
  lp.frequency.setTargetAtTime(f * (soft ? 1.7 : 2.4), t + atk + 0.02, 0.22);
  const off = t + Math.max(0.1, dur);
  lp.frequency.setTargetAtTime(f * 1.1, off, 0.08);
  const g = gain(ctx);
  const peak = 0.085 * Math.pow(vel, 1.1) * kt(f);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.setTargetAtTime(peak * 0.72, t + atk, 0.25);
  g.gain.setTargetAtTime(0, off, soft ? 0.09 : 0.07);
  const sources: AudioScheduledSourceNode[] = [o1, o2];
  const nodes: AudioNode[] = [lp, g];
  if (soft) {
    const lfo = osc(ctx, 'sine', 4.7);
    const lg = gain(ctx);
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + 0.2);
    lg.gain.linearRampToValueAtTime(9, t + 0.6);
    lfo.connect(lg);
    lg.connect(o1.detune);
    lg.connect(o2.detune);
    sources.push(lfo);
    nodes.push(lg);
  }
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  g.connect(dest);
  return run(sources, nodes, t, off + 0.45);
}

/** Warm pad: two detuned saws per note through one slowly opening lowpass. */
export function pad(
  ctx: Ctx,
  dest: AudioNode,
  t: number,
  freqs: number[],
  dur: number,
  vel: number,
  cutoff = 1400,
  attack = 0.6,
  release = 1.2,
): number {
  const lp = biquad(ctx, 'lowpass', cutoff * 0.5, 0.6);
  lp.frequency.setValueAtTime(cutoff * 0.5, t);
  lp.frequency.linearRampToValueAtTime(cutoff, t + attack + 0.4);
  const g = gain(ctx);
  const peak = (0.055 * vel) / Math.sqrt(Math.max(1, freqs.length));
  const off = t + Math.max(attack, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, off, release / 4);
  const end = off + release * 1.4;
  const sources: OscillatorNode[] = [];
  for (const f of freqs) {
    for (const d of [-8, 7]) {
      const o = osc(ctx, 'sawtooth', f, d + (Math.random() - 0.5) * 4);
      o.connect(lp);
      sources.push(o);
    }
  }
  lp.connect(g);
  g.connect(dest);
  return run(sources, [lp, g], t, end);
}

/** Upright-ish bass (triangle + sine through a closing lowpass), or a rounder synth bass. */
export function bass(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number, synth = false): number {
  const o1 = osc(ctx, synth ? 'sawtooth' : 'triangle', f);
  const o2 = osc(ctx, 'sine', f);
  const g2 = gain(ctx, synth ? 0.8 : 0.6);
  const lp = biquad(ctx, 'lowpass', 800, synth ? 2.5 : 0.8);
  lp.frequency.setValueAtTime(synth ? 1300 : 700 + 900 * vel, t);
  lp.frequency.setTargetAtTime(synth ? 320 : 240 + f, t, synth ? 0.07 : 0.09);
  const o1g = gain(ctx, synth ? 0.45 : 1);
  const g = gain(ctx);
  const peak = 0.34 * Math.pow(vel, 1.1);
  const off = t + Math.max(0.06, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.007);
  g.gain.setTargetAtTime(peak * 0.5, t + 0.007, 0.28);
  g.gain.setTargetAtTime(0, off, 0.035);
  o1.connect(o1g);
  o1g.connect(lp);
  lp.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(dest);
  return run([o1, o2], [o1g, g2, lp, g], t, off + 0.2);
}

/** Slow drone (root + octave + 12th) with long attack/release. */
export function drone(ctx: Ctx, dest: AudioNode, t: number, f: number, dur: number, vel: number): number {
  const o1 = osc(ctx, 'sine', f);
  const o2 = osc(ctx, 'triangle', f * 2, 4);
  const g2 = gain(ctx, 0.22);
  const o3 = osc(ctx, 'sine', f * 3, -3);
  const g3 = gain(ctx, 0.1);
  const g = gain(ctx);
  const peak = 0.22 * vel;
  const off = t + Math.max(2, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 1.6);
  g.gain.setTargetAtTime(0, off, 0.6);
  o1.connect(g);
  o2.connect(g2);
  g2.connect(g);
  o3.connect(g3);
  g3.connect(g);
  g.connect(dest);
  return run([o1, o2, o3], [g2, g3, g], t, off + 3);
}

// ---------------------------------------------------------------------------------------------
// Percussion
// ---------------------------------------------------------------------------------------------

/** Generic filtered-noise hit. */
export function noiseHit(
  ctx: Ctx,
  dest: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
): number {
  const n = noiseSrc(ctx);
  const f = biquad(ctx, type, freq, q);
  const g = gain(ctx);
  const end = perc(g.gain, t, peak, attack, decay);
  n.connect(f);
  f.connect(g);
  g.connect(dest);
  return startNoise(n, t, end + 0.01, [f, g]);
}

export function kick(ctx: Ctx, dest: AudioNode, t: number, vel: number): number {
  const o = osc(ctx, 'sine', 120);
  o.frequency.setValueAtTime(125, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
  const g = gain(ctx);
  const end = perc(g.gain, t, 0.7 * vel, 0.003, 0.36);
  o.connect(g);
  g.connect(dest);
  return run([o], [g], t, end + 0.01);
}

export const brushTap = (ctx: Ctx, d: AudioNode, t: number, vel: number): number =>
  noiseHit(ctx, d, t, 'bandpass', 3200, 0.6, 0.22 * vel, 0.004, 0.16);

/** Brush stir — a slower, airy swish. */
export function brushSwish(ctx: Ctx, dest: AudioNode, t: number, vel: number, len = 0.35): number {
  const n = noiseSrc(ctx);
  const f = biquad(ctx, 'bandpass', 2000, 0.5);
  f.frequency.setValueAtTime(1800, t);
  f.frequency.linearRampToValueAtTime(4200, t + len);
  const g = gain(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.1 * vel, t + len * 0.45);
  g.gain.linearRampToValueAtTime(0, t + len);
  n.connect(f);
  f.connect(g);
  g.connect(dest);
  return startNoise(n, t, t + len + 0.01, [f, g]);
}

export const hatChick = (ctx: Ctx, d: AudioNode, t: number, vel: number): number =>
  noiseHit(ctx, d, t, 'highpass', 7000, 0.7, 0.16 * vel, 0.001, 0.035);
export const shaker = (ctx: Ctx, d: AudioNode, t: number, vel: number): number =>
  noiseHit(ctx, d, t, 'highpass', 6000, 0.8, 0.15 * vel, 0.012, 0.06);
export const tick = (ctx: Ctx, d: AudioNode, t: number, vel: number): number =>
  noiseHit(ctx, d, t, 'highpass', 8500, 0.7, 0.13 * vel, 0.0005, 0.02);
export const crash = (ctx: Ctx, d: AudioNode, t: number, vel: number): number =>
  noiseHit(ctx, d, t, 'highpass', 4500, 0.5, 0.14 * vel, 0.002, 1.5);

/** Ride cymbal: three inharmonic squares through a band-pass plus a noise sizzle. */
export function ride(ctx: Ctx, dest: AudioNode, t: number, vel: number): number {
  const bp = biquad(ctx, 'bandpass', 7800, 0.9);
  const hp = biquad(ctx, 'highpass', 5200, 0.7);
  const g = gain(ctx);
  const end = perc(g.gain, t, 0.11 * vel, 0.001, 0.4);
  const oscs = [1047, 1481, 1867].map((f) => osc(ctx, 'square', f));
  for (const o of oscs) o.connect(bp);
  bp.connect(hp);
  hp.connect(g);
  g.connect(dest);
  noiseHit(ctx, dest, t, 'bandpass', 9500, 1.5, 0.05 * vel, 0.001, 0.12);
  return run(oscs, [bp, hp, g], t, end + 0.01);
}

export function rim(ctx: Ctx, dest: AudioNode, t: number, vel: number): number {
  const o = osc(ctx, 'triangle', 1750);
  const o2 = osc(ctx, 'sine', 820);
  const g = gain(ctx);
  const end = perc(g.gain, t, 0.22 * vel, 0.0005, 0.04);
  o.connect(g);
  o2.connect(g);
  g.connect(dest);
  noiseHit(ctx, dest, t, 'bandpass', 2600, 2, 0.14 * vel, 0.0005, 0.02);
  return run([o, o2], [g], t, end + 0.01);
}

export function snap(ctx: Ctx, dest: AudioNode, t: number, vel: number): number {
  noiseHit(ctx, dest, t, 'highpass', 5000, 0.7, 0.18 * vel, 0.0005, 0.015);
  return noiseHit(ctx, dest, t, 'bandpass', 2300, 3, 0.55 * vel, 0.001, 0.06);
}

/** Soft hand clap (three quick bursts and a short tail). */
export function clap(ctx: Ctx, dest: AudioNode, t: number, vel: number): number {
  const n = noiseSrc(ctx);
  const f = biquad(ctx, 'bandpass', 1500, 1.1);
  const g = gain(ctx);
  const p = 0.4 * vel;
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.011;
    g.gain.setValueAtTime(p, s);
    g.gain.exponentialRampToValueAtTime(p * 0.15, s + 0.009);
  }
  g.gain.setValueAtTime(p * 0.7, t + 0.034);
  g.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
  n.connect(f);
  f.connect(g);
  g.connect(dest);
  return startNoise(n, t, t + 0.17, [f, g]);
}

/** Tuned drum: tom / timpani / hand drum depending on parameters. */
export function tom(ctx: Ctx, dest: AudioNode, t: number, f: number, vel: number, decay = 0.5, bend = 1.6, slap = 0): number {
  const o = osc(ctx, 'sine', f);
  o.frequency.setValueAtTime(f * bend, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const g = gain(ctx);
  const end = perc(g.gain, t, 0.5 * vel, 0.002, decay);
  o.connect(g);
  g.connect(dest);
  noiseHit(ctx, dest, t, 'lowpass', 900, 0.7, 0.12 * vel, 0.001, 0.05);
  if (slap > 0) noiseHit(ctx, dest, t, 'bandpass', 1300, 1, slap * vel, 0.0005, 0.03);
  return run([o], [g], t, end + 0.01);
}

/** Reverse-cymbal swell ending at t + len. */
export function swell(ctx: Ctx, dest: AudioNode, t: number, vel: number, len: number): number {
  const n = noiseSrc(ctx);
  const f = biquad(ctx, 'highpass', 3000, 0.6);
  f.frequency.setValueAtTime(2500, t);
  f.frequency.exponentialRampToValueAtTime(7000, t + len);
  const g = gain(ctx);
  g.gain.setValueAtTime(1e-4, t);
  g.gain.exponentialRampToValueAtTime(0.12 * vel, t + len);
  g.gain.linearRampToValueAtTime(0, t + len + 0.04);
  n.connect(f);
  f.connect(g);
  g.connect(dest);
  return startNoise(n, t, t + len + 0.05, [f, g]);
}
