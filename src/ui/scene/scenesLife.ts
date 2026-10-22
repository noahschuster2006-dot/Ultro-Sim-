/**
 * Life scenes (group B): people, feelings, life milestones and the spirit world.
 *
 * Every scene is a short procedural animation painted on the stage canvas behind the phone.
 * The `def` wrapper multiplies everything by the fade envelope (frame.a), so the drawing code
 * below can paint at full strength. Landscape screens get a main group left of the phone
 * (Stage.main) and a secondary group right of it (Stage.alt); portrait screens centre the
 * action in the top half (the phone dips down while a scene plays).
 */
import type { LifeSceneId } from './ids';
import {
  CONFETTI_COLORS,
  type EraLook,
  type Layout,
  type PersonOpts,
  type Rand,
  type SceneDef,
  type SceneFrame,
  clamp,
  drawConfetti,
  easeIn,
  easeOut,
  heart,
  lerp,
  makeRand,
  particles,
  person,
  sky,
  skyline,
  span,
  star,
  stepParticles,
} from './kit';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ================================================================== stage geometry

interface Stage {
  /** Figure height in px. */
  fh: number;
  /** Feet line. */
  gy: number;
  /** Centre x of the main group. */
  main: number;
  /** Centre x of the secondary group (landscape only). */
  alt: number | null;
  /** Free width around the main group. */
  sideW: number;
  /** Spacing between figures in a group. */
  gap: number;
  port: boolean;
  /** Scale relative to a 200px tall figure. */
  k: number;
}

function stage(L: Layout): Stage {
  if (L.portrait) {
    const fh = Math.min(L.h * 0.18, L.w * 0.42);
    return { fh, gy: L.groundY - L.h * 0.02, main: L.w * 0.5, alt: null, sideW: L.w, gap: Math.min(fh * 0.42, L.w * 0.2), port: true, k: fh / 200 };
  }
  const left = L.phone.x;
  const right = L.w - (L.phone.x + L.phone.w);
  const sideW = Math.max(140, Math.min(left, right));
  const fh = Math.min(L.h * 0.22, sideW * 0.6);
  return { fh, gy: L.groundY, main: L.slots[0], alt: L.slots[1] ?? null, sideW, gap: Math.min(fh * 0.42, sideW * 0.2), port: false, k: fh / 200 };
}

function def(dur: number, draw: (f: SceneFrame, S: Stage) => void, shake?: (t: number, dur: number) => number): SceneDef {
  const d: SceneDef = {
    dur,
    draw(f) {
      const g = f.g;
      g.save();
      g.globalAlpha *= f.a;
      draw(f, stage(f.L));
      g.restore();
    },
  };
  if (shake) d.shake = shake;
  return d;
}

/** Map u in [0,1] to an x position that is not hidden by the phone. */
function visX(L: Layout, S: Stage, u: number): number {
  if (S.port) return L.w * (0.03 + 0.94 * u);
  const lw = L.phone.x;
  const rx = L.phone.x + L.phone.w;
  const rw = L.w - rx;
  const v = u * (lw + rw);
  return v < lw ? v : rx + (v - lw);
}

// ================================================================== small utilities

function once(f: SceneFrame, key: string): boolean {
  if (f.mem[key]) return false;
  f.mem[key] = 1;
  return true;
}

/** Call fn `rate` times per second (accumulated in mem). */
function emit(f: SceneFrame, key: string, rate: number, fn: () => void): void {
  const k = `${key}#acc`;
  let acc = ((f.mem[k] as number | undefined) ?? 0) + rate * f.dt;
  let n = 0;
  while (acc >= 1 && n++ < 40) {
    acc -= 1;
    fn();
  }
  f.mem[k] = acc;
}

const easeOutBack = (x: number) => {
  const t = clamp(x) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};
/** 0 before a, overshooting pop to 1 by b. */
const pop = (t: number, a: number, b: number) => (t <= a ? 0 : easeOutBack((t - a) / (b - a)));
/** 0 → 1 → 0 over [a,b]. */
const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * clamp((t - a) / (b - a)));
const fract = (v: number) => v - Math.floor(v);
const hash = (n: number) => fract(Math.sin(n * 12.9898) * 43758.5453);

function isLight(hex: string): boolean {
  if (hex[0] !== '#' || hex.length !== 7) return false;
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

function rrect(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

// Soft round sprite cache: one radial gradient per colour, drawn with drawImage (cheap).
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(rgb: string): HTMLCanvasElement {
  let c = sprites.get(rgb);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    if (x) {
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},1)`);
      gr.addColorStop(0.35, `rgba(${rgb},0.5)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
    }
    sprites.set(rgb, c);
  }
  return c;
}

/** Soft glow blob; rgb is 'r,g,b'. */
function blob(g: G, x: number, y: number, r: number, rgb: string, alpha = 1): void {
  if (r <= 0 || alpha <= 0) return;
  const a = g.globalAlpha;
  g.globalAlpha = a * Math.min(1, alpha);
  g.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = a;
}

function additive(g: G, fn: () => void): void {
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  fn();
  g.globalCompositeOperation = op;
}

function floor(g: G, L: Layout, S: Stage, color: string, edge?: string): void {
  g.fillStyle = color;
  g.fillRect(0, S.gy, L.w, L.h - S.gy);
  if (edge) {
    g.fillStyle = edge;
    g.fillRect(0, S.gy, L.w, Math.max(3, S.fh * 0.025));
  }
}

function footShadow(g: G, x: number, y: number, w: number, alpha = 0.22): void {
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(x, y, w, w * 0.22, 0, 0, TAU);
  g.fill();
  g.globalAlpha = a;
}

// ================================================================== figures

type Mood = 'laugh' | 'smile' | 'sad' | 'love' | 'calm' | 'wow';

interface Fig extends PersonOpts {
  mood?: Mood;
  /** Face line colour (defaults to a contrast colour for the head). */
  ink?: string;
  shadow?: boolean;
}

function headOf(x: number, y: number, h: number, kneel = false): { x: number; y: number; r: number } {
  const r = h * 0.13;
  const sh = y - h * 0.74 + (kneel ? h * 0.12 : 0);
  return { x, y: sh - r * 1.05, r };
}

function face(g: G, x: number, y: number, h: number, mood: Mood, dir: 1 | -1, kneel: boolean, ink: string): void {
  const hd = headOf(x, y, h, kneel);
  const r = hd.r;
  if (r < 4) return;
  const cx = hd.x + dir * r * 0.14;
  const cy = hd.y;
  g.save();
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = Math.max(1.2, r * 0.13);
  g.lineCap = 'round';
  const ey = cy - r * 0.16;
  for (const sx of [-1, 1]) {
    const px = cx + sx * r * 0.36;
    g.beginPath();
    if (mood === 'laugh') {
      g.arc(px, ey + r * 0.1, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    } else if (mood === 'calm') {
      g.arc(px, ey - r * 0.06, r * 0.15, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    } else if (mood === 'love') {
      heart(g, px, ey, r * 0.2, '#ff4d6d');
    } else {
      g.arc(px, ey, r * 0.11, 0, TAU);
      g.fill();
    }
  }
  g.beginPath();
  switch (mood) {
    case 'laugh':
      g.arc(cx, cy + r * 0.18, r * 0.34, 0, Math.PI);
      g.closePath();
      g.fill();
      break;
    case 'sad':
      g.arc(cx, cy + r * 0.62, r * 0.3, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      g.fillStyle = '#8fd3ff';
      g.beginPath();
      g.ellipse(cx + r * 0.38, cy + r * 0.12, r * 0.08, r * 0.13, 0, 0, TAU);
      g.fill();
      break;
    case 'wow':
      g.ellipse(cx, cy + r * 0.38, r * 0.13, r * 0.19, 0, 0, TAU);
      g.fill();
      break;
    default:
      g.arc(cx, cy + r * 0.1, r * 0.32, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
  }
  g.restore();
}

function fig(g: G, x: number, y: number, h: number, o: Fig = {}): void {
  if (o.shadow !== false) footShadow(g, x, y, h * 0.2);
  person(g, x, y, h, o);
  if (o.mood) {
    const col = o.color ?? '#1d2233';
    face(g, x, y, h, o.mood, o.dir ?? 1, o.pose === 'kneel', o.ink ?? (isLight(col) ? '#2b1d1d' : '#fff6e8'));
  }
}

/** Figure that bobs and rocks (laughing / dancing) around its feet. */
function bobFig(g: G, x: number, y: number, h: number, o: Fig, bob: number, rock: number): void {
  footShadow(g, x, y, h * 0.2);
  g.save();
  g.translate(x, y - bob);
  g.rotate(rock);
  fig(g, 0, 0, h, { ...o, shadow: false });
  g.restore();
}

/** Line joining two standing figures' inner hands. */
function holdHands(g: G, x1: number, h1: number, x2: number, h2: number, y: number, color: string): void {
  const ax = x1 + h1 * 0.065;
  const ay = y - h1 * 0.42;
  const bx = x2 - h2 * 0.065;
  const by = y - h2 * 0.42;
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, Math.min(h1, h2) * 0.075);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ax, ay);
  g.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + Math.min(h1, h2) * 0.05, bx, by);
  g.stroke();
}

// ================================================================== little props & glyphs

function sparkle(g: G, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

function note(g: G, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.2);
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.36, -0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.44, y - s * 0.1);
  g.lineTo(x + s * 0.44, y - s * 1.6);
  g.quadraticCurveTo(x + s * 0.9, y - s * 1.25, x + s * 1.05, y - s * 0.85);
  g.stroke();
}

type Glyph = 'heart' | 'star' | 'note' | 'dot' | 'sparkle' | 'z';

function glyph(g: G, kind: Glyph, x: number, y: number, s: number, color: string, rot: number): void {
  switch (kind) {
    case 'heart':
      heart(g, x, y, s, color);
      break;
    case 'star':
      star(g, x, y, s, color, rot);
      break;
    case 'note':
      note(g, x, y, s, color);
      break;
    case 'sparkle':
      sparkle(g, x, y, s, color);
      break;
    case 'z':
      g.fillStyle = color;
      g.font = `800 ${Math.round(s * 1.8)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('z', x, y);
      break;
    default:
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, s * 0.5, 0, TAU);
      g.fill();
  }
}

interface FloatOpts {
  key?: string;
  kinds: readonly Glyph[];
  colors: readonly string[];
  size: [number, number];
  rate: number;
  x?: () => number;
  y?: () => number;
  speed?: [number, number];
  life?: [number, number];
  until?: number;
  max?: number;
  sway?: number;
}

/** Glyphs (hearts, stars, notes…) that drift upwards and fade. */
function floaters(f: SceneFrame, S: Stage, o: FloatOpts): void {
  const { g } = f;
  const key = o.key ?? 'float';
  const ps = particles(f.mem, key);
  const sp = o.speed ?? [50, 110];
  const lf = o.life ?? [1.6, 2.6];
  if (f.p < (o.until ?? 0.8))
    emit(f, key, o.rate, () => {
      if (ps.length >= (o.max ?? 60)) return;
      ps.push({
        x: o.x ? o.x() : visX(f.L, S, f.rand()),
        y: o.y ? o.y() : S.gy - f.rand() * S.fh * 0.6,
        vx: 0,
        vy: -f.rand.range(sp[0], sp[1]) * S.k,
        life: 0,
        max: f.rand.range(lf[0], lf[1]),
        size: f.rand.range(o.size[0], o.size[1]) * S.k,
        color: f.rand.pick(o.colors),
        kind: Math.floor(f.rand() * o.kinds.length),
        rot: f.rand() * TAU,
      });
    });
  stepParticles(ps, f.dt);
  const ga = g.globalAlpha;
  const sw = o.sway ?? 1.2;
  for (const p of ps) {
    g.globalAlpha = ga * clamp(p.life / 0.25) * clamp((p.max - p.life) / 0.6);
    const wob = Math.sin(p.life * 2.6 + (p.rot ?? 0)) * p.size * sw;
    glyph(g, o.kinds[p.kind ?? 0], p.x + wob, p.y, p.size, p.color, (p.rot ?? 0) + p.life);
  }
  g.globalAlpha = ga;
}

/** Confetti raining from the top across the visible area. */
function confettiRain(f: SceneFrame, S: Stage, rate: number, colors: readonly string[], key = 'conf', until = 0.85, seed = 0): void {
  const ps = particles(f.mem, key);
  const L = f.L;
  const spawn = (y: number) => {
    if (ps.length >= 240) return;
    ps.push({
      x: visX(L, S, f.rand()),
      y,
      vx: f.rand.range(-30, 30),
      vy: f.rand.range(70, 150) * Math.max(0.7, S.k),
      life: 0,
      max: 4,
      size: f.rand.range(7, 13) * Math.max(0.75, S.k),
      color: f.rand.pick(colors),
      rot: f.rand() * TAU,
      vr: f.rand.range(-6, 6),
    });
  };
  if (seed > 0 && once(f, `${key}#seed`)) for (let i = 0; i < seed; i++) spawn(f.rand.range(-20, S.gy * 0.7));
  if (f.p < until) emit(f, key, rate, () => spawn(-12));
  stepParticles(ps, f.dt);
  for (const p of ps) p.x += Math.sin(p.life * 3 + (p.rot ?? 0)) * 0.6;
  drawConfetti(f.g, ps);
}

/** A burst of confetti from a point. */
function confettiBurst(f: SceneFrame, x: number, y: number, n: number, speed: number, colors: readonly string[], key = 'conf'): void {
  const ps = particles(f.mem, key);
  for (let i = 0; i < n && ps.length < 260; i++) {
    const a = -Math.PI / 2 + f.rand.range(-1.1, 1.1);
    const v = f.rand.range(0.5, 1) * speed;
    ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 3, size: f.rand.range(7, 12), color: f.rand.pick(colors), rot: f.rand() * TAU, vr: f.rand.range(-8, 8) });
  }
}

/** Falling rain streaks over the whole stage. */
function rain(f: SceneFrame, S: Stage, rate: number, color: string, floorY = S.gy + S.fh * 0.2): void {
  const { g, L } = f;
  const ps = particles(f.mem, 'rain');
  const k = Math.max(0.7, S.k);
  const spawn = (y: number) => {
    if (ps.length < 280) ps.push({ x: f.rand.range(-30, L.w + 80), y, vx: -110 * k, vy: f.rand.range(900, 1150) * k, life: 0, max: 3, size: f.rand.range(12, 22) * k, color });
  };
  if (once(f, 'rain#seed')) for (let i = 0; i < rate * 0.6; i++) spawn(f.rand.range(-20, floorY));
  emit(f, 'rain', rate, () => spawn(f.rand.range(-40, -5)));
  stepParticles(ps, f.dt);
  for (let i = ps.length - 1; i >= 0; i--) if (ps[i].y > floorY) ps.splice(i, 1);
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, 1.6 * S.k);
  g.lineCap = 'round';
  g.beginPath();
  for (const p of ps) {
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + (p.vx / p.vy) * p.size, p.y + p.size);
  }
  g.stroke();
}

function bubble(g: G, x: number, y: number, text: string, size: number, s: number, tail: number, bg = '#ffffff', fg = '#2b2d42'): void {
  if (s <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
  const w = g.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  g.fillStyle = 'rgba(0,0,0,0.16)';
  rrect(g, -w / 2 + 3, -h / 2 + 4, w, h, h * 0.45);
  g.fill();
  g.fillStyle = bg;
  rrect(g, -w / 2, -h / 2, w, h, h * 0.45);
  g.fill();
  g.beginPath();
  g.moveTo(tail * w * 0.15 - size * 0.35, h / 2 - 2);
  g.lineTo(tail * w * 0.32, h / 2 + size * 0.75);
  g.lineTo(tail * w * 0.15 + size * 0.35, h / 2 - 2);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, size * 0.06);
  g.restore();
}

/** Speech bubble that pops in at t0 and fades after t1. */
function timedBubble(f: SceneFrame, x: number, y: number, text: string, size: number, t0: number, t1: number, tail: number, fg?: string): void {
  if (f.t < t0 || f.t > t1 + 0.25) return;
  const g = f.g;
  const a = g.globalAlpha;
  g.globalAlpha = a * clamp((t1 + 0.25 - f.t) / 0.25);
  const wob = 1 + Math.sin(f.t * 18) * 0.03;
  bubble(g, x, y, text, size, pop(f.t, t0, t0 + 0.3) * wob, tail, '#ffffff', fg);
  g.globalAlpha = a;
}

function cloud(g: G, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  const puff = (cx: number, cy: number, r: number) => {
    g.moveTo(cx + r, cy);
    g.arc(cx, cy, r, 0, TAU);
  };
  puff(x - s * 0.55, y + s * 0.08, s * 0.38);
  puff(x - s * 0.1, y - s * 0.16, s * 0.5);
  puff(x + s * 0.42, y - s * 0.02, s * 0.42);
  puff(x + s * 0.85, y + s * 0.14, s * 0.3);
  g.rect(x - s * 0.9, y + s * 0.08, s * 1.9, s * 0.36);
  g.fill();
}

function flameShape(g: G, x: number, y: number, w: number, h: number, sway: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + w, y - w);
  g.arc(x, y - w, w, 0, Math.PI);
  g.quadraticCurveTo(x - w, y - h * 0.55, x + sway, y - h);
  g.quadraticCurveTo(x + w, y - h * 0.55, x + w, y - w);
  g.fill();
}

/** Flickering flame standing on (x, y), s tall. */
function flame(g: G, x: number, y: number, s: number, t: number, seed: number, glowAmt = 1): void {
  const fl = 1 + Math.sin(t * 17 + seed * 3.1) * 0.08 + Math.sin(t * 29 + seed) * 0.06;
  const h = s * fl;
  const w = s * 0.24;
  const sway = Math.sin(t * 9 + seed * 1.7) * s * 0.1;
  if (glowAmt > 0) additive(g, () => blob(g, x, y - h * 0.45, s * 1.9, '255,160,60', 0.5 * glowAmt * fl));
  flameShape(g, x, y, w, h, sway, '#ff7a1a');
  flameShape(g, x, y, w * 0.62, h * 0.68, sway * 0.7, '#ffcf3f');
  flameShape(g, x, y, w * 0.32, h * 0.38, sway * 0.4, '#fff8dc');
}

function candle(g: G, x: number, y: number, s: number, t: number, seed: number, wax = '#f3ead8'): void {
  const w = s * 0.28;
  g.fillStyle = wax;
  g.fillRect(x - w / 2, y - s, w, s);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x + w * 0.1, y - s, w * 0.4, s);
  g.fillStyle = '#2b2b2b';
  g.fillRect(x - 0.75, y - s - s * 0.08, 1.5, s * 0.08);
  flame(g, x, y - s - s * 0.06, Math.max(8, s * 0.55), t, seed);
}

function torch(g: G, x: number, y: number, h: number, t: number, seed: number): void {
  g.strokeStyle = '#4a2c17';
  g.lineWidth = Math.max(3, h * 0.05);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - h);
  g.stroke();
  g.fillStyle = '#6b4423';
  g.beginPath();
  g.moveTo(x - h * 0.07, y - h);
  g.lineTo(x + h * 0.07, y - h);
  g.lineTo(x + h * 0.04, y - h * 0.9);
  g.lineTo(x - h * 0.04, y - h * 0.9);
  g.fill();
  flame(g, x, y - h * 0.98, h * 0.32, t, seed, 1.6);
}

function balloon(g: G, x: number, y: number, r: number, color: string, t: number, seed: number): void {
  g.strokeStyle = 'rgba(70,70,80,0.55)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, y + r * 1.25);
  for (let i = 1; i <= 6; i++) g.lineTo(x + Math.sin(t * 3 + seed + i * 0.9) * r * 0.16, y + r * 1.25 + i * r * 0.42);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, r, r * 1.18, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x, y + r * 1.1);
  g.lineTo(x - r * 0.15, y + r * 1.3);
  g.lineTo(x + r * 0.15, y + r * 1.3);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.17, r * 0.32, -0.5, 0, TAU);
  g.fill();
}

function tree(g: G, x: number, y: number, h: number, trunk: string, leaf: string): void {
  g.fillStyle = trunk;
  g.fillRect(x - h * 0.045, y - h * 0.55, h * 0.09, h * 0.55);
  g.fillStyle = leaf;
  g.beginPath();
  for (const [dx, dy, r] of [
    [0, -0.78, 0.3],
    [-0.22, -0.6, 0.22],
    [0.22, -0.62, 0.22],
    [0, -0.55, 0.2],
  ] as const) {
    g.moveTo(x + dx * h + r * h, y + dy * h);
    g.arc(x + dx * h, y + dy * h, r * h, 0, TAU);
  }
  g.fill();
}

function crescent(g: G, x: number, y: number, r: number, color: string): void {
  g.save();
  g.beginPath();
  g.rect(x - r * 2, y - r * 2, r * 4, r * 4);
  g.arc(x + r * 0.48, y - r * 0.22, r * 0.85, 0, TAU);
  g.clip('evenodd');
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.restore();
}

function fullMoon(g: G, x: number, y: number, r: number, color: string, glowRgb: string): void {
  additive(g, () => blob(g, x, y, r * 3.2, glowRgb, 0.35));
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU);
  g.arc(x + r * 0.3, y + r * 0.25, r * 0.16, 0, TAU);
  g.fill();
}

/** Deterministic twinkling stars scattered over the visible sky. */
function starfield(g: G, L: Layout, S: Stage, n: number, maxY: number, t: number, color: string, seed: number): void {
  const r = makeRand(seed);
  g.fillStyle = color;
  const a = g.globalAlpha;
  for (let i = 0; i < n; i++) {
    const x = visX(L, S, r());
    const y = r() * maxY;
    const s = 0.6 + r() * 1.6;
    g.globalAlpha = a * (0.45 + 0.55 * Math.abs(Math.sin(t * (1 + r() * 2) + i)));
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  g.globalAlpha = a;
}

/** Map pin with its tip at (x, y). */
function mapPin(g: G, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x - s * 0.25, y - s * 0.5, x - s * 0.55, y - s * 0.75, x - s * 0.55, y - s * 1.1);
  g.arc(x, y - s * 1.1, s * 0.55, Math.PI, 0);
  g.bezierCurveTo(x + s * 0.55, y - s * 0.75, x + s * 0.25, y - s * 0.5, x, y);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x, y - s * 1.1, s * 0.22, 0, TAU);
  g.fill();
}

/** Wedge rays fanning out from (cx, cy), additive. */
function rays(g: G, cx: number, cy: number, n: number, len: number, base: number, spread: number, halfW: number, rgb: string, alpha: number): void {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, len);
  gr.addColorStop(0, `rgba(${rgb},${alpha})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  additive(g, () => {
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = base - spread / 2 + (spread * (i + 0.5)) / n;
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a - halfW) * len, cy + Math.sin(a - halfW) * len);
      g.lineTo(cx + Math.cos(a + halfW) * len, cy + Math.sin(a + halfW) * len);
      g.closePath();
    }
    g.fill();
  });
}

// ================================================================== houses & buildings

function houseShape(g: G, x: number, y: number, w: number, era: EraLook, lit: number): { cx: number; cy: number } {
  const bh = w * 0.6;
  const look: Record<EraLook, { wall: string; roof: string; door: string; trim: string }> = {
    ancient: { wall: '#e6cfa6', roof: '#c49a64', door: '#6b4423', trim: '#d4b98a' },
    medieval: { wall: '#efe4cc', roof: '#b8935a', door: '#5a3a1e', trim: '#6b4a2b' },
    early: { wall: '#c97b5a', roof: '#5a3d33', door: '#3f2a1e', trim: '#f2e6d0' },
    industrial: { wall: '#a8553d', roof: '#3d3a46', door: '#2e2a38', trim: '#e9dccb' },
    modern: { wall: '#8ecae6', roof: '#d1495b', door: '#ffb703', trim: '#ffffff' },
    future: { wall: '#eef6ff', roof: '#59e3ff', door: '#2a3a5a', trim: '#7df9ff' },
  };
  const c = look[era];
  const chimX = x + w * 0.24;
  const chimY = y - bh - w * 0.34;
  // chimney behind the roof
  if (era !== 'ancient' && era !== 'future') {
    g.fillStyle = era === 'modern' ? '#9a3b46' : '#6e4a3a';
    g.fillRect(chimX - w * 0.06, chimY, w * 0.12, w * 0.32);
  }
  g.fillStyle = c.wall;
  g.fillRect(x - w / 2, y - bh, w, bh);
  if (era === 'medieval') {
    g.strokeStyle = c.trim;
    g.lineWidth = Math.max(2, w * 0.025);
    g.beginPath();
    g.moveTo(x - w / 2, y - bh * 0.55);
    g.lineTo(x + w / 2, y - bh * 0.55);
    g.moveTo(x - w * 0.42, y - bh);
    g.lineTo(x - w * 0.2, y - bh * 0.55);
    g.moveTo(x + w * 0.42, y - bh);
    g.lineTo(x + w * 0.2, y - bh * 0.55);
    g.stroke();
  }
  g.fillStyle = c.roof;
  g.beginPath();
  if (era === 'ancient') {
    g.rect(x - w * 0.56, y - bh - w * 0.07, w * 1.12, w * 0.08);
    g.rect(x - w * 0.5, y - bh - w * 0.12, w * 0.12, w * 0.06);
    g.rect(x + w * 0.38, y - bh - w * 0.12, w * 0.12, w * 0.06);
  } else if (era === 'future') {
    g.globalAlpha *= 0.85;
    g.arc(x, y - bh + 1, w * 0.5, Math.PI, 0);
  } else {
    g.moveTo(x - w * 0.62, y - bh + 2);
    g.lineTo(x, y - bh - w * 0.42);
    g.lineTo(x + w * 0.62, y - bh + 2);
  }
  g.fill();
  if (era === 'future') g.globalAlpha /= 0.85;
  // door
  g.fillStyle = c.door;
  rrect(g, x - w * 0.09, y - bh * 0.55, w * 0.18, bh * 0.55, w * 0.05);
  g.fill();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  g.arc(x + w * 0.05, y - bh * 0.27, Math.max(1.5, w * 0.012), 0, TAU);
  g.fill();
  // windows
  const ww = w * 0.2;
  const wh = w * 0.17;
  for (const sx of [-1, 1]) {
    const wx = x + sx * w * 0.29;
    const wy = y - bh * 0.62;
    if (lit > 0) additive(g, () => blob(g, wx, wy, w * 0.3, '255,200,90', 0.55 * lit));
    g.fillStyle = lit > 0 ? '#ffd56b' : '#a9d6f5';
    g.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
    g.strokeStyle = c.trim;
    g.lineWidth = Math.max(1.5, w * 0.018);
    g.strokeRect(wx - ww / 2, wy - wh / 2, ww, wh);
    g.beginPath();
    g.moveTo(wx, wy - wh / 2);
    g.lineTo(wx, wy + wh / 2);
    g.moveTo(wx - ww / 2, wy);
    g.lineTo(wx + ww / 2, wy);
    g.stroke();
  }
  return { cx: chimX, cy: chimY };
}

/** Chimney smoke puffs rising from (x, y). */
function smoke(f: SceneFrame, x: number, y: number, s: number, rgb = '200,200,210', key = 'smoke'): void {
  const ps = particles(f.mem, key);
  emit(f, key, 5, () => {
    if (ps.length < 30) ps.push({ x, y, vx: f.rand.range(8, 20) * s, vy: -f.rand.range(28, 45) * s, life: 0, max: 2.4, size: 8 * s, color: rgb });
  });
  stepParticles(ps, f.dt);
  for (const p of ps) blob(f.g, p.x, p.y, p.size * (1 + p.life * 1.4), rgb, 0.55 * clamp(1 - p.life / p.max));
}

// ================================================================== 1. funeral

function tombstone(g: G, x: number, y: number, h: number): void {
  const tw = h * 0.44;
  const th = h * 0.6;
  footShadow(g, x, y, tw * 0.75, 0.3);
  g.beginPath();
  g.moveTo(x - tw / 2, y);
  g.lineTo(x - tw / 2, y - th + tw / 2);
  g.arc(x, y - th + tw / 2, tw / 2, Math.PI, 0);
  g.lineTo(x + tw / 2, y);
  g.closePath();
  g.fillStyle = '#8e949e';
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(x + tw * 0.22, y - th, tw * 0.4, th);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(x - tw / 2, y - th, tw * 0.12, th);
  g.restore();
  g.lineWidth = Math.max(1.5, h * 0.012);
  g.strokeStyle = '#5f656f';
  g.stroke();
  g.fillStyle = '#4b5059';
  g.font = `700 ${Math.round(h * 0.085)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('R.I.P.', x, y - th + tw * 0.62);
  g.fillRect(x - tw * 0.28, y - th * 0.42, tw * 0.56, Math.max(1.5, h * 0.01));
  g.fillRect(x - tw * 0.2, y - th * 0.31, tw * 0.4, Math.max(1.5, h * 0.01));
  g.fillStyle = '#1d2521';
  g.beginPath();
  g.ellipse(x, y + h * 0.01, tw * 0.8, h * 0.05, 0, Math.PI, TAU);
  g.fill();
}

function bouquet(g: G, x: number, y: number, h: number, colors: readonly string[]): void {
  const s = h * 0.03;
  const tips: [number, number][] = [
    [-2.2, -4.2],
    [-0.8, -5.2],
    [0.7, -4.6],
    [1.9, -3.6],
    [-0.1, -3.1],
  ];
  g.strokeStyle = '#3f7a3a';
  g.lineWidth = Math.max(1.2, s * 0.35);
  g.beginPath();
  for (const [dx, dy] of tips) {
    g.moveTo(x, y);
    g.lineTo(x + dx * s, y + dy * s);
  }
  g.stroke();
  tips.forEach(([dx, dy], i) => {
    g.fillStyle = colors[i % colors.length];
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, s * 1.1, 0, TAU);
    g.fill();
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, s * 0.38, 0, TAU);
    g.fill();
  });
}

