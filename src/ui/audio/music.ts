/**
 * Procedural background music for LifeSim Ultra — light jazzy / bossa / plucky "build mode" style
 * tunes, all original and synthesized at runtime with the Web Audio API (see ./synth.ts).
 *
 * Each track is data: key, scale, meter, swing, a chord progression per section (A/B…), a form,
 * and instrument/style choices for comp, bass, drums, melody and pad. A seeded melody writer builds
 * motifs per section (rhythm + contour), repeats them with variation and realizes them over the
 * changes, so the result sounds composed rather than random. Playback uses a look-ahead scheduler
 * (25 ms timer, 150 ms horizon against `AudioContext.currentTime`).
 *
 * Nothing touches `window`/`document`/`localStorage` at import time.
 */

import {
  type Ctx,
  type Graph,
  type Rng,
  bass,
  brass,
  brushSwish,
  brushTap,
  clamp,
  clap,
  core,
  crash,
  drone,
  duckMusic,
  ePiano,
  flute,
  fmBell,
  getPrefs,
  hashString,
  hatChick,
  holdParam,
  initContext,
  isHidden,
  kick,
  marimba,
  mtof,
  mulberry32,
  musicGain,
  onVisibilityChange,
  pad,
  pluck,
  rampParam,
  ride,
  rim,
  schedulePowerCheck,
  setMusicActivityProbe,
  setPrefs,
  shaker,
  snap,
  swell,
  tick as tickHit,
  tom,
  unlockContext,
  wake,
} from './synth';

export type Mood = 'calm' | 'upbeat' | 'tense' | 'sad' | 'epic' | 'mystic';
export interface Track {
  id: string;
  name: string;
  mood: Mood;
  bpm: number;
}

// ---------------------------------------------------------------------------------------------
// Track definitions
// ---------------------------------------------------------------------------------------------

type Inst = 'epiano' | 'marimba' | 'vibes' | 'nylon' | 'pizz' | 'celesta' | 'bell' | 'flute' | 'brass' | 'horn';
type CompStyle = 'charleston' | 'bossa' | 'offbeat' | 'waltz' | 'arp' | 'pulse' | 'stabs' | 'ostinato';
type BassStyle = 'walking' | 'bossa' | 'twofeel' | 'waltz' | 'pedal' | 'pulse' | 'epic' | 'drone';
type DrumStyle = 'brushes' | 'noir' | 'bossa' | 'pop' | 'waltz' | 'pulse' | 'ballad' | 'epic' | 'hand';
/** Mixer parts of a track (exported for offline level checks). */
export type Part = 'comp' | 'bass' | 'drums' | 'melody' | 'pad';

interface TrackDef extends Track {
  /** Tonic pitch class (0 = C). */
  key: number;
  /** Melody scale, semitones above the tonic. */
  scale: number[];
  meter: 3 | 4;
  /** Delay of the off-beat 8th as a fraction of a beat (0 = straight, ~0.167 = triplet swing). */
  swing: number;
  /** Roman-numeral chords per bar; two chords in a bar split it. */
  sections: Record<string, string[]>;
  form: string;
  comp: { style: CompStyle; inst: Inst; center: number; level: number; rootless?: boolean; pan?: number };
  bass: { style: BassStyle; level: number; synth?: boolean };
  drums: { style: DrumStyle; level: number };
  melody: {
    inst: Inst;
    /** Instrument used for improvised ("noodle") sections. */
    alt?: Inst;
    lo: number;
    hi: number;
    /** Rhythmic grid in beats (0.5 = 8ths). */
    grid: number;
    density: number;
    level: number;
    phraseBars: number;
    pan?: number;
  };
  pad?: { level: number; cutoff: number; attack: number; when: 'always' | 'B' | 'sometimes' };
  reverb: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

const DEFS: TrackDef[] = [
  {
    id: 'sunday-plans',
    name: 'Sunday Plans',
    mood: 'calm',
    bpm: 120,
    key: 2, // D major, bossa nova
    scale: MAJOR,
    meter: 4,
    swing: 0,
    sections: {
      A: ['Imaj7', 'Imaj7', 'ii7', 'V7', 'iii7', 'VI7', 'ii7', 'V7sus V7'],
      B: ['IVmaj7', 'IVmaj7', 'iv6', 'iv6', 'iii7', 'VI7', 'II7', 'V7'],
    },
    form: 'AABA',
    comp: { style: 'bossa', inst: 'nylon', center: 60, level: 0.6, pan: -0.2 },
    bass: { style: 'bossa', level: 0.75 },
    drums: { style: 'bossa', level: 0.6 },
    melody: { inst: 'vibes', alt: 'flute', lo: 66, hi: 86, grid: 0.5, density: 0.5, level: 0.7, phraseBars: 2, pan: 0.15 },
    pad: { level: 0.3, cutoff: 1300, attack: 0.8, when: 'B' },
    reverb: 0.3,
  },
  {
    id: 'neighbourhood-stroll',
    name: 'Neighbourhood Stroll',
    mood: 'upbeat',
    bpm: 132,
    key: 10, // Bb major, medium swing
    scale: MAJOR,
    meter: 4,
    swing: 0.14,
    sections: {
      A: ['Imaj7 vi7', 'ii7 V7', 'iii7 VI7', 'ii7 V7', 'I7', 'IVmaj7 iv7', 'iii7 VI7', 'ii7 V7'],
      B: ['III7', 'III7', 'VI7', 'VI7', 'II7', 'II7', 'V7', 'V7'],
    },
    form: 'AABA',
    comp: { style: 'charleston', inst: 'epiano', center: 60, level: 0.55, rootless: true, pan: -0.18 },
    bass: { style: 'walking', level: 0.8 },
    drums: { style: 'brushes', level: 0.6 },
    melody: { inst: 'marimba', alt: 'vibes', lo: 67, hi: 89, grid: 0.5, density: 0.65, level: 0.75, phraseBars: 2, pan: 0.15 },
    reverb: 0.2,
  },
  {
    id: 'paper-route',
    name: 'Paper Route',
    mood: 'upbeat',
    bpm: 144,
    key: 7, // G major, bouncy and plucky
    scale: MAJOR,
    meter: 4,
    swing: 0.06,
    sections: {
      A: ['I6', 'I6', 'IVmaj7', 'IVmaj7', 'iii7', 'VI7', 'ii7', 'V7'],
      B: ['IVmaj7', 'V7', 'iii7', 'vi7', 'ii7', 'II7', 'V7sus', 'V7'],
    },
    form: 'AABA',
    comp: { style: 'offbeat', inst: 'marimba', center: 64, level: 0.5, pan: -0.2 },
    bass: { style: 'twofeel', level: 0.8 },
    drums: { style: 'pop', level: 0.6 },
    melody: { inst: 'pizz', alt: 'celesta', lo: 67, hi: 88, grid: 0.5, density: 0.65, level: 0.75, phraseBars: 2, pan: 0.18 },
    reverb: 0.16,
  },
  {
    id: 'corner-cafe',
    name: 'Corner Café',
    mood: 'calm',
    bpm: 138,
    key: 5, // F major jazz waltz
    scale: MAJOR,
    meter: 3,
    swing: 0.12,
    sections: {
      A: ['Imaj7', 'Imaj7', 'vi7', 'vi7', 'ii7', 'ii7', 'V7', 'V7', 'iii7', 'VI7', 'ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7'],
      B: ['IVmaj7', 'IVmaj7', 'iv6', 'iv6', 'iii7', 'iii7', 'VI7', 'VI7', 'ii7', 'ii7', 'V7', 'V7', 'iii7', 'VI7', 'ii7', 'V7'],
    },
    form: 'AB',
    comp: { style: 'waltz', inst: 'epiano', center: 60, level: 0.55, rootless: true, pan: -0.15 },
    bass: { style: 'waltz', level: 0.75 },
    drums: { style: 'waltz', level: 0.55 },
    melody: { inst: 'marimba', alt: 'vibes', lo: 65, hi: 86, grid: 0.5, density: 0.5, level: 0.7, phraseBars: 4, pan: 0.15 },
    reverb: 0.25,
  },
  {
    id: 'late-night-diner',
    name: 'Late Night Diner',
    mood: 'tense',
    bpm: 92,
    key: 0, // C minor noir
    scale: MINOR,
    meter: 4,
    swing: 0.16,
    sections: {
      A: ['i6', 'i6', 'iiø', 'V7b9', 'i6', 'iv7', 'bVI7', 'V7b9'],
      B: ['iv7', 'bVII7', 'bIIImaj7', 'bVImaj7', 'iiø', 'V7b9', 'i6', 'V7b9'],
    },
    form: 'AABA',
    comp: { style: 'charleston', inst: 'epiano', center: 58, level: 0.5, rootless: true, pan: -0.15 },
    bass: { style: 'walking', level: 0.8 },
    drums: { style: 'noir', level: 0.55 },
    melody: { inst: 'vibes', alt: 'horn', lo: 65, hi: 84, grid: 0.5, density: 0.4, level: 0.7, phraseBars: 2, pan: 0.15 },
    pad: { level: 0.28, cutoff: 900, attack: 1.0, when: 'B' },
    reverb: 0.3,
  },
  {
    id: 'deadline',
    name: 'Deadline',
    mood: 'tense',
    bpm: 116,
    key: 2, // D minor pulse
    scale: MINOR,
    meter: 4,
    swing: 0,
    sections: {
      A: ['i', 'i', 'bVI', 'bVI', 'iv', 'iv', 'V7', 'V7'],
      B: ['bVI', 'bVII', 'i', 'i', 'bVI', 'bVII', 'V7sus', 'V7'],
    },
    form: 'AABA',
    comp: { style: 'pulse', inst: 'pizz', center: 57, level: 0.45, pan: -0.2 },
    bass: { style: 'pulse', level: 0.7, synth: true },
    drums: { style: 'pulse', level: 0.55 },
    melody: { inst: 'epiano', alt: 'horn', lo: 62, hi: 81, grid: 1, density: 0.45, level: 0.7, phraseBars: 2, pan: 0.12 },
    pad: { level: 0.32, cutoff: 1000, attack: 0.9, when: 'always' },
    reverb: 0.22,
  },
  {
    id: 'grey-skies',
    name: 'Grey Skies',
    mood: 'sad',
    bpm: 70,
    key: 9, // A minor ballad
    scale: MINOR,
    meter: 4,
    swing: 0.08,
    sections: {
      A: ['i9', 'bVImaj7', 'bIIImaj7', 'bVII', 'iv7', 'bVImaj7', 'iiø', 'V7b9'],
      B: ['bVImaj7', 'bVII', 'i7', 'IV7', 'bVImaj7', 'bIIImaj7', 'iv7', 'V7sus V7'],
    },
    form: 'AABA',
    comp: { style: 'arp', inst: 'epiano', center: 62, level: 0.5, pan: -0.1 },
    bass: { style: 'pedal', level: 0.6 },
    drums: { style: 'ballad', level: 0.5 },
    melody: { inst: 'flute', alt: 'vibes', lo: 64, hi: 81, grid: 0.5, density: 0.35, level: 0.65, phraseBars: 2, pan: 0.1 },
    pad: { level: 0.3, cutoff: 1400, attack: 1.2, when: 'always' },
    reverb: 0.38,
  },
  {
    id: 'big-day',
    name: 'Big Day',
    mood: 'epic',
    bpm: 100,
    key: 0, // C major, brass + strings
    scale: MAJOR,
    meter: 4,
    swing: 0,
    sections: {
      A: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
      B: ['vi', 'IV', 'I', 'V', 'bVI', 'bVII', 'Isus4', 'I'],
    },
    form: 'AABA',
    comp: { style: 'stabs', inst: 'brass', center: 60, level: 0.5, pan: -0.1 },
    bass: { style: 'epic', level: 0.75, synth: true },
    drums: { style: 'epic', level: 0.6 },
    melody: { inst: 'horn', alt: 'celesta', lo: 62, hi: 81, grid: 0.5, density: 0.5, level: 0.7, phraseBars: 2, pan: 0.1 },
    pad: { level: 0.35, cutoff: 2600, attack: 0.5, when: 'always' },
    reverb: 0.32,
  },
  {
    id: 'old-gods',
    name: 'Old Gods',
    mood: 'mystic',
    bpm: 84,
    key: 2, // D dorian with phrygian colours
    scale: DORIAN,
    meter: 4,
    swing: 0,
    sections: {
      A: ['i9', 'IV', 'i9', 'IV', 'bIIImaj7', 'IV', 'bVIImaj7', 'i9'],
      B: ['bIImaj7', 'i', 'bIImaj7', 'i', 'bVImaj7', 'bVII', 'IV', 'IV'],
    },
    form: 'AB',
    comp: { style: 'ostinato', inst: 'marimba', center: 60, level: 0.45, pan: -0.2 },
    bass: { style: 'drone', level: 0.7 },
    drums: { style: 'hand', level: 0.55 },
    melody: { inst: 'bell', alt: 'flute', lo: 69, hi: 88, grid: 0.5, density: 0.35, level: 0.65, phraseBars: 2, pan: 0.15 },
    pad: { level: 0.32, cutoff: 1600, attack: 1.6, when: 'always' },
    reverb: 0.45,
  },
];

const DEF_BY_ID = new Map(DEFS.map((d) => [d.id, d] as const));

export const TRACKS: Track[] = DEFS.map(({ id, name, mood, bpm }) => ({ id, name, mood, bpm }));

// ---------------------------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------------------------

interface Chord {
  sym: string;
  /** Root, semitones above the key tonic. */
  root: number;
  /** Chord intervals above the root (may include 9ths etc.). */
  tones: number[];
  /** Characteristic mode of this chord quality (used to resolve chromatic chord-scale notes). */
  mode: number[];
}
interface Slot {
  beat: number;
  beats: number;
  ch: Chord;
}
type Bar = Slot[];

const IONIAN = MAJOR;
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYG_DOM = [0, 1, 4, 5, 7, 8, 10];
const MELODIC_MINOR = [0, 2, 3, 5, 7, 9, 11];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10];
const DIMINISHED = [0, 2, 3, 5, 6, 8, 9, 11];