function umbrella(g: G, cx: number, cy: number, R: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - R, cy);
  g.arc(cx, cy, R, Math.PI, 0);
  const n = 4;
  const sr = R / n;
  for (let i = 0; i < n; i++) g.arc(cx + R - sr - i * 2 * sr, cy, sr, 0, Math.PI, true);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = Math.max(1, R * 0.03);
  g.beginPath();
  for (let i = 1; i < n; i++) {
    g.moveTo(cx, cy - R);
    g.quadraticCurveTo(cx + (i - n / 2) * sr * 1.2, cy - R * 0.5, cx - R + i * 2 * sr, cy);
  }
  g.stroke();
  g.strokeStyle = '#0d0f14';
  g.lineWidth = Math.max(2, R * 0.06);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cy - R * 1.12);
  g.lineTo(cx, cy - R);
  g.moveTo(cx, cy);
  g.lineTo(cx, cy + R * 1.15);
  g.arc(cx - R * 0.1, cy + R * 1.15, R * 0.1, 0, Math.PI);
  g.stroke();
}

function mourner(g: G, x: number, y: number, h: number, dir: 1 | -1, hooded: boolean, withUmbrella: boolean): void {
  const color = '#1a1d26';
  if (hooded) {
    fig(g, x, y, h, { color, dress: true, accent: '#2b303e', hat: 'hood', dir, mood: 'sad', ink: '#b8c1cf' });
    return;
  }
  fig(g, x, y, h, { color, pose: withUmbrella ? 'wave' : 'stand', phase: 0, dir, accent: '#3a4050', mood: 'sad', ink: '#b8c1cf' });
  if (withUmbrella) umbrella(g, x + dir * h * 0.144, y - h * 1.02, h * 0.36, '#262b38');
}

const funeral = def(3.8, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#283040', '#434d5f', '#687284']);
  skyline(g, L, gy, era, 'rgba(48,55,70,0.85)', 23);
  floor(g, L, S, '#212925', '#323e37');
  const hooded = era === 'ancient' || era === 'medieval';
  const bloom = ['#f4f1de', '#e8a0b4', '#f2cc8f', '#ffffff', '#c9b6e4'];
  // main: a mourner at a grave
  const tx = S.main + S.gap * (S.port ? 0.6 : 0.65);
  const mx = S.main - S.gap * (S.port ? 0.9 : 0.85);
  additive(g, () => blob(g, tx, gy - fh * 0.12, fh * 0.95, '255,170,90', 0.32 + 0.05 * Math.sin(t * 13)));
  tombstone(g, tx, gy, fh);
  bouquet(g, tx - fh * 0.04, gy + fh * 0.01, fh, bloom);
  mourner(g, mx, gy, fh, 1, hooded, !hooded);
  candle(g, tx - fh * 0.3, gy + fh * 0.045, fh * 0.11, t, 1);
  candle(g, tx + fh * 0.3, gy + fh * 0.025, fh * 0.085, t, 2);
  candle(g, tx + fh * 0.18, gy + fh * 0.08, fh * 0.06, t, 3);
  if (S.alt !== null) {
    const ax = S.alt;
    additive(g, () => blob(g, ax, gy, fh * 0.9, '255,170,90', 0.25));
    fig(g, ax + fh * 0.36, gy, fh * 0.84, { color: '#1d2029', dress: true, accent: '#2c3140', hat: hooded ? 'hood' : 'none', dir: -1, mood: 'sad', ink: '#b8c1cf' });
    mourner(g, ax - fh * 0.04, gy, fh, 1, hooded, !hooded);
    for (let i = 0; i < 5; i++) candle(g, ax + (i - 2) * fh * 0.2, gy + fh * (0.07 + (i % 2) * 0.035), fh * (0.07 + ((i * 3) % 5) * 0.012), t, 10 + i);
    bouquet(g, ax + fh * 0.5, gy + fh * 0.1, fh * 0.9, bloom);
  }
  rain(f, S, 170, 'rgba(190,205,228,0.42)');
});

// ================================================================== 2. birth

function cradle(g: G, x: number, y: number, s: number, rock: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rock);
  g.lineCap = 'round';
  g.strokeStyle = '#d48fb3';
  g.lineWidth = s * 0.045;
  g.beginPath();
  g.arc(0, -s * 0.9, s * 0.9, Math.PI * 0.32, Math.PI * 0.68);
  g.stroke();
  g.beginPath();
  g.moveTo(-s * 0.3, -s * 0.07);
  g.lineTo(-s * 0.3, -s * 0.2);
  g.moveTo(s * 0.3, -s * 0.07);
  g.lineTo(s * 0.3, -s * 0.2);
  g.stroke();
  // hood
  g.fillStyle = '#f7a8c4';
  g.beginPath();
  g.arc(-s * 0.3, -s * 0.33, s * 0.25, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ffd0e1';
  g.beginPath();
  g.arc(-s * 0.3, -s * 0.33, s * 0.17, Math.PI, 0);
  g.fill();
  // baby
  const bx = -s * 0.27;
  const by = -s * 0.37;
  const br = s * 0.11;
  g.fillStyle = '#ffd9b8';
  g.beginPath();
  g.arc(bx, by, br, 0, TAU);
  g.fill();
  g.strokeStyle = '#7a4e3a';
  g.lineWidth = Math.max(1, s * 0.013);
  g.beginPath();
  g.arc(bx - br * 0.36, by - br * 0.08, br * 0.2, Math.PI * 0.15, Math.PI * 0.85);
  g.moveTo(bx + br * 0.56, by - br * 0.08);
  g.arc(bx + br * 0.36, by - br * 0.08, br * 0.2, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  g.beginPath();
  g.arc(bx + br * 0.05, by - br * 1.0, br * 0.3, Math.PI * 0.2, Math.PI * 1.6);
  g.stroke();
  g.fillStyle = 'rgba(255,120,150,0.45)';
  g.beginPath();
  g.arc(bx - br * 0.55, by + br * 0.3, br * 0.18, 0, TAU);
  g.arc(bx + br * 0.55, by + br * 0.3, br * 0.18, 0, TAU);
  g.fill();
  // blanket
  g.fillStyle = '#a9d6ff';
  g.beginPath();
  g.ellipse(s * 0.16, -s * 0.33, s * 0.32, s * 0.1, 0, Math.PI, TAU);
  g.fill();
  // basket
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(0, -s * 0.33, s * 0.53, s * 0.28, 0, 0, Math.PI);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#ffd6e6';
  for (let i = -5; i <= 5; i += 2) g.fillRect(i * s * 0.05 - s * 0.025, -s * 0.34, s * 0.05, s * 0.3);
  g.restore();
  g.strokeStyle = '#f29bbf';
  g.lineWidth = s * 0.035;
  g.beginPath();
  g.moveTo(-s * 0.54, -s * 0.33);
  g.lineTo(s * 0.54, -s * 0.33);
  g.stroke();
  g.restore();
}

const birth = def(3.4, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#f7c1d9', '#e7d6ff', '#cde4ff']);
  starfield(g, L, S, 40, gy - fh * 0.6, t, '#ffffff', 5);
  blob(g, S.main, gy - fh * 0.5, fh * 1.8, '255,255,255', 0.9);
  // moon
  const mx = S.alt ?? L.w * 0.84;
  const my = S.port ? L.h * 0.09 : L.h * 0.2;
  additive(g, () => blob(g, mx, my, fh * 0.9, '255,240,180', 0.5));
  crescent(g, mx, my, fh * (S.port ? 0.17 : 0.28), '#fff1a8');
  floor(g, L, S, '#f2c2d4', '#f8d7e3');
  // hanging mobile above the cradle
  const cw = fh * 0.85;
  const barY = gy - fh * 1.22;
  g.strokeStyle = 'rgba(150,110,160,0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(S.main, 0);
  g.lineTo(S.main, barY);
  g.moveTo(S.main - cw * 0.42, barY);
  g.lineTo(S.main + cw * 0.42, barY);
  g.stroke();
  const items: [Glyph, string][] = [
    ['star', '#ffd166'],
    ['heart', '#ff8fab'],
    ['star', '#a0c4ff'],
  ];
  items.forEach(([kind, col], i) => {
    const a = t * 1.3 + (i * TAU) / 3;
    const ix = S.main + Math.cos(a) * cw * 0.42;
    const iy = barY + fh * (0.16 + 0.04 * i) + Math.sin(t * 2 + i) * fh * 0.01;
    g.beginPath();
    g.moveTo(ix, barY);
    g.lineTo(ix, iy);
    g.stroke();
    glyph(g, kind, ix, iy, fh * (0.05 + 0.015 * Math.sin(a)), col, Math.sin(t + i) * 0.3);
  });
  cradle(g, S.main, gy, cw, Math.sin(t * 2.4) * 0.09);
  // proud parents
  const px = cw * 0.5 + S.gap * 0.7;
  const mood: Mood = p > 0.35 ? 'love' : 'smile';
  fig(g, S.main - px, gy, fh * 0.96, { color: '#7a4f8f', dress: true, accent: '#ff8fab', dir: 1, mood });
  fig(g, S.main + px, gy, fh, { color: '#3d5a80', accent: '#98c1d9', dir: -1, mood });
  floaters(f, S, { key: 'z', kinds: ['z'], colors: ['#9b7fc7'], size: [7, 10], rate: 1.6, x: () => S.main - cw * 0.2, y: () => gy - cw * 0.5, speed: [35, 50], life: [1.4, 1.8], sway: 2.5, max: 6 });
  floaters(f, S, { kinds: ['heart', 'star', 'heart'], colors: ['#ff8fab', '#ffc6ff', '#ffd166', '#a0c4ff', '#bdb2ff'], size: [7, 15], rate: 10, speed: [40, 90], life: [2, 3], max: 50 });
});

// ================================================================== 3. love

function arrowSeg(g: G, x: number, y: number, ang: number, from: number, to: number, lw: number, tail: boolean, tip: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = lw;
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(from, 0);
  g.lineTo(to, 0);
  g.stroke();
  if (tip) {
    g.fillStyle = '#e9edf2';
    g.beginPath();
    g.moveTo(to + lw * 4, 0);
    g.lineTo(to - lw * 1.2, -lw * 2.4);
    g.lineTo(to - lw * 1.2, lw * 2.4);
    g.fill();
  }
  if (tail) {
    g.fillStyle = '#ff8fab';
    for (const sy of [-1, 1]) {
      g.beginPath();
      g.moveTo(from, 0);
      g.lineTo(from - lw * 1.5, sy * lw * 2.6);
      g.lineTo(from + lw * 3.5, sy * lw * 2.6);
      g.lineTo(from + lw * 5, 0);
      g.fill();
    }
  }
  g.restore();
}

/** A pulsing heart pierced by Cupid's arrow that flies in between t0 and t1 (progress p). */
function cupidHeart(f: SceneFrame, x: number, y: number, R: number, t0: number, t1: number): void {
  const { g, p, t } = f;
  const ang = -0.38;
  const len = R * 3.6;
  const lw = Math.max(2, R * 0.08);
  const hit = p >= t1;
  const beat = 1 + 0.07 * Math.sin(t * 9) + (hit ? 0.18 * bump(p, t1, t1 + 0.12) : 0);
  const RR = R * beat;
  additive(g, () => blob(g, x, y, RR * 3, '255,80,120', 0.45));
  if (p >= t0 && !hit) {
    const d = (1 - easeIn((p - t0) / (t1 - t0))) * f.L.w * 0.35;
    arrowSeg(g, x - Math.cos(ang) * d, y - Math.sin(ang) * d, ang, -len / 2, len / 2, lw, true, true);
  }
  if (hit) arrowSeg(g, x, y, ang, -len / 2, -RR * 0.3, lw, true, false);
  heart(g, x, y, RR, '#ff3d6e');
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(x - RR * 0.55, y - RR * 0.45, RR * 0.18, RR * 0.28, -0.6, 0, TAU);
  g.fill();
  if (hit) {
    arrowSeg(g, x, y, ang, RR * 0.55, len / 2, lw, false, true);
    if (once(f, `cupid${Math.round(x)}`)) {
      const ps = particles(f.mem, 'cupidSpark');
      for (let i = 0; i < 14; i++) {
        const a = f.rand() * TAU;
        const v = f.rand.range(80, 200);
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.8, size: f.rand.range(4, 8), color: f.rand.pick(['#fff', '#ffd166', '#ff8fab']) });
      }
    }
  }
}

const love = def(3.4, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#2b1055', '#7b2a6e', '#e0557b', '#ff9b6a', '#ffd39b']);
  const sunY = gy - fh * 0.5;
  additive(g, () => blob(g, S.main, sunY, fh * 2.2, '255,180,110', 0.55));
  g.fillStyle = '#ffd27a';
  g.beginPath();
  g.arc(S.main, sunY, fh * 0.6, 0, TAU);
  g.fill();
  skyline(g, L, gy, era, 'rgba(74,22,70,0.8)', 31);
  floor(g, L, S, '#2a0d2c');
  // the couple walks together
  const d = lerp(S.gap * 1.35, S.gap * 0.34, span(p, 0.04, 0.38));
  const walking = p < 0.38;
  const col = '#2a0d2c';
  fig(g, S.main - d, gy, fh * 0.95, { color: col, dress: true, accent: '#ff4d6d', pose: walking ? 'walk' : 'stand', phase: t, dir: 1, shadow: false });
  fig(g, S.main + d, gy, fh, { color: col, pose: walking ? 'walk' : 'stand', phase: t + 0.4, dir: -1, shadow: false });
  if (!walking) holdHands(g, S.main - d, fh * 0.95, S.main + d, fh, gy, col);
  // heart above them
  const hy = gy - fh * 1.38;
  if (S.port) {
    if (p > 0.3) cupidHeart(f, S.main, hy, fh * 0.24 * pop(p, 0.3, 0.42), 0.42, 0.55);
  } else {
    const hp = pop(p, 0.38, 0.52);
    if (hp > 0) {
      const R = fh * 0.2 * hp * (1 + 0.07 * Math.sin(t * 9));
      additive(g, () => blob(g, S.main, hy, R * 3, '255,90,130', 0.5));
      heart(g, S.main, hy, R, '#ff3d6e');
    }
  }
  if (S.alt !== null) cupidHeart(f, S.alt, gy - fh * 0.95, fh * 0.34, 0.22, 0.36);
  const sp = particles(f.mem, 'cupidSpark');
  stepParticles(sp, f.dt, 200);
  for (const s of sp) {
    g.globalAlpha = f.a * clamp(1 - s.life / s.max);
    sparkle(g, s.x, s.y, s.size, s.color);
  }
  g.globalAlpha = f.a;
  floaters(f, S, { kinds: ['heart'], colors: ['#ff4d6d', '#ff8fab', '#ffb3c6', '#ff006e'], size: [6, 13], rate: 12, speed: [60, 120], life: [1.8, 2.8] });
});

// ================================================================== 4. wedding

function bell(g: G, x: number, y: number, s: number, ang: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = '#b8860b';
  g.beginPath();
  g.arc(-Math.sin(ang) * s * 0.25, s * 0.98, s * 0.13, 0, TAU);
  g.fill();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  g.moveTo(-s * 0.18, s * 0.06);
  g.quadraticCurveTo(-s * 0.44, s * 0.1, -s * 0.44, s * 0.55);
  g.quadraticCurveTo(-s * 0.46, s * 0.8, -s * 0.64, s * 0.92);
  g.lineTo(s * 0.64, s * 0.92);
  g.quadraticCurveTo(s * 0.46, s * 0.8, s * 0.44, s * 0.55);
  g.quadraticCurveTo(s * 0.44, s * 0.1, s * 0.18, s * 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = '#d9a426';
  g.fillRect(-s * 0.64, s * 0.86, s * 1.28, s * 0.09);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(-s * 0.2, s * 0.42, s * 0.07, s * 0.24, 0.1, 0, TAU);
  g.fill();
  g.restore();
}

function bow(g: G, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x - s * 0.5, y, s * 0.5, s * 0.3, -0.3, 0, TAU);
  g.ellipse(x + s * 0.5, y, s * 0.5, s * 0.3, 0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.1, y);
  g.lineTo(x - s * 0.45, y + s * 0.9);
  g.lineTo(x - s * 0.2, y + s * 0.8);
  g.lineTo(x + s * 0.2, y + s * 0.8);
  g.lineTo(x + s * 0.45, y + s * 0.9);
  g.lineTo(x + s * 0.1, y);
  g.fill();
  g.beginPath();
  g.arc(x, y, s * 0.2, 0, TAU);
  g.fill();
}

function bellPair(f: SceneFrame, x: number, y: number, s: number): void {
  const { g, t } = f;
  const sw = Math.sin(t * 5);
  bell(f.g, x - s * 0.55, y, s, 0.35 * sw);
  bell(f.g, x + s * 0.55, y, s, -0.35 * sw);
  bow(g, x, y, s * 0.42, '#ff7aa2');
  const ring = Math.abs(sw);
  if (ring > 0.6) {
    g.strokeStyle = `rgba(255,214,102,${(ring - 0.6) * 2})`;
    g.lineWidth = Math.max(1.5, s * 0.06);
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(x + sx * s * 1.5, y + s * 0.6, s * 0.35, sx > 0 ? -0.8 : Math.PI - 0.8 + 1.6 - 1.6, sx > 0 ? 0.8 : Math.PI + 0.8);
      g.stroke();
      g.beginPath();
      g.arc(x + sx * s * 1.5, y + s * 0.6, s * 0.6, sx > 0 ? -0.7 : Math.PI - 0.7, sx > 0 ? 0.7 : Math.PI + 0.7);
      g.stroke();
    }
  }
}

function flowerArch(g: G, x: number, y: number, aw: number, ph: number, fh: number): void {
  g.strokeStyle = '#f6f1e9';
  g.lineWidth = fh * 0.05;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - aw, y);
  g.lineTo(x - aw, y - ph);
  g.arc(x, y - ph, aw, Math.PI, 0);
  g.lineTo(x + aw, y);
  g.stroke();
  const cols = ['#ff7aa2', '#ffffff', '#e63962', '#ffb3c6', '#ffd6e0'];
  const step = fh * 0.055;
  const postLen = ph * 0.8;
  const arcLen = Math.PI * aw;
  const total = postLen * 2 + arcLen;
  const r = fh * 0.032;
  let i = 0;
  for (let s = 0; s <= total; s += step, i++) {
    let px: number;
    let py: number;
    if (s < postLen) {
      px = x - aw;
      py = y - ph * 0.2 - s;
    } else if (s < postLen + arcLen) {
      const a = Math.PI + (s - postLen) / aw;
      px = x + Math.cos(a) * aw;
      py = y - ph + Math.sin(a) * aw;
    } else {
      px = x + aw;
      py = y - ph + (s - postLen - arcLen);
    }
    const j = (i * 7) % 3;
    if (i % 2 === 0) {
      g.fillStyle = '#5e9e58';
      g.beginPath();
      g.ellipse(px + (j - 1) * r * 1.2, py + r * 0.6, r * 0.9, r * 0.45, j - 1, 0, TAU);
      g.fill();
    }
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(px + (j - 1) * r * 0.5, py, r * (1 + (i % 3) * 0.15), 0, TAU);
    g.fill();
    g.fillStyle = '#ffe08a';
    g.beginPath();
    g.arc(px + (j - 1) * r * 0.5, py, r * 0.32, 0, TAU);
    g.fill();
  }
}

const wedding = def(3.8, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#ffc8dc', '#ffe3d6', '#fff6ea']);
  additive(g, () => blob(g, S.main, gy - fh * 1.4, fh * 2.4, '255,240,200', 0.6));
  floor(g, L, S, '#8cc084', '#a8d69e');
  const aw = Math.min(fh * 0.62, S.sideW * 0.32);
  const ph = fh * 0.8;
  // aisle runner
  g.fillStyle = '#fffaf3';
  g.beginPath();
  g.moveTo(S.main - aw * 0.55, gy);
  g.lineTo(S.main + aw * 0.55, gy);
  g.lineTo(S.main + aw * 1.2, L.h);
  g.lineTo(S.main - aw * 1.2, L.h);
  g.fill();
  flowerArch(g, S.main, gy, aw, ph, fh);
  bellPair(f, S.main, gy - ph - aw + fh * 0.03, fh * 0.12);
  // couple
  const kiss = span(p, 0.42, 0.52) - span(p, 0.7, 0.8);
  const d = S.gap * lerp(0.4, 0.27, kiss);
  const mood: Mood = p > 0.5 ? 'love' : 'smile';
  fig(g, S.main - d, gy, fh * 0.95, { color: '#6a4458', dress: true, accent: '#ffffff', hat: 'veil', dir: 1, mood, ink: '#3b2433' });
  fig(g, S.main + d, gy, fh, { color: '#26283b', hat: 'tophat', dir: -1, mood });
  const hp = pop(p, 0.48, 0.6);
  if (hp > 0) {
    const R = fh * 0.13 * hp * (1 + 0.06 * Math.sin(t * 9));
    heart(g, S.main, gy - fh * 1.22 - hp * fh * 0.04, R, '#ff3d6e');
  }
  if (S.alt !== null) {
    const ax = S.alt;
    bellPair(f, ax, L.h * 0.16, fh * 0.22);
    const guests: [number, string, boolean][] = [
      [-1, '#3d5a80', false],
      [0, '#e07a5f', true],
      [1, '#81b29a', false],
    ];
    guests.forEach(([i, col, dress], n) => {
      const bob = Math.abs(Math.sin(t * 6 + n)) * fh * 0.03;
      bobFig(g, ax + i * S.gap * 0.95, gy, fh * (0.92 + n * 0.03), { color: col, dress, accent: '#f2cc8f', pose: 'cheer', phase: t + n, mood: 'laugh' }, bob, 0);
    });
  }
  confettiRain(f, S, 60, ['#ffffff', '#ffc2d1', '#ff8fab', '#ffe5a8', '#f7d6e0', '#e63962'], 'conf', 0.85, 50);
});

// ================================================================== 5. heartbreak

const CRACK: [number, number][] = [
  [0, -0.45],
  [0.17, -0.2],
  [-0.13, 0.06],
  [0.15, 0.32],
  [-0.1, 0.58],
  [0, 0.9],
];

function brokenHeart(g: G, x: number, y: number, R: number, crack: number, split: number): void {
  const col = '#e63946';
  const hl = () => {
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.ellipse(-R * 0.55, -R * 0.45, R * 0.16, R * 0.26, -0.6, 0, TAU);
    g.fill();
  };
  if (split <= 0) {
    g.save();
    g.translate(x, y);
    heart(g, 0, 0, R, col);
    hl();
    if (crack > 0) {
      g.strokeStyle = '#3a0a12';
      g.lineWidth = Math.max(2, R * 0.07);
      g.lineJoin = 'round';
      g.beginPath();
      const n = (CRACK.length - 1) * crack;
      g.moveTo(CRACK[0][0] * R, CRACK[0][1] * R);
      for (let i = 1; i <= Math.ceil(n); i++) {
        const fr = Math.min(1, n - (i - 1));
        const [ax, ay] = CRACK[i - 1];
        const [bx, by] = CRACK[i];
        g.lineTo(lerp(ax, bx, fr) * R, lerp(ay, by, fr) * R);
      }
      g.stroke();
    }
    g.restore();
    return;
  }
  for (const side of [-1, 1]) {
    g.save();
    g.translate(x + side * split * R * 0.4, y + split * R * 0.35);
    g.rotate(side * split * 0.4);
    g.beginPath();
    g.moveTo(side * R * 2, -R * 2);
    g.lineTo(0, -R * 2);
    for (const [cx, cy] of CRACK) g.lineTo(cx * R, cy * R);
    g.lineTo(0, R * 2);
    g.lineTo(side * R * 2, R * 2);
    g.closePath();
    g.clip();
    heart(g, 0, 0, R, col);
    if (side < 0) hl();
    g.strokeStyle = '#7a1020';
    g.lineWidth = Math.max(2, R * 0.05);
    g.beginPath();
    CRACK.forEach(([cx, cy], i) => (i ? g.lineTo(cx * R, cy * R) : g.moveTo(cx * R, cy * R)));
    g.stroke();
    g.restore();
  }
}

const heartbreak = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#0d1729', '#1b2c48', '#2c4262']);
  floor(g, L, S, '#121b2b', '#1d2a40');
  const hx = S.main;
  const hy = S.port ? L.h * 0.22 : gy - fh * 1.45;
  const R = fh * (S.port ? 0.38 : 0.42) * (p < 0.3 ? 1 + 0.06 * Math.sin(t * 10) : 1);
  const crack = span(p, 0.22, 0.36);
  const split = easeOut((p - 0.4) / 0.3) * (p > 0.4 ? 1 : 0);
  additive(g, () => blob(g, hx, hy, R * 2.6, '230,57,70', 0.35 * (1 - split * 0.6)));
  brokenHeart(g, hx, hy, R, crack, split);
  if (p > 0.4 && once(f, 'shards')) {
    const ps = particles(f.mem, 'shards');
    for (let i = 0; i < 9; i++)
      ps.push({ x: hx + f.rand.range(-0.1, 0.1) * R, y: hy + f.rand.range(-0.3, 0.8) * R, vx: f.rand.range(-90, 90), vy: f.rand.range(-120, 10), life: 0, max: 1.8, size: f.rand.range(4, 9) * S.k + 2, color: '#e63946', rot: f.rand() * TAU, vr: f.rand.range(-6, 6) });
  }
  const shards = particles(f.mem, 'shards');
  stepParticles(shards, f.dt, 500);
  g.fillStyle = '#e63946';
  for (const s of shards) {
    g.save();
    g.globalAlpha *= clamp(1 - s.life / s.max);
    g.translate(s.x, s.y);
    g.rotate(s.rot ?? 0);
    g.beginPath();
    g.moveTo(-s.size, s.size * 0.6);
    g.lineTo(0, -s.size);
    g.lineTo(s.size * 0.7, s.size * 0.5);
    g.fill();
    g.restore();
  }
  // lonely figure under a little rain cloud
  const fx = S.port ? S.main + S.gap * 0.15 : S.main + S.gap * 0.2;
  fig(g, fx, gy, fh * 0.92, { color: '#5b6b8c', pose: 'kneel', dir: -1, mood: 'sad', ink: '#e8eefc' });
  cloud(g, fx - fh * 0.1, gy - fh * 1.08 + Math.sin(t * 2) * 3, fh * 0.2, '#4a5670');
  if (S.alt !== null) {
    // the other one walks away
    const wx = S.alt - S.gap * 0.6 + span(p, 0.3, 1) * S.sideW * 0.35;
    fig(g, wx, gy, fh, { color: '#3b4a66', pose: p > 0.3 ? 'walk' : 'stand', phase: t, dir: 1, alpha: 1 - span(p, 0.55, 1) * 0.6 });
    cloud(g, S.alt + S.sideW * 0.1, L.h * 0.22, fh * 0.45, '#24324d');
  }
  cloud(g, S.port ? L.w * 0.25 : S.main - S.sideW * 0.25, S.port ? L.h * 0.07 : L.h * 0.12, fh * 0.45, '#24324d');
  rain(f, S, 130, 'rgba(160,190,230,0.45)');
});

// ================================================================== 6. friends

function mug(g: G, x: number, y: number, s: number, t: number): void {
  g.fillStyle = '#ffffff';
  rrect(g, x - s * 0.45, y - s, s * 0.9, s, s * 0.15);
  g.fill();
  g.fillStyle = '#e76f51';
  g.fillRect(x - s * 0.45, y - s * 0.62, s * 0.9, s * 0.22);
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(1.5, s * 0.14);
  g.beginPath();
  g.arc(x + s * 0.5, y - s * 0.5, s * 0.22, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(1, s * 0.09);
  g.beginPath();
  for (const dx of [-0.15, 0.18]) {
    const bx = x + dx * s;
    g.moveTo(bx, y - s * 1.1);
    for (let i = 1; i <= 4; i++) g.lineTo(bx + Math.sin(t * 5 + i + dx * 9) * s * 0.12, y - s * 1.1 - i * s * 0.18);
  }
  g.stroke();
}

const friends = def(2.8, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#7cc0f5', '#b5defb', '#ffe8c2']);
  additive(g, () => blob(g, S.port ? L.w * 0.15 : L.w * 0.1, L.h * 0.1, fh * 1.4, '255,240,190', 0.7));
  skyline(g, L, gy, era, 'rgba(150,182,212,0.75)', 41);
  floor(g, L, S, '#78c25e', '#95d47c');
  if (S.port) {
    tree(g, L.w * 0.06, gy, fh * 1.3, '#7a5236', '#4fa34a');
    tree(g, L.w * 0.95, gy, fh * 1.1, '#7a5236', '#5cb356');
  } else {
    tree(g, S.main - S.sideW * 0.42, gy, fh * 1.35, '#7a5236', '#4fa34a');
    if (S.alt !== null) tree(g, S.alt + S.sideW * 0.42, gy, fh * 1.2, '#7a5236', '#5cb356');
  }
  const laughs = era === 'modern' || era === 'future' ? ['HA HA!', 'LOL', 'HAHAHA', 'HEHE'] : ['HA HA!', 'HO HO!', 'HAHAHA', 'HEHE'];
  const ts = fh * 0.11;
  const bobOf = (i: number) => Math.abs(Math.sin(t * 10 + i * 1.3)) * fh * 0.03;
  const rockOf = (i: number) => Math.sin(t * 10 + i * 1.3) * 0.05;
  const by = gy - fh * 1.28;
  const clampX = (x: number) => clamp(x, L.w * 0.16, L.w * 0.84);
  if (S.port) {
    const xs = [S.main - gap * 1.05, S.main, S.main + gap * 1.05];
    bobFig(g, xs[0], gy, fh, { color: '#e76f51', pose: 'wave', phase: t, dir: 1, mood: 'laugh' }, bobOf(0), rockOf(0));
    bobFig(g, xs[2], gy, fh * 0.97, { color: '#6d597a', pose: 'cheer', phase: t, dir: -1, mood: 'laugh' }, bobOf(2), rockOf(2));
    bobFig(g, xs[1], gy, fh * 0.93, { color: '#2a9d8f', dress: true, accent: '#ffd166', dir: 1, mood: 'laugh' }, bobOf(1), rockOf(1));
    mug(g, xs[1] + fh * 0.93 * 0.07, gy - bobOf(1) - fh * 0.38, fh * 0.08, t);
    timedBubble(f, clampX(xs[0]), by, laughs[0], ts, 0.25, 1.3, 0.3);
    timedBubble(f, clampX(xs[2]), by - fh * 0.1, laughs[1], ts, 0.8, 1.9, -0.3);
    timedBubble(f, xs[1], by - fh * 0.22, laughs[2], ts, 1.35, 2.3, 0);
  } else {
    const a = S.main - gap * 0.55;
    const b = S.main + gap * 0.55;
    bobFig(g, a, gy, fh, { color: '#e76f51', pose: 'wave', phase: t, dir: 1, mood: 'laugh' }, bobOf(0), rockOf(0));
    bobFig(g, b, gy, fh * 0.94, { color: '#2a9d8f', dress: true, accent: '#ffd166', dir: -1, mood: 'laugh' }, bobOf(1), rockOf(1));
    mug(g, b - fh * 0.94 * 0.07, gy - bobOf(1) - fh * 0.38, fh * 0.08, t);
    timedBubble(f, a - gap * 0.2, by, laughs[0], ts, 0.25, 1.3, 0.3);
    timedBubble(f, b + gap * 0.2, by - fh * 0.08, laughs[1], ts, 0.95, 2.1, -0.3);
    if (S.alt !== null) {
      const c = S.alt - gap * 0.55;
      const d = S.alt + gap * 0.55;
      bobFig(g, c, gy, fh * 0.97, { color: '#6d597a', pose: 'cheer', phase: t, dir: 1, mood: 'laugh' }, bobOf(2), rockOf(2));
      bobFig(g, d, gy, fh, { color: '#3a86ff', pose: 'wave', phase: t + 0.5, dir: -1, mood: 'laugh' }, bobOf(3), rockOf(3));
      timedBubble(f, S.alt, by - fh * 0.05, laughs[2], ts, 0.6, 1.8, 0);
      timedBubble(f, d + gap * 0.1, by, laughs[3], ts, 1.75, 2.45, -0.2);
    }
  }
  const groups = S.alt !== null ? [S.main, S.alt] : [S.main];
  floaters(f, S, {
    kinds: ['sparkle', 'heart', 'sparkle'],
    colors: ['#ffd166', '#ffffff', '#ff8fab'],
    size: [5, 10],
    rate: 7,
    x: () => f.rand.pick(groups) + f.rand.range(-1, 1) * gap * 1.4,
    y: () => gy - fh * f.rand.range(0.9, 1.2),
    speed: [30, 60],
    life: [0.8, 1.4],
    max: 20,
  });
});

// ================================================================== 7. party

function discoBall(g: G, x: number, y: number, r: number, t: number): void {
  g.strokeStyle = 'rgba(200,200,220,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, y - r);
  g.stroke();
  additive(g, () => blob(g, x, y, r * 3, '200,170,255', 0.5));
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.clip();
  g.fillStyle = '#6c7088';
  g.fillRect(x - r, y - r, r * 2, r * 2);
  const n = 7;
  const cell = (2 * r) / n;
  const shift = fract(t * 0.8) * cell;
  const frame = Math.floor(t * 6);
  for (let i = -1; i <= n; i++)
    for (let j = 0; j < n; j++) {
      const v = hash(i * 31 + j * 7 + frame * 13 + Math.floor(t * 0.8) * 5);
      g.fillStyle = v > 0.9 ? '#ffffff' : v > 0.8 ? `hsl(${(v * 3600) % 360},90%,70%)` : `hsl(240,10%,${45 + v * 40}%)`;
      g.fillRect(x - r + i * cell + shift + 1, y - r + j * cell + 1, cell - 2, cell - 2);
    }
  const sh = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  sh.addColorStop(0, 'rgba(255,255,255,0.35)');
  sh.addColorStop(1, 'rgba(10,0,40,0.6)');
  g.fillStyle = sh;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
  sparkle(g, x - r * 0.4, y - r * 0.4, r * 0.35 * (0.6 + 0.4 * Math.sin(t * 9)), '#ffffff');
}

function discoBeams(g: G, x: number, y: number, len: number, t: number, colors: readonly string[]): void {
  additive(g, () => {
    const a0 = g.globalAlpha;
    for (let i = 0; i < 8; i++) {
      const a = t * 0.9 + (i * TAU) / 8;
      const w = 0.06;
      const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      gr.addColorStop(0, colors[i % colors.length]);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a0 * 0.35;
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
      g.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
      g.fill();
    }
    g.globalAlpha = a0;
  });
}

function danceFloor(g: G, L: Layout, S: Stage, t: number, sat: number): void {
  const ts = S.fh * 0.22;
  const beat = Math.floor(t * 4);
  for (let row = 0; row < 3; row++)
    for (let c = 0; c * ts < L.w; c++) {
      const h = (c * 47 + row * 83 + beat * 67) % 360;
      const on = (c + row + beat) % 3 === 0;
      g.fillStyle = `hsla(${h},${sat}%,60%,${on ? 0.7 : 0.25})`;
      g.fillRect(c * ts + 2, S.gy + row * ts * 0.55 + 2, ts - 4, ts * 0.55 - 4);
    }
}

function stringLights(g: G, L: Layout, y0: number, sag: number, t: number): void {
  const spans = Math.max(2, Math.round(L.w / 380));
  const sw = L.w / spans;
  g.strokeStyle = 'rgba(20,12,10,0.9)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let s = 0; s < spans; s++) {
    g.moveTo(s * sw, y0);
    g.quadraticCurveTo(s * sw + sw / 2, y0 + sag * 2, (s + 1) * sw, y0);
  }
  g.stroke();
  const cols = ['255,214,102', '255,160,90', '255,240,200', '255,120,120'];
  additive(g, () => {
    for (let s = 0; s < spans; s++)
      for (let i = 1; i < 12; i++) {
        const u = i / 12;
        const x = s * sw + u * sw;
        const y = y0 + sag * 4 * u * (1 - u) + 6;
        const tw = 0.6 + 0.4 * Math.sin(t * 6 + i * 1.7 + s);
        const c = cols[(i + s) % cols.length];
        blob(g, x, y, 16, c, 0.6 * tw);
        blob(g, x, y, 4, '255,255,255', 0.9);
      }
  });
}

function gramophone(g: G, x: number, y: number, s: number): void {
  g.fillStyle = '#6b3e26';
  g.fillRect(x - s * 0.35, y - s * 0.32, s * 0.7, s * 0.32);
  g.fillStyle = '#4a2a18';
  g.fillRect(x - s * 0.35, y - s * 0.08, s * 0.7, s * 0.08);
  g.fillStyle = '#111';
  g.beginPath();
  g.ellipse(x, y - s * 0.34, s * 0.3, s * 0.05, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#c9a227';
  g.lineWidth = Math.max(2, s * 0.04);
  g.beginPath();
  g.moveTo(x + s * 0.22, y - s * 0.34);
  g.quadraticCurveTo(x + s * 0.3, y - s * 0.6, x + s * 0.08, y - s * 0.72);
  g.stroke();
  g.fillStyle = '#d4a017';
  g.beginPath();
  g.moveTo(x + s * 0.1, y - s * 0.7);
  g.lineTo(x + s * 0.04, y - s * 0.78);
  g.lineTo(x - s * 0.5, y - s * 1.25);
  g.lineTo(x - s * 0.18, y - s * 1.38);
  g.closePath();
  g.fill();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  g.ellipse(x - s * 0.34, y - s * 1.32, s * 0.22, s * 0.1, -0.65, 0, TAU);
  g.fill();
  g.fillStyle = '#7a5a10';
  g.beginPath();
  g.ellipse(x - s * 0.34, y - s * 1.32, s * 0.14, s * 0.05, -0.65, 0, TAU);
  g.fill();
}

function feastTable(g: G, x: number, y: number, w: number, t: number): void {
  const h = w * 0.28;
  g.fillStyle = '#5a3418';
  g.fillRect(x - w * 0.45, y - h, w * 0.05, h);
  g.fillRect(x + w * 0.4, y - h, w * 0.05, h);
  g.fillStyle = '#7a4a24';
  g.fillRect(x - w / 2, y - h - w * 0.04, w, w * 0.05);
  g.fillStyle = '#c8b28a';
  g.fillRect(x - w / 2, y - h - w * 0.04, w, w * 0.015);
  // roast
  const top = y - h - w * 0.04;
  g.fillStyle = '#e8e2d4';
  g.beginPath();
  g.ellipse(x, top, w * 0.14, w * 0.025, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#9c4a1a';
  g.beginPath();
  g.ellipse(x, top - w * 0.04, w * 0.1, w * 0.055, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f3e6c4';
  g.fillRect(x + w * 0.08, top - w * 0.06, w * 0.06, w * 0.015);
  // goblets and bread
  for (const dx of [-0.36, -0.22, 0.24, 0.38]) {
    const gx = x + dx * w;
    g.fillStyle = '#e0b84a';
    g.beginPath();
    g.moveTo(gx - w * 0.025, top - w * 0.07);
    g.lineTo(gx + w * 0.025, top - w * 0.07);
    g.lineTo(gx + w * 0.008, top - w * 0.03);
    g.lineTo(gx - w * 0.008, top - w * 0.03);
    g.fill();
    g.fillRect(gx - w * 0.004, top - w * 0.03, w * 0.008, w * 0.03);
  }
  g.fillStyle = '#d9a05b';
  g.beginPath();
  g.ellipse(x - w * 0.12, top - w * 0.02, w * 0.045, w * 0.022, 0, Math.PI, TAU);
  g.ellipse(x + w * 0.14, top - w * 0.02, w * 0.04, w * 0.02, 0, Math.PI, TAU);
  g.fill();
  candle(g, x - w * 0.29, top, w * 0.06, t, 4);
  candle(g, x + w * 0.31, top, w * 0.06, t, 5);
}

function lute(g: G, x: number, y: number, h: number, dir: 1 | -1, t: number): void {
  g.save();
  g.translate(x + dir * h * 0.04, y - h * 0.47);
  g.rotate(dir * -0.65 + Math.sin(t * 8) * 0.04);
  g.strokeStyle = '#5a3418';
  g.lineWidth = Math.max(2, h * 0.025);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(dir * h * 0.36, 0);
  g.stroke();
  g.fillStyle = '#c0843c';
  g.beginPath();
  g.ellipse(0, 0, h * 0.11, h * 0.085, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#3d220f';
  g.beginPath();
  g.arc(dir * h * 0.02, 0, h * 0.025, 0, TAU);
  g.fill();
  g.restore();
}

function dancer(f: SceneFrame, S: Stage, x: number, i: number, color: string, h: number, extra: Partial<Fig> = {}): void {
  const { t } = f;
  const beat = Math.floor(t * 2.6 + i * 0.37);
  const poses = ['cheer', 'wave', 'walk', 'cheer', 'stand'] as const;
  const pose = poses[(beat + i) % poses.length];
  const bob = Math.abs(Math.sin(t * Math.PI * 2.6 + i)) * h * 0.05;
  bobFig(f.g, x + Math.sin(t * 3 + i) * h * 0.07, S.gy, h, { color, pose, phase: t + i, dir: i % 2 ? -1 : 1, mood: 'laugh', ...extra }, bob, Math.sin(t * 5.2 + i) * 0.09);
}

const party = def(3.4, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy, gap } = S;
  const pre = era === 'ancient' || era === 'medieval' || era === 'early';
  const groups = S.alt !== null ? [S.main, S.alt] : [S.main];
  if (pre) {
    // torch-lit feast with a lute player
    sky(g, L, ['#160b08', '#341a10', '#5e2d14']);
    skyline(g, L, gy, era, 'rgba(25,12,8,0.9)', 17);
    floor(g, L, S, '#2a160c', '#3a2012');
    const torches = S.port ? [L.w * 0.08, L.w * 0.92] : [S.main - S.sideW * 0.44, S.main + S.sideW * 0.44, ...(S.alt !== null ? [S.alt - S.sideW * 0.44, S.alt + S.sideW * 0.44] : [])];
    torches.forEach((x, i) => torch(g, x, gy, fh * 1.05, t, i * 2.3));
    if (S.alt !== null) {
      feastTable(g, S.alt - fh * 0.15, gy, Math.min(S.sideW * 0.62, fh * 1.6), t);
      const lx = S.alt + S.sideW * 0.3;
      fig(g, lx, gy, fh, { color: '#3d6b4f', accent: '#e9c46a', dir: -1, mood: 'smile', hat: 'cap' });
      lute(g, lx, gy, fh, -1, t);
    }
    const cols = ['#c0392b', '#2e86ab', '#e9c46a', '#8e44ad'];
    const n = S.port ? 3 : 3;
    for (let i = 0; i < n; i++) dancer(f, S, S.main + (i - (n - 1) / 2) * gap * 1.05, i, cols[i], fh * (0.94 + (i % 2) * 0.06), { dress: i % 2 === 1, accent: '#f4e3c1' });
    floaters(f, S, { kinds: ['note'], colors: ['#ffd166', '#ffe8b0', '#ffb703'], size: [8, 13], rate: 7, x: () => f.rand.pick(groups) + f.rand.range(-1, 1) * gap * 1.5, speed: [50, 90] });
    const sparks = particles(f.mem, 'sparks');
    emit(f, 'sparks', 18, () => {
      const x = f.rand.pick(torches);
      if (sparks.length < 60) sparks.push({ x, y: gy - fh * 1.15, vx: f.rand.range(-20, 20), vy: -f.rand.range(60, 140), life: 0, max: 1.2, size: f.rand.range(1.2, 2.6), color: '#ffb347' });
    });
    stepParticles(sparks, f.dt);
    additive(g, () => drawDotsLite(g, sparks));
    return;
  }
  const future = era === 'future';
  const beamCols = future ? ['#00f5d4', '#f15bb5', '#9b5de5', '#00bbf9'] : ['#ff5d73', '#ffd166', '#4cc9f0', '#b388ff', '#06d6a0'];
  sky(g, L, future ? ['#020c1b', '#0b1e3a', '#1b0b3a'] : ['#12002b', '#2a0845', '#45106b']);
  if (era === 'industrial') {
    // jazz-age dance: string lights and a gramophone
    skyline(g, L, gy, era, 'rgba(10,4,20,0.9)', 17, 'rgba(255,214,120,0.35)');
    floor(g, L, S, '#2b1a14', '#4a2c1a');
    stringLights(g, L, L.h * 0.06, L.h * 0.07, t);
    if (S.alt !== null) {
      gramophone(g, S.alt + S.sideW * 0.18, gy, fh * 0.8);
      dancer(f, S, S.alt - gap * 0.7, 3, '#f15bb5', fh * 0.95, { dress: true, accent: '#ffd166' });
      dancer(f, S, S.alt - gap * 0.05, 4, '#4cc9f0', fh);
    }
  } else {
    floor(g, L, S, '#0c0418');
    danceFloor(g, L, S, t, future ? 100 : 85);
    const bx = S.main;
    const by = S.port ? L.h * 0.1 : L.h * 0.14;
    discoBeams(g, bx, by, Math.hypot(L.w, L.h), t, beamCols);
    if (S.alt !== null) {
      discoBeams(g, S.alt, L.h * 0.1, L.h, -t * 1.2, beamCols);
      for (const sx of [-1, 1]) {
        const spx = S.alt + sx * S.sideW * 0.38;
        const pulse = 1 + 0.08 * Math.abs(Math.sin(t * Math.PI * 2.6));
        g.fillStyle = '#1a1028';
        g.fillRect(spx - fh * 0.15, gy - fh * 0.75, fh * 0.3, fh * 0.75);
        g.fillStyle = '#3a2a55';
        for (const [cy, r] of [
          [0.55, 0.1],
          [0.22, 0.065],
        ] as const) {
          g.beginPath();
          g.arc(spx, gy - fh * cy, fh * r * pulse, 0, TAU);
          g.fill();
        }
      }
      dancer(f, S, S.alt - gap * 0.55, 3, future ? '#00f5d4' : '#ffd166', fh * 0.97);
      dancer(f, S, S.alt + gap * 0.55, 4, future ? '#f15bb5' : '#4cc9f0', fh, { dress: true, accent: '#ff5d73' });
    }
    discoBall(g, bx, by, fh * 0.17, t);
  }
  const cols = future ? ['#00f5d4', '#f15bb5', '#9b5de5'] : ['#ff5d73', '#06d6a0', '#ffd166'];
  for (let i = 0; i < 3; i++) dancer(f, S, S.main + (i - 1) * gap * 1.05, i, cols[i], fh * (0.94 + (i % 2) * 0.06), { dress: i === 1, accent: '#ffffff' });
  if (era === 'industrial') floaters(f, S, { kinds: ['note'], colors: ['#ffd166', '#ffe8b0'], size: [8, 13], rate: 6, x: () => f.rand.pick(groups) + f.rand.range(-1, 1) * gap * 1.5, speed: [50, 90] });
  else confettiRain(f, S, 45, future ? beamCols : CONFETTI_COLORS, 'conf', 0.85, 30);
});

/** Small additive dots (no per-particle save/restore). */
function drawDotsLite(g: G, ps: { x: number; y: number; size: number; color: string; life: number; max: number }[]): void {
  const a = g.globalAlpha;
  for (const p of ps) {
    g.globalAlpha = a * clamp(1 - p.life / p.max);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, TAU);
    g.fill();
  }
  g.globalAlpha = a;
}

// ================================================================== 8. family

const family = def(3.4, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#3d2c5e', '#a8577e', '#f29e6d', '#ffd8a8']);
  additive(g, () => blob(g, S.main, gy - fh * 0.3, fh * 2, '255,200,140', 0.5));
  skyline(g, L, gy, era, 'rgba(90,58,94,0.55)', 13);
  floor(g, L, S, '#3f5a36', '#557a48');
  const hx = S.alt ?? S.main;
  const hw = S.port ? Math.min(L.w * 0.62, fh * 1.6) : Math.min(S.sideW * 0.7, fh * 1.7);
  const chim = houseShape(g, hx, gy - (S.port ? fh * 0.08 : 0), hw, era, 0.8 + 0.2 * Math.sin(t * 3));
  if (era !== 'ancient' && era !== 'future') smoke(f, chim.cx, chim.cy, Math.max(0.7, S.k));
  if (S.alt !== null) tree(g, S.alt - S.sideW * 0.42, gy, fh * 1.2, '#4a3426', '#2f5a3a');
  // the family holding hands
  const members: [number, number, Fig][] = [
    [-1.5, 1, { color: '#355070', accent: '#eaac8b' }],
    [-0.5, 0.6, { color: '#e56b6f', dress: true, accent: '#ffd166' }],
    [0.5, 0.95, { color: '#6d597a', dress: true, accent: '#b56576' }],
    [1.5, 0.48, { color: '#2a9d8f' }],
  ];
  const sp = gap * 0.66;
  const pos = members.map(([i, s]) => [S.main + i * sp, fh * s] as const);
  members.forEach(([, , o], i) => {
    const [x, h] = pos[i];
    const hop = h < fh * 0.7 ? Math.max(0, Math.sin(t * 7 + i)) * fh * 0.04 : 0;
    fig(g, x, gy - hop, h, { ...o, dir: i < 2 ? 1 : -1, mood: 'smile' });
  });
  for (let i = 0; i < pos.length - 1; i++) holdHands(g, pos[i][0], pos[i][1], pos[i + 1][0], pos[i + 1][1], gy, members[i][2].color ?? '#333');
  const hp = pop(p, 0.3, 0.45);
  if (hp > 0) {
    const R = fh * 0.17 * hp * (1 + 0.06 * Math.sin(t * 8));
    const y = gy - fh * 1.3;
    additive(g, () => blob(g, S.main, y, R * 3, '255,120,140', 0.5));
    heart(g, S.main, y, R, '#ff5d73');
  }
  floaters(f, S, { kinds: ['dot'], colors: ['#fff3b0', '#ffd166'], size: [4, 7], rate: 10, speed: [15, 40], life: [1.5, 2.5], y: () => gy - f.rand() * fh * 1.2, max: 40 });
});

// ================================================================== 9. graduation

function campus(g: G, x: number, y: number, w: number, color: string, shade: string): void {
  const h = w * 0.5;
  g.fillStyle = shade;
  g.fillRect(x - w * 0.58, y - w * 0.04, w * 1.16, w * 0.04);
  g.fillRect(x - w * 0.54, y - w * 0.075, w * 1.08, w * 0.04);
  g.fillStyle = color;
  g.fillRect(x - w / 2, y - h, w, h - w * 0.07);
  g.beginPath();
  g.moveTo(x - w * 0.56, y - h);
  g.lineTo(x, y - h - w * 0.2);
  g.lineTo(x + w * 0.56, y - h);
  g.fill();
  g.fillStyle = shade;
  g.fillRect(x - w * 0.56, y - h, w * 1.12, w * 0.035);
  g.beginPath();
  g.moveTo(x - w * 0.4, y - h - w * 0.02);
  g.lineTo(x, y - h - w * 0.15);
  g.lineTo(x + w * 0.4, y - h - w * 0.02);
  g.fill();
  const cols = 6;
  const cw = w / (cols * 2 - 1);
  for (let i = 0; i < cols - 1; i++) g.fillRect(x - w / 2 + cw * (i * 2 + 1), y - h + w * 0.06, cw, h - w * 0.13);
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y - h - w * 0.07, w * 0.035, 0, TAU);
  g.fill();
}

function mortar(g: G, x: number, y: number, s: number, rot: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#16161f';
  g.fillRect(-s * 0.42, 0, s * 0.84, s * 0.36);
  g.beginPath();
  g.moveTo(-s, 0);
  g.lineTo(0, -s * 0.36);
  g.lineTo(s, 0);
  g.lineTo(0, s * 0.36);
  g.closePath();
  g.fill();
  g.strokeStyle = '#f2c94c';
  g.lineWidth = Math.max(1.5, s * 0.09);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(s * 0.72, s * 0.12);
  g.lineTo(s * 0.74 + Math.sin(t * 9) * s * 0.1, s * 0.62);
  g.stroke();
  g.restore();
}

const graduation = def(3.4, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#4facfe', '#8fd3fe', '#d9f1ff']);
  cloud(g, visX(L, S, 0.12), L.h * 0.12, fh * 0.35, 'rgba(255,255,255,0.85)');
  cloud(g, visX(L, S, 0.85), L.h * 0.2, fh * 0.28, 'rgba(255,255,255,0.8)');
  const cw = Math.min(S.sideW * 0.86, fh * 2.2);
  campus(g, S.main, gy, cw, '#efe8d8', '#cfc4ad');
  if (S.alt !== null) campus(g, S.alt, gy, cw * 0.8, '#e9e1cf', '#cdbfa5');
  floor(g, L, S, '#7bc96f', '#98d98c');
  const T = 0.3;
  const thrown = p >= T;
  const gowns: [number, string][] = S.alt !== null
    ? [
        [S.main - gap * 0.9, '#e76f51'],
        [S.main, '#3d5a80'],
        [S.main + gap * 0.9, '#9c6644'],
        [S.alt - gap * 0.5, '#2a9d8f'],
        [S.alt + gap * 0.5, '#b5179e'],
      ]
    : [
        [S.main - gap * 0.95, '#e76f51'],
        [S.main, '#3d5a80'],
        [S.main + gap * 0.95, '#9c6644'],
      ];
  const caps = particles(f.mem, 'caps');
  if (thrown && once(f, 'throw')) {
    gowns.forEach(([x], i) => {
      const hd = headOf(x, gy, fh);
      caps.push({ x, y: hd.y - hd.r * 1.1, vx: f.rand.range(-70, 70) * S.k, vy: -f.rand.range(720, 860) * S.k, life: 0, max: 2.6, size: fh * 0.1, color: '#000', rot: 0, vr: f.rand.range(-5, 5) + (i % 2 ? 3 : -3) });
    });
    for (const x of gowns.map(([gx]) => gx)) confettiBurst(f, x, gy - fh * 1.1, 14, 520 * S.k, CONFETTI_COLORS);
  }
  gowns.forEach(([x, col], i) => {
    const jump = thrown ? Math.max(0, Math.sin((p - T) * 14 + i)) * fh * 0.04 * (1 - span(p, 0.6, 0.9)) : 0;
    fig(g, x, gy - jump, fh * (0.95 + (i % 2) * 0.05), { color: col, dress: true, accent: '#1b1b3a', hat: thrown ? 'none' : 'grad', pose: thrown ? 'cheer' : 'stand', phase: t + i, mood: thrown ? 'laugh' : 'smile' });
    if (!thrown && i === 1) {
      // diploma scroll
      g.fillStyle = '#fffaf0';
      g.fillRect(x + fh * 0.04, gy - fh * 0.47, fh * 0.16, fh * 0.05);
      g.fillStyle = '#e63946';
      g.fillRect(x + fh * 0.11, gy - fh * 0.47, fh * 0.02, fh * 0.05);
    }
  });
  stepParticles(caps, f.dt, 1000 * S.k);
  for (const c of caps) mortar(g, c.x, c.y, c.size, c.rot ?? 0, t);
  const conf = particles(f.mem, 'conf');
  stepParticles(conf, f.dt, 260, 1.2);
  drawConfetti(g, conf);
  if (thrown) floaters(f, S, { key: 'stars', kinds: ['star', 'sparkle'], colors: ['#ffd166', '#ffffff'], size: [6, 11], rate: 8, y: () => gy - fh * f.rand.range(1.1, 2.2), speed: [10, 30], life: [0.8, 1.4], max: 20 });
});