const MAJOR_Q: Record<string, [number[], number[]]> = {
  '': [[0, 4, 7], IONIAN],
  '6': [[0, 4, 7, 9], IONIAN],
  maj7: [[0, 4, 7, 11], IONIAN],
  maj9: [[0, 4, 7, 11, 14], IONIAN],
  add9: [[0, 4, 7, 14], IONIAN],
  '7': [[0, 4, 7, 10], MIXO],
  '9': [[0, 4, 7, 10, 14], MIXO],
  '7b9': [[0, 4, 7, 10, 13], PHRYG_DOM],
  '7sus': [[0, 5, 7, 10], MIXO],
  sus4: [[0, 5, 7], IONIAN],
  sus2: [[0, 2, 7], IONIAN],
};
const MINOR_Q: Record<string, [number[], number[]]> = {
  '': [[0, 3, 7], DORIAN],
  '6': [[0, 3, 7, 9], DORIAN],
  '7': [[0, 3, 7, 10], DORIAN],
  '9': [[0, 3, 7, 10, 14], DORIAN],
  maj7: [[0, 3, 7, 11], MELODIC_MINOR],
  'ø': [[0, 3, 6, 10], LOCRIAN],
  o7: [[0, 3, 6, 9], DIMINISHED],
};
const DEGREE: Record<string, number> = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };

function parseChord(sym: string): Chord {
  const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(sym);
  if (!m) throw new Error(`music: bad chord "${sym}"`);
  const minor = m[2] === m[2].toLowerCase();
  const q = (minor ? MINOR_Q : MAJOR_Q)[m[3]];
  if (!q) throw new Error(`music: bad chord quality "${sym}"`);
  const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  return { sym, root: (DEGREE[m[2].toUpperCase()] + acc + 12) % 12, tones: q[0], mode: q[1] };
}

function parseBar(src: string, meter: number): Bar {
  const chords = src.trim().split(/\s+/).map(parseChord);
  if (chords.length === 1) return [{ beat: 0, beats: meter, ch: chords[0] }];
  if (chords.length === 2) {
    const a = meter === 3 ? 2 : 2;
    return [
      { beat: 0, beats: a, ch: chords[0] },
      { beat: a, beats: meter - a, ch: chords[1] },
    ];
  }
  const each = meter / chords.length;
  return chords.map((ch, i) => ({ beat: i * each, beats: each, ch }));
}

function slotAt(bar: Bar, beat: number): Slot {
  let s = bar[0];
  for (const x of bar) if (x.beat <= beat + 1e-6) s = x;
  return s;
}

const pcOf = (n: number): number => ((n % 12) + 12) % 12;