// ================================================================== 10. promotion

function zigzagArrow(g: G, pts: readonly (readonly [number, number])[], prog: number, lw: number, color: string, glowCol: string): void {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let left = total * clamp(prog);
  if (left <= 0) return;
  const path: [number, number][] = [[pts[0][0], pts[0][1]]];
  let ang = 0;
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const fr = Math.min(1, left / lens[i - 1]);
    path.push([lerp(ax, bx, fr), lerp(ay, by, fr)]);
    ang = Math.atan2(by - ay, bx - ax);
    left -= lens[i - 1];
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [w, c] of [
    [lw * 2.6, glowCol],
    [lw, color],
  ] as const) {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  const [tx, ty] = path[path.length - 1];
  g.save();
  g.translate(tx, ty);
  g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(lw * 2.4, 0);
  g.lineTo(-lw * 1.4, -lw * 2);
  g.lineTo(-lw * 1.4, lw * 2);
  g.closePath();
  g.fill();
  g.restore();
}

const promotion = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#0f2a4f', '#1d4e89', '#5fa8d3']);
  skyline(g, L, gy, era, '#0b2545', 29, 'rgba(255,230,150,0.55)');
  floor(g, L, S, '#13243d', '#1d3557');
  // bar chart where the arrow starts
  const bx0 = S.port ? L.w * 0.08 : S.main - S.sideW * 0.3;
  const bw = S.port ? L.w * 0.07 : S.sideW * 0.1;
  const heights = [0.28, 0.45, 0.66, 0.92];
  heights.forEach((h, i) => {
    const grow = easeOut((p - 0.08 - i * 0.07) / 0.2);
    const bh = fh * 1.15 * h * clamp(grow);
    g.fillStyle = i === 3 ? '#ffd166' : '#3ddc97';
    g.fillRect(bx0 + i * bw * 1.45, gy - bh, bw, bh);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(bx0 + i * bw * 1.45, gy - bh, bw * 0.25, bh);
  });
  // rising arrow across the sky
  const x0 = bx0 + bw * 0.5;
  const y0 = gy - fh * 0.5;
  const x1 = S.port ? L.w * 0.92 : (S.alt ?? L.w * 0.8) + S.sideW * 0.3;
  const y1 = S.port ? L.h * 0.07 : L.h * 0.12;
  const pts: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + (i % 2 && i < n ? fh * 0.22 : 0)]);
  }
  zigzagArrow(g, pts, span(p, 0.12, 0.62), fh * 0.065, '#ffd166', 'rgba(255,209,102,0.25)');
  // the promoted one
  const px = S.alt ?? S.main + gap * 1.05;
  const jump = bump(p, 0.58, 0.78) * fh * 0.18;
  const happy = p > 0.55;
  fig(g, px, gy - jump, fh, { color: '#264653', accent: '#e63946', pose: happy ? 'cheer' : 'stand', phase: t, mood: happy ? 'laugh' : 'smile', dir: -1 });
  if (!happy) {
    g.fillStyle = '#6b4226';
    g.fillRect(px - fh * 0.2, gy - fh * 0.38, fh * 0.16, fh * 0.12);
  }
  if (p > 0.6 && once(f, 'burst')) confettiBurst(f, px, gy - fh * 1.2, 40, 600 * S.k, CONFETTI_COLORS);
  const conf = particles(f.mem, 'conf');
  stepParticles(conf, f.dt, 300, 1);
  drawConfetti(g, conf);
  if (happy) floaters(f, S, { kinds: ['star', 'sparkle'], colors: ['#ffd166', '#ffffff'], size: [6, 12], rate: 10, x: () => px + f.rand.range(-1, 1) * fh * 0.6, y: () => gy - fh * f.rand.range(0.6, 1.3), speed: [20, 50], life: [0.6, 1.2] });
});

// ================================================================== 11. fired

function cardboardBox(g: G, x: number, y: number, s: number): void {
  // plant sticking out
  g.strokeStyle = '#3a7d44';
  g.lineWidth = Math.max(1.5, s * 0.05);
  g.beginPath();
  g.moveTo(x + s * 0.15, y - s * 0.3);
  g.lineTo(x + s * 0.2, y - s * 0.75);
  g.stroke();
  g.fillStyle = '#4caf50';
  for (const [dx, dy, a] of [
    [0.08, -0.62, -0.7],
    [0.3, -0.7, 0.6],
    [0.18, -0.85, -0.1],
  ] as const) {
    g.beginPath();
    g.ellipse(x + dx * s, y + dy * s, s * 0.13, s * 0.06, a, 0, TAU);
    g.fill();
  }
  // a picture frame
  g.fillStyle = '#8d6e63';
  g.fillRect(x - s * 0.32, y - s * 0.52, s * 0.22, s * 0.28);
  g.fillStyle = '#bde0fe';
  g.fillRect(x - s * 0.29, y - s * 0.49, s * 0.16, s * 0.2);
  g.fillStyle = '#c79a5b';
  g.fillRect(x - s / 2, y - s * 0.32, s, s * 0.62);
  g.fillStyle = '#a47a40';
  g.fillRect(x - s / 2, y - s * 0.32, s, s * 0.08);
  g.beginPath();
  g.moveTo(x - s / 2, y - s * 0.32);
  g.lineTo(x - s * 0.62, y - s * 0.46);
  g.lineTo(x - s * 0.42, y - s * 0.46);
  g.lineTo(x - s * 0.3, y - s * 0.32);
  g.fill();
}

const fired = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#2b303b', '#474f60', '#6b7385']);
  skyline(g, L, gy, era, 'rgba(40,45,58,0.85)', 37, 'rgba(255,240,180,0.18)');
  floor(g, L, S, '#2a2e36', '#3a404b');
  // the office they leave
  const bw = fh * 0.9;
  const bx = S.port ? L.w * 0.8 : S.main + S.sideW * 0.3;
  const top = S.port ? L.h * 0.08 : L.h * 0.12;
  g.fillStyle = '#3c4454';
  g.fillRect(bx - bw / 2, top, bw, gy - top);
  const cols = 4;
  const rows = Math.floor((gy - top - fh * 0.4) / (fh * 0.16));
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      g.fillStyle = hash(c * 7 + r * 13) > 0.45 ? 'rgba(255,230,160,0.75)' : 'rgba(20,24,32,0.8)';
      g.fillRect(bx - bw / 2 + bw * 0.1 + c * bw * 0.215, top + fh * 0.08 + r * fh * 0.16, bw * 0.13, fh * 0.09);
    }
  const doorX = bx - bw * 0.2;
  g.fillStyle = '#ffe6a6';
  g.fillRect(doorX - fh * 0.1, gy - fh * 0.32, fh * 0.2, fh * 0.32);
  // walk of shame in the rain
  const from = doorX;
  const to = S.port ? L.w * 0.18 : S.main - S.sideW * 0.32;
  const wx = lerp(from, to, span(p, 0.06, 0.95));
  fig(g, wx, gy, fh, { color: '#556070', accent: '#8d99ae', pose: 'walk', phase: t * 0.8, dir: -1, mood: 'sad', ink: '#e9eef7' });
  cardboardBox(g, wx - fh * 0.08, gy - fh * 0.42, fh * 0.32);
  const cy = gy - fh * 1.25 + Math.sin(t * 2) * 3;
  cloud(g, wx, cy, fh * 0.28, '#3a4252');
  g.strokeStyle = 'rgba(170,190,220,0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const rx = wx + (i / 8 - 0.5) * fh * 0.5;
    const ry = cy + fh * 0.12 + fract(t * 2.2 + hash(i) * 3) * fh * 0.5;
    g.moveTo(rx, ry);
    g.lineTo(rx - 2, ry + fh * 0.06);
  }
  g.stroke();
  // papers blowing around
  const papers = particles(f.mem, 'papers');
  if (once(f, 'papers'))
    for (let i = 0; i < 7; i++) papers.push({ x: visX(L, S, f.rand()), y: f.rand.range(0.1, 0.6) * gy, vx: -f.rand.range(40, 90), vy: f.rand.range(10, 40), life: 0, max: 10, size: fh * 0.07, color: '#f8f9fa', rot: f.rand() * TAU, vr: f.rand.range(-3, 3) });
  stepParticles(papers, f.dt);
  for (const s of papers) {
    g.save();
    g.translate(s.x, s.y + Math.sin(s.life * 3 + s.size) * 10);
    g.rotate(s.rot ?? 0);
    g.scale(1, 0.6 + 0.4 * Math.sin(s.life * 4));
    g.fillStyle = s.color;
    g.fillRect(-s.size * 0.4, -s.size * 0.5, s.size * 0.8, s.size);
    g.fillStyle = '#adb5bd';
    for (let l = 0; l < 3; l++) g.fillRect(-s.size * 0.3, -s.size * 0.32 + l * s.size * 0.22, s.size * 0.6, Math.max(1, s.size * 0.05));
    g.restore();
  }
  if (S.alt !== null) {
    // a lone street lamp
    const lx = S.alt;
    g.strokeStyle = '#1f232b';
    g.lineWidth = Math.max(3, fh * 0.03);
    g.beginPath();
    g.moveTo(lx, gy);
    g.lineTo(lx, gy - fh * 1.5);
    g.quadraticCurveTo(lx, gy - fh * 1.65, lx + fh * 0.15, gy - fh * 1.62);
    g.stroke();
    additive(g, () => {
      blob(g, lx + fh * 0.15, gy - fh * 1.58, fh * 0.6, '255,220,150', 0.6);
      const gr = g.createLinearGradient(0, gy - fh * 1.55, 0, gy);
      gr.addColorStop(0, 'rgba(255,220,150,0.25)');
      gr.addColorStop(1, 'rgba(255,220,150,0.05)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(lx + fh * 0.1, gy - fh * 1.56);
      g.lineTo(lx + fh * 0.2, gy - fh * 1.56);
      g.lineTo(lx + fh * 0.55, gy);
      g.lineTo(lx - fh * 0.25, gy);
      g.fill();
    });
    g.fillStyle = 'rgba(255,220,150,0.18)';
    g.beginPath();
    g.ellipse(lx + fh * 0.15, gy + fh * 0.06, fh * 0.5, fh * 0.06, 0, 0, TAU);
    g.fill();
  }
  rain(f, S, 150, 'rgba(180,195,220,0.4)');
});

// ================================================================== 12. sports

function crowdRows(g: G, L: Layout, S: Stage, yTop: number, rows: number, t: number, cheer: number, colors: readonly string[]): void {
  const sp = S.fh * 0.085;
  const rad = S.fh * 0.036;
  for (let r = 0; r < rows; r++) {
    const y = yTop + r * S.fh * 0.12;
    g.fillStyle = colors[r % colors.length];
    g.beginPath();
    for (let x = (r % 2) * sp * 0.5; x < L.w + sp; x += sp) {
      const i = Math.round(x / sp) + r * 17;
      const bob = Math.max(0, Math.sin(t * 9 + i * 1.3)) * S.fh * 0.03 * cheer;
      g.moveTo(x + rad, y - bob);
      g.arc(x, y - bob, rad, 0, TAU);
      g.rect(x - rad * 1.3, y - bob + rad * 0.9, rad * 2.6, rad * 2.6);
    }
    g.fill();
  }
  // raised arms and little flags
  g.strokeStyle = colors[0];
  g.lineWidth = Math.max(1.5, rad * 0.45);
  g.beginPath();
  for (let x = sp * 0.3; x < L.w; x += sp * 3.3) {
    const i = Math.round(x);
    if (hash(i) < 0.5) continue;
    const up = Math.max(0, Math.sin(t * 9 + i)) * cheer;
    const y = yTop + (i % rows) * S.fh * 0.12;
    g.moveTo(x, y + rad);
    g.lineTo(x + rad * 0.6, y - rad * (1.5 + up * 1.5));
  }
  g.stroke();
}

function floodlight(g: G, x: number, topY: number, baseY: number, s: number, aimX: number, aimY: number): void {
  additive(g, () => {
    const gr = g.createLinearGradient(x, topY, aimX, aimY);
    gr.addColorStop(0, 'rgba(255,255,230,0.35)');
    gr.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - s * 0.3, topY);
    g.lineTo(x + s * 0.3, topY);
    g.lineTo(aimX + s * 2.2, aimY);
    g.lineTo(aimX - s * 2.2, aimY);
    g.fill();
  });
  g.fillStyle = '#1b2236';
  g.fillRect(x - s * 0.04, topY, s * 0.08, baseY - topY);
  g.fillStyle = '#2d3550';
  g.fillRect(x - s * 0.34, topY - s * 0.24, s * 0.68, s * 0.36);
  additive(g, () => {
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const lx = x - s * 0.22 + i * s * 0.22;
        const ly = topY - s * 0.14 + j * s * 0.16;
        blob(g, lx, ly, s * 0.32, '255,255,220', 0.7);
      }
  });
  g.fillStyle = '#fffef0';
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      g.beginPath();
      g.arc(x - s * 0.22 + i * s * 0.22, topY - s * 0.14 + j * s * 0.16, s * 0.065, 0, TAU);
      g.fill();
    }
}

const sports = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, gap } = S;
  const night = !(era === 'ancient' || era === 'medieval' || era === 'early');
  sky(g, L, night ? ['#050a1f', '#0d1b3e', '#1b2d5c'] : ['#7ec8e3', '#bde4f4', '#fff1d0']);
  if (night) starfield(g, L, S, 30, gy * 0.5, t, '#cfd8ff', 3);
  // stands
  const standTop = gy - fh * 0.95;
  g.fillStyle = night ? '#141a33' : '#c9a66b';
  g.fillRect(0, standTop - fh * 0.06, L.w, gy - standTop + fh * 0.06);
  const finishX = S.main + S.sideW * 0.16;
  const crossed = (f.mem.crossT as number | undefined) ?? -1;
  const cheer = crossed >= 0 ? 1 : 0.35;
  crowdRows(g, L, S, standTop + fh * 0.06, 5, t, cheer, night ? ['#2b3561', '#3a4478', '#252e55'] : ['#8a6a3f', '#a07a48', '#7a5c35']);
  g.fillStyle = night ? '#0e1328' : '#a8844f';
  g.fillRect(0, gy - fh * 0.2, L.w, fh * 0.2);
  // field
  floor(g, L, S, night ? '#2f8f46' : '#c2884f', night ? '#3fae5a' : '#d39a5e');
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 1; i < 4; i++) g.fillRect(0, gy + i * fh * 0.07, L.w, Math.max(1.5, fh * 0.008));
  if (night) {
    const towers = S.port ? [L.w * 0.05, L.w * 0.95] : [L.w * 0.03, L.phone.x - L.w * 0.02, L.phone.x + L.phone.w + L.w * 0.02, L.w * 0.97];
    towers.forEach((x) => floodlight(g, x, L.h * 0.06, standTop, fh * 0.4, x < L.w / 2 ? x + fh * 0.8 : x - fh * 0.8, gy));
  } else {
    // olympic-style flame on a column
    const cx = S.alt ?? L.w * 0.88;
    g.fillStyle = '#efe6d2';
    g.fillRect(cx - fh * 0.08, standTop - fh * 0.5, fh * 0.16, fh * 0.6);
    g.fillRect(cx - fh * 0.14, standTop - fh * 0.56, fh * 0.28, fh * 0.07);
    flame(g, cx, standTop - fh * 0.56, fh * 0.42, t, 1, 1.4);
  }
  // finish banner
  const fy = gy - fh * 1.32;
  g.fillStyle = '#e9ecef';
  g.fillRect(finishX - fh * 0.44, fy, fh * 0.04, gy - fy);
  g.fillRect(finishX + fh * 0.4, fy, fh * 0.04, gy - fy);
  const cells = 10;
  const cwid = (fh * 0.84) / cells;
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      g.fillRect(finishX - fh * 0.42 + i * cwid, fy + j * cwid, cwid, cwid);
    }
  // runner
  const rx0 = S.main - S.sideW * 0.48;
  const rx1 = S.main + S.sideW * 0.4;
  const rx = lerp(rx0, rx1, easeOut(clamp((p - 0.04) / 0.7)) * 0.4 + clamp((p - 0.04) / 0.7) * 0.6);
  if (crossed < 0 && rx > finishX) {
    f.mem.crossT = t;
    confettiBurst(f, finishX, fy, 50, 560 * S.k, CONFETTI_COLORS);
    if (S.alt !== null) confettiBurst(f, S.alt, gy - fh * 1.3, 30, 520 * S.k, CONFETTI_COLORS);
  }
  const done = crossed >= 0 && t - crossed > 0.35;
  const runPhase = t * 1.9;
  if (!done) {
    for (let i = 1; i <= 3; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.5 - i * 0.12})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(rx - fh * (0.2 + i * 0.12), gy - fh * (0.35 + i * 0.12));
      g.lineTo(rx - fh * (0.45 + i * 0.12), gy - fh * (0.35 + i * 0.12));
      g.stroke();
    }
    footShadow(g, rx, gy, fh * 0.2);
    g.save();
    g.translate(rx, gy);
    g.rotate(0.14);
    fig(g, 0, 0, fh, { color: '#e63946', accent: '#ffffff', pose: 'walk', phase: runPhase, dir: 1, mood: 'smile', shadow: false });
    g.restore();
  } else {
    fig(g, rx, gy - Math.abs(Math.sin(t * 8)) * fh * 0.05, fh, { color: '#e63946', accent: '#ffffff', pose: 'cheer', phase: t, dir: 1, mood: 'laugh' });
  }
  if (S.alt !== null) {
    const fans: [number, string][] = [
      [-1, '#ffd166'],
      [0, '#4361ee'],
      [1, '#06d6a0'],
    ];
    fans.forEach(([i, col], n) => {
      const jump = Math.max(0, Math.sin(t * 9 + n * 2)) * fh * 0.06 * cheer;
      fig(g, S.alt! + i * gap * 1.05, gy - jump + fh * 0.05, fh * 0.9, { color: col, pose: cheer > 0.5 || n === 1 ? 'cheer' : 'wave', phase: t + n, mood: cheer > 0.5 ? 'laugh' : 'wow' });
    });
    const flx = S.alt + gap * 1.6;
    g.strokeStyle = '#ddd';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(flx, gy - fh * 0.45);
    g.lineTo(flx, gy - fh * 1.25);
    g.stroke();
    g.fillStyle = '#e63946';
    g.beginPath();
    g.moveTo(flx, gy - fh * 1.25);
    for (let i = 0; i <= 6; i++) g.lineTo(flx + (i / 6) * fh * 0.35, gy - fh * 1.25 + Math.sin(t * 8 - i) * fh * 0.025);
    for (let i = 6; i >= 0; i--) g.lineTo(flx + (i / 6) * fh * 0.35, gy - fh * 1.05 + Math.sin(t * 8 - i) * fh * 0.025);
    g.fill();
  }
  const conf = particles(f.mem, 'conf');
  stepParticles(conf, f.dt, 300, 1);
  drawConfetti(g, conf);
});

// ================================================================== 13. study

function chalkboard(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle = '#8b5a2b';
  g.fillRect(x - w / 2 - h * 0.05, y - h * 0.05, w + h * 0.1, h + h * 0.1);
  g.fillStyle = '#2f4f3a';
  g.fillRect(x - w / 2, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(x - w / 2, y, w, h * 0.45);
  g.fillStyle = '#6e4521';
  g.fillRect(x - w / 2, y + h + h * 0.05, w, h * 0.04);
  g.fillStyle = '#ffffff';
  g.fillRect(x + w * 0.3, y + h + h * 0.02, h * 0.08, h * 0.03);
}

function lightBulb(g: G, x: number, y: number, s: number, on: number, t: number): void {
  if (on > 0) {
    additive(g, () => blob(g, x, y, s * 2.4 * (1 + 0.05 * Math.sin(t * 12)), '255,230,120', 0.8 * on));
    g.strokeStyle = `rgba(255,214,102,${on})`;
    g.lineWidth = Math.max(2, s * 0.07);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.42;
      g.moveTo(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75);
      g.lineTo(x + Math.cos(a) * s * (0.95 + 0.15 * on), y + Math.sin(a) * s * (0.95 + 0.15 * on));
    }
    g.stroke();
  }
  g.fillStyle = on > 0.5 ? '#fff3a3' : '#dfe3ea';
  g.beginPath();
  g.arc(x, y, s * 0.5, Math.PI * 0.8, Math.PI * 2.2);
  g.lineTo(x + s * 0.2, y + s * 0.62);
  g.lineTo(x - s * 0.2, y + s * 0.62);
  g.closePath();
  g.fill();
  g.strokeStyle = on > 0.5 ? '#ff9f1c' : '#8a8f99';
  g.lineWidth = Math.max(1.5, s * 0.05);
  g.beginPath();
  g.moveTo(x - s * 0.12, y + s * 0.5);
  g.lineTo(x - s * 0.12, y + s * 0.05);
  g.lineTo(x - s * 0.04, y - s * 0.08);
  g.lineTo(x + s * 0.04, y + s * 0.05);
  g.lineTo(x + s * 0.12, y - s * 0.08);
  g.lineTo(x + s * 0.12, y + s * 0.5);
  g.stroke();
  g.fillStyle = '#9aa1ad';
  g.fillRect(x - s * 0.21, y + s * 0.62, s * 0.42, s * 0.24);
  g.fillStyle = '#6c7380';
  g.fillRect(x - s * 0.21, y + s * 0.68, s * 0.42, s * 0.04);
  g.fillRect(x - s * 0.21, y + s * 0.77, s * 0.42, s * 0.04);
  g.fillRect(x - s * 0.1, y + s * 0.86, s * 0.2, s * 0.06);
}

function bookStack(g: G, x: number, y: number, w: number, t: number): void {
  const cols = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#8338ec'];
  let yy = y;
  cols.forEach((c, i) => {
    const bw = w * (0.86 + hash(i + 3) * 0.14);
    const bh = w * 0.13;
    const bx = x - bw / 2 + (hash(i) - 0.5) * w * 0.1;
    g.fillStyle = c;
    g.fillRect(bx, yy - bh, bw, bh);
    g.fillStyle = '#fdf6e3';
    g.fillRect(bx + bw - w * 0.05, yy - bh + bh * 0.15, w * 0.04, bh * 0.7);
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(bx + bw * 0.1, yy - bh * 0.6, bw * 0.5, Math.max(1, bh * 0.1));
    yy -= bh;
  });
  // open book on top with a flipping page
  const ow = w * 0.9;
  g.fillStyle = '#fdf6e3';
  g.beginPath();
  g.moveTo(x, yy);
  g.quadraticCurveTo(x - ow * 0.25, yy - w * 0.1, x - ow / 2, yy - w * 0.04);
  g.lineTo(x - ow / 2, yy);
  g.lineTo(x + ow / 2, yy);
  g.lineTo(x + ow / 2, yy - w * 0.04);
  g.quadraticCurveTo(x + ow * 0.25, yy - w * 0.1, x, yy);
  g.fill();
  const flip = fract(t * 0.7);
  const px = x + Math.cos(flip * Math.PI) * ow * 0.45;
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.moveTo(x, yy);
  g.quadraticCurveTo((x + px) / 2, yy - w * 0.12 - Math.sin(flip * Math.PI) * w * 0.25, px, yy - w * 0.04 - Math.sin(flip * Math.PI) * w * 0.3);
  g.lineTo(px, yy - Math.sin(flip * Math.PI) * w * 0.25);
  g.lineTo(x, yy);
  g.fill();
}

const study = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#f3e3c3', '#ead3a6', '#dcbc84']);
  floor(g, L, S, '#9c6b3f', '#b07d4c');
  const bw = Math.min(S.sideW * 0.86, fh * 1.7);
  const bh = fh * 0.82;
  const bx = S.main;
  const by = gy - fh * 1.42;
  chalkboard(g, bx, by, bw, bh);
  const pre = era === 'ancient' || era === 'medieval' || era === 'early';
  const lines = pre ? ['a² + b² = c²', 'π ≈ 3.1416', '2 + 2 = 4 ✓'] : era === 'future' ? ['E = mc²', 'ψ(x,t) = ?', '∫ f(x) dx ✓'] : ['E = mc²', 'a² + b² = c²', '∫ x dx = x²/2'];
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  let shown = Math.floor(span(p, 0.06, 0.62) * totalChars);
  const size = Math.min(bh * 0.2, bw * 0.095);
  g.font = `700 ${Math.round(size)}px 'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive, sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(245,245,235,0.92)';
  let tipX = bx;
  let tipY = by;
  lines.forEach((ln, i) => {
    const s = ln.slice(0, Math.max(0, shown));
    shown -= ln.length;
    const lx = bx - bw / 2 + bw * 0.08;
    const ly = by + bh * (0.22 + i * 0.28);
    if (s.length) {
      g.fillText(s, lx, ly);
      tipX = lx + g.measureText(s).width;
      tipY = ly;
    }
  });
  if (p < 0.64) {
    g.fillStyle = '#ffffff';
    g.fillRect(tipX + 2, tipY - size * 0.15 + Math.sin(t * 30) * 2, size * 0.35, size * 0.18);
  }
  // student at the board
  const sx = bx + bw * 0.42;
  const ah = p > 0.62;
  fig(g, sx, gy, fh, { color: '#7a3e48', accent: '#ffd166', pose: ah ? 'cheer' : 'wave', phase: t * 0.5, dir: -1, mood: ah ? 'laugh' : 'smile' });
  // the light bulb moment
  const on = span(p, 0.6, 0.66);
  const lbx = bx - bw * 0.05;
  const lby = by - fh * 0.32 - bump(p, 0.6, 0.72) * fh * 0.06;
  if (pre) {
    if (on > 0) {
      additive(g, () => blob(g, lbx, lby, fh * 0.5, '255,220,120', 0.9 * on));
      star(g, lbx, lby, fh * 0.14 * pop(p, 0.6, 0.7), '#ffd166', t);
      rays(g, lbx, lby, 12, fh * 0.45, t, TAU, 0.06, '255,220,120', 0.6 * on);
    }
  } else lightBulb(g, lbx, lby, fh * 0.26, on, t);
  // books and floating symbols
  const bookX = S.alt ?? (S.port ? L.w * 0.12 : S.main - bw * 0.6);
  const bookW = S.alt !== null ? fh * 0.75 : fh * 0.42;
  if (S.alt !== null || S.port) bookStack(g, bookX, gy, bookW, t);
  if (S.alt !== null) {
    fig(g, S.alt + bookW * 0.85, gy, fh * 0.92, { color: '#3a6ea5', dress: true, accent: '#9ad1d4', pose: 'hold', dir: -1, mood: p > 0.62 ? 'wow' : 'calm' });
  }
  const syms = pre ? ['π', '△', '√', '÷', '∞'] : ['π', '√', 'Σ', 'x²', '∞', '%'];
  const ps = particles(f.mem, 'syms');
  if (f.p < 0.85)
    emit(f, 'syms', 4, () => {
      if (ps.length < 14) ps.push({ x: bookX + f.rand.range(-0.4, 0.4) * bookW, y: gy - bookW * 0.8, vx: f.rand.range(-15, 15), vy: -f.rand.range(40, 70) * S.k, life: 0, max: 2, size: fh * f.rand.range(0.08, 0.12), color: f.rand.pick(['#3a0ca3', '#7209b7', '#f72585', '#4361ee']), kind: Math.floor(f.rand() * syms.length) });
    });
  stepParticles(ps, f.dt);
  g.textAlign = 'center';
  for (const s of ps) {
    g.globalAlpha = f.a * clamp(s.life / 0.3) * clamp((s.max - s.life) / 0.5);
    g.fillStyle = s.color;
    g.font = `800 ${Math.round(s.size)}px Georgia, serif`;
    g.fillText(syms[s.kind ?? 0], s.x + Math.sin(s.life * 3) * 6, s.y);
  }
  g.globalAlpha = f.a;
});

// ================================================================== 14. holy

function dove(g: G, x: number, y: number, s: number, flap: number, dir: 1 | -1): void {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  additive(g, () => blob(g, 0, 0, s * 1.6, '255,250,220', 0.5));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-s * 0.42, 0);
  g.lineTo(-s * 0.9, -s * 0.16);
  g.lineTo(-s * 0.84, s * 0.04);
  g.lineTo(-s * 0.92, s * 0.18);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(0, 0, s * 0.55, s * 0.21, -0.08, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(s * 0.5, -s * 0.13, s * 0.16, 0, TAU);
  g.fill();
  g.fillStyle = '#f4a261';
  g.beginPath();
  g.moveTo(s * 0.64, -s * 0.16);
  g.lineTo(s * 0.8, -s * 0.1);
  g.lineTo(s * 0.63, -s * 0.06);
  g.fill();
  g.fillStyle = '#333';
  g.beginPath();
  g.arc(s * 0.54, -s * 0.16, Math.max(1, s * 0.035), 0, TAU);
  g.fill();
  g.fillStyle = '#f7f7ff';
  g.beginPath();
  g.moveTo(s * 0.15, -s * 0.05);
  g.quadraticCurveTo(s * 0.05, -s * 0.75 * flap, -s * 0.38, -s * 0.95 * flap);
  g.quadraticCurveTo(-s * 0.22, -s * 0.4 * flap, -s * 0.3, -s * 0.02);
  g.closePath();
  g.fill();
  g.restore();
}

const holy = def(3.4, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#fff1c9', '#ffd98a', '#f4b860', '#e49a52']);
  const ox = S.main;
  rays(g, ox, -L.h * 0.08, 14, L.h * 1.2, Math.PI / 2 + Math.sin(t * 0.6) * 0.08, 1.5, 0.045, '255,255,235', 0.55);
  if (S.alt !== null) rays(g, S.alt, -L.h * 0.08, 12, L.h * 1.1, Math.PI / 2 - Math.sin(t * 0.6) * 0.08, 1.3, 0.04, '255,255,235', 0.45);
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const cx = visX(L, S, u) + Math.sin(t * 0.5 + i) * 12;
    const cy = L.h * (0.04 + 0.05 * (i % 3));
    cloud(g, cx, cy + 6, fh * 0.42, 'rgba(255,205,120,0.6)');
    cloud(g, cx, cy, fh * 0.42, 'rgba(255,255,255,0.95)');
  }
  floor(g, L, S, '#d8a868', '#e8bf86');
  // beam onto the faithful
  additive(g, () => {
    const gr = g.createLinearGradient(0, 0, 0, gy);
    gr.addColorStop(0, 'rgba(255,255,230,0.05)');
    gr.addColorStop(1, 'rgba(255,255,230,0.5)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(ox - fh * 0.12, 0);
    g.lineTo(ox + fh * 0.12, 0);
    g.lineTo(ox + fh * 0.45, gy);
    g.lineTo(ox - fh * 0.45, gy);
    g.fill();
    blob(g, ox, gy - fh * 0.4, fh * 0.9, '255,255,220', 0.7);
  });
  fig(g, ox, gy, fh, { color: '#6b4e3d', dress: true, accent: '#f8f1e3', pose: 'kneel', dir: 1, mood: 'calm' });
  const hd = headOf(ox, gy, fh, true);
  g.strokeStyle = 'rgba(255,230,120,0.95)';
  g.lineWidth = Math.max(2, fh * 0.018);
  g.beginPath();
  g.ellipse(hd.x, hd.y - hd.r * 1.25, hd.r * 0.9, hd.r * 0.28, 0, 0, TAU);
  g.stroke();
  // doves
  const flap = Math.sin(t * 11);
  const dp = easeOut(clamp(p / 0.55));
  const d1x = lerp(S.port ? -fh * 0.5 : S.main - S.sideW * 0.6, ox + fh * 0.35, dp) + (p > 0.55 ? Math.sin(t * 2) * fh * 0.06 : 0);
  const d1y = lerp(L.h * 0.12, gy - fh * 1.35, dp) + Math.sin(t * 3) * fh * 0.03;
  dove(g, d1x, d1y, fh * 0.2, flap, -1 as 1 | -1 > 0 ? 1 : 1);
  if (S.alt !== null) {
    const ax = lerp(L.phone.x + L.phone.w - fh * 0.3, L.w + fh, clamp(p * 1.1));
    dove(g, ax, L.h * 0.3 - p * fh * 0.6, fh * 0.17, Math.sin(t * 12 + 1), 1);
  }
  floaters(f, S, { kinds: ['sparkle', 'dot'], colors: ['#fff8d6', '#ffe9a3', '#ffffff'], size: [4, 9], rate: 14, speed: [20, 50], life: [1.4, 2.4], y: () => gy - f.rand() * fh * 1.6, max: 45 });
});

// ================================================================== 15. demonic

function flameRow(g: G, x0: number, x1: number, y: number, h: number, t: number, cols: readonly string[]): void {
  cols.forEach((c, layer) => {
    const step = h * 0.32;
    const lh = h * (1 - layer * 0.28);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x0, y + 4);
    for (let x = x0; x <= x1 + step; x += step) {
      const i = x / step;
      const fh = lh * (0.5 + 0.4 * Math.abs(Math.sin(t * (2.6 + layer) + i * 1.7 + layer)) + 0.15 * Math.sin(t * 11 + i * 3.3));
      const sway = Math.sin(t * 5 + i) * step * 0.25;
      g.lineTo(x, y);
      g.quadraticCurveTo(x + step * 0.15, y - fh * 0.5, x + step * 0.5 + sway, y - fh);
      g.quadraticCurveTo(x + step * 0.85, y - fh * 0.5, x + step, y);
    }
    g.lineTo(x1 + step, y + 4);
    g.closePath();
    g.fill();
  });
}

function hornedShadow(g: G, x: number, y: number, H: number, t: number): void {
  const w = H * 0.9;
  const br = 1 + 0.015 * Math.sin(t * 2.5);
  g.save();
  g.translate(x, y);
  g.scale(br, br);
  g.fillStyle = 'rgba(14,0,0,0.92)';
  g.beginPath();
  g.moveTo(-w * 0.62, 0);
  g.quadraticCurveTo(-w * 0.58, -H * 0.55, -w * 0.24, -H * 0.62);
  g.lineTo(-w * 0.13, -H * 0.66);
  g.quadraticCurveTo(-w * 0.22, -H * 0.96, 0, -H * 0.98);
  g.quadraticCurveTo(w * 0.22, -H * 0.96, w * 0.13, -H * 0.66);
  g.lineTo(w * 0.24, -H * 0.62);
  g.quadraticCurveTo(w * 0.58, -H * 0.55, w * 0.62, 0);
  g.closePath();
  g.fill();
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * w * 0.06, -H * 0.9);
    g.quadraticCurveTo(s * w * 0.32, -H * 0.98, s * w * 0.3, -H * 1.24);
    g.quadraticCurveTo(s * w * 0.2, -H * 1.04, s * w * 0.15, -H * 0.84);
    g.closePath();
    g.fill();
  }
  const blink = Math.sin(t * 1.3) > 0.97 ? 0.15 : 1;
  additive(g, () => {
    for (const s of [-1, 1]) blob(g, s * w * 0.075, -H * 0.82, w * 0.1, '255,140,40', 0.9);
  });
  g.fillStyle = '#ffd23f';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * w * 0.075, -H * 0.82, w * 0.045, w * 0.018 * blink, s * -0.35, 0, TAU);
    g.fill();
  }
  g.restore();
}

function sigil(g: G, x: number, y: number, r: number, prog: number, rot: number): void {
  g.save();
  g.translate(x, y);
  additive(g, () => blob(g, 0, 0, r * 1.8, '255,60,20', 0.55 * prog));
  g.rotate(rot);
  const draw = (lw: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog * 1.6));
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r * 0.82, Math.PI / 2, Math.PI / 2 + TAU * clamp(prog * 1.6 - 0.2));
    g.stroke();
    const sp = clamp((prog - 0.35) / 0.65) * 5;
    if (sp > 0) {
      g.beginPath();
      const pt = (i: number) => {
        const a = -Math.PI / 2 + ((i * 2) % 5) * (TAU / 5);
        return [Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82] as const;
      };
      const [sx, sy] = pt(0);
      g.moveTo(sx, sy);
      for (let i = 1; i <= Math.ceil(sp); i++) {
        const [ax, ay] = pt(i - 1);
        const [bx, by] = pt(i);
        const fr = Math.min(1, sp - (i - 1));
        g.lineTo(lerp(ax, bx, fr), lerp(ay, by, fr));
      }
      g.stroke();
    }
    g.beginPath();
    for (let i = 0; i < 12 * clamp(prog * 1.5); i++) {
      const a = (i * TAU) / 12;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.moveTo(c * r * 0.86, s * r * 0.86);
      g.lineTo(c * r * 0.96, s * r * 0.96);
      if (i % 2) {
        g.moveTo(c * r * 0.9 - s * r * 0.04, s * r * 0.9 + c * r * 0.04);
        g.lineTo(c * r * 0.92 + s * r * 0.04, s * r * 0.92 - c * r * 0.04);
      }
    }
    g.stroke();
  };
  additive(g, () => draw(r * 0.09, 'rgba(255,60,20,0.35)'));
  draw(r * 0.035, '#ff5a1f');
  g.restore();
}

const demonic = def(
  3.6,
  (f, S) => {
    const { g, L, t, p } = f;
    const { fh, gy } = S;
    sky(g, L, ['#0a0000', '#2e0303', '#6e0b0b', '#b3261e']);
    // horned shadow rises
    const rise = easeOut(clamp((p - 0.12) / 0.45));
    const H = S.port ? fh * 2.2 : fh * 2.5;
    const sx = S.alt ?? S.main;
    hornedShadow(g, sx, gy + (1 - rise) * H * 0.9, H, t);
    floor(g, L, S, '#160000');
    // sigil and the one who made the pact
    const sr = fh * (S.port ? 0.52 : 0.5);
    const sgx = S.port ? S.main : S.main + S.gap * 0.45;
    const sgy = S.port ? L.h * 0.33 : gy - fh * 0.95;
    sigil(g, sgx, sgy, sr, span(p, 0.05, 0.5), t * 0.5);
    const kx = S.port ? S.main - S.gap * 1.6 : sgx - sr * 1.35;
    additive(g, () => blob(g, kx, gy - fh * 0.4, fh * 0.6, '255,60,20', 0.3));
    fig(g, kx, gy, fh * 0.9, { color: '#1a0505', pose: 'kneel', dir: 1, hat: 'hood', accent: '#2b0a0a', dress: true });
    flameRow(g, -20, L.w + 20, gy + fh * 0.08, fh * 0.42, t, ['#7a0d0d', '#e2401c', '#ffb22e']);
    // embers
    const em = particles(f.mem, 'embers');
    emit(f, 'embers', 45, () => {
      if (em.length < 120) em.push({ x: f.rand.range(0, L.w), y: gy, vx: f.rand.range(-30, 30), vy: -f.rand.range(80, 220) * Math.max(0.7, S.k), life: 0, max: f.rand.range(1, 2.2), size: f.rand.range(1.5, 3.5), color: f.rand.pick(['#ffb22e', '#ff7a1a', '#ffd23f']) });
    });
    stepParticles(em, f.dt);
    for (const e of em) e.x += Math.sin(e.life * 5 + e.max * 10) * 0.8;
    additive(g, () => drawDotsLite(g, em));
    g.fillStyle = `rgba(255,30,0,${0.08 * bump(p, 0.3, 0.6)})`;
    g.fillRect(0, 0, L.w, L.h);
  },
  (t, dur) => 3 * bump(t / dur, 0.2, 0.65),
);

// ================================================================== 16. ghost

function bareTree(g: G, x: number, y: number, len: number, ang: number, depth: number, w: number, r: Rand): void {
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x2, y2);
  g.stroke();
  if (depth <= 0) return;
  bareTree(g, x2, y2, len * 0.72, ang - 0.4 - r() * 0.25, depth - 1, w * 0.66, r);
  bareTree(g, x2, y2, len * 0.68, ang + 0.35 + r() * 0.25, depth - 1, w * 0.66, r);
}

function ghostShape(g: G, x: number, y: number, R: number, t: number, alpha: number, seed: number): void {
  g.save();
  g.globalAlpha *= alpha;
  additive(g, () => blob(g, x, y + R * 0.4, R * 2.6, '170,210,255', 0.45));
  g.fillStyle = 'rgba(240,247,255,0.88)';
  const bottom = y + R * 1.55;
  g.beginPath();
  g.moveTo(x - R, y);
  g.arc(x, y, R, Math.PI, 0);
  g.quadraticCurveTo(x + R * 1.05, y + R * 0.9, x + R * 1.15, bottom);
  const n = 4;
  const sw = (R * 2.3) / n;
  for (let i = 0; i < n; i++) {
    const xa = x + R * 1.15 - i * sw;
    g.quadraticCurveTo(xa - sw / 2, bottom - R * 0.35 + Math.sin(t * 6 + i * 1.6 + seed) * R * 0.15, xa - sw, bottom + Math.sin(t * 5 + i + seed) * R * 0.08);
  }
  g.quadraticCurveTo(x - R * 1.05, y + R * 0.9, x - R, y);
  g.fill();
  // little arms
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * R * 1.02, y + R * 0.55 + Math.sin(t * 4 + s + seed) * R * 0.12, R * 0.32, R * 0.16, s * (0.6 + Math.sin(t * 4 + seed) * 0.2), 0, TAU);
    g.fill();
  }
  g.fillStyle = '#1b2440';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * R * 0.36, y - R * 0.05, R * 0.14, R * 0.21, 0, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(x, y + R * 0.45, R * 0.13, R * 0.19 * (0.8 + 0.3 * Math.sin(t * 3 + seed)), 0, 0, TAU);
  g.fill();
  g.restore();
}

function mist(f: SceneFrame, S: Stage, y: number, n: number): void {
  const { g, L, t } = f;
  for (let i = 0; i < n; i++) {
    const w = L.w + 400;
    const mx = ((hash(i + 1) * w + t * (20 + i * 6)) % w) - 200;
    const my = y + (hash(i + 9) - 0.5) * S.fh * 0.6;
    g.save();
    g.translate(mx, my);
    g.scale(3.2, 1);
    blob(g, 0, 0, S.fh * (0.35 + hash(i + 4) * 0.25), '190,205,235', 0.28);
    g.restore();
  }
}

const ghost = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#070b1c', '#141c3a', '#283458']);
  starfield(g, L, S, 40, gy * 0.6, t, '#dfe7ff', 9);
  const mx = S.alt ?? L.w * 0.8;
  fullMoon(g, mx + (S.alt !== null ? S.sideW * 0.2 : 0), S.port ? L.h * 0.1 : L.h * 0.18, fh * (S.port ? 0.2 : 0.28), '#f1f4ff', '200,215,255');
  g.strokeStyle = '#05070f';
  g.lineCap = 'round';
  const tx = S.port ? L.w * 0.1 : S.main - S.sideW * 0.38;
  bareTree(g, tx, gy, fh * 0.55, -Math.PI / 2 + 0.05, 5, fh * 0.07, makeRand(4));
  if (S.alt !== null) bareTree(g, S.alt + S.sideW * 0.35, gy, fh * 0.5, -Math.PI / 2 - 0.08, 5, fh * 0.06, makeRand(8));
  floor(g, L, S, '#0b0f1e', '#141a30');
  // little graves and a fence
  g.fillStyle = '#0d1224';
  for (let i = 0; i < 6; i++) {
    const gx = visX(L, S, (i + 0.5) / 6);
    const gh = fh * (0.16 + hash(i) * 0.1);
    rrect(g, gx - fh * 0.06, gy - gh, fh * 0.12, gh + 2, fh * 0.06);
    g.fill();
  }
  mist(f, S, gy - fh * 0.1, 8);
  const appear = span(p, 0.02, 0.3);
  const R = fh * 0.3;
  const gx1 = S.main + Math.sin(t * 1.3) * S.gap * 0.6;
  const gy1 = gy - fh * 1.05 + Math.sin(t * 2.4) * fh * 0.07;
  ghostShape(g, gx1, gy1, R, t, appear * (0.75 + 0.2 * Math.sin(t * 5)), 0);
  if (S.alt !== null) ghostShape(g, S.alt - S.gap * 0.4 + Math.sin(t * 1.1 + 2) * S.gap * 0.5, gy - fh * 1.25 + Math.sin(t * 2 + 1) * fh * 0.08, R * 0.7, t, span(p, 0.2, 0.5) * 0.75, 3);
  else ghostShape(g, L.w * 0.82 + Math.sin(t * 1.1) * 10, gy - fh * 1.7 + Math.sin(t * 2 + 1) * fh * 0.08, R * 0.5, t, span(p, 0.25, 0.5) * 0.6, 3);
  mist(f, S, gy + fh * 0.05, 5);
});

// ================================================================== 17. curse

function bigEye(g: G, x: number, y: number, w: number, open: number, look: number, t: number): void {
  const hh = w * 0.24 * open;
  additive(g, () => blob(g, x, y, w * 1.1, '170,60,255', 0.6));
  const almond = () => {
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x, y - hh * 2, x + w / 2, y);
    g.quadraticCurveTo(x, y + hh * 2, x - w / 2, y);
    g.closePath();
  };
  if (open > 0.02) {
    g.save();
    almond();
    g.fillStyle = '#f1e6ff';
    g.fill();
    g.clip();
    const ix = x + look * w * 0.18;
    const ir = w * 0.17;
    const gr = g.createRadialGradient(ix, y, ir * 0.2, ix, y, ir);
    gr.addColorStop(0, '#e9ff70');
    gr.addColorStop(0.6, '#8ac926');
    gr.addColorStop(1, '#2d5a0c');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(ix, y, ir, 0, TAU);
    g.fill();
    g.fillStyle = '#0a0410';
    g.beginPath();
    g.ellipse(ix, y, w * 0.035, ir * 0.78 * (0.85 + 0.15 * Math.sin(t * 3)), 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(ix - ir * 0.35, y - ir * 0.35, ir * 0.14, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(90,0,120,0.35)';
    g.fillRect(x - w / 2, y - hh, w, hh * 0.5);
    g.restore();
  }
  almond();
  g.strokeStyle = '#1a0628';
  g.lineWidth = Math.max(2, w * 0.03);
  g.stroke();
  g.strokeStyle = '#1a0628';
  g.lineWidth = Math.max(1.5, w * 0.018);
  g.beginPath();
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const lx = x - w / 2 + u * w;
    const ly = y - hh * 2 * 2 * u * (1 - u);
    const a = -Math.PI / 2 + (u - 0.5) * 1.6;
    g.moveTo(lx, ly);
    g.lineTo(lx + Math.cos(a) * w * 0.07, ly + Math.sin(a) * w * 0.07);
  }
  g.stroke();
}

function rune(g: G, x: number, y: number, s: number, seed: number): void {
  const r = makeRand(seed);
  g.beginPath();
  g.moveTo(x + (r() - 0.5) * s, y - s * 0.5);
  g.lineTo(x + (r() - 0.5) * s * 0.4, y + s * 0.5);
  for (let i = 0; i < 2; i++) {
    g.moveTo(x - s * 0.4, y + (r() - 0.5) * s);
    g.lineTo(x + s * 0.4, y + (r() - 0.5) * s);
  }
  g.stroke();
}

const curse = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#0d0221', '#24063d', '#3c0f5f']);
  floor(g, L, S, '#12041f');
  const ex = S.main;
  const ey = S.port ? L.h * 0.27 : gy - fh * 1.15;
  const ew = S.port ? Math.min(L.w * 0.62, fh * 1.6) : Math.min(S.sideW * 0.75, fh * 1.4);
  // swirling fog
  const centres = S.alt !== null ? [ex, S.alt] : [ex];
  additive(g, () => {
    centres.forEach((cx, c) => {
      const cy = c === 0 ? ey : gy - fh * 0.9;
      const n = c === 0 ? 34 : 24;
      for (let i = 0; i < n; i++) {
        const r0 = ew * (0.45 + hash(i + c * 50) * 0.75);
        const a = hash(i * 3 + c) * TAU + t * (0.9 + hash(i + 7) * 0.6) * (c ? -1 : 1);
        const rr = r0 * (1 - 0.12 * Math.sin(t * 2 + i));
        blob(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.55, fh * (0.18 + hash(i + 2) * 0.16), i % 3 ? '150,60,220' : '220,80,255', 0.22);
      }
    });
  });
  // runes orbiting
  g.strokeStyle = '#d29bff';
  g.lineWidth = Math.max(1.5, fh * 0.012);
  additive(g, () => {
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + t * 0.7;
      rune(g, ex + Math.cos(a) * ew * 0.82, ey + Math.sin(a) * ew * 0.42, fh * 0.07, i + 1);
    }
  });
  const open = span(p, 0.05, 0.25) * (1 - bump(p, 0.66, 0.74));
  const look = Math.sin(t * 1.6) * 0.9;
  bigEye(g, ex, ey, ew, open, look, t);
  if (S.alt !== null) {
    for (let i = 0; i < 5; i++) {
      const px = S.alt + (hash(i + 20) - 0.5) * S.sideW * 0.75;
      const py = gy - fh * (0.4 + hash(i + 30) * 1.4);
      const o = clamp(Math.sin(t * 2.2 + i * 1.9) * 2);
      if (o <= 0) continue;
      additive(g, () => blob(g, px, py, fh * 0.12, '200,255,80', 0.4 * o));
      g.fillStyle = '#d4ff5a';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(px + s * fh * 0.04, py, fh * 0.022, fh * 0.012 * o, s * 0.25, 0, TAU);
        g.fill();
      }
    }
  }
  floaters(f, S, { kinds: ['dot', 'sparkle'], colors: ['#c77dff', '#e0aaff', '#9d4edd'], size: [3, 7], rate: 12, speed: [20, 50], life: [1.2, 2], max: 40 });
});

// ================================================================== 18. ritual

function hooded(g: G, x: number, y: number, h: number, pose: PersonOpts['pose'], dir: 1 | -1, t: number, robe: string): void {
  fig(g, x, y, h, { color: '#140a1c', dress: true, accent: robe, hat: 'hood', pose, phase: t, dir });
  const hd = headOf(x, y, h);
  g.fillStyle = '#050208';
  g.beginPath();
  g.ellipse(hd.x, hd.y + hd.r * 0.05, hd.r * 0.72, hd.r * 0.85, 0, 0, TAU);
  g.fill();
  additive(g, () => {
    for (const s of [-1, 1]) blob(g, hd.x + s * hd.r * 0.3 + dir * hd.r * 0.1, hd.y, hd.r * 0.35, '255,200,90', 0.9);
  });
}

function eyeTriangle(g: G, x: number, y: number, s: number, t: number): void {
  rays(g, x, y, 16, s * 2.2, t * 0.4, TAU, 0.05, '255,214,102', 0.5);
  additive(g, () => blob(g, x, y, s * 1.5, '255,200,90', 0.5));
  g.strokeStyle = '#ffd166';
  g.lineWidth = Math.max(2, s * 0.07);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x, y - s * 0.75);
  g.lineTo(x + s * 0.8, y + s * 0.55);
  g.lineTo(x - s * 0.8, y + s * 0.55);
  g.closePath();
  g.stroke();
  g.fillStyle = 'rgba(255,209,102,0.25)';
  g.fill();
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.moveTo(x - s * 0.36, y + s * 0.12);
  g.quadraticCurveTo(x, y - s * 0.2, x + s * 0.36, y + s * 0.12);
  g.quadraticCurveTo(x, y + s * 0.44, x - s * 0.36, y + s * 0.12);
  g.fill();
  g.fillStyle = '#2a0f3a';
  g.beginPath();
  g.arc(x, y + s * 0.12, s * 0.11, 0, TAU);
  g.fill();
}

const ritual = def(3.4, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#06030d', '#170d29', '#2f1846']);
  starfield(g, L, S, 30, gy * 0.6, t, '#e6dcff', 21);
  fullMoon(g, S.alt !== null ? S.alt + S.sideW * 0.25 : L.w * 0.82, S.port ? L.h * 0.09 : L.h * 0.15, fh * (S.port ? 0.17 : 0.26), '#f5e6d3', '255,220,190');
  floor(g, L, S, '#0c0814', '#160e22');
  const rx = Math.min(S.sideW * 0.4, fh * 0.95);
  const ry = rx * 0.3;
  const cx = S.main;
  const cy = gy - ry * 0.35;
  const glowAmt = 0.5 + 0.5 * span(p, 0.2, 0.45);
  additive(g, () => {
    g.save();
    g.translate(cx, cy);
    g.scale(1, 0.3);
    blob(g, 0, 0, rx * 1.4, '200,90,255', 0.5 * glowAmt);
    g.restore();
  });
  g.strokeStyle = '#c77dff';
  g.lineWidth = Math.max(2, fh * 0.015);
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU * span(p, 0, 0.35));
  g.stroke();
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.7, ry * 0.7, 0, Math.PI, Math.PI + TAU * span(p, 0.1, 0.4));
  g.stroke();
  const cand = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * TAU + 0.3;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, back: Math.sin(a) < 0, i };
  });
  for (const c of cand) if (c.back) candle(g, c.x, c.y, fh * 0.09, t, c.i, '#d9cbb8');
  const sway = (i: number) => Math.sin(t * 1.6 + i) * fh * 0.02;
  const arms = p > 0.45 ? 'cheer' : 'hold';
  hooded(g, cx - rx * 0.5 + sway(0), cy - ry * 0.85, fh * 0.82, arms, 1, t * 0.3, '#3b0d2e');
  hooded(g, cx + rx * 0.5 + sway(1), cy - ry * 0.85, fh * 0.82, arms, -1, t * 0.3, '#3b0d2e');
  // the symbol rising from the circle
  const sy = cy - fh * (0.45 + 0.6 * span(p, 0.25, 0.65)) + Math.sin(t * 2) * fh * 0.03;
  if (p > 0.22) eyeTriangle(g, cx, sy, fh * 0.26 * pop(p, 0.22, 0.4), t);
  for (const c of cand) if (!c.back) candle(g, c.x, c.y, fh * 0.1, t, c.i, '#d9cbb8');
  hooded(g, cx - rx * 1.02 + sway(2), cy + ry * 0.45, fh, arms, 1, t * 0.3, '#4a1238');
  hooded(g, cx + rx * 1.02 + sway(3), cy + ry * 0.45, fh, arms, -1, t * 0.3, '#4a1238');
  if (S.alt !== null) {
    // procession carrying candles
    for (let i = 0; i < 3; i++) {
      const x = S.alt - S.sideW * 0.38 + i * S.gap * 1.1 + span(p, 0, 1) * S.gap * 0.6;
      const h = fh * (0.92 + i * 0.04);
      hooded(g, x, gy, h, 'walk', -1, t * 0.35 + i, '#3b0d2e');
      candle(g, x - h * 0.16, gy - h * 0.46, h * 0.08, t, 20 + i, '#d9cbb8');
    }
  }
  const sm = particles(f.mem, 'smoke');
  emit(f, 'smoke', 14, () => {
    if (sm.length < 50) sm.push({ x: cx + f.rand.range(-0.6, 0.6) * rx, y: cy, vx: f.rand.range(-10, 10), vy: -f.rand.range(30, 70) * S.k, life: 0, max: 2.4, size: fh * f.rand.range(0.06, 0.12), color: '160,90,220' });
  });
  stepParticles(sm, f.dt);
  additive(g, () => {
    for (const s of sm) blob(g, s.x + Math.sin(s.life * 2 + s.size) * 8, s.y, s.size * (1 + s.life), s.color, 0.3 * clamp(1 - s.life / s.max));
  });
});

// ================================================================== 19. travel

function jet(g: G, x: number, y: number, s: number, ang: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = '#c5ccd6';
  g.beginPath();
  g.moveTo(-s * 0.05, s * 0.02);
  g.lineTo(-s * 0.3, -s * 0.2);
  g.lineTo(-s * 0.2, -s * 0.2);
  g.lineTo(s * 0.12, s * 0.02);
  g.fill();
  g.fillStyle = '#f8f9fb';
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.03);
  g.lineTo(-s * 0.58, -s * 0.3);
  g.lineTo(-s * 0.48, -s * 0.3);
  g.lineTo(-s * 0.3, -s * 0.05);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.55, s * 0.0);
  g.quadraticCurveTo(-s * 0.55, -s * 0.07, -s * 0.4, -s * 0.07);
  g.lineTo(s * 0.4, -s * 0.07);
  g.quadraticCurveTo(s * 0.56, -s * 0.06, s * 0.58, s * 0.0);
  g.quadraticCurveTo(s * 0.56, s * 0.06, s * 0.4, s * 0.06);
  g.lineTo(-s * 0.45, s * 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = '#2f6fde';
  g.fillRect(-s * 0.45, s * 0.015, s * 0.9, s * 0.025);
  g.fillRect(-s * 0.58, -s * 0.3, s * 0.1, s * 0.12);
  g.fillStyle = '#334155';
  for (let i = 0; i < 12; i++) g.fillRect(-s * 0.32 + i * s * 0.055, -s * 0.035, s * 0.025, s * 0.025);
  g.beginPath();
  g.moveTo(s * 0.45, -s * 0.05);
  g.lineTo(s * 0.53, -s * 0.03);
  g.lineTo(s * 0.45, -s * 0.02);
  g.fill();
  g.fillStyle = '#e2e8f0';
  g.beginPath();
  g.moveTo(-s * 0.02, s * 0.03);
  g.lineTo(-s * 0.26, s * 0.24);
  g.lineTo(-s * 0.14, s * 0.24);
  g.lineTo(s * 0.16, s * 0.04);
  g.fill();
  g.fillStyle = '#94a3b8';
  g.beginPath();
  g.ellipse(-s * 0.08, s * 0.12, s * 0.07, s * 0.03, 0, 0, TAU);
  g.fill();
  g.restore();
}

function propPlane(g: G, x: number, y: number, s: number, ang: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = '#9b2226';
  g.fillRect(-s * 0.05, -s * 0.2, s * 0.22, s * 0.035);
  g.strokeStyle = '#4a2c17';
  g.lineWidth = Math.max(1.5, s * 0.015);
  g.beginPath();
  g.moveTo(0, -s * 0.17);
  g.lineTo(s * 0.02, s * 0.03);
  g.moveTo(s * 0.13, -s * 0.17);
  g.lineTo(s * 0.12, s * 0.03);
  g.stroke();
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.moveTo(-s * 0.45, -s * 0.06);
  g.lineTo(s * 0.3, -s * 0.08);
  g.quadraticCurveTo(s * 0.38, -s * 0.03, s * 0.3, s * 0.05);
  g.lineTo(-s * 0.45, -s * 0.01);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.42, -s * 0.05);
  g.lineTo(-s * 0.5, -s * 0.2);
  g.lineTo(-s * 0.4, -s * 0.2);
  g.lineTo(-s * 0.3, -s * 0.06);
  g.fill();
  g.fillStyle = '#ae2012';
  g.fillRect(-s * 0.1, s * 0.0, s * 0.25, s * 0.035);
  g.fillStyle = '#222';
  g.beginPath();
  g.arc(s * 0.05, s * 0.1, s * 0.035, 0, TAU);
  g.fill();
  g.fillStyle = '#333';
  g.beginPath();
  g.arc(-s * 0.05, -s * 0.1, s * 0.035, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(220,220,220,0.55)';
  g.beginPath();
  g.ellipse(s * 0.37, -s * 0.015, s * 0.02, s * 0.14 * (0.7 + 0.3 * Math.abs(Math.sin(t * 40))), 0, 0, TAU);
  g.fill();
  g.restore();
}

function shuttle(g: G, x: number, y: number, s: number, ang: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  additive(g, () => {
    blob(g, -s * 0.55, 0, s * 0.3 * (1 + 0.1 * Math.sin(t * 30)), '0,245,255', 0.9);
    blob(g, -s * 0.75, 0, s * 0.22, '255,0,200', 0.5);
  });
  g.fillStyle = '#dfe6ee';
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.06);
  g.quadraticCurveTo(s * 0.1, -s * 0.14, s * 0.6, 0);
  g.quadraticCurveTo(s * 0.1, s * 0.1, -s * 0.5, s * 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = '#9aa6b4';
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.02);
  g.lineTo(-s * 0.48, s * 0.2);
  g.lineTo(-s * 0.05, s * 0.04);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.35, -s * 0.05);
  g.lineTo(-s * 0.5, -s * 0.2);
  g.lineTo(-s * 0.2, -s * 0.07);
  g.fill();
  g.fillStyle = '#00e5ff';
  g.fillRect(-s * 0.3, -s * 0.015, s * 0.6, s * 0.02);
  g.fillStyle = '#1e293b';
  g.beginPath();
  g.ellipse(s * 0.3, -s * 0.045, s * 0.1, s * 0.03, 0.1, 0, TAU);
  g.fill();
  g.restore();
}

function ship(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 1.8) * 0.04);
  g.strokeStyle = '#4a2c1a';
  g.lineWidth = Math.max(2, s * 0.02);
  const masts = [-0.25, 0.08, 0.36];
  g.beginPath();
  for (const m of masts) {
    g.moveTo(m * s, -s * 0.1);
    g.lineTo(m * s, -s * (m === 0.08 ? 0.95 : 0.78));
  }
  g.moveTo(s * 0.55, -s * 0.12);
  g.lineTo(s * 0.8, -s * 0.28);
  g.stroke();
  // sails
  masts.forEach((m, i) => {
    const top = m === 0.08 ? 0.9 : 0.72;
    for (let k = 0; k < 2; k++) {
      const y0 = -s * (top - k * 0.32);
      const y1 = y0 + s * 0.27;
      const sw = s * (0.22 - k * 0.02 + (i === 1 ? 0.03 : 0));
      const bulge = s * (0.07 + Math.sin(t * 2 + i + k) * 0.01);
      g.fillStyle = k === 0 && i === 1 ? '#fff4e0' : '#fffaf0';
      g.beginPath();
      g.moveTo(m * s - sw / 2, y0);
      g.lineTo(m * s + sw / 2, y0);
      g.quadraticCurveTo(m * s + sw / 2 + bulge, (y0 + y1) / 2, m * s + sw / 2, y1);
      g.lineTo(m * s - sw / 2, y1);
      g.quadraticCurveTo(m * s - sw / 2 + bulge, (y0 + y1) / 2, m * s - sw / 2, y0);
      g.fill();
    }
    g.fillStyle = '#e63946';
    g.beginPath();
    const fy = -s * (m === 0.08 ? 0.95 : 0.78);
    g.moveTo(m * s, fy);
    g.lineTo(m * s - s * 0.1, fy + Math.sin(t * 7 + i) * s * 0.015 + s * 0.02);
    g.lineTo(m * s, fy + s * 0.05);
    g.fill();
  });
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.moveTo(s * 0.48, -s * 0.14);
  g.lineTo(s * 0.78, -s * 0.27);
  g.quadraticCurveTo(s * 0.68, -s * 0.2, s * 0.5, -s * 0.5);
  g.closePath();
  g.fill();
  // hull
  g.fillStyle = '#6b3e26';
  g.beginPath();
  g.moveTo(-s * 0.55, -s * 0.16);
  g.lineTo(s * 0.62, -s * 0.12);
  g.quadraticCurveTo(s * 0.52, s * 0.08, s * 0.3, s * 0.1);
  g.lineTo(-s * 0.42, s * 0.1);
  g.quadraticCurveTo(-s * 0.56, s * 0.02, -s * 0.55, -s * 0.16);
  g.fill();
  g.fillStyle = '#c8a26b';
  g.fillRect(-s * 0.5, -s * 0.07, s * 1.05, s * 0.025);
  g.fillStyle = '#3d220f';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(-s * 0.35 + i * s * 0.14, -s * 0.0, s * 0.018, 0, TAU);
    g.fill();
  }
  g.restore();
}

function eiffel(g: G, x: number, y: number, h: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x - h * 0.28, y);
  g.quadraticCurveTo(x - h * 0.1, y - h * 0.35, x - h * 0.035, y - h * 0.85);
  g.lineTo(x, y - h);
  g.lineTo(x + h * 0.035, y - h * 0.85);
  g.quadraticCurveTo(x + h * 0.1, y - h * 0.35, x + h * 0.28, y);
  g.lineTo(x + h * 0.16, y);
  g.quadraticCurveTo(x, y - h * 0.22, x - h * 0.16, y);
  g.closePath();
  g.fill();
  g.fillRect(x - h * 0.17, y - h * 0.33, h * 0.34, h * 0.025);
  g.fillRect(x - h * 0.09, y - h * 0.6, h * 0.18, h * 0.02);
}

function futureTower(g: G, x: number, y: number, h: number, color: string, t: number): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x - h * 0.12, y);
  g.lineTo(x - h * 0.03, y - h * 0.8);
  g.lineTo(x, y - h);
  g.lineTo(x + h * 0.03, y - h * 0.8);
  g.lineTo(x + h * 0.12, y);
  g.fill();
  g.beginPath();
  g.ellipse(x, y - h * 0.62, h * 0.16, h * 0.05, 0, 0, TAU);
  g.fill();
  additive(g, () => blob(g, x, y - h, h * 0.12 * (1 + 0.3 * Math.sin(t * 6)), '0,245,255', 0.9));
}

function palm(g: G, x: number, y: number, h: number, t: number, color: string): void {
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = h * 0.07;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + h * 0.05, y - h * 0.5, x + h * 0.18, y - h);
  g.stroke();
  g.lineWidth = h * 0.05;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 2 + i) * 0.05;
    const tx = x + h * 0.18 + Math.cos(a) * h * 0.45;
    const ty = y - h + Math.sin(a) * h * 0.25 + h * 0.18;
    g.beginPath();
    g.moveTo(x + h * 0.18, y - h);
    g.quadraticCurveTo(x + h * 0.18 + Math.cos(a) * h * 0.3, y - h - h * 0.15, tx, ty);
    g.stroke();
  }
}

const travel = def(3.4, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  const sea = era === 'ancient' || era === 'medieval' || era === 'early';
  sky(g, L, era === 'future' ? ['#1a2a6c', '#5b4fbf', '#f39fdc', '#ffd6e8'] : ['#3a7bd5', '#6fb1fc', '#bfe1ff', '#ffe8c8']);
  additive(g, () => blob(g, visX(L, S, 0.92), L.h * 0.14, fh * 0.9, '255,240,180', 0.8));
  // drifting clouds
  for (let i = 0; i < 6; i++) {
    const w = L.w + 400;
    const cx = (((hash(i + 3) * w - t * (40 + i * 15)) % w) + w) % w - 200;
    cloud(g, cx, L.h * (0.12 + hash(i + 11) * 0.3) * (S.port ? 0.7 : 1), fh * (0.25 + hash(i) * 0.2), 'rgba(255,255,255,0.85)');
  }
  if (sea) {
    const hz = gy - fh * 0.32;
    const gr = g.createLinearGradient(0, hz, 0, L.h);
    gr.addColorStop(0, '#2a7fb0');
    gr.addColorStop(1, '#0f3d5e');
    g.fillStyle = gr;
    g.fillRect(0, hz, L.w, L.h - hz);
    // destination island
    const ix = S.alt ?? L.w * 0.85;
    const iw = S.alt !== null ? S.sideW * 0.5 : L.w * 0.22;
    g.fillStyle = '#f2d49b';
    g.beginPath();
    g.ellipse(ix, hz + fh * 0.03, iw * 0.5, fh * 0.09, 0, Math.PI, TAU);
    g.fill();
    palm(g, ix - iw * 0.12, hz, fh * (S.alt !== null ? 0.9 : 0.55), t, '#2d6a4f');
    palm(g, ix + iw * 0.18, hz, fh * (S.alt !== null ? 0.7 : 0.45), t + 1, '#40916c');
    if (p > 0.5) mapPin(g, ix, hz - fh * (S.alt !== null ? 1.0 : 0.62) - bump(p, 0.5, 0.6) * fh * 0.1, fh * 0.13 * pop(p, 0.5, 0.6), '#e63946');
    // the ship sails across the main side
    const sx = lerp(S.port ? -fh * 0.6 : S.main - S.sideW * 0.62, S.port ? L.w * 0.6 : S.main + S.sideW * 0.32, easeOut(p * 1.05));
    ship(g, sx, gy - fh * 0.12 + Math.sin(t * 2.2) * fh * 0.015, fh * 1.35, t);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1.5, fh * 0.012);
    for (let row = 0; row < 5; row++) {
      const yy = hz + fh * 0.12 + row * fh * 0.1;
      g.beginPath();
      for (let x = -20; x < L.w + 20; x += 12) {
        const yv = yy + Math.sin(x * 0.03 + t * 3 + row) * fh * 0.015;
        if (x === -20) g.moveTo(x, yv);
        else g.lineTo(x, yv);
      }
      g.stroke();
    }
    // gulls
    g.strokeStyle = '#2b2d42';
    g.lineWidth = Math.max(1.5, fh * 0.012);
    for (let i = 0; i < 4; i++) {
      const bx = visX(L, S, fract(hash(i + 40) + t * 0.05));
      const by = L.h * (0.2 + hash(i + 50) * 0.15);
      const fl = Math.sin(t * 8 + i) * fh * 0.02;
      g.beginPath();
      g.moveTo(bx - fh * 0.06, by - fl);
      g.quadraticCurveTo(bx - fh * 0.03, by - fh * 0.03, bx, by);
      g.quadraticCurveTo(bx + fh * 0.03, by - fh * 0.03, bx + fh * 0.06, by - fl);
      g.stroke();
    }
    return;
  }
  skyline(g, L, gy, era, 'rgba(110,140,190,0.55)', 47);
  floor(g, L, S, '#8fae7a', '#a6c48f');
  // destination landmark
  const lx = S.alt ?? L.w * 0.86;
  const lh = S.alt !== null ? fh * 1.9 : fh * 1.2;
  if (era === 'future') futureTower(g, lx, gy, lh, '#3b3f6b', t);
  else eiffel(g, lx, gy, lh, '#5a4a6b');
  if (p > 0.62) mapPin(g, lx, gy - lh - fh * 0.08 - bump(p, 0.62, 0.72) * fh * 0.1, fh * 0.15 * pop(p, 0.62, 0.72), '#e63946');
  // traveller with a suitcase
  const tx = S.port ? S.main - S.gap * 0.9 : S.main - S.gap * 0.35;
  fig(g, tx, gy, fh, { color: '#e76f51', accent: '#264653', pose: 'wave', phase: t, dir: 1, mood: 'laugh', hat: era === 'industrial' ? 'tophat' : 'cap' });
  const cx = tx + fh * 0.32;
  g.fillStyle = '#ffb703';
  rrect(g, cx - fh * 0.11, gy - fh * 0.34, fh * 0.22, fh * 0.32, fh * 0.03);
  g.fill();
  g.fillStyle = '#fb8500';
  g.fillRect(cx - fh * 0.11, gy - fh * 0.24, fh * 0.22, fh * 0.03);
  g.fillStyle = '#e63946';
  g.beginPath();
  g.arc(cx + fh * 0.04, gy - fh * 0.12, fh * 0.03, 0, TAU);
  g.fill();
  g.strokeStyle = '#555';
  g.lineWidth = Math.max(2, fh * 0.015);
  g.beginPath();
  g.moveTo(cx - fh * 0.05, gy - fh * 0.34);
  g.lineTo(cx - fh * 0.05, gy - fh * 0.42);
  g.lineTo(cx + fh * 0.05, gy - fh * 0.42);
  g.lineTo(cx + fh * 0.05, gy - fh * 0.34);
  g.stroke();
  // the plane crosses the sky
  const u = clamp((p - 0.05) / 0.85);
  const px = lerp(-fh * 0.8, L.w + fh * 0.8, u);
  const y0 = S.port ? gy - fh * 1.3 : gy - fh * 1.5;
  const y1 = S.port ? L.h * 0.06 : L.h * 0.1;
  const py = lerp(y0, y1, u);
  const ang = Math.atan2(y1 - y0, L.w + fh * 1.6);
  const ps = particles(f.mem, 'trail');
  const size = fh * (S.port ? 1.0 : 1.15);
  const tailX = px - Math.cos(ang) * size * 0.5;
  const tailY = py - Math.sin(ang) * size * 0.5;
  if (era !== 'industrial')
    emit(f, 'trail', 60, () => {
      if (ps.length < 150) ps.push({ x: tailX, y: tailY, vx: 0, vy: 0, life: 0, max: 1.6, size: fh * 0.035, color: era === 'future' ? '0,229,255' : '255,255,255' });
    });
  stepParticles(ps, f.dt);
  for (const q of ps) blob(g, q.x, q.y, q.size * (1 + q.life * 2.2), q.color, 0.6 * (1 - q.life / q.max));
  if (era === 'industrial') propPlane(g, px, py, size * 0.9, ang, t);
  else if (era === 'future') shuttle(g, px, py, size, ang, t);
  else jet(g, px, py, size, ang);
});

// ================================================================== 20. drugs

const drugs = def(3.0, (f, S) => {
  const { g, L, t } = f;
  const { fh } = S;
  g.fillStyle = '#12002a';
  g.fillRect(0, 0, L.w, L.h);
  const cx = L.w / 2;
  const cy = S.port ? L.h * 0.3 : L.h * 0.45;
  const cg = g.createConicGradient(t * 1.4, cx, cy);
  for (let i = 0; i <= 12; i++) cg.addColorStop(i / 12, `hsl(${(i * 60 + t * 140) % 360},95%,${i % 2 ? 55 : 35}%)`);
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * 0.75;
  g.fillStyle = cg;
  g.fillRect(0, 0, L.w, L.h);
  g.globalAlpha = a0;
  const centres = S.alt !== null ? [S.main, S.alt] : [S.main];
  centres.forEach((ccx, c) => {
    const ccy = S.port ? L.h * 0.3 : L.h * 0.45;
    const step = fh * 0.2;
    const maxR = Math.max(S.sideW, L.h) * 0.7;
    for (let r = 0; r < 14; r++) {
      const rad = ((r * step + t * fh * 0.55) % (14 * step)) + 4;
      if (rad > maxR) continue;
      g.strokeStyle = `hsla(${(r * 40 + t * 200 + c * 90) % 360},100%,75%,${0.55 * (1 - rad / maxR)})`;
      g.lineWidth = Math.max(2, fh * 0.03);
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const wr = rad * (1 + 0.1 * Math.sin(a * 6 + t * 5 + r));
        const x = ccx + Math.cos(a) * wr;
        const y = ccy + Math.sin(a) * wr * 0.9;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  });
  additive(g, () => {
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4 + t * (0.8 + (i % 3) * 0.3);
      const rr = fh * (0.3 + (i % 7) * 0.22) * (1 + 0.2 * Math.sin(t * 2 + i));
      const ccx = centres[i % centres.length];
      const hue = (i * 47 + t * 160) % 360;
      const rgb = hsl2rgb(hue, 1, 0.6);
      blob(g, ccx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr, fh * (0.15 + (i % 4) * 0.05), rgb, 0.55);
    }
  });
  // wobbly smiling flower faces drifting by
  for (let i = 0; i < (S.alt !== null ? 4 : 2); i++) {
    const x = visX(L, S, fract(hash(i + 2) + t * 0.06 * (i % 2 ? 1 : -1)));
    const y = L.h * (0.15 + hash(i + 7) * 0.3) + Math.sin(t * 2 + i) * fh * 0.1;
    const r = fh * 0.13 * (1 + 0.15 * Math.sin(t * 4 + i));
    g.save();
    g.translate(x, y);
    g.rotate(t * (i % 2 ? 1 : -1));
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `hsl(${(k * 60 + t * 200) % 360},100%,65%)`;
      g.beginPath();
      g.arc(Math.cos((k * TAU) / 6) * r, Math.sin((k * TAU) / 6) * r, r * 0.6, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ffe14d';
    g.beginPath();
    g.arc(0, 0, r * 0.75, 0, TAU);
    g.fill();
    g.fillStyle = '#2b0a3d';
    g.beginPath();
    g.arc(-r * 0.25, -r * 0.15, r * 0.09, 0, TAU);
    g.arc(r * 0.25, -r * 0.15, r * 0.09, 0, TAU);
    g.fill();
    g.strokeStyle = '#2b0a3d';
    g.lineWidth = Math.max(1.5, r * 0.1);
    g.beginPath();
    g.arc(0, r * 0.05, r * 0.35, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    g.restore();
  }
});

function hsl2rgb(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const fn = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${fn(0)},${fn(8)},${fn(4)}`;
}