/** Nearest pitch with pitch-class `pc` to `ref`, inside [lo, hi] (range must span ≥ 12). */
function near(pc: number, ref: number, lo: number, hi: number): number {
  let best = lo;
  let bd = Infinity;
  const want = pcOf(pc);
  for (let p = lo; p <= hi; p++) {
    if (pcOf(p) !== want) continue;
    const d = Math.abs(p - ref);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Key scale adjusted so it agrees with the chord (chromatic chord tones replace their neighbours). */
function chordScale(scale: number[], ch: Chord): number[] {
  const set = new Set(scale);
  const ct = ch.tones.map((i) => pcOf(ch.root + i));
  const mode = new Set(ch.mode.map((i) => pcOf(ch.root + i)));
  for (const c of ct) {
    if (set.has(c)) continue;
    for (const nb of [pcOf(c - 1), pcOf(c + 1)]) {
      if (set.has(nb) && !ct.includes(nb) && !mode.has(nb)) set.delete(nb);
    }
    set.add(c);
  }
  return [...set].sort((a, b) => a - b);
}

/** Pitch classes (absolute) to voice for a chord. */
function chordPcs(ch: Chord, key: number, rootless: boolean, maxN: number): number[] {
  let iv = [...new Set(ch.tones.map((i) => i % 12))];
  if (rootless && iv.length >= 4) iv = iv.filter((i) => i !== 0);
  while (iv.length > maxN) {
    const k = iv.indexOf(7);
    if (k >= 0) iv.splice(k, 1);
    else iv.pop();
  }
  return iv.map((i) => pcOf(key + ch.root + i));
}

/** Close voicing near `center`, choosing the inversion with the smoothest voice leading. */
function voice(pcs: number[], center: number, prev: number[] | null): number[] {
  let best: number[] = [];
  let bestCost = Infinity;
  const n = pcs.length;
  for (let r = 0; r < n; r++) {
    for (const lowStart of [center - 10, center - 4]) {
      const notes: number[] = [];
      let p = lowStart;
      while (pcOf(p) !== pcs[r]) p++;
      notes.push(p);
      for (let k = 1; k < n; k++) {
        let q = notes[k - 1] + 1;
        while (pcOf(q) !== pcs[(r + k) % n]) q++;
        notes.push(q);
      }
      const mean = notes.reduce((s, x) => s + x, 0) / n;
      let cost = Math.abs(mean - center) * 0.6;
      if (prev && prev.length) {
        let lead = 0;
        for (const x of notes) {
          let m = Infinity;
          for (const y of prev) m = Math.min(m, Math.abs(x - y));
          lead += m;
        }
        cost += lead / n;
      }
      if (n > 1 && notes[0] < 52 && notes[1] - notes[0] < 5) cost += 4;
      if (cost < bestCost) {
        bestCost = cost;
        best = notes;
      }
    }
  }
  return best;
}

/** Open, spread voicing for arpeggios: root, fifth, then upper chord tones an octave up. */
function wideVoicing(ch: Chord, key: number, center: number): number[] {
  let r = center - 12;
  while (pcOf(r) !== pcOf(key + ch.root)) r--;
  if (r < 40) r += 12;
  const fifth = ch.tones.includes(7) ? 7 : ch.tones.includes(6) ? 6 : 7;
  const upper = [...new Set(ch.tones.map((i) => i % 12))].filter((i) => i !== 0 && i !== fifth).sort((a, b) => a - b);
  return [r, r + fifth, ...upper.map((i) => r + 12 + i)].slice(0, 6);
}

// ---------------------------------------------------------------------------------------------
// Arrangement
// ---------------------------------------------------------------------------------------------

interface BarInfo {
  label: string;
  barIdx: number;
  bars: Bar[];
  pass: number;
  chorus: number;
  bar: Bar;
  next: Bar;
  isStart: boolean;
  isEnd: boolean;
  formEnd: boolean;
}

class Arranger {
  private readonly parsed: Record<string, Bar[]> = {};
  private readonly form: string[];
  private readonly intro: Bar[];
  private sec = -1; // -1 = intro
  private bar = 0;
  private chorus = 0;
  private curPass = 0;
  private readonly passes: Record<string, number> = {};

  constructor(def: TrackDef) {
    for (const [label, bars] of Object.entries(def.sections)) this.parsed[label] = bars.map((b) => parseBar(b, def.meter));
    this.form = def.form.split('');
    this.intro = this.parsed[this.form[this.form.length - 1]].slice(-2);
  }

  private barsOf(sec: number): Bar[] {
    return sec < 0 ? this.intro : this.parsed[this.form[sec]];
  }

  next(): BarInfo {
    const sec = this.sec;
    const bars = this.barsOf(sec);
    const label = sec < 0 ? 'intro' : this.form[sec];
    const isStart = this.bar === 0;
    if (isStart && sec >= 0) {
      this.curPass = this.passes[label] ?? 0;
      this.passes[label] = this.curPass + 1;
    }
    const info: BarInfo = {
      label,
      barIdx: this.bar,
      bars,
      pass: sec < 0 ? 0 : this.curPass,
      chorus: this.chorus,
      bar: bars[this.bar],
      next: bars[this.bar],
      isStart,
      isEnd: this.bar === bars.length - 1,
      formEnd: sec === this.form.length - 1 && this.bar === bars.length - 1,
    };
    this.bar++;
    if (this.bar >= bars.length) {
      this.bar = 0;
      this.sec++;
      if (this.sec >= this.form.length) {
        this.sec = 0;
        this.chorus++;
      }
    }
    info.next = this.barsOf(this.sec)[this.bar];
    return info;
  }
}

// ---------------------------------------------------------------------------------------------
// Melody writer
// ---------------------------------------------------------------------------------------------

interface MNote {
  slot: number;
  len: number;
  step: number;
}
interface Motif {
  notes: MNote[];
  anchorDeg: number;
  anchorOct: number;
}
interface MelNote {
  beat: number;
  dur: number;
  midi: number;
  vel: number;
  inst: Inst;
}
type MelMode = 'theme' | 'var0' | 'var' | 'noodle' | 'rest';

function genMotif(r: Rng, slots: number, spb: number, density: number): Motif {
  const notes: MNote[] = [];
  const endRest = Math.max(1, Math.round(spb));
  const limit = slots - endRest;
  let s = r() < 0.55 ? 0 : r() < 0.6 ? 1 : spb;
  while (s < limit) {
    const x = r();
    let len: number;
    if (spb <= 1) len = x < 0.5 ? 1 : x < 0.85 ? 2 : 3;
    else len = x < 0.2 + 0.3 * density ? 1 : x < 0.78 ? 2 : x < 0.92 ? 3 : 4;
    len = Math.max(1, Math.min(len, limit - s));
    notes.push({ slot: s, len, step: 0 });
    s += len;
    if (r() < 0.22 * (1.3 - density)) s += r() < 0.6 ? 1 : 2;
  }
  while (notes.length < 3) {
    const lastSlot = notes.length ? notes[notes.length - 1].slot + 1 : 0;
    notes.push({ slot: Math.min(lastSlot, slots - 2), len: 1, step: 0 });
  }
  const last = notes[notes.length - 1];
  last.len = Math.max(last.len, Math.min(slots - last.slot - 1, 2 * spb));
  let dir = r() < 0.6 ? 1 : -1;
  let prevMag = 0;
  for (let i = 1; i < notes.length; i++) {
    const x = r();
    let mag = x < 0.5 ? 1 : x < 0.75 ? 2 : x < 0.86 ? 0 : x < 0.96 ? 3 : 4;
    if (prevMag >= 3) {
      mag = 1;
      dir = -dir;
    } else if (i === Math.ceil(notes.length / 2)) dir = -dir;
    else if (r() < 0.2) dir = -dir;
    notes[i].step = mag * dir;
    prevMag = mag;
  }
  return {
    notes,
    anchorDeg: [0, 1, 2, 1, 2, 3][Math.floor(r() * 6)],
    anchorOct: r() < 0.5 ? 0 : r() < 0.5 ? -1 : 1,
  };
}

/** Copy of a motif with `count` small edits (step tweak, dropped note, passing note, new anchor, inverted interval). */
function vary(m: Motif, r: Rng, count: number): Motif {
  const notes = m.notes.map((n) => ({ ...n }));
  let anchorDeg = m.anchorDeg;
  for (let k = 0; k < count; k++) {
    const n = notes.length;
    const i = 1 + Math.floor(r() * Math.max(1, n - 1));
    const op = Math.floor(r() * 5);
    if (i >= n) continue;
    if (op === 0) notes[i].step += r() < 0.5 ? 1 : -1;
    else if (op === 1 && n > 4 && i < n - 1) {
      notes[i - 1].len += notes[i].len;
      notes[i + 1].step += notes[i].step;
      notes.splice(i, 1);
    } else if (op === 2 && notes[i].len >= 2) {
      const half = Math.floor(notes[i].len / 2);
      const step = r() < 0.5 ? 1 : -1;
      notes.splice(i + 1, 0, { slot: notes[i].slot + half, len: notes[i].len - half, step });
      notes[i].len = half;
      if (notes[i + 2]) notes[i + 2].step -= step;
    } else if (op === 3) anchorDeg = (anchorDeg + 1 + Math.floor(r() * 2)) % 4;
    else notes[i].step = -notes[i].step;
  }
  return { notes, anchorDeg, anchorOct: m.anchorOct };
}

function stepIn(list: number[], p: number, k: number): number {
  let i = 0;
  let bd = Infinity;
  for (let j = 0; j < list.length; j++) {
    const d = Math.abs(list[j] - p);
    if (d < bd) {
      bd = d;
      i = j;
    }
  }
  return list[clamp(i + k, 0, list.length - 1)];
}

class MelodyWriter {
  private readonly motifs = new Map<string, Motif[]>();
  private readonly scales = new Map<string, number[]>();
  private last: number;
  private readonly lo: number;
  private readonly hi: number;
  private readonly center: number;

  constructor(private readonly def: TrackDef) {
    this.lo = def.melody.lo;
    this.hi = def.melody.hi;
    this.center = Math.round((this.lo + this.hi) / 2);
    this.last = this.center;
  }

  private get slotsPerBeat(): number {
    return 1 / this.def.melody.grid;
  }
  private get phraseSlots(): number {
    return Math.round((this.def.melody.phraseBars * this.def.meter) / this.def.melody.grid);
  }

  private motifsFor(label: string): Motif[] {
    let m = this.motifs.get(label);
    if (!m) {
      const r = mulberry32(hashString(`${this.def.id}:${label}`));
      const { density } = this.def.melody;
      const a = genMotif(r, this.phraseSlots, this.slotsPerBeat, density);
      const b = genMotif(r, this.phraseSlots, this.slotsPerBeat, density);
      m = [a, vary(a, r, 1), b, vary(a, r, 2)];
      this.motifs.set(label, m);
    }
    return m;
  }

  private scaleNotes(ch: Chord): number[] {
    let s = this.scales.get(ch.sym);
    if (!s) {
      const pcs = new Set(chordScale(this.def.scale, ch));
      s = [];
      for (let p = this.lo - 14; p <= this.hi + 14; p++) if (pcs.has(pcOf(p - this.def.key))) s.push(p);
      this.scales.set(ch.sym, s);
    }
    return s;
  }

  private chordTones(ch: Chord): number[] {
    return ch.tones.filter((i) => i < 12).map((i) => pcOf(this.def.key + ch.root + i));
  }

  private nearestChordTone(p: number, ch: Chord, pcs = this.chordTones(ch)): number {
    let best = p;
    let bd = Infinity;
    for (let q = p - 7; q <= p + 7; q++) {
      if (!pcs.includes(pcOf(q))) continue;
      const d = Math.abs(q - p) + Math.abs(q - this.center) * 0.01;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  private consonant(p: number, ch: Chord): boolean {
    const rel = pcOf(p - this.def.key - ch.root);
    const set = new Set(ch.tones.map((i) => i % 12));
    if (set.has(rel)) return true;
    if (rel === 2 && !set.has(1) && !set.has(6)) return true;
    return rel === 9 && set.has(4) && !set.has(8);
  }

  private fold(p: number): number {
    while (p > this.hi) p -= 12;
    while (p < this.lo) p += 12;
    return p;
  }

  private realize(m: Motif, start: number, chordAt: (b: number) => Chord, inst: Inst, cadence: boolean, r: Rng): MelNote[] {
    const g = this.def.melody.grid;
    const meter = this.def.meter;
    const out: MelNote[] = [];
    let p = this.last;
    m.notes.forEach((n, i) => {
      const beat = start + n.slot * g;
      const ch = chordAt(beat);
      const scale = this.scaleNotes(ch);
      if (i === 0) {
        const tones = ch.tones.filter((x) => x < 12);
        const pc = pcOf(this.def.key + ch.root + tones[Math.min(m.anchorDeg, tones.length - 1)]);
        p = near(pc, this.center + m.anchorOct * 4, this.lo, this.hi);
      } else {
        let q = stepIn(scale, p, n.step);
        if (q > this.hi || q < this.lo) q = stepIn(scale, p, -n.step);
        p = q;
      }
      const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
      const down = onBeat && Math.round(beat) % meter === 0;
      const isLast = i === m.notes.length - 1;
      let dur = n.len * g;
      if (isLast && cadence) {
        const ct = this.chordTones(ch);
        p = this.nearestChordTone(p, ch, [ct[0], ct[1] ?? ct[0]]);
        dur = Math.min(3, Math.max(dur, (this.phraseSlots - n.slot - 1) * g));
      } else if ((down || (onBeat && n.len * g >= 1)) && !this.consonant(p, ch)) {
        p = this.nearestChordTone(p, ch);
      }
      p = this.fold(p);
      const vel = 0.62 + (down ? 0.1 : onBeat ? 0.04 : -0.05) + (r() - 0.5) * 0.08 - (isLast && cadence ? 0.06 : 0);
      out.push({ beat, dur, midi: p, vel, inst });
    });
    this.last = p;
    return out;
  }

  /** Free improvisation over the changes: short stepwise runs with chord tones on the beats. */
  private noodle(start: number, chordAt: (b: number) => Chord, inst: Inst, r: Rng): MelNote[] {
    const g = this.def.melody.grid;
    const slots = this.phraseSlots;
    const out: MelNote[] = [];
    let s = r() < 0.5 ? 0 : 1;
    let p = this.last;
    let dir = p > this.center ? -1 : 1;
    const end = slots - 2;
    while (s < end) {
      const run = 2 + Math.floor(r() * 5);
      for (let k = 0; k < run && s < end; k++, s++) {
        const beat = start + s * g;
        const ch = chordAt(beat);
        if (r() < 0.2) dir = -dir;
        p = stepIn(this.scaleNotes(ch), p, dir * (r() < 0.85 ? 1 : 2));
        if (p > this.hi - 2) dir = -1;
        if (p < this.lo + 2) dir = 1;
        const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
        if (onBeat && !this.consonant(p, ch)) p = this.nearestChordTone(p, ch);
        p = this.fold(p);
        out.push({ beat, dur: g, midi: p, vel: 0.52 + (onBeat ? 0.08 : 0) + (r() - 0.5) * 0.08, inst });
      }
      s += 1 + Math.floor(r() * 3);
    }
    if (s < slots - 1) {
      const beat = start + s * g;
      const ch = chordAt(beat);
      p = this.fold(this.nearestChordTone(p, ch));
      out.push({ beat, dur: Math.max(g, (slots - s - 1) * g), midi: p, vel: 0.55, inst });
    }
    this.last = p;
    return out;
  }

  /** Compose a whole section; returns notes per bar with bar-relative beats. */
  compose(label: string, bars: Bar[], mode: MelMode, r: Rng): MelNote[][] {
    const out: MelNote[][] = bars.map(() => []);
    if (mode === 'rest') return out;
    const { meter } = this.def;
    const pb = this.def.melody.phraseBars;
    const phrases = Math.max(1, Math.floor(bars.length / pb));
    const [a, a1, b, cad] = this.motifsFor(label);
    const inst = mode === 'noodle' && this.def.melody.alt ? this.def.melody.alt : this.def.melody.inst;
    const chordAt = (beat: number): Chord => {
      const bi = clamp(Math.floor(beat / meter + 1e-6), 0, bars.length - 1);
      return slotAt(bars[bi], beat - bi * meter).ch;
    };
    for (let i = 0; i < phrases; i++) {
      const start = i * pb * meter;
      const isLast = i === phrases - 1 && phrases > 1;
      let notes: MelNote[];
      if (mode === 'noodle' && !(isLast && r() < 0.5)) {
        notes = this.noodle(start, chordAt, inst, r);
      } else {
        let m = isLast ? cad : i % 4 === 2 ? b : i % 2 === 1 ? a1 : a;
        if (mode === 'var0' && i % 2 === 1) m = vary(m, mulberry32(hashString(`${this.def.id}:${label}:v${i}`)), 1);
        if (mode === 'var') {
          if (i > 0 && !isLast && r() < 0.2) continue; // leave a phrase of space
          m = vary(m, r, 1 + Math.floor(r() * 2));
        }
        notes = this.realize(m, start, chordAt, inst, isLast, r);
      }
      for (const n of notes) {
        const bi = Math.floor(n.beat / meter + 1e-6);
        if (bi >= 0 && bi < bars.length) out[bi].push({ ...n, beat: n.beat - bi * meter });
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// Rhythm patterns
// ---------------------------------------------------------------------------------------------

interface Hit {
  beat: number;
  len: number;
  vel: number;
  push?: boolean;
}
const H = (beat: number, len: number, vel: number, push = false): Hit => ({ beat, len, vel, push });
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];

function compPattern(style: CompStyle, meter: number, bar: Bar, r: Rng, busy: boolean, barIdx: number): Hit[] {
  const two = bar.length > 1;
  switch (style) {
    case 'charleston': {
      if (two)
        return pick(r, [
          [H(0, 1.4, 0.6), H(2, 1.4, 0.56)],
          [H(0, 0.45, 0.6), H(1.5, 0.4, 0.5), H(2, 1.4, 0.56)],
          [H(0, 1.2, 0.58), H(2.5, 0.8, 0.54)],
        ]);
      const opts = [
        [H(0, 1.2, 0.62), H(1.5, 0.45, 0.52)],
        [H(0, 0.5, 0.6), H(2.5, 0.9, 0.55)],
        [H(1, 0.45, 0.55), H(2.5, 0.45, 0.5), H(3.5, 0.6, 0.56, true)],
        [H(0, 3.4, 0.55)],
        [H(1.5, 0.45, 0.55), H(3, 0.9, 0.55)],
      ];
      if (busy) opts.push([H(0, 0.45, 0.6), H(1.5, 0.45, 0.5), H(2.5, 0.45, 0.52), H(3.5, 0.5, 0.56, true)]);
      return pick(r, opts);
    }
    case 'bossa':
      return barIdx % 2 === 0
        ? [H(0, 0.9, 0.56), H(1.5, 0.45, 0.48), H(3, 0.9, 0.52)]
        : [H(1, 0.45, 0.5), H(2.5, 0.9, 0.52), ...(busy ? [H(3.5, 0.4, 0.45)] : [])];
    case 'offbeat':
      return pick(r, [
        [H(0.5, 0.25, 0.5), H(1.5, 0.25, 0.56), H(2.5, 0.25, 0.5), H(3.5, 0.25, 0.56)],
        [H(1, 0.3, 0.55), H(3, 0.3, 0.55), H(3.5, 0.25, 0.45)],
        [H(0.5, 0.25, 0.5), H(1.5, 0.25, 0.55), H(2, 0.25, 0.45), H(3, 0.3, 0.55)],
      ]);
    case 'waltz':
      if (meter !== 3) return [H(0, meter * 0.9, 0.55)];
      return pick(r, [
        [H(1, 0.4, 0.46), H(2, 0.4, 0.42)],
        [H(0, 0.9, 0.55), H(1.5, 0.6, 0.5)],
        [H(0, 2.5, 0.5)],
        ...(busy ? [[H(0, 0.4, 0.52), H(1, 0.4, 0.45), H(1.5, 0.4, 0.45), H(2.5, 0.4, 0.5, true)]] : []),
      ]);
    case 'pulse': {
      const hits: Hit[] = [];
      for (let i = 0; i < meter * 2; i++) hits.push(H(i * 0.5, 0.28, i % 2 === 0 ? 0.5 : 0.36));
      return hits;
    }
    case 'stabs':
      if (two) return [H(0, 1.7, 0.66), H(2, 1.7, 0.62)];
      return pick(r, [
        [H(0, 1.6, 0.7), H(2, 1.6, 0.62)],
        [H(0, 0.5, 0.72), H(0.75, 0.5, 0.55), H(1.5, 2, 0.62)],
        [H(0, 3.6, 0.64)],
        [H(0, 0.4, 0.7), H(1.5, 0.4, 0.6), H(3, 0.9, 0.62)],
      ]);
    default:
      return [H(0, meter * 0.9, 0.5)];
  }
}

type DrumKind =
  | 'kick'
  | 'tap'
  | 'swish'
  | 'chick'
  | 'shaker'
  | 'tick'
  | 'ride'
  | 'rim'
  | 'snap'
  | 'clap'
  | 'tom'
  | 'tomLo'
  | 'timp'
  | 'hand'
  | 'handHi'
  | 'swell'
  | 'crash';
interface DHit {
  beat: number;
  kind: DrumKind;
  vel: number;
  straight?: boolean;
}

function drumPattern(style: DrumStyle, info: BarInfo, light: boolean, r: Rng): DHit[] {
  const out: DHit[] = [];
  const D = (beat: number, kind: DrumKind, vel: number, straight = false): void => {
    out.push({ beat, kind, vel, straight });
  };
  const fill = info.isEnd && !light && info.label !== 'intro';
  switch (style) {
    case 'brushes':
    case 'noir': {
      const rv = style === 'noir' ? 0.75 : 1;
      D(0, 'ride', 0.45 * rv);
      D(1, 'ride', 0.55 * rv);
      if (r() < 0.85) D(1.5, 'ride', 0.28 * rv);
      D(2, 'ride', 0.45 * rv);
      D(3, 'ride', 0.55 * rv);
      if (r() < 0.85) D(3.5, 'ride', 0.28 * rv);
      D(1, 'chick', 0.3);
      D(3, 'chick', 0.3);
      if (!light) {
        D(0, 'swish', 0.5);
        D(2, 'swish', 0.5);
        if (!fill) {
          D(1, 'tap', 0.42);
          D(3, 'tap', 0.46);
        }
        D(0, 'kick', 0.22);
        if (r() < 0.5) D(2, 'kick', 0.16);
        if (r() < 0.2) D(2.5, 'tap', 0.22);
        if (style === 'noir') {
          D(1, 'snap', 0.5);
          D(3, 'snap', 0.55);
        }
      }
      if (fill) {
        D(2, 'tap', 0.34, true);
        D(2 + 2 / 3, 'tap', 0.3, true);
        D(3, 'tap', 0.44, true);
        D(3 + 1 / 3, 'tap', 0.38, true);
        D(3 + 2 / 3, 'tap', 0.5, true);
        D(3 + 2 / 3, 'kick', 0.3, true);
      }
      break;
    }
    case 'bossa': {
      for (let i = 0; i < 8; i++) D(i * 0.5, 'shaker', i % 2 ? 0.32 : 0.2);
      if (!light) {
        for (const b of info.barIdx % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]) D(b, 'rim', 0.38);
        D(0, 'kick', 0.45);
        D(1.5, 'kick', 0.22);
        D(2, 'kick', 0.42);
        D(3.5, 'kick', 0.22);
      } else {
        D(0, 'kick', 0.3);
        D(2, 'kick', 0.28);
      }
      if (fill) {
        D(3.25, 'rim', 0.28);
        D(3.75, 'rim', 0.34);
      }
      break;
    }
    case 'pop': {
      for (let i = 0; i < 8; i++) D(i * 0.5, 'shaker', i % 2 ? 0.32 : 0.18);
      if (!light) {
        D(0, 'kick', 0.6);
        D(2, 'kick', 0.52);
        if (r() < 0.4) D(2.5, 'kick', 0.32);
        if (!fill) {
          D(1, 'clap', 0.42);
          D(3, 'clap', 0.46);
        } else {
          D(1, 'clap', 0.42);
          D(3, 'clap', 0.3);
          D(3.25, 'clap', 0.34);
          D(3.5, 'clap', 0.4);
          D(3.75, 'clap', 0.46);
        }
      } else {
        D(0, 'kick', 0.4);
        D(1, 'rim', 0.3);
        D(3, 'rim', 0.3);
      }
      break;
    }
    case 'waltz': {
      D(0, 'ride', 0.45);
      D(1, 'ride', 0.5);
      if (r() < 0.8) D(1.5, 'ride', 0.26);
      D(2, 'ride', 0.5);
      D(1, 'chick', 0.22);
      if (!light) {
        D(0, 'swish', 0.4);
        D(0, 'kick', 0.2);
        if (!fill) {
          D(1, 'tap', 0.3);
          D(2, 'tap', 0.32);
        } else {
          D(1 + 2 / 3, 'tap', 0.3, true);
          D(2, 'tap', 0.38, true);
          D(2 + 1 / 3, 'tap', 0.34, true);
          D(2 + 2 / 3, 'tap', 0.44, true);
        }
      }
      break;
    }
    case 'pulse': {
      for (let i = 0; i < 16; i++) D(i * 0.25, 'tick', i % 4 === 0 ? 0.34 : i % 2 ? 0.13 : 0.21);
      D(0, 'kick', 0.55);
      if (!light) {
        D(2, 'kick', 0.5);
        if (r() < 0.5) D(2.75, 'kick', 0.3);
        if (!fill) D(3, 'rim', 0.32);
        else {
          D(3, 'tom', 0.35);
          D(3.5, 'tom', 0.45);
        }
      }
      break;
    }
    case 'ballad': {
      D(0, 'swish', 0.45);
      D(2, 'swish', 0.45);
      D(1, 'tap', 0.3);
      D(3, 'tap', 0.32);
      D(0, 'kick', 0.16);
      if (!light) for (let b = 0; b < 4; b++) D(b, 'ride', b % 2 ? 0.34 : 0.28);
      if (fill) D(3.5, 'tap', 0.34);
      break;
    }
    case 'epic': {
      if (info.barIdx === 0 && info.label !== 'intro' && !light) D(0, 'crash', 0.55);
      if (light) {
        D(0, 'timp', 0.55);
        if (info.isEnd) D(2, 'timp', 0.45);
        break;
      }
      if (!fill) {
        if (r() < 0.5) {
          D(0, 'kick', 0.75);
          D(1.5, 'tom', 0.4);
          D(2, 'kick', 0.6);
          D(3, 'tom', 0.45);
          D(3.5, 'tomLo', 0.42);
        } else {
          D(0, 'kick', 0.72);
          D(2, 'kick', 0.6);
          D(1, 'clap', 0.32);
          D(3, 'clap', 0.36);
          for (let i = 0; i < 8; i++) D(i * 0.5, 'shaker', i % 2 ? 0.16 : 0.1);
        }
      } else {
        D(0, 'kick', 0.72);
        D(2, 'tom', 0.35);
        D(2.5, 'tom', 0.42);
        D(3, 'tomLo', 0.5);
        D(3.5, 'tomLo', 0.58);
        if (r() < 0.6) D(0, 'swell', 0.5);
      }
      break;
    }
    case 'hand': {
      D(0, 'hand', 0.55);
      D(1.5, 'hand', 0.35);
      if (r() < 0.5) D(2.5, 'hand', 0.3);
      D(1, 'handHi', 0.3);
      D(3, 'handHi', 0.32);
      if (r() < 0.4) D(3.5, 'handHi', 0.2);
      if (!light) for (let i = 0; i < 8; i++) D(i * 0.5, 'shaker', i % 2 ? 0.14 : 0.09);
      if (fill) {
        D(3.25, 'hand', 0.32);
        D(3.5, 'handHi', 0.36);
        D(3.75, 'handHi', 0.42);
      }
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Track player
// ---------------------------------------------------------------------------------------------

interface Channel {
  input: GainNode;
  nodes: AudioNode[];
  lfo: OscillatorNode | null;
}
interface Ev {
  t: number;
  fn: (t: number) => void;
}
type Emit = (part: Part, beat: number, fn: (t: number) => void, jitter?: number, straight?: boolean) => void;
interface Flags {
  melody: MelMode;
  drums: 'full' | 'light' | 'off';
  pad: boolean;
  compBusy: boolean;
}

const LEGATO: Record<Inst, number> = {
  epiano: 0.9,
  marimba: 0.8,
  vibes: 0.95,
  nylon: 0.85,
  pizz: 0.6,
  celesta: 0.8,
  bell: 0.9,
  flute: 0.92,
  brass: 0.9,
  horn: 0.92,
};
const ROLL: Partial<Record<Inst, number>> = { nylon: 0.016, epiano: 0.005, brass: 0.006, pizz: 0.004 };

function playInst(ctx: Ctx, dest: AudioNode, inst: Inst, t: number, midi: number, dur: number, vel: number): void {
  const f = mtof(midi);
  switch (inst) {
    case 'epiano':
      ePiano(ctx, dest, t, f, dur, vel);
      break;
    case 'marimba':
      marimba(ctx, dest, t, f, dur, vel);
      break;
    case 'vibes':
      marimba(ctx, dest, t, f, dur, vel, true);
      break;
    case 'nylon':
      pluck(ctx, dest, t, f, dur, vel, 0.5);
      break;
    case 'pizz':
      pluck(ctx, dest, t, f, Math.min(dur, 0.3), vel, 0.75);
      break;
    case 'celesta':
      fmBell(ctx, dest, t, f, vel, 1.1, 4, 1.1, 0.13);
      break;
    case 'bell':
      fmBell(ctx, dest, t, f, vel, 2.4, 3.5, 1.4, 0.13);
      break;
    case 'flute':
      flute(ctx, dest, t, f, dur, vel);
      break;
    case 'brass':
      brass(ctx, dest, t, f, dur, vel, false);
      break;
    case 'horn':
      brass(ctx, dest, t, f, dur, vel, true);
      break;
  }
}

class TrackPlayer {
  readonly def: TrackDef;
  /** Time after which this player is silent and can be disposed. */
  endAt = Infinity;
  /** Set after ~3.5 minutes at the end of a chorus, so automatic mode can move on. */
  wantsRotate = false;
  private readonly ctx: Ctx;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly ch: Record<Part, Channel>;
  private readonly arr: Arranger;
  private readonly mel: MelodyWriter;
  private readonly rng: Rng;
  private readonly solo: Part | null;
  private readonly spb: number;
  private readonly barDur: number;
  private readonly startTime: number;
  private nextBarTime: number;
  private pending: Ev[] = [];
  private flags: Flags = { melody: 'rest', drums: 'light', pad: false, compBusy: false };
  private melBars: MelNote[][] = [];
  private prevVoicing: number[] | null = null;
  private prevPad: number[] | null = null;
  private lastBass = 40;
  private lastChordSym = '';
  private pushed = false;
  private readonly wideCache = new Map<string, number[]>();

  constructor(graph: Graph, def: TrackDef, start: number, opts: { solo?: Part; seed?: number } = {}) {
    this.def = def;
    this.ctx = graph.ctx;
    this.rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 4294967296));
    this.solo = opts.solo ?? null;
    this.spb = 60 / def.bpm;
    this.barDur = this.spb * def.meter;
    this.startTime = start;
    this.nextBarTime = start;
    this.dry = graph.ctx.createGain();
    this.wet = graph.ctx.createGain();
    this.dry.gain.value = 0;
    this.wet.gain.value = 0;
    this.dry.connect(graph.musicDry);
    this.wet.connect(graph.musicWet);
    const trem = (inst: Inst): [number, number] | null =>
      inst === 'epiano' ? [4.3, 0.07] : inst === 'vibes' ? [5.5, 0.12] : null;
    this.ch = {
      comp: this.channel(def.comp.level, def.comp.pan ?? -0.15, def.reverb * 0.9, trem(def.comp.inst)),
      bass: this.channel(def.bass.level, 0, def.reverb * 0.25, null),
      drums: this.channel(def.drums.level, 0.05, def.reverb * 0.45, null),
      melody: this.channel(def.melody.level, def.melody.pan ?? 0.12, def.reverb * 1.1, trem(def.melody.inst)),
      pad: this.channel(def.pad?.level ?? 0, 0, def.reverb * 1.3, null),
    };
    this.arr = new Arranger(def);
    this.mel = new MelodyWriter(def);
  }

  private channel(level: number, pan: number, send: number, trem: [number, number] | null): Channel {
    const c = this.ctx;
    const input = c.createGain();
    input.gain.value = level;
    const nodes: AudioNode[] = [input];
    let node: AudioNode = input;
    let lfo: OscillatorNode | null = null;
    if (trem) {
      const tg = c.createGain();
      tg.gain.value = 1 - trem[1];
      lfo = c.createOscillator();
      lfo.frequency.value = trem[0];
      const depth = c.createGain();
      depth.gain.value = trem[1];
      lfo.connect(depth);
      depth.connect(tg.gain);
      lfo.start();
      node.connect(tg);
      node = tg;
      nodes.push(tg, depth);
    }
    if (pan && typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      node = p;
      nodes.push(p);
    }
    node.connect(this.dry);
    if (send > 0) {
      const s = c.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(this.wet);
      nodes.push(s);
    }
    return { input, nodes, lfo };
  }

  fadeIn(t: number, dur: number): void {
    for (const g of [this.dry.gain, this.wet.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(1, t + Math.max(0.01, dur));
    }
  }

  fadeOut(t: number, dur: number): void {
    const end = t + Math.max(0.02, dur);
    for (const g of [this.dry.gain, this.wet.gain]) {
      holdParam(g, t);
      g.linearRampToValueAtTime(0, end);
    }
    this.endAt = Math.min(this.endAt, end);
  }

  /** Re-anchor the timeline after a pause (mute / hidden tab) so we never schedule in the past. */
  resync(now: number): void {
    if (this.nextBarTime < now + 0.02 || (this.pending.length && this.pending[0].t < now)) {
      this.pending = [];
      this.nextBarTime = now + 0.08;
    }
  }

  /** Schedule every note that starts before `horizon`. `now` (real-time only) drops late events. */
  scheduleUntil(horizon: number, now = -Infinity): void {
    if (this.nextBarTime < now - 0.05) this.resync(now);
    for (;;) {
      while (this.pending.length && this.pending[0].t < horizon) {
        const e = this.pending.shift()!;
        if (e.t >= this.endAt || e.t < now - 0.05) continue;
        try {
          e.fn(e.t);
        } catch {
          /* never let one note kill the scheduler */
        }
      }
      if (this.nextBarTime < horizon && this.nextBarTime < this.endAt) this.composeBar();
      else break;
    }
  }

  dispose(): void {
    for (const c of Object.values(this.ch)) {
      if (c.lfo) {
        try {
          c.lfo.stop();
        } catch {
          /* ignore */
        }
      }
      for (const n of c.nodes) n.disconnect();
      c.lfo?.disconnect();
    }
    this.dry.disconnect();
    this.wet.disconnect();
    this.pending = [];
  }

  private beatTime(barStart: number, beat: number, straight: boolean): number {
    let b = beat;
    const s = this.def.swing;
    if (s > 0 && !straight) {
      const w = Math.floor(b + 1e-9);
      const f = b - w;
      b = w + (f < 0.5 ? (f * (0.5 + s)) / 0.5 : 0.5 + s + ((f - 0.5) * (0.5 - s)) / 0.5);
    }
    return barStart + b * this.spb;
  }

  private composeBar(): void {
    const info = this.arr.next();
    if (info.isStart) this.startSection(info);
    const t0 = this.nextBarTime;
    const emit: Emit = (part, beat, fn, jitter = 0, straight = false) => {
      const j = jitter > 0 ? this.rng() * jitter : 0;
      if (this.solo && part !== this.solo) return;
      this.pending.push({ t: this.beatTime(t0, beat, straight) + j, fn });
    };
    this.compBar(info, emit);
    this.bassBar(info, emit);
    this.drumBar(info, emit);
    this.melodyBar(info, emit);
    this.padBar(info, emit);
    this.pending.sort((a, b) => a.t - b.t);
    this.nextBarTime = t0 + this.barDur;
    this.lastChordSym = info.bar[info.bar.length - 1].ch.sym;
    if (info.formEnd && t0 - this.startTime > 200) this.wantsRotate = true;
  }

  private startSection(info: BarInfo): void {
    const r = this.rng;
    const def = this.def;
    const first = info.chorus === 0;
    let melody: MelMode;
    if (info.label === 'intro') melody = 'rest';
    else if (first) melody = info.pass === 0 ? 'theme' : 'var0';
    else {
      const x = r();
      melody = x < 0.12 ? 'rest' : x < 0.42 ? 'theme' : x < 0.72 ? 'var' : 'noodle';
    }
    let drums: Flags['drums'];
    if (info.label === 'intro') drums = def.drums.style === 'ballad' ? 'off' : 'light';
    else if (def.drums.style === 'ballad' && first && info.label !== 'B') drums = 'off';
    else drums = r() < 0.15 ? 'light' : 'full';
    const p = def.pad;
    const padOn =
      !!p &&
      (p.when === 'always' ||
        (p.when === 'B' && info.label === 'B') ||
        (p.when === 'sometimes' && r() < 0.5) ||
        (!first && r() < 0.25));
    this.flags = { melody, drums, pad: padOn, compBusy: melody === 'rest' };
    this.melBars = this.mel.compose(info.label, info.bars, melody, r);
  }

  // --- parts -------------------------------------------------------------------------------

  private compBar(info: BarInfo, emit: Emit): void {
    const d = this.def.comp;
    const c = this.ctx;
    const dest = this.ch.comp.input;
    if (d.style === 'arp' || d.style === 'ostinato') {
      const pattern = d.style === 'arp' ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 2, 1, 3, 0, 2, 4, 2];
      for (let i = 0; i < this.def.meter * 2; i++) {
        const beat = i * 0.5;
        const ch = slotAt(info.bar, beat).ch;
        let tones = this.wideCache.get(ch.sym);
        if (!tones) {
          tones = wideVoicing(ch, this.def.key, d.center);
          this.wideCache.set(ch.sym, tones);
        }
        if (d.style === 'arp' && i % 2 === 1 && !this.flags.compBusy && this.rng() < 0.15) continue;
        const midi = tones[pattern[i % pattern.length] % tones.length];
        const vel = (i % 2 === 0 ? 0.5 : 0.4) + this.rng() * 0.06 + (beat === 0 ? 0.06 : 0);
        const dur = (d.style === 'arp' ? 1.6 : 0.45) * this.spb;
        emit('comp', beat, (t) => playInst(c, dest, d.inst, t, midi, dur, vel), 0.006);
      }
      return;
    }
    const hits = compPattern(d.style, this.def.meter, info.bar, this.rng, this.flags.compBusy, info.barIdx);
    const skipDown = this.pushed;
    this.pushed = false;
    const maxN = d.style === 'pulse' ? 3 : 4;
    const roll = ROLL[d.inst] ?? 0;
    for (const h of hits) {
      if (skipDown && h.beat === 0) continue;
      if (h.push) this.pushed = true;
      const ch = h.push ? info.next[0].ch : slotAt(info.bar, h.beat).ch;
      const v = voice(chordPcs(ch, this.def.key, !!d.rootless, maxN), d.center, this.prevVoicing);
      this.prevVoicing = v;
      const dur = h.len * this.spb;
      const vels = v.map(() => h.vel * (0.9 + this.rng() * 0.15));
      emit(
        'comp',
        h.beat,
        (t) => {
          v.forEach((m, i) => playInst(c, dest, d.inst, t + i * roll, m, dur, vels[i]));
        },
        0.008,
      );
    }
  }

  private bassBar(info: BarInfo, emit: Emit): void {
    const d = this.def.bass;
    const key = this.def.key;
    const meter = this.def.meter;
    const r = this.rng;
    const LO = 31;
    const HI = 52;
    const c = this.ctx;
    const dest = this.ch.bass.input;
    const synth = !!d.synth;
    if (d.style === 'drone') {
      if (info.barIdx === 0) {
        const f = mtof(near(key, 38, 33, 45));
        const dur = info.bars.length * this.barDur;
        emit('bass', 0, (t) => drone(c, dest, t, f, dur, 0.8));
      }
      return;
    }
    const root = (ch: Chord, ref = 40): number => near(key + ch.root, ref, LO, HI);
    const fifthOf = (ch: Chord, rt: number): number => {
      const iv = ch.tones.includes(7) ? 7 : ch.tones.includes(6) ? 6 : 7;
      return rt - 12 + iv >= LO ? rt - 12 + iv : rt + iv;
    };
    const notes: { beat: number; len: number; midi: number; vel: number }[] = [];
    const N = (beat: number, len: number, midi: number, vel: number): void => {
      let m = midi;
      while (m > HI) m -= 12;
      while (m < LO) m += 12;
      notes.push({ beat, len, midi: m, vel });
    };
    const approach = (target: number, from: number): number => {
      const x = r();
      if (x < 0.45) return target + (from > target ? 1 : -1);
      if (x < 0.7) return Math.abs(target + 7 - from) < Math.abs(target - 5 - from) ? target + 7 : target - 5;
      return Math.abs(target + 2 - from) < Math.abs(target - 2 - from) ? target + 2 : target - 2;
    };
    switch (d.style) {
      case 'walking': {
        let prev = this.lastBass;
        for (let b = 0; b < meter; b++) {
          const slot = slotAt(info.bar, b);
          const ch = slot.ch;
          const nextCh = b + 1 < meter ? slotAt(info.bar, b + 1).ch : info.next[0].ch;
          const ref = (prev * 2 + 40) / 3;
          let m: number;
          if (Math.abs(b - slot.beat) < 1e-6) {
            m = root(ch, ref);
            if (b === 0 && this.lastChordSym === ch.sym && r() < 0.35) {
              const tones = ch.tones.filter((i) => i > 0 && i < 12);
              m = near(key + ch.root + pick(r, tones), ref, LO, HI);
            }
          } else if (nextCh !== ch || b === meter - 1) {
            m = approach(root(nextCh, ref), prev);
          } else {
            const tones = ch.tones.filter((i) => i < 12).map((i) => near(key + ch.root + i, prev, LO, HI));
            const cands = tones.filter((x) => x !== prev && Math.abs(x - prev) <= 7);
            m = cands.length ? pick(r, cands) : prev + (r() < 0.5 ? 2 : -2);
          }
          N(b, 0.92, m, (b % 2 === 0 ? 0.74 : 0.66) + r() * 0.06);
          prev = notes[notes.length - 1].midi;
        }
        break;
      }
      case 'bossa': {
        for (const s of info.bar) {
          const rt = root(s.ch);
          const f5 = fifthOf(s.ch, rt);
          N(s.beat, 1.4, rt, 0.72);
          N(s.beat + 1.5, 0.45, f5, 0.55);
          if (s.beats >= 4) {
            N(s.beat + 2, 1.4, f5, 0.66);
            N(s.beat + 3.5, 0.45, rt, 0.55);
          }
        }
        break;
      }
      case 'twofeel': {
        if (info.bar.length > 1) {
          for (const s of info.bar) N(s.beat, 1.6, root(s.ch), 0.74);
          break;
        }
        const ch = info.bar[0].ch;
        const rt = root(ch);
        const f5 = fifthOf(ch, rt);
        const nextRt = root(info.next[0].ch);
        const v = Math.floor(r() * 3);
        if (v === 0) {
          N(0, 0.8, rt, 0.74);
          N(2, 0.8, f5, 0.66);
        } else if (v === 1) {
          N(0, 0.8, rt, 0.74);
          N(2, 0.8, f5, 0.66);
          N(3, 0.8, approach(nextRt, f5), 0.6);
        } else {
          N(0, 0.4, rt, 0.74);
          N(1, 0.4, rt + 12, 0.55);
          N(2, 0.8, f5, 0.66);
          N(3, 0.4, approach(nextRt, f5), 0.6);
        }
        break;
      }
      case 'waltz': {
        const ch = info.bar[0].ch;
        const rt = root(ch);
        const f5 = fifthOf(ch, rt);
        const v = Math.floor(r() * 3);
        if (v === 0) N(0, 2.6, rt, 0.72);
        else if (v === 1) {
          N(0, 0.9, rt, 0.72);
          N(2, 0.9, f5, 0.62);
        } else {
          N(0, 0.9, rt, 0.72);
          N(1, 0.9, f5, 0.62);
          N(2, 0.9, approach(root(info.next[0].ch), f5), 0.6);
        }
        break;
      }
      case 'pedal': {
        for (const s of info.bar) {
          const rt = root(s.ch);
          if (s.beats >= 4 && r() < 0.3) {
            N(s.beat, 2.4, rt, 0.6);
            N(s.beat + 2.5, 1.4, fifthOf(s.ch, rt), 0.5);
          } else N(s.beat, s.beats * 0.98, rt, 0.6);
        }
        break;
      }
      case 'pulse': {
        for (let i = 0; i < meter * 2; i++) {
          const beat = i * 0.5;
          const rt = root(slotAt(info.bar, beat).ch, 38);
          N(beat, 0.38, i % 8 === 7 && r() < 0.4 ? rt + 12 : rt, i % 2 === 0 ? 0.66 : 0.5);
        }
        break;
      }
      case 'epic': {
        const v = Math.floor(r() * 3);
        for (const s of info.bar) {
          const rt = root(s.ch, 38);
          if (v === 1 || s.beats < 4) N(s.beat, s.beats * 0.95, rt, 0.72);
          else if (v === 0) {
            N(s.beat, 1.4, rt, 0.76);
            N(s.beat + 1.5, 0.4, rt, 0.55);
            N(s.beat + 2, 1.4, rt, 0.7);
            N(s.beat + 3.5, 0.4, fifthOf(s.ch, rt), 0.55);
          } else for (let i = 0; i < 8; i++) N(s.beat + i * 0.5, 0.4, i % 2 ? rt + 12 : rt, i % 2 ? 0.5 : 0.66);
        }
        break;
      }
    }
    for (const n of notes) {
      const f = mtof(n.midi);
      const dur = n.len * this.spb;
      emit('bass', n.beat, (t) => bass(c, dest, t, f, dur, n.vel, synth), 0.004);
    }
    if (notes.length) this.lastBass = notes[notes.length - 1].midi;
  }

  private drumBar(info: BarInfo, emit: Emit): void {
    if (this.flags.drums === 'off') return;
    const c = this.ctx;
    const dest = this.ch.drums.input;
    const tonic = mtof(near(this.def.key, 40, 36, 47));
    const barDur = this.barDur;
    for (const h of drumPattern(this.def.drums.style, info, this.flags.drums === 'light', this.rng)) {
      const vel = h.vel * (0.92 + this.rng() * 0.16);
      const fn = (t: number): void => {
        switch (h.kind) {
          case 'kick':
            kick(c, dest, t, vel);
            break;
          case 'tap':
            brushTap(c, dest, t, vel);
            break;
          case 'swish':
            brushSwish(c, dest, t, vel, 0.35);
            break;
          case 'chick':
            hatChick(c, dest, t, vel);
            break;
          case 'shaker':
            shaker(c, dest, t, vel);
            break;
          case 'tick':
            tickHit(c, dest, t, vel);
            break;
          case 'ride':
            ride(c, dest, t, vel);
            break;
          case 'rim':
            rim(c, dest, t, vel);
            break;
          case 'snap':
            snap(c, dest, t, vel);
            break;
          case 'clap':
            clap(c, dest, t, vel);
            break;
          case 'tom':
            tom(c, dest, t, tonic * 1.5, vel, 0.45);
            break;
          case 'tomLo':
            tom(c, dest, t, tonic, vel, 0.6);
            break;
          case 'timp':
            tom(c, dest, t, tonic, vel, 1.1, 1.15);
            break;
          case 'hand':
            tom(c, dest, t, 145, vel, 0.3, 1.4, 0.08);
            break;
          case 'handHi':
            tom(c, dest, t, 290, vel, 0.18, 1.3, 0.18);
            break;
          case 'swell':
            swell(c, dest, t, vel, barDur);
            break;
          case 'crash':
            crash(c, dest, t, vel);
            break;
        }
      };
      emit('drums', h.beat, fn, 0.004, !!h.straight);
    }
  }

  private melodyBar(info: BarInfo, emit: Emit): void {
    const c = this.ctx;
    const dest = this.ch.melody.input;
    for (const n of this.melBars[info.barIdx] ?? []) {
      const dur = n.dur * this.spb * LEGATO[n.inst];
      emit('melody', n.beat, (t) => playInst(c, dest, n.inst, t, n.midi, dur, n.vel), 0.006);
    }
  }

  private padBar(info: BarInfo, emit: Emit): void {
    const p = this.def.pad;
    if (!p || !this.flags.pad) return;
    const c = this.ctx;
    const dest = this.ch.pad.input;
    info.bar.forEach((s, si) => {
      const prevSlot =
        si > 0 ? info.bar[si - 1] : info.barIdx > 0 ? info.bars[info.barIdx - 1][info.bars[info.barIdx - 1].length - 1] : null;
      if (prevSlot && prevSlot.ch.sym === s.ch.sym) return; // still sustaining
      let beats = s.beats;
      let bi = info.barIdx;
      let k = si + 1;
      let same = true;
      while (same) {
        const bar = info.bars[bi];
        while (k < bar.length) {
          if (bar[k].ch.sym !== s.ch.sym) {
            same = false;
            break;
          }
          beats += bar[k].beats;
          k++;
        }
        if (!same) break;
        bi++;
        k = 0;
        if (bi >= info.bars.length) break;
      }
      const v = voice(chordPcs(s.ch, this.def.key, false, 4), 60, this.prevPad);
      this.prevPad = v;
      const freqs = v.map(mtof);
      const dur = beats * this.spb;
      emit('pad', s.beat, (t) => pad(c, dest, t, freqs, dur, 0.9, p.cutoff, p.attack, 1.4));
    });
  }
}

/**
 * Offline / testing helper: schedule a track into any graph (e.g. one built with `buildGraph` on an
 * OfflineAudioContext) from `start` to `end` seconds. `solo` renders a single part.
 */
export function renderTrackInto(
  graph: Graph,
  trackId: string,
  start: number,
  end: number,
  opts: { solo?: Part; seed?: number } = {},
): void {
  const def = DEF_BY_ID.get(trackId);
  if (!def) throw new Error(`music: unknown track "${trackId}"`);
  const p = new TrackPlayer(graph, def, start, opts);
  p.fadeIn(start, 0.01);
  p.scheduleUntil(end);
}

// ---------------------------------------------------------------------------------------------
// Real-time controller
// ---------------------------------------------------------------------------------------------

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const XFADE = 1.5;

interface MusicState {
  playing: boolean;
  trackId: string | null;
  volume: number;
  muted: boolean;
  pinned: string | null;
  unlocked: boolean;
}

let current: TrackPlayer | null = null;
let fading: TrackPlayer[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let mood: Mood = 'calm';
let playing = false;
let trackId: string | null = null;
let unlocked = false;
let wired = false;
let snapshot: MusicState | null = null;
const listeners = new Set<() => void>();

function pinnedId(): string | null {
  const p = getPrefs().pinned;
  return p && DEF_BY_ID.has(p) ? p : null;
}

function buildState(): MusicState {
  const p = getPrefs();
  return { playing, trackId, volume: p.volume, muted: p.muted, pinned: pinnedId(), unlocked };
}

function emitChange(): void {
  snapshot = buildState();
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* a broken listener must not break audio */
    }
  }
}

function pickForMood(m: Mood, avoid: string | null = null): string {
  let pool = DEFS.filter((d) => d.mood === m && d.id !== avoid);
  if (!pool.length) pool = DEFS.filter((d) => d.mood === m);
  if (!pool.length) return DEFS[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function shouldTick(): boolean {
  if (!core.ctx || isHidden()) return false;
  return (!!current && !getPrefs().muted) || fading.length > 0;
}

function ensureTimer(): void {
  if (shouldTick()) {
    if (timer === null) {
      const c = core.ctx;
      if (c && current) current.resync(c.currentTime);
      timer = setInterval(tick, TICK_MS);
      tick();
    }
  } else if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function tick(): void {
  const c = core.ctx;
  if (!c) return;
  const now = c.currentTime;
  const horizon = now + LOOKAHEAD;
  if (current && !getPrefs().muted) current.scheduleUntil(horizon, now);
  for (const f of fading) f.scheduleUntil(horizon, now);
  if (fading.length) {
    fading = fading.filter((f) => {
      if (now > f.endAt + 0.25) {
        f.dispose();
        return false;
      }
      return true;
    });
  }
  if (current && current.wantsRotate) {
    current.wantsRotate = false;
    if (!pinnedId()) {
      const nid = pickForMood(current.def.mood, current.def.id);
      if (nid !== current.def.id) {
        trackId = nid;
        switchTo(nid);
        emitChange();
      }
    }
  }
  if (!shouldTick()) ensureTimer();
}

function switchTo(id: string): void {
  const g = core.graph;
  const c = core.ctx;
  const def = DEF_BY_ID.get(id);
  if (!g || !c || !def) return;
  if (current && current.def.id === id) {
    ensureTimer();
    return;
  }
  const now = c.currentTime;
  for (const f of fading) f.fadeOut(now, 0.15);
  const crossfade = !!current;
  if (current) {
    current.fadeOut(now, XFADE);
    fading.push(current);
  }
  const start = now + (crossfade ? 0.35 : 0.08);
  current = new TrackPlayer(g, def, start);
  current.fadeIn(start, crossfade ? XFADE : 0.3);
  if (!getPrefs().muted) wake();
  ensureTimer();
}

function applyVolume(fade: number): void {
  const g = core.graph;
  if (g) rampParam(g.musicVol.gain, g.ctx, musicGain(getPrefs()), fade);
}

setMusicActivityProbe(() => playing && !!current && !getPrefs().muted);

export const music = {
  /** Must be called from a user gesture the first time (creates/resumes the AudioContext). Safe to call repeatedly. */
  unlock(): void {
    const g = initContext();
    if (!g) return;
    unlockContext();
    if (!wired) {
      wired = true;
      onVisibilityChange(() => ensureTimer());
    }
    const wasUnlocked = unlocked;
    unlocked = true;
    if (playing) {
      trackId = trackId ?? pinnedId() ?? pickForMood(mood);
      switchTo(trackId);
    }
    if (!wasUnlocked) emitChange();
  },

  /** Start (or switch to) a track; no id = keep current / pinned / one matching the mood. */
  play(id?: string): void {
    if (id !== undefined && !DEF_BY_ID.has(id)) return;
    trackId = id ?? trackId ?? pinnedId() ?? pickForMood(mood);
    playing = true;
    if (core.graph) switchTo(trackId);
    emitChange();
  },

  stop(): void {
    if (!playing && !current) return;
    playing = false;
    const c = core.ctx;
    if (c && current) {
      current.fadeOut(c.currentTime, 0.8);
      fading.push(current);
    }
    current = null;
    ensureTimer();
    schedulePowerCheck();
    emitChange();
  },

  /** Crossfade to a track of this mood unless the user pinned a track. Same mood = no-op. */
  setMood(m: Mood): void {
    if (m === mood) return;
    mood = m;
    if (pinnedId()) return;
    const cur = trackId ? DEF_BY_ID.get(trackId) : undefined;
    if (cur && cur.mood === m) return;
    trackId = pickForMood(m, trackId);
    if (playing && core.graph) switchTo(trackId);
    emitChange();
  },

  /** Pin a user-chosen track (null = automatic by mood). Switches if music is playing. */
  pin(id: string | null): void {
    if (id !== null && !DEF_BY_ID.has(id)) return;
    setPrefs({ pinned: id });
    if (id) trackId = id;
    else {
      const cur = trackId ? DEF_BY_ID.get(trackId) : undefined;
      if (!cur || cur.mood !== mood) trackId = pickForMood(mood, trackId);
    }
    if (playing && core.graph && trackId) switchTo(trackId);
    emitChange();
  },

  /** Skip to another track (next in list when pinned, otherwise another of the same mood). Starts playback. */
  next(): void {
    let nid: string;
    if (pinnedId()) {
      const i = DEFS.findIndex((d) => d.id === trackId);
      nid = DEFS[(i + 1) % DEFS.length].id;
      setPrefs({ pinned: nid });
    } else {
      const m = (trackId && DEF_BY_ID.get(trackId)?.mood) || mood;
      let pool = DEFS.filter((d) => d.mood === m && d.id !== trackId);
      if (!pool.length) pool = DEFS.filter((d) => d.id !== trackId);
      nid = pool[Math.floor(Math.random() * pool.length)].id;
    }
    trackId = nid;
    playing = true;
    if (core.graph) switchTo(nid);
    emitChange();
  },

  /** 0..1 master music volume (persisted). */
  setVolume(v: number): void {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    setPrefs({ volume: clamp(v, 0, 1) });
    applyVolume(0.08);
    emitChange();
  },

  setMuted(m: boolean): void {
    const was = getPrefs().muted;
    setPrefs({ muted: !!m });
    applyVolume(0.25);
    const c = core.ctx;
    if (m) {
      if (c) for (const f of fading) f.fadeOut(c.currentTime, 0.1);
      schedulePowerCheck();
    } else if (was && current && c) {
      wake();
      current.resync(c.currentTime);
    }
    ensureTimer();
    emitChange();
  },

  get state(): MusicState {
    return snapshot ?? (snapshot = buildState());
  },

  /** Notify on state changes; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  /** Briefly duck the music (e.g. under a dramatic sting). */
  duck(seconds = 1.5): void {
    duckMusic(seconds);
  },
};