// ================================================================== 21. calm

function meditator(g: G, x: number, y: number, h: number, color: string): void {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.ellipse(x, y - h * 0.08, h * 0.4, h * 0.1, 0, 0, TAU);
  g.fill();
  g.lineWidth = h * 0.13;
  g.beginPath();
  g.moveTo(x, y - h * 0.14);
  g.lineTo(x, y - h * 0.6);
  g.stroke();
  g.lineWidth = h * 0.06;
  g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(x + s * h * 0.03, y - h * 0.56);
    g.lineTo(x + s * h * 0.24, y - h * 0.32);
    g.lineTo(x + s * h * 0.34, y - h * 0.14);
  }
  g.stroke();
  g.beginPath();
  g.arc(x, y - h * 0.78, h * 0.13, 0, TAU);
  g.fill();
}

const calm = def(3.6, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy } = S;
  sky(g, L, ['#2d1b4e', '#6b3e75', '#d4708a', '#f9a87a', '#fcd6a4']);
  const hz = gy - fh * 0.38;
  const sunX = S.main;
  const sunR = fh * 0.42;
  const sunY = hz - sunR * 0.35 + p * fh * 0.08;
  additive(g, () => blob(g, sunX, sunY, sunR * 4, '255,200,140', 0.5));
  g.fillStyle = '#ffd59e';
  g.beginPath();
  g.arc(sunX, sunY, sunR, 0, TAU);
  g.fill();
  // distant hills
  g.fillStyle = '#5b2e5e';
  g.beginPath();
  g.moveTo(0, hz);
  for (let x = 0; x <= L.w + 40; x += 40) g.lineTo(x, hz - fh * (0.1 + 0.08 * Math.sin(x * 0.006) + 0.05 * Math.sin(x * 0.017)));
  g.lineTo(L.w, hz);
  g.fill();
  // still water
  const gr = g.createLinearGradient(0, hz, 0, L.h);
  gr.addColorStop(0, '#8a4f7d');
  gr.addColorStop(1, '#2a1b3d');
  g.fillStyle = gr;
  g.fillRect(0, hz, L.w, L.h - hz);
  g.fillStyle = 'rgba(255,213,158,0.55)';
  for (let i = 0; i < 9; i++) {
    const w = sunR * (1.3 - i * 0.1) * (0.75 + 0.25 * Math.sin(t * 2.5 + i * 1.3));
    g.fillRect(sunX - w + Math.sin(t * 1.7 + i) * 4, hz + 4 + i * fh * 0.045, w * 2, Math.max(2, fh * 0.012));
  }
  // ripples
  const sources = S.alt !== null ? [S.main, S.alt] : [S.main];
  g.lineWidth = Math.max(1.5, fh * 0.01);
  for (let i = 0; i < 6; i++) {
    const age = fract(t / 2.2 + i / 6 + (i % 2) * 0.13);
    const sx = sources[i % sources.length] + (i % 3 - 1) * fh * 0.15;
    const r = age * fh * 1.1;
    g.strokeStyle = `rgba(255,225,200,${0.5 * (1 - age)})`;
    g.beginPath();
    g.ellipse(sx, gy - fh * 0.02, r, r * 0.18, 0, 0, TAU);
    g.stroke();
  }
  // meditating on a rock
  g.fillStyle = '#2a1830';
  g.beginPath();
  g.ellipse(S.main, gy - fh * 0.02, fh * 0.45, fh * 0.1, 0, Math.PI, TAU);
  g.fill();
  const breathe = 1 + 0.015 * Math.sin(t * 2);
  additive(g, () => blob(g, S.main, gy - fh * 0.5, fh * 0.9 * breathe, '255,220,180', 0.35));
  meditator(g, S.main, gy - fh * 0.05, fh * 0.8 * breathe, '#22142e');
  // bamboo and lotus
  g.strokeStyle = '#1d1430';
  g.fillStyle = '#1d1430';
  for (const [bx, bh] of S.port ? [[L.w * 0.04, fh * 2.2], [L.w * 0.97, fh * 1.8]] : [[S.main - S.sideW * 0.45, fh * 2.4], [S.main - S.sideW * 0.38, fh * 1.9]]) {
    g.lineWidth = fh * 0.05;
    g.beginPath();
    g.moveTo(bx, gy + 10);
    g.lineTo(bx + Math.sin(t) * 3, gy - bh);
    g.stroke();
    for (let k = 1; k < 5; k++) {
      g.fillRect(bx - fh * 0.035, gy - (bh * k) / 5, fh * 0.07, fh * 0.012);
      g.beginPath();
      g.ellipse(bx + fh * 0.12, gy - (bh * k) / 5 - fh * 0.05, fh * 0.12, fh * 0.025, -0.5 + Math.sin(t + k) * 0.1, 0, TAU);
      g.fill();
    }
  }
  if (S.alt !== null) {
    for (let i = 0; i < 3; i++) {
      const lx = S.alt + (i - 1) * S.gap * 1.3;
      const ly = gy + fh * (0.02 + (i % 2) * 0.06) + Math.sin(t * 1.5 + i) * 2;
      g.fillStyle = '#2f6b4f';
      g.beginPath();
      g.ellipse(lx, ly, fh * 0.2, fh * 0.05, 0, 0.2, TAU - 0.2);
      g.lineTo(lx, ly);
      g.fill();
      g.fillStyle = '#ff9ec4';
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.ellipse(lx + k * fh * 0.035, ly - fh * 0.05, fh * 0.03, fh * 0.07, k * 0.35, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffd166';
      g.beginPath();
      g.arc(lx, ly - fh * 0.04, fh * 0.02, 0, TAU);
      g.fill();
    }
  }
  floaters(f, S, { kinds: ['dot'], colors: ['#fff3b0', '#ffe0a3'], size: [3, 6], rate: 6, speed: [10, 25], life: [2, 3], y: () => gy - f.rand() * fh * 1.4, max: 25 });
});

// ================================================================== 22. birthday

function partyHat(g: G, x: number, y: number, h: number, color: string): void {
  const hd = headOf(x, y, h);
  const r = hd.r;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(hd.x - r * 0.75, hd.y - r * 0.7);
  g.lineTo(hd.x + r * 0.15, hd.y - r * 2.7);
  g.lineTo(hd.x + r * 0.8, hd.y - r * 0.6);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.moveTo(hd.x - r * 0.45, hd.y - r * 1.3);
  g.lineTo(hd.x + r * 0.55, hd.y - r * 1.2);
  g.lineTo(hd.x + r * 0.42, hd.y - r * 1.55);
  g.lineTo(hd.x - r * 0.3, hd.y - r * 1.65);
  g.fill();
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.arc(hd.x + r * 0.15, hd.y - r * 2.75, r * 0.25, 0, TAU);
  g.fill();
}

function cake(g: G, x: number, y: number, w: number, t: number): void {
  additive(g, () => blob(g, x, y - w * 0.7, w * 1.3, '255,200,120', 0.45));
  g.fillStyle = '#ff8fab';
  g.fillRect(x - w / 2, y - w * 0.36, w, w * 0.36);
  g.fillStyle = '#ffc2d1';
  g.fillRect(x - w * 0.34, y - w * 0.64, w * 0.68, w * 0.28);
  g.fillStyle = '#ffffff';
  for (const [cw, cy] of [
    [w, -0.36],
    [w * 0.68, -0.64],
  ] as const) {
    g.fillRect(x - cw / 2, y + w * cy, cw, w * 0.05);
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(x - cw / 2 + (i + 0.5) * (cw / 6), y + w * cy + w * 0.05, cw / 14, 0, Math.PI);
      g.fill();
    }
  }
  g.fillStyle = '#e63946';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(x - w * 0.4 + i * w * 0.2, y - w * 0.18, w * 0.03, 0, TAU);
    g.fill();
  }
  const cols = ['#4cc9f0', '#ffd166', '#06d6a0'];
  for (let i = 0; i < 3; i++) {
    const cx = x - w * 0.18 + i * w * 0.18;
    g.fillStyle = cols[i];
    g.fillRect(cx - w * 0.02, y - w * 0.84, w * 0.04, w * 0.2);
    flame(g, cx, y - w * 0.85, w * 0.13, t, i);
  }
}

function gift(g: G, x: number, y: number, s: number, body: string, ribbon: string): void {
  g.fillStyle = body;
  g.fillRect(x - s / 2, y - s * 0.8, s, s * 0.8);
  g.fillRect(x - s * 0.55, y - s * 0.95, s * 1.1, s * 0.2);
  g.fillStyle = ribbon;
  g.fillRect(x - s * 0.08, y - s * 0.95, s * 0.16, s * 0.95);
  g.beginPath();
  g.ellipse(x - s * 0.2, y - s * 1.02, s * 0.2, s * 0.1, 0.4, 0, TAU);
  g.ellipse(x + s * 0.2, y - s * 1.02, s * 0.2, s * 0.1, -0.4, 0, TAU);
  g.fill();
}

const birthday = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#ffafcc', '#ffd6a5', '#fdffb6']);
  // bunting
  const by0 = S.port ? L.h * 0.03 : L.h * 0.05;
  const sag = L.h * 0.06;
  g.strokeStyle = '#8d6e63';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, by0);
  g.quadraticCurveTo(L.w / 2, by0 + sag * 2, L.w, by0);
  g.stroke();
  for (let i = 0; i < 40; i++) {
    const u = (i + 0.5) / 40;
    const x = u * L.w;
    const y = by0 + sag * 4 * u * (1 - u) * 0.5 * 2 * 0.5 * 2;
    g.fillStyle = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    g.beginPath();
    g.moveTo(x - L.w / 90, y);
    g.lineTo(x + L.w / 90, y);
    g.lineTo(x + Math.sin(t * 4 + i) * 2, y + Math.min(30, fh * 0.14));
    g.fill();
  }
  floor(g, L, S, '#cdb4db', '#e2cfe8');
  // balloons
  const bl = particles(f.mem, 'balloons');
  if (once(f, 'balloons'))
    for (let i = 0; i < (S.port ? 9 : 16); i++) bl.push({ x: visX(L, S, (i + f.rand()) / (S.port ? 9 : 16)), y: f.rand.range(gy * 0.35, gy * 1.35), vx: 0, vy: -f.rand.range(70, 130) * Math.max(0.7, S.k), life: 0, max: 99, size: fh * f.rand.range(0.1, 0.13), color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], rot: f.rand() * 10 });
  stepParticles(bl, f.dt);
  for (const b of bl) balloon(g, b.x + Math.sin(t * 1.5 + (b.rot ?? 0)) * fh * 0.05, b.y, b.size, b.color, t, b.rot ?? 0);
  // table and cake
  const tw = Math.min(fh * 0.85, S.sideW * 0.4);
  const tableY = gy - fh * 0.38;
  g.fillStyle = '#8d5a3b';
  g.fillRect(S.main - tw * 0.4, tableY, tw * 0.06, gy - tableY);
  g.fillRect(S.main + tw * 0.34, tableY, tw * 0.06, gy - tableY);
  g.fillStyle = '#ffffff';
  g.fillRect(S.main - tw / 2, tableY - fh * 0.03, tw, fh * 0.09);
  g.fillStyle = '#ff8fab';
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(S.main - tw / 2 + (i + 0.5) * (tw / 7), tableY + fh * 0.06, tw / 14, 0, Math.PI);
    g.fill();
  }
  cake(g, S.main, tableY - fh * 0.03, tw * 0.62, t);
  const bx = S.main - tw / 2 - gap * 0.55;
  const jump = Math.max(0, Math.sin(t * 7)) * fh * 0.05;
  fig(g, bx, gy - jump, fh, { color: '#3a86ff', pose: 'cheer', phase: t, dir: 1, mood: 'laugh' });
  partyHat(g, bx, gy - jump, fh, '#ff006e');
  if (S.port) {
    gift(g, S.main + tw / 2 + gap * 0.4, gy, fh * 0.22, '#06d6a0', '#ff006e');
    gift(g, S.main + tw / 2 + gap * 0.95, gy, fh * 0.16, '#ffd166', '#3a86ff');
  } else if (S.alt !== null) {
    gift(g, S.alt - gap * 1.2, gy, fh * 0.3, '#06d6a0', '#ff006e');
    gift(g, S.alt - gap * 0.55, gy, fh * 0.2, '#ffd166', '#3a86ff');
    gift(g, S.alt - gap * 0.85, gy - fh * 0.28, fh * 0.16, '#b388ff', '#ffd166');
    const fx = S.alt + gap * 0.6;
    const j2 = Math.max(0, Math.sin(t * 7 + 1.5)) * fh * 0.05;
    fig(g, fx, gy - j2, fh * 0.95, { color: '#f15bb5', dress: true, accent: '#ffd166', pose: 'cheer', phase: t + 1, dir: -1, mood: 'laugh' });
    partyHat(g, fx, gy - j2, fh * 0.95, '#06d6a0');
  }
  if (p > 0.45 && once(f, 'pop')) {
    confettiBurst(f, S.main, tableY - fh * 0.6, 40, 560 * S.k, CONFETTI_COLORS);
    if (S.alt !== null) confettiBurst(f, S.alt, gy - fh * 1.1, 30, 520 * S.k, CONFETTI_COLORS);
  }
  const conf = particles(f.mem, 'conf');
  stepParticles(conf, f.dt, 280, 1);
  drawConfetti(g, conf);
});

// ================================================================== 23. fireworks

interface Rocket {
  x: number;
  y: number;
  ty: number;
  vy: number;
  hue: number;
  willow: boolean;
}

const fireworks = def(3.4, (f, S) => {
  const { g, L, t, dur } = f;
  const { fh, gy } = S;
  sky(g, L, ['#020414', '#0a1030', '#1a1f4a']);
  starfield(g, L, S, 50, gy * 0.8, t, '#e8ecff', 12);
  const flashes = (f.mem.flashes as { x: number; y: number; t: number; c: string }[] | undefined) ?? (f.mem.flashes = []);
  // skyline lit by the bursts
  let lit = 0;
  for (const fl of flashes) lit = Math.max(lit, clamp(1 - (t - fl.t) / 0.5));
  skyline(g, L, gy, f.era, '#0b0f24', 7, 'rgba(255,214,106,0.35)');
  if (lit > 0) {
    g.fillStyle = `rgba(255,240,220,${0.06 * lit})`;
    g.fillRect(0, 0, L.w, gy);
  }
  floor(g, L, S, '#05060d');
  const rockets = (f.mem.rockets as Rocket[] | undefined) ?? (f.mem.rockets = []);
  const sparks = particles(f.mem, 'sparks');
  let next = (f.mem.next as number | undefined) ?? 0.1;
  while (t >= next && next < dur - 1.0) {
    rockets.push({ x: visX(L, S, f.rand.range(0.05, 0.95)), y: gy, ty: f.rand.range(L.h * 0.08, Math.max(L.h * 0.12, gy - fh * 1.6)), vy: 0, hue: f.rand() * 360, willow: f.rand() < 0.25 });
    next += f.rand.range(0.2, 0.34);
  }
  f.mem.next = next;
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.vy = -(r.y - r.ty) * 3.2 - 60;
    r.y += r.vy * f.dt;
    if (sparks.length < 300) sparks.push({ x: r.x + f.rand.range(-1, 1), y: r.y, vx: f.rand.range(-15, 15), vy: f.rand.range(10, 50), life: 0, max: 0.35, size: 1.6, color: '#ffd9a0' });
    if (r.y - r.ty < 6) {
      rockets.splice(i, 1);
      const n = Math.min(54, 300 - sparks.length);
      const col = `hsl(${r.hue},100%,65%)`;
      const col2 = `hsl(${(r.hue + 40) % 360},100%,80%)`;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + f.rand.range(-0.05, 0.05);
        const v = f.rand.range(0.75, 1) * (r.willow ? 160 : 240) * Math.max(0.75, S.k);
        sparks.push({ x: r.x, y: r.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: r.willow ? 1.9 : f.rand.range(1, 1.4), size: r.willow ? 1.8 : 2.4, color: k % 5 === 0 ? col2 : r.willow ? '#ffcf70' : col, kind: r.willow ? 1 : 0 });
      }
      flashes.push({ x: r.x, y: r.ty, t, c: hsl2rgb(r.hue, 1, 0.7) });
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    const gr = s.kind === 1 ? 140 : 90;
    s.vy += gr * f.dt;
    s.vx *= 1 - 1.4 * f.dt;
    s.vy *= 1 - 1.4 * f.dt;
    s.x += s.vx * f.dt;
    s.y += s.vy * f.dt;
    s.life += f.dt;
    if (s.life >= s.max) sparks.splice(i, 1);
  }
  additive(g, () => {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const fl = flashes[i];
      const age = t - fl.t;
      if (age > 0.6) {
        flashes.splice(i, 1);
        continue;
      }
      blob(g, fl.x, fl.y, fh * (0.6 + age * 2), fl.c, 0.7 * (1 - age / 0.6));
    }
    const a0 = g.globalAlpha;
    g.lineCap = 'round';
    for (const s of sparks) {
      const k = 1 - s.life / s.max;
      g.globalAlpha = a0 * clamp(k * 1.4);
      g.strokeStyle = s.color;
      g.lineWidth = s.size;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
      g.stroke();
    }
    g.globalAlpha = a0;
  });
  // crowd watching
  const crowdY = gy + fh * 0.02;
  g.fillStyle = '#030409';
  g.beginPath();
  const sp = fh * 0.14;
  for (let x = sp * 0.3; x < L.w; x += sp) {
    const i = Math.round(x / sp);
    const hh = fh * (0.16 + hash(i) * 0.08);
    const r = fh * 0.05;
    g.moveTo(x + r, crowdY - hh);
    g.arc(x, crowdY - hh, r, 0, TAU);
    g.rect(x - r * 1.5, crowdY - hh + r * 0.8, r * 3, hh);
    if (hash(i + 5) > 0.75) {
      g.rect(x + r * 0.8, crowdY - hh - r * 2.4 - Math.max(0, Math.sin(t * 6 + i)) * r * 0.6, r * 0.5, r * 3);
    }
  }
  g.fill();
});

// ================================================================== 24. fame

function rose(g: G, x: number, y: number, s: number, rot: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = '#2d6a4f';
  g.lineWidth = Math.max(1.5, s * 0.25);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, s * 2.2);
  g.stroke();
  g.fillStyle = '#d00000';
  g.beginPath();
  g.arc(0, 0, s, 0, TAU);
  g.fill();
  g.strokeStyle = '#7a0000';
  g.lineWidth = Math.max(1, s * 0.18);
  g.beginPath();
  g.arc(s * 0.1, 0, s * 0.5, 0.5, 4.5);
  g.stroke();
  g.restore();
}

const fame = def(3.4, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, gap } = S;
  const cameras = !(era === 'ancient' || era === 'medieval' || era === 'early');
  sky(g, L, ['#0b0614', '#25103a', '#4a1b5c']);
  starfield(g, L, S, 40, gy * 0.7, t, '#ffe9b0', 31);
  // sweeping spotlights
  const beams = S.port ? [L.w * 0.15, L.w * 0.85] : [S.main - S.sideW * 0.35, S.main + S.sideW * 0.35, ...(S.alt !== null ? [S.alt - S.sideW * 0.3, S.alt + S.sideW * 0.3] : [])];
  additive(g, () => {
    beams.forEach((bx, i) => {
      const a = -Math.PI / 2 + Math.sin(t * 1.1 + i * 1.7) * 0.45;
      const len = L.h * 1.2;
      const gr = g.createLinearGradient(bx, L.h, bx + Math.cos(a) * len, L.h + Math.sin(a) * len);
      gr.addColorStop(0, 'rgba(255,240,200,0.35)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(bx - 6, L.h);
      g.lineTo(bx + Math.cos(a - 0.06) * len, L.h + Math.sin(a - 0.06) * len);
      g.lineTo(bx + Math.cos(a + 0.06) * len, L.h + Math.sin(a + 0.06) * len);
      g.lineTo(bx + 6, L.h);
      g.fill();
    });
  });
  floor(g, L, S, '#140a1e', '#22122e');
  // red carpet
  const cw0 = fh * 0.45;
  const cw1 = fh * 1.5;
  g.fillStyle = '#b5121b';
  g.beginPath();
  g.moveTo(S.main - cw0, gy - fh * 0.1);
  g.lineTo(S.main + cw0, gy - fh * 0.1);
  g.lineTo(S.main + cw1, L.h);
  g.lineTo(S.main - cw1, L.h);
  g.fill();
  g.strokeStyle = '#f2c94c';
  g.lineWidth = Math.max(2, fh * 0.012);
  g.beginPath();
  g.moveTo(S.main - cw0 * 0.9, gy - fh * 0.1);
  g.lineTo(S.main - cw1 * 0.9, L.h);
  g.moveTo(S.main + cw0 * 0.9, gy - fh * 0.1);
  g.lineTo(S.main + cw1 * 0.9, L.h);
  g.stroke();
  // velvet ropes
  for (const s of [-1, 1]) {
    const posts = [0.15, 0.6].map((u) => [S.main + s * lerp(cw0, cw1, u) * 1.12, lerp(gy - fh * 0.1, L.h, u) * 1] as const);
    g.strokeStyle = '#8b0a1a';
    g.lineWidth = Math.max(2, fh * 0.02);
    g.beginPath();
    g.moveTo(posts[0][0], posts[0][1] - fh * 0.25);
    g.quadraticCurveTo((posts[0][0] + posts[1][0]) / 2, (posts[0][1] + posts[1][1]) / 2 - fh * 0.12, posts[1][0], posts[1][1] - fh * 0.3);
    g.stroke();
    g.fillStyle = '#f2c94c';
    for (const [px, py] of posts) {
      const ph = fh * (0.28 + (py - gy) / L.h * 0.2);
      g.fillRect(px - fh * 0.012, py - ph, fh * 0.024, ph);
      g.beginPath();
      g.arc(px, py - ph, fh * 0.025, 0, TAU);
      g.fill();
    }
  }
  // the star walks forward, waving
  const sh = fh * lerp(0.9, 1.05, span(p, 0, 0.8));
  const sy = gy - fh * 0.1 + span(p, 0, 0.8) * fh * 0.12;
  additive(g, () => blob(g, S.main, sy - sh * 0.5, sh * 0.9, '255,230,160', 0.45));
  fig(g, S.main, sy, sh, { color: '#3a2a4d', dress: true, accent: '#f2c94c', pose: 'wave', phase: t, dir: 1, mood: 'smile' });
  const hd = headOf(S.main, sy, sh);
  g.fillStyle = '#111';
  g.fillRect(hd.x - hd.r * 0.62, hd.y - hd.r * 0.3, hd.r * 0.55, hd.r * 0.3);
  g.fillRect(hd.x + hd.r * 0.12, hd.y - hd.r * 0.3, hd.r * 0.55, hd.r * 0.3);
  g.fillRect(hd.x - hd.r * 0.1, hd.y - hd.r * 0.26, hd.r * 0.25, hd.r * 0.08);
  // crowd / paparazzi
  const crowdXs: number[] = [];
  const addCrowd = (cx: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) crowdXs.push(cx + (i - (n - 1) / 2) * spread);
  };
  if (S.port) {
    addCrowd(L.w * 0.12, 2, gap * 0.9);
    addCrowd(L.w * 0.88, 2, gap * 0.9);
  } else {
    addCrowd(S.main - S.sideW * 0.4, 1, 0);
    addCrowd(S.main + S.sideW * 0.4, 1, 0);
    if (S.alt !== null) addCrowd(S.alt, 4, gap * 0.95);
  }
  crowdXs.forEach((cx, i) => {
    const h = fh * (0.85 + hash(i) * 0.1);
    const bob = Math.max(0, Math.sin(t * 7 + i * 2)) * fh * 0.03;
    if (cameras) {
      fig(g, cx, gy + fh * 0.12 - bob, h, { color: '#120a1a', pose: 'hold', dir: cx < S.main ? 1 : -1, hat: era === 'industrial' ? 'tophat' : 'cap' });
      const hh = headOf(cx, gy + fh * 0.12 - bob, h);
      const d = cx < S.main ? 1 : -1;
      g.fillStyle = '#2b2b3a';
      g.fillRect(hh.x + d * hh.r * 0.3 - hh.r * 0.6, hh.y - hh.r * 0.4, hh.r * 1.2, hh.r * 0.85);
      g.fillStyle = '#555';
      g.fillRect(hh.x + d * hh.r * 0.9 - hh.r * 0.25, hh.y - hh.r * 0.2, hh.r * 0.5, hh.r * 0.45);
    } else {
      fig(g, cx, gy + fh * 0.12 - bob, h, { color: ['#7a3e48', '#3d5a80', '#6d597a', '#9c6644'][i % 4], pose: 'cheer', phase: t + i, mood: 'laugh', dress: i % 2 === 1, accent: '#e9c46a' });
    }
  });
  if (cameras) {
    const fl = (f.mem.flashes as { x: number; y: number; t: number }[] | undefined) ?? (f.mem.flashes = []);
    if (p < 0.85)
      emit(f, 'flash', 9, () => {
        const cx = f.rand.pick(crowdXs);
        const hh = headOf(cx, gy + fh * 0.12, fh * 0.9);
        fl.push({ x: cx + (cx < S.main ? 1 : -1) * hh.r * 0.9, y: hh.y, t });
      });
    let big = 0;
    additive(g, () => {
      for (let i = fl.length - 1; i >= 0; i--) {
        const age = t - fl[i].t;
        if (age > 0.18) {
          fl.splice(i, 1);
          continue;
        }
        const k = 1 - age / 0.18;
        big = Math.max(big, k);
        blob(g, fl[i].x, fl[i].y, fh * 0.5 * k, '255,255,255', 0.95);
        sparkle(g, fl[i].x, fl[i].y, fh * 0.22 * k, '#ffffff');
      }
    });
    if (big > 0.8) {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, 0, L.w, L.h);
    }
  } else {
    const rs = particles(f.mem, 'roses');
    if (p < 0.8)
      emit(f, 'roses', 5, () => {
        const sx = f.rand.pick(crowdXs);
        const tx = S.main + f.rand.range(-0.4, 0.4) * fh;
        const T = 0.9;
        const ty = gy + fh * f.rand.range(-0.05, 0.15);
        const y0 = gy - fh * 0.9;
        rs.push({ x: sx, y: y0, vx: (tx - sx) / T, vy: (ty - y0) / T - 0.5 * 600 * T, life: 0, max: T, size: fh * 0.035, color: '#d00000', rot: f.rand() * TAU, vr: f.rand.range(-6, 6) });
      });
    const landed = (f.mem.landed as { x: number; y: number; r: number }[] | undefined) ?? (f.mem.landed = []);
    for (const r of rs) if (r.life + f.dt >= r.max) landed.push({ x: r.x, y: r.y, r: r.rot ?? 0 });
    stepParticles(rs, f.dt, 600);
    for (const r of landed) rose(g, r.x, r.y, fh * 0.035, r.r);
    for (const r of rs) rose(g, r.x, r.y, r.size, r.rot ?? 0);
  }
  floaters(f, S, { kinds: ['star', 'sparkle'], colors: ['#ffd166', '#fff3b0', '#ffffff'], size: [5, 10], rate: 9, x: () => S.main + f.rand.range(-1, 1) * fh * 0.7, y: () => gy - fh * f.rand.range(0.6, 1.4), speed: [10, 35], life: [0.7, 1.3], max: 20 });
});

// ================================================================== 25. coronation

function bigCrown(g: G, x: number, y: number, w: number): void {
  const h = w * 0.62;
  g.fillStyle = '#f2c94c';
  g.strokeStyle = '#b8860b';
  g.lineWidth = Math.max(1.5, w * 0.03);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x - w * 0.5, y);
  g.lineTo(x - w * 0.5, y - h * 0.25);
  g.lineTo(x - w * 0.56, y - h);
  g.lineTo(x - w * 0.26, y - h * 0.52);
  g.lineTo(x, y - h * 1.15);
  g.lineTo(x + w * 0.26, y - h * 0.52);
  g.lineTo(x + w * 0.56, y - h);
  g.lineTo(x + w * 0.5, y - h * 0.25);
  g.lineTo(x + w * 0.5, y);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(x - w * 0.42, y - h * 0.22, w * 0.84, h * 0.06);
  g.fillStyle = '#fff3b0';
  for (const [dx, dy] of [
    [-0.56, -1],
    [0, -1.15],
    [0.56, -1],
  ] as const) {
    g.beginPath();
    g.arc(x + dx * w, y + dy * h, w * 0.06, 0, TAU);
    g.fill();
  }
  const gems = ['#e63946', '#3a86ff', '#06d6a0'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = gems[i];
    g.beginPath();
    g.arc(x + (i - 1) * w * 0.3, y - h * 0.12, w * 0.055, 0, TAU);
    g.fill();
  }
}

function trumpeter(g: G, x: number, y: number, h: number, dir: 1 | -1, t: number, blowing: boolean): void {
  fig(g, x, y, h, { color: '#2b2d42', accent: '#f2c94c', dir, mood: blowing ? 'wow' : 'smile', hat: 'cap' });
  const hd = headOf(x, y, h);
  const ang = -0.5 + (blowing ? Math.sin(t * 10) * 0.03 : 0);
  const mx = hd.x + dir * hd.r * 0.8;
  const my = hd.y + hd.r * 0.35;
  const len = h * 0.55;
  const ex = mx + dir * Math.cos(ang) * len;
  const ey = my + Math.sin(ang) * len;
  g.strokeStyle = '#2b2d42';
  g.lineWidth = Math.max(2, h * 0.065);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y - h * 0.7);
  g.lineTo(lerp(mx, ex, 0.4), lerp(my, ey, 0.4));
  g.stroke();
  g.strokeStyle = '#f2c94c';
  g.lineWidth = Math.max(2, h * 0.025);
  g.beginPath();
  g.moveTo(mx, my);
  g.lineTo(ex, ey);
  g.stroke();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  g.moveTo(ex - dir * Math.cos(ang) * h * 0.08, ey - Math.sin(ang) * h * 0.08);
  g.lineTo(ex + nx * h * 0.07 * dir, ey + ny * h * 0.07);
  g.lineTo(ex - nx * h * 0.07 * dir, ey - ny * h * 0.07);
  g.fill();
  // hanging banner
  const bx = lerp(mx, ex, 0.55);
  const by = lerp(my, ey, 0.55);
  const bw = h * 0.2;
  const bh = h * 0.24;
  const sway = Math.sin(t * 3 + x) * h * 0.015;
  g.fillStyle = '#7b2cbf';
  g.beginPath();
  g.moveTo(bx - bw / 2, by);
  g.lineTo(bx + bw / 2, by);
  g.lineTo(bx + bw / 2 + sway, by + bh);
  g.lineTo(bx + sway, by + bh * 0.78);
  g.lineTo(bx - bw / 2 + sway, by + bh);
  g.closePath();
  g.fill();
  g.strokeStyle = '#f2c94c';
  g.lineWidth = Math.max(1, h * 0.01);
  g.stroke();
  star(g, bx + sway * 0.5, by + bh * 0.38, bw * 0.22, '#f2c94c');
  if (blowing) {
    g.strokeStyle = 'rgba(255,220,120,0.7)';
    g.lineWidth = Math.max(1.5, h * 0.012);
    for (let i = 0; i < 3; i++) {
      const r = h * (0.08 + fract(t * 2 + i / 3) * 0.2);
      g.beginPath();
      g.arc(ex, ey, r, dir > 0 ? ang - 0.6 : Math.PI + -ang - 0.6, dir > 0 ? ang + 0.6 : Math.PI - ang + 0.6);
      g.stroke();
    }
  }
}

const coronation = def(3.6, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, gap } = S;
  sky(g, L, ['#1a0b2e', '#3c1361', '#6a2c91', '#a4508b']);
  rays(g, S.main, -L.h * 0.1, 10, L.h * 1.1, Math.PI / 2, 0.9, 0.04, '255,230,150', 0.35);
  floor(g, L, S, '#2a0f3d', '#3d1757');
  // carpet
  g.fillStyle = '#9b111e';
  g.beginPath();
  g.moveTo(S.main - fh * 0.3, gy);
  g.lineTo(S.main + fh * 0.3, gy);
  g.lineTo(S.main + fh * 0.9, L.h);
  g.lineTo(S.main - fh * 0.9, L.h);
  g.fill();
  additive(g, () => {
    const gr = g.createLinearGradient(0, 0, 0, gy);
    gr.addColorStop(0, 'rgba(255,230,150,0.08)');
    gr.addColorStop(1, 'rgba(255,230,150,0.45)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(S.main - fh * 0.15, 0);
    g.lineTo(S.main + fh * 0.15, 0);
    g.lineTo(S.main + fh * 0.5, gy);
    g.lineTo(S.main - fh * 0.5, gy);
    g.fill();
  });
  // royal cape
  const mx = S.main;
  g.fillStyle = '#b5172a';
  g.beginPath();
  g.moveTo(mx - fh * 0.1, gy - fh * 0.72);
  g.lineTo(mx + fh * 0.1, gy - fh * 0.72);
  g.lineTo(mx + fh * 0.3, gy);
  g.lineTo(mx - fh * 0.3, gy);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillRect(mx - fh * 0.3, gy - fh * 0.05, fh * 0.6, fh * 0.05);
  g.beginPath();
  g.ellipse(mx, gy - fh * 0.72, fh * 0.14, fh * 0.04, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#111';
  for (let i = 0; i < 6; i++) g.fillRect(mx - fh * 0.26 + i * fh * 0.1, gy - fh * 0.035, fh * 0.015, fh * 0.02);
  const landT = 0.62;
  const landed = p >= landT;
  fig(g, mx, gy, fh, { color: '#3b2554', accent: '#f2c94c', pose: landed ? 'wave' : 'stand', phase: t, dir: 1, mood: landed ? 'laugh' : 'calm' });
  // the crown descends
  const hd = headOf(mx, gy, fh);
  const restY = hd.y - hd.r * 0.55;
  const restW = hd.r * 2.1;
  const u = easeOut(clamp((p - 0.06) / (landT - 0.06)));
  const cy = lerp(-fh * 0.3, restY, u);
  const cw = lerp(restW * 2.6, restW, u);
  additive(g, () => blob(g, mx, cy - cw * 0.35, cw * (landed ? 1.6 : 1.3), '255,220,120', 0.7));
  g.save();
  g.translate(mx, cy);
  g.rotate(landed ? 0 : Math.sin(t * 3) * 0.08 * (1 - u));
  bigCrown(g, 0, 0, cw);
  g.restore();
  if (!landed) {
    const tr = particles(f.mem, 'trail');
    emit(f, 'trail', 30, () => {
      if (tr.length < 60) tr.push({ x: mx + f.rand.range(-0.5, 0.5) * cw, y: cy - cw * 0.3, vx: f.rand.range(-20, 20), vy: f.rand.range(-30, 10), life: 0, max: 0.8, size: f.rand.range(3, 7) * Math.max(0.7, S.k), color: '#ffe08a' });
    });
  }
  if (landed && once(f, 'land')) {
    const tr = particles(f.mem, 'trail');
    for (let i = 0; i < 40; i++) {
      const a = f.rand() * TAU;
      const v = f.rand.range(80, 260) * Math.max(0.7, S.k);
      tr.push({ x: mx, y: restY - restW * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1, size: f.rand.range(4, 9) * Math.max(0.7, S.k), color: f.rand.pick(['#ffe08a', '#ffffff', '#f2c94c']) });
    }
  }
  const tr = particles(f.mem, 'trail');
  stepParticles(tr, f.dt, 60, 1);
  for (const s of tr) {
    g.globalAlpha = f.a * clamp(1 - s.life / s.max);
    sparkle(g, s.x, s.y, s.size, s.color);
  }
  g.globalAlpha = f.a;
  if (landed) rays(g, mx, restY - restW * 0.3, 12, fh * 0.9 * pop(p, landT, landT + 0.15), t, TAU, 0.05, '255,230,150', 0.6);
  // trumpeters
  const td = S.port ? S.gap * 1.6 : Math.min(S.sideW * 0.36, gap * 1.9);
  trumpeter(g, mx - td, gy, fh * 0.9, 1, t, p > 0.3);
  trumpeter(g, mx + td, gy, fh * 0.9, -1, t + 1, p > 0.3);
  if (S.alt !== null) {
    for (const s of [-1, 1]) {
      const bx = S.alt + s * S.sideW * 0.25;
      const bw = fh * 0.32;
      const bh = fh * 1.3;
      const sw = Math.sin(t * 1.5 + s) * fh * 0.03;
      g.fillStyle = '#f2c94c';
      g.fillRect(bx - bw * 0.65, 0, bw * 1.3, fh * 0.03);
      g.fillStyle = s < 0 ? '#7b2cbf' : '#b5172a';
      g.beginPath();
      g.moveTo(bx - bw / 2, 0);
      g.lineTo(bx + bw / 2, 0);
      g.lineTo(bx + bw / 2 + sw, bh);
      g.lineTo(bx + sw, bh - bw * 0.4);
      g.lineTo(bx - bw / 2 + sw, bh);
      g.closePath();
      g.fill();
      g.strokeStyle = '#f2c94c';
      g.lineWidth = Math.max(2, fh * 0.012);
      g.stroke();
      bigCrown(g, bx + sw * 0.5, bh * 0.45, bw * 0.6);
    }
    for (let i = 0; i < 3; i++) {
      const x = S.alt + (i - 1) * gap * 1.05;
      const cheer = landed;
      const bob = cheer ? Math.max(0, Math.sin(t * 8 + i * 2)) * fh * 0.05 : 0;
      fig(g, x, gy - bob + fh * 0.04, fh * 0.85, { color: ['#3d5a80', '#9c6644', '#6d597a'][i], dress: i === 1, accent: '#e9c46a', pose: cheer ? 'cheer' : 'stand', phase: t + i, mood: cheer ? 'laugh' : 'wow' });
    }
  }
  if (landed) confettiRain(f, S, 50, ['#f2c94c', '#ffe08a', '#ffffff', '#b5172a', '#7b2cbf'], 'gold', 0.9);
});

// ================================================================== 26. pet

function dog(g: G, x: number, y: number, s: number, t: number, dir: 1 | -1): void {
  const body = '#c98b4a';
  const dark = '#8a5523';
  const belly = '#f3d2a2';
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.lineCap = 'round';
  // tail
  const wag = Math.sin(t * 24) * 0.55;
  g.strokeStyle = body;
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.moveTo(-s * 0.4, -s * 0.58);
  g.quadraticCurveTo(-s * 0.55 + Math.sin(wag) * s * 0.1, -s * 0.8, -s * 0.5 + Math.sin(wag) * s * 0.35, -s * 1.0 + Math.abs(wag) * s * 0.1);
  g.stroke();
  // far legs
  g.strokeStyle = dark;
  g.lineWidth = s * 0.11;
  g.beginPath();
  g.moveTo(-s * 0.22, -s * 0.4);
  g.lineTo(-s * 0.26, -s * 0.05);
  g.moveTo(s * 0.32, -s * 0.4);
  g.lineTo(s * 0.36, -s * 0.05);
  g.stroke();
  // body
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, -s * 0.52, s * 0.46, s * 0.22, 0, 0, TAU);
  g.fill();
  g.fillStyle = belly;
  g.beginPath();
  g.ellipse(s * 0.05, -s * 0.42, s * 0.3, s * 0.1, 0, 0, TAU);
  g.fill();
  // near legs
  g.strokeStyle = body;
  g.beginPath();
  g.moveTo(-s * 0.3, -s * 0.4);
  g.lineTo(-s * 0.32, -s * 0.04);
  g.moveTo(s * 0.26, -s * 0.4);
  g.lineTo(s * 0.28, -s * 0.04);
  g.stroke();
  // head
  const hx = s * 0.48;
  const hy = -s * 0.86 + Math.sin(t * 6) * s * 0.02;
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(s * 0.38, -s * 0.68, s * 0.12, s * 0.16, -0.5, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(hx, hy, s * 0.23, 0, TAU);
  g.fill();
  g.fillStyle = belly;
  g.beginPath();
  g.ellipse(hx + s * 0.18, hy + s * 0.07, s * 0.15, s * 0.11, 0, 0, TAU);
  g.fill();
  // tongue
  g.fillStyle = '#ff6b8b';
  g.beginPath();
  g.ellipse(hx + s * 0.2, hy + s * 0.2 + Math.sin(t * 12) * s * 0.015, s * 0.05, s * 0.08, 0.2, 0, TAU);
  g.fill();
  g.fillStyle = '#1b1b1b';
  g.beginPath();
  g.arc(hx + s * 0.31, hy + s * 0.02, s * 0.05, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(hx + s * 0.06, hy - s * 0.07, s * 0.04, 0, TAU);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(hx + s * 0.075, hy - s * 0.085, s * 0.013, 0, TAU);
  g.fill();
  // ear
  g.fillStyle = dark;
  g.save();
  g.translate(hx - s * 0.1, hy - s * 0.15);
  g.rotate(0.3 + Math.sin(t * 10) * 0.2);
  g.beginPath();
  g.ellipse(0, s * 0.12, s * 0.08, s * 0.16, 0, 0, TAU);
  g.fill();
  g.restore();
  // collar
  g.strokeStyle = '#e63946';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(s * 0.3, -s * 0.62);
  g.lineTo(s * 0.44, -s * 0.72);
  g.stroke();
  g.fillStyle = '#f2c94c';
  g.beginPath();
  g.arc(s * 0.38, -s * 0.6, s * 0.035, 0, TAU);
  g.fill();
  g.restore();
}

function pawPrint(g: G, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.36, 0, 0, TAU);
  g.fill();
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(x + (i - 1.5) * s * 0.3, y - s * 0.5 - (i === 1 || i === 2 ? s * 0.1 : 0), s * 0.15, 0, TAU);
    g.fill();
  }
}

const pet = def(2.8, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#8fd3ff', '#c7ecff', '#fff5d1']);
  additive(g, () => blob(g, visX(L, S, 0.95), L.h * 0.1, fh, '255,240,190', 0.7));
  skyline(g, L, gy, era, 'rgba(160,190,220,0.7)', 53);
  floor(g, L, S, '#79c267', '#95d47c');
  const ds = fh * 0.6;
  const dx = S.main + ds * 0.35;
  const hop = Math.abs(Math.sin(t * 6.5)) * ds * 0.12;
  footShadow(g, dx, gy, ds * 0.45, 0.25 * (1 - hop / ds));
  const ox = S.main - ds * 0.85;
  fig(g, ox, gy, fh, { color: '#ef476f', pose: 'kneel', dir: 1, mood: 'laugh' });
  // petting hand
  const hd = headOf(ox, gy, fh, true);
  g.strokeStyle = '#ef476f';
  g.lineWidth = Math.max(2, fh * 0.075);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ox, hd.y + hd.r * 1.4);
  g.lineTo(ox + fh * 0.26, hd.y + hd.r * 1.4 + Math.sin(t * 6) * fh * 0.03);
  g.stroke();
  dog(g, dx, gy - hop, ds, t, -1);
  floaters(f, S, { kinds: ['heart'], colors: ['#ff4d6d', '#ff8fab'], size: [7, 12], rate: 4, x: () => dx + f.rand.range(-0.3, 0.3) * ds, y: () => gy - ds * 1.0, speed: [40, 70], life: [1, 1.5], max: 10 });
  if (S.alt !== null) {
    // bouncing ball and a trail of paw prints
    const bx = S.alt + Math.sin(t * 1.6) * S.sideW * 0.25;
    const bounce = Math.abs(Math.sin(t * 5));
    const by = gy - bounce * fh * 0.6 - fh * 0.08;
    const sq = bounce < 0.15 ? 0.8 : 1;
    footShadow(g, bx, gy, fh * 0.08 * (1.4 - bounce * 0.6), 0.25);
    g.save();
    g.translate(bx, by);
    g.scale(1 / sq, sq);
    g.rotate(t * 4);
    g.fillStyle = '#e63946';
    g.beginPath();
    g.arc(0, 0, fh * 0.08, 0, TAU);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(2, fh * 0.02);
    g.beginPath();
    g.arc(0, 0, fh * 0.08, -0.9, 0.9);
    g.stroke();
    g.restore();
    const n = Math.floor(clamp(f.p / 0.7) * 8);
    for (let i = 0; i < n; i++) {
      const px = S.alt - S.sideW * 0.42 + i * S.sideW * 0.11;
      pawPrint(g, px, gy + fh * (0.05 + (i % 2) * 0.06), fh * 0.06, 'rgba(70,110,50,0.55)');
    }
  }
});

// ================================================================== 27. house

function keyShape(g: G, x: number, y: number, s: number, rot: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, s * 0.25, s * 0.25, 0, TAU);
  g.arc(0, s * 0.25, s * 0.1, 0, TAU, true);
  g.fill('evenodd');
  g.fillRect(-s * 0.05, s * 0.45, s * 0.1, s * 0.75);
  g.fillRect(s * 0.05, s * 0.95, s * 0.14, s * 0.07);
  g.fillRect(s * 0.05, s * 1.1, s * 0.1, s * 0.07);
  g.restore();
}

function sign(g: G, x: number, y: number, h: number, sold: number, t: number): void {
  g.fillStyle = '#7a5230';
  g.fillRect(x - h * 0.025, y - h, h * 0.05, h);
  g.fillRect(x - h * 0.025, y - h, h * 0.5, h * 0.04);
  const bx = x + h * 0.25;
  const by = y - h * 0.82;
  const sw = Math.sin(t * 2) * 0.04;
  g.save();
  g.translate(bx, y - h * 0.96);
  g.rotate(sw);
  g.strokeStyle = '#555';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-h * 0.18, 0);
  g.lineTo(-h * 0.18, by - (y - h * 0.96));
  g.moveTo(h * 0.18, 0);
  g.lineTo(h * 0.18, by - (y - h * 0.96));
  g.stroke();
  const top = by - (y - h * 0.96);
  g.fillStyle = '#ffffff';
  g.fillRect(-h * 0.26, top, h * 0.52, h * 0.3);
  g.strokeStyle = '#1d3557';
  g.lineWidth = Math.max(2, h * 0.02);
  g.strokeRect(-h * 0.26, top, h * 0.52, h * 0.3);
  g.fillStyle = '#1d3557';
  g.font = `900 ${Math.round(h * 0.085)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FOR', 0, top + h * 0.09);
  g.fillText('SALE', 0, top + h * 0.2);
  if (sold > 0) {
    g.save();
    g.translate(0, top + h * 0.15);
    g.rotate(-0.25);
    const sc = 1 + (1 - clamp(sold)) * 1.4;
    g.scale(sc, sc);
    g.globalAlpha *= clamp(sold * 2);
    g.fillStyle = '#e63946';
    g.fillRect(-h * 0.34, -h * 0.09, h * 0.68, h * 0.18);
    g.fillStyle = '#ffffff';
    g.font = `900 ${Math.round(h * 0.13)}px system-ui, sans-serif`;
    g.fillText('SOLD', 0, h * 0.005);
    g.restore();
  }
  g.restore();
}

const house = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#79b8ff', '#b9dcff', '#fff0d4']);
  additive(g, () => blob(g, visX(L, S, 0.05), L.h * 0.1, fh * 1.1, '255,240,190', 0.7));
  cloud(g, visX(L, S, 0.3), L.h * 0.12, fh * 0.3, 'rgba(255,255,255,0.9)');
  cloud(g, visX(L, S, 0.75), L.h * 0.2, fh * 0.25, 'rgba(255,255,255,0.85)');
  floor(g, L, S, '#7cc36b', '#97d687');
  const hw = S.port ? Math.min(L.w * 0.5, fh * 1.25) : Math.min(S.sideW * 0.58, fh * 1.35);
  const hx = S.port ? S.main - fh * 0.3 : S.main - S.sideW * 0.08;
  g.fillStyle = '#d9c9a3';
  g.beginPath();
  g.moveTo(hx - hw * 0.07, gy);
  g.lineTo(hx + hw * 0.07, gy);
  g.lineTo(hx + hw * 0.2, L.h);
  g.lineTo(hx - hw * 0.2, L.h);
  g.fill();
  const chim = houseShape(g, hx, gy, hw, era, 0);
  if (era !== 'ancient' && era !== 'future') smoke(f, chim.cx, chim.cy, Math.max(0.7, S.k));
  tree(g, hx - hw * 0.75, gy, fh * 0.9, '#7a5236', '#4fa34a');
  const sx = hx + hw * 0.62;
  const sold = span(p, 0.3, 0.42);
  sign(g, sx, gy, fh * 0.8, sold, t);
  if (p > 0.36 && once(f, 'sold')) confettiBurst(f, sx + fh * 0.2, gy - fh * 0.7, 36, 520 * S.k, CONFETTI_COLORS);
  // the keys
  const kx = S.alt ?? (S.port ? L.w * 0.82 : S.main + S.sideW * 0.35);
  const ky = S.alt !== null ? gy - fh * 1.38 : L.h * 0.11;
  const ks = S.alt !== null ? fh * 0.3 : fh * 0.22;
  const kp = pop(p, 0.42, 0.56);
  if (S.alt !== null) fig(g, kx, gy, fh, { color: '#3a86ff', pose: p > 0.42 ? 'cheer' : 'stand', phase: t, mood: p > 0.42 ? 'laugh' : 'smile' });
  if (kp > 0) {
    const swing = Math.sin(t * 3.2) * 0.35;
    const yy = ky - (S.alt !== null ? 0 : 0) + (1 - kp) * fh * 0.3;
    additive(g, () => blob(g, kx, yy + ks * 0.6, ks * 2, '255,220,120', 0.5 * kp));
    g.strokeStyle = '#d4a017';
    g.lineWidth = Math.max(2, ks * 0.07);
    g.beginPath();
    g.arc(kx, yy, ks * 0.25 * kp, 0, TAU);
    g.stroke();
    keyShape(g, kx - ks * 0.1, yy + ks * 0.2, ks * kp, swing + 0.25, '#f2c94c');
    keyShape(g, kx + ks * 0.1, yy + ks * 0.2, ks * 0.85 * kp, swing - 0.35, '#c0c6cf');
    sparkle(g, kx + ks * 0.5, yy + ks * 0.3, ks * 0.3 * Math.abs(Math.sin(t * 5)), '#ffffff');
  }
  const conf = particles(f.mem, 'conf');
  stepParticles(conf, f.dt, 300, 1);
  drawConfetti(g, conf);
});

// ================================================================== 28. car

function wheel(g: G, x: number, y: number, r: number, rot: number, tyre: string, rim: string, spokes: number): void {
  g.fillStyle = tyre;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = rim;
  g.beginPath();
  g.arc(x, y, r * 0.55, 0, TAU);
  g.fill();
  g.strokeStyle = tyre;
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  for (let i = 0; i < spokes; i++) {
    const a = rot + (i * TAU) / spokes;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
  }
  g.stroke();
}

function sportsCar(g: G, x: number, y: number, s: number, rot: number): void {
  g.fillStyle = '#e63946';
  g.beginPath();
  g.moveTo(-s * 0.5 + x, y - s * 0.08);
  g.lineTo(-s * 0.5 + x, y - s * 0.2);
  g.quadraticCurveTo(-s * 0.46 + x, y - s * 0.27, -s * 0.3 + x, y - s * 0.28);
  g.lineTo(-s * 0.2 + x, y - s * 0.29);
  g.quadraticCurveTo(-s * 0.08 + x, y - s * 0.43, s * 0.08 + x, y - s * 0.42);
  g.quadraticCurveTo(s * 0.2 + x, y - s * 0.41, s * 0.3 + x, y - s * 0.28);
  g.lineTo(s * 0.46 + x, y - s * 0.23);
  g.quadraticCurveTo(s * 0.53 + x, y - s * 0.2, s * 0.53 + x, y - s * 0.12);
  g.lineTo(s * 0.5 + x, y - s * 0.07);
  g.closePath();
  g.fill();
  g.fillStyle = '#a8dadc';
  g.beginPath();
  g.moveTo(x - s * 0.15, y - s * 0.29);
  g.quadraticCurveTo(x - s * 0.06, y - s * 0.39, x + s * 0.07, y - s * 0.385);
  g.quadraticCurveTo(x + s * 0.17, y - s * 0.375, x + s * 0.24, y - s * 0.29);
  g.closePath();
  g.fill();
  g.fillStyle = '#e63946';
  g.fillRect(x + s * 0.035, y - s * 0.4, s * 0.02, s * 0.11);
  g.fillStyle = '#ffffff';
  g.fillRect(x - s * 0.45, y - s * 0.19, s * 0.9, s * 0.025);
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.ellipse(x + s * 0.49, y - s * 0.17, s * 0.03, s * 0.02, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#8b0000';
  g.fillRect(x - s * 0.51, y - s * 0.19, s * 0.025, s * 0.04);
  wheel(g, x - s * 0.3, y - s * 0.08, s * 0.1, rot, '#1b1b1b', '#d0d4da', 5);
  wheel(g, x + s * 0.32, y - s * 0.08, s * 0.1, rot, '#1b1b1b', '#d0d4da', 5);
}

function oldCar(g: G, x: number, y: number, s: number, rot: number): void {
  g.fillStyle = '#222';
  g.fillRect(x - s * 0.48, y - s * 0.2, s * 0.96, s * 0.1);
  g.fillStyle = '#1d3557';
  g.fillRect(x - s * 0.42, y - s * 0.4, s * 0.42, s * 0.22);
  g.fillRect(x - s * 0.02, y - s * 0.3, s * 0.42, s * 0.12);
  g.fillStyle = '#111';
  g.fillRect(x - s * 0.46, y - s * 0.52, s * 0.5, s * 0.04);
  g.fillRect(x - s * 0.44, y - s * 0.52, s * 0.025, s * 0.14);
  g.fillRect(x - s * 0.04, y - s * 0.52, s * 0.025, s * 0.14);
  g.fillStyle = '#c9a227';
  g.fillRect(x + s * 0.38, y - s * 0.32, s * 0.04, s * 0.14);
  g.beginPath();
  g.arc(x + s * 0.44, y - s * 0.28, s * 0.035, 0, TAU);
  g.fill();
  g.fillStyle = '#a8dadc';
  g.fillRect(x - s * 0.36, y - s * 0.37, s * 0.3, s * 0.1);
  wheel(g, x - s * 0.3, y - s * 0.11, s * 0.12, rot, '#151515', '#c9a227', 10);
  wheel(g, x + s * 0.3, y - s * 0.11, s * 0.12, rot, '#151515', '#c9a227', 10);
}

function hoverCar(g: G, x: number, y: number, s: number, t: number): void {
  const yy = y - s * 0.12 + Math.sin(t * 4) * s * 0.02;
  additive(g, () => {
    g.save();
    g.translate(x, yy + s * 0.05);
    g.scale(2.6, 0.6);
    blob(g, 0, 0, s * 0.18, '0,245,255', 0.9);
    g.restore();
  });
  g.fillStyle = '#f1f5f9';
  g.beginPath();
  g.moveTo(x - s * 0.5, yy - s * 0.04);
  g.quadraticCurveTo(x - s * 0.45, yy - s * 0.18, x - s * 0.1, yy - s * 0.2);
  g.lineTo(x + s * 0.3, yy - s * 0.17);
  g.quadraticCurveTo(x + s * 0.56, yy - s * 0.1, x + s * 0.52, yy);
  g.quadraticCurveTo(x, yy + s * 0.06, x - s * 0.5, yy - s * 0.04);
  g.fill();
  g.fillStyle = 'rgba(80,220,255,0.75)';
  g.beginPath();
  g.ellipse(x - s * 0.02, yy - s * 0.2, s * 0.22, s * 0.11, 0, Math.PI, TAU);
  g.fill();
  g.fillStyle = '#00e5ff';
  g.fillRect(x - s * 0.42, yy - s * 0.05, s * 0.86, s * 0.02);
  g.fillStyle = '#f15bb5';
  g.fillRect(x - s * 0.52, yy - s * 0.08, s * 0.03, s * 0.05);
}

function horse(g: G, x: number, y: number, s: number, t: number, moving: boolean): void {
  const col = '#6f4e37';
  const dark = '#3e2a1d';
  g.lineCap = 'round';
  const leg = (bx: number, ph: number, c: string) => {
    const sw = moving ? Math.sin(t * 16 + ph) * 0.45 : 0;
    const kx = bx + Math.sin(sw) * s * 0.14;
    const ky = y - s * 0.26;
    g.strokeStyle = c;
    g.lineWidth = s * 0.07;
    g.beginPath();
    g.moveTo(bx, y - s * 0.5);
    g.lineTo(kx, ky);
    g.lineTo(kx + Math.sin(sw * 1.4 - 0.2) * s * 0.12, y - s * 0.02);
    g.stroke();
  };
  leg(x - s * 0.22, 0, dark);
  leg(x + s * 0.24, 1.6, dark);
  g.strokeStyle = dark;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(x - s * 0.38, y - s * 0.66);
  g.quadraticCurveTo(x - s * 0.55, y - s * 0.6 + Math.sin(t * 8) * s * 0.04, x - s * 0.5, y - s * 0.35);
  g.stroke();
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y - s * 0.62, s * 0.4, s * 0.16, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.25, y - s * 0.72);
  g.lineTo(x + s * 0.42, y - s * 1.0);
  g.lineTo(x + s * 0.56, y - s * 0.96);
  g.lineTo(x + s * 0.4, y - s * 0.6);
  g.fill();
  g.beginPath();
  g.ellipse(x + s * 0.55, y - s * 0.93, s * 0.16, s * 0.07, 0.5, 0, TAU);
  g.fill();
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(x + s * 0.42, y - s * 1.03);
  g.lineTo(x + s * 0.3, y - s * 0.75);
  g.lineTo(x + s * 0.24, y - s * 0.76);
  g.lineTo(x + s * 0.36, y - s * 1.03);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.46, y - s * 1.02);
  g.lineTo(x + s * 0.48, y - s * 1.12);
  g.lineTo(x + s * 0.52, y - s * 1.0);
  g.fill();
  leg(x - s * 0.28, 3.1, col);
  leg(x + s * 0.3, 4.7, col);
}

function carriage(g: G, x: number, y: number, s: number, rot: number, t: number, moving: boolean): void {
  // s = total length; carriage behind (left), horse in front (right)
  const cx = x - s * 0.18;
  g.strokeStyle = '#3e2a1d';
  g.lineWidth = Math.max(2, s * 0.012);
  g.beginPath();
  g.moveTo(cx + s * 0.15, y - s * 0.15);
  g.lineTo(x + s * 0.22, y - s * 0.25);
  g.stroke();
  g.fillStyle = '#5b1a2a';
  rrect(g, cx - s * 0.17, y - s * 0.42, s * 0.34, s * 0.26, s * 0.03);
  g.fill();
  g.fillStyle = '#3e0f1c';
  g.fillRect(cx - s * 0.2, y - s * 0.45, s * 0.4, s * 0.04);
  g.fillStyle = '#f2c94c';
  g.fillRect(cx - s * 0.12, y - s * 0.38, s * 0.1, s * 0.09);
  g.fillRect(cx + s * 0.02, y - s * 0.38, s * 0.1, s * 0.09);
  g.fillStyle = '#ffe9b0';
  g.fillRect(cx - s * 0.11, y - s * 0.37, s * 0.08, s * 0.07);
  g.fillRect(cx + s * 0.03, y - s * 0.37, s * 0.08, s * 0.07);
  wheel(g, cx - s * 0.1, y - s * 0.1, s * 0.1, rot, '#3e2a1d', '#8a6a4a', 8);
  wheel(g, cx + s * 0.13, y - s * 0.08, s * 0.08, rot * 1.25, '#3e2a1d', '#8a6a4a', 8);
  horse(g, x + s * 0.3, y, s * 0.42, t, moving);
}

const car = def(2.8, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy } = S;
  sky(g, L, era === 'future' ? ['#1a2a6c', '#4a5bd1', '#b8a6ff', '#ffe2f0'] : ['#7fc8f8', '#bfe6ff', '#fff3d6']);
  skyline(g, L, gy - fh * 0.12, era, 'rgba(140,170,210,0.7)', 61);
  const roadTop = gy - fh * 0.14;
  const pre = era === 'ancient' || era === 'medieval' || era === 'early';
  g.fillStyle = pre ? '#b08d5a' : era === 'industrial' ? '#6b6258' : era === 'future' ? '#1a1f3a' : '#3a3d42';
  g.fillRect(0, roadTop, L.w, L.h - roadTop);
  g.fillStyle = pre ? '#8fae5a' : '#79c267';
  g.fillRect(0, roadTop - fh * 0.03, L.w, fh * 0.03);
  if (era === 'modern' || era === 'industrial') {
    g.fillStyle = era === 'modern' ? '#f8f9fa' : 'rgba(255,255,255,0.3)';
    for (let x = 0; x < L.w; x += fh * 0.5) g.fillRect(x, gy + fh * 0.04, fh * 0.25, Math.max(2, fh * 0.02));
  } else if (era === 'future') {
    g.fillStyle = '#00e5ff';
    g.fillRect(0, gy + fh * 0.04, L.w, Math.max(2, fh * 0.012));
  }
  const len = pre ? fh * 1.6 : fh * 1.25;
  const stopX = S.port ? L.w * 0.5 : S.main;
  const start = -len * 0.8;
  const end = L.w + len * 1.2;
  let x: number;
  if (p < 0.36) x = lerp(start, stopX, easeOut(p / 0.36));
  else if (p < 0.62) x = stopX;
  else x = lerp(stopX, end, easeIn((p - 0.62) / 0.38));
  const lastX = (f.mem.lastX as number | undefined) ?? x;
  const v = f.dt > 0 ? (x - lastX) / f.dt : 0;
  f.mem.lastX = x;
  const rot = (f.mem.rot = ((f.mem.rot as number | undefined) ?? 0) + (v * f.dt) / (fh * 0.12)) as number;
  const groundY = gy - fh * 0.02;
  // speed lines and dust
  const speed = Math.abs(v);
  if (speed > 150) {
    g.strokeStyle = `rgba(255,255,255,${clamp(speed / 1500) * 0.8})`;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = groundY - len * (0.08 + i * 0.07);
      const lx = x - len * 0.55 - hash(i) * len * 0.2;
      g.moveTo(lx, yy);
      g.lineTo(lx - clamp(speed / 1200) * len * 0.8, yy);
    }
    g.stroke();
  }
  const dust = particles(f.mem, 'dust');
  if (speed > 100)
    emit(f, 'dust', era === 'future' ? 0 : 30, () => {
      if (dust.length < 50) dust.push({ x: x - len * 0.45, y: groundY - fh * 0.03, vx: -f.rand.range(20, 60), vy: -f.rand.range(10, 40), life: 0, max: 0.8, size: fh * 0.05, color: pre ? '200,170,120' : '200,200,200' });
    });
  stepParticles(dust, f.dt);
  for (const d of dust) blob(g, d.x, d.y, d.size * (1 + d.life * 2), d.color, 0.5 * (1 - d.life / d.max));
  const bounce = p >= 0.36 && p < 0.62 ? Math.sin((p - 0.36) * 60) * fh * 0.01 * (1 - (p - 0.36) / 0.26) : 0;
  footShadow(g, x, groundY, len * 0.45, 0.25);
  g.save();
  g.translate(0, -bounce);
  if (pre) carriage(g, x, groundY, len, rot, t, speed > 20);
  else if (era === 'industrial') oldCar(g, x, groundY, len, rot);
  else if (era === 'future') hoverCar(g, x, groundY, len, t);
  else sportsCar(g, x, groundY, len, rot);
  g.restore();
  // "new ride" shine while it is parked
  if (p > 0.36 && p < 0.66) {
    const k = bump(p, 0.36, 0.66);
    for (let i = 0; i < 4; i++) {
      const sx = x + (hash(i + 1) - 0.5) * len * 0.8;
      const sy = groundY - len * (0.15 + hash(i + 2) * 0.3);
      sparkle(g, sx, sy, fh * 0.07 * k * Math.abs(Math.sin(t * 6 + i * 1.7)), '#ffffff');
    }
    floaters(f, S, { kinds: ['star'], colors: ['#ffd166', '#ffffff'], size: [6, 10], rate: 10, x: () => x + f.rand.range(-0.5, 0.5) * len, y: () => groundY - len * 0.35, speed: [40, 80], life: [0.6, 1], until: 0.66, max: 12 });
  } else floaters(f, S, { kinds: ['star'], colors: ['#ffd166'], size: [6, 10], rate: 0, until: 0, max: 12 });
});

// ================================================================== registry

export const LIFE_SCENE_DEFS: Record<LifeSceneId, SceneDef> = {
  funeral,
  birth,
  love,
  wedding,
  heartbreak,
  friends,
  party,
  family,
  graduation,
  promotion,
  fired,
  sports,
  study,
  holy,
  demonic,
  ghost,
  curse,
  ritual,
  travel,
  drugs,
  calm,
  birthday,
  fireworks,
  fame,
  coronation,
  pet,
  house,
  car,
};
