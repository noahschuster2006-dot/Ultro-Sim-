/**
 * Romance scenes: dates, kisses, proposals, heartbreak and family life.
 *
 * Desktop: the main group stands at L.slots[0] (left of the phone), a supporting
 * element at L.slots[1]. Portrait: everything is centred above L.groundY.
 */
import type { RomanceSceneId } from './ids';
import {
  caption,
  clamp,
  CONFETTI_COLORS,
  easeOut,
  glow as kitGlow,
  heart,
  lerp,
  makeRand,
  particles,
  sky,
  skyline,
  span,
  star,
  stepParticles,
  type EraLook,
  type Layout,
  type Particle,
  type SceneDef,
  type SceneFrame,
} from './kit';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ERA_ORDER: EraLook[] = ['ancient', 'medieval', 'early', 'industrial', 'modern', 'future'];
const before = (era: EraLook, look: EraLook) => ERA_ORDER.indexOf(era) < ERA_ORDER.indexOf(look);

// ================================================================== stage geometry

interface Stage {
  fh: number;
  gy: number;
  main: number;
  alt: number | null;
  sideW: number;
  gap: number;
  port: boolean;
}

function stage(L: Layout): Stage {
  if (L.portrait) {
    const fh = Math.min(L.h * 0.18, L.w * 0.42);
    return { fh, gy: L.groundY - L.h * 0.02, main: L.w * 0.5, alt: null, sideW: L.w, gap: Math.min(fh * 0.42, L.w * 0.2), port: true };
  }
  const left = L.phone.x;
  const right = L.w - (L.phone.x + L.phone.w);
  const sideW = Math.max(140, Math.min(left, right));
  const fh = Math.min(L.h * 0.22, sideW * 0.6);
  return { fh, gy: L.groundY, main: L.slots[0], alt: L.slots[1] ?? null, sideW, gap: Math.min(fh * 0.42, sideW * 0.2), port: false };
}

function def(dur: number, draw: (f: SceneFrame, S: Stage) => void, shake?: (t: number, dur: number) => number): SceneDef {
  return {
    dur,
    shake,
    draw(f) {
      const g = f.g;
      g.save();
      g.globalAlpha *= f.a;
      draw(f, stage(f.L));
      g.restore();
    },
  };
}

/** Radial glow that fades to the same colour at zero alpha (no grey fringe on light skies). */
function glow(g: G, x: number, y: number, r: number, color: string, alpha = 1): void {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(color);
  if (!m) {
    kitGlow(g, x, y, r, color, alpha);
    return;
  }
  if (r <= 0 || alpha <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, `rgba(${m[1]},${m[2]},${m[3]},0)`);
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.restore();
}

// ================================================================== figures

interface Pt {
  x: number;
  y: number;
}
type Arm = number | Pt | 'face' | 'belly' | 'chest';
type Mood = 'none' | 'smile' | 'grin' | 'sad' | 'angry' | 'kiss' | 'wink' | 'shock' | 'calm' | 'nervous';
interface Fig {
  color?: string;
  dir?: 1 | -1;
  pose?: 'stand' | 'walk' | 'run' | 'kneel' | 'sit';
  phase?: number;
  dress?: boolean;
  accent?: string;
  hair?: 'long' | 'bun' | 'none';
  hairCol?: string;
  front?: Arm;
  back?: Arm;
  mood?: Mood;
  ink?: string;
  blush?: number;
  lean?: number;
  alpha?: number;
  hat?: 'none' | 'fedora' | 'flower';
  coat?: string;
  belly?: boolean;
}
interface FigInfo {
  hx: number;
  hy: number;
  hr: number;
  hf: Pt;
  hb: Pt;
}

function face(g: G, x: number, hy: number, hr: number, dir: number, m: Mood, ink: string, blush: number): void {
  const cx = x + dir * hr * 0.3;
  const ey = hy - hr * 0.08;
  const ex = hr * 0.3;
  g.save();
  if (blush > 0) {
    g.save();
    g.globalAlpha *= clamp(blush) * 0.85;
    g.fillStyle = '#ff7aa2';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * hr * 0.5, hy + hr * 0.3, hr * 0.2, hr * 0.13, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = Math.max(1.2, hr * 0.13);
  g.lineCap = 'round';
  const closed = (ax: number) => {
    g.beginPath();
    g.arc(ax, ey + hr * 0.06, hr * 0.13, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  };
  const dot = (ax: number, r: number) => {
    g.beginPath();
    g.arc(ax, ey, r, 0, TAU);
    g.fill();
  };
  for (const s of [-1, 1]) {
    const ax = cx + s * ex;
    if (m === 'calm' || m === 'kiss') closed(ax);
    else if (m === 'wink' && s === dir) closed(ax);
    else dot(ax, m === 'shock' ? hr * 0.16 : hr * 0.11);
  }
  if (m === 'angry' || m === 'sad' || m === 'nervous') {
    g.beginPath();
    for (const s of [-1, 1]) {
      const ax = cx + s * ex;
      const tilt = m === 'angry' ? 1 : -1;
      g.moveTo(ax - s * hr * 0.17, ey - hr * 0.22 + tilt * hr * 0.08);
      g.lineTo(ax + s * hr * 0.17, ey - hr * 0.22 - tilt * hr * 0.08);
    }
    g.stroke();
  }
  const my = hy + hr * 0.42;
  g.beginPath();
  switch (m) {
    case 'smile':
    case 'wink':
    case 'calm':
      g.arc(cx, hy + hr * 0.16, hr * 0.32, 0.22 * Math.PI, 0.78 * Math.PI);
      g.stroke();
      break;
    case 'grin':
      g.arc(cx, my - hr * 0.12, hr * 0.3, 0, Math.PI);
      g.fill();
      break;
    case 'sad':
    case 'angry':
      g.arc(cx, my + hr * 0.22, hr * 0.26, 1.2 * Math.PI, 1.8 * Math.PI);
      g.stroke();
      break;
    case 'kiss':
      g.fillStyle = '#ff7aa2';
      g.arc(cx + dir * hr * 0.2, my - hr * 0.04, hr * 0.12, 0, TAU);
      g.fill();
      break;
    case 'shock':
      g.ellipse(cx, my, hr * 0.13, hr * 0.19, 0, 0, TAU);
      g.fill();
      break;
    case 'nervous':
      g.moveTo(cx - hr * 0.25, my);
      for (let i = 1; i <= 4; i++) g.lineTo(cx - hr * 0.25 + i * hr * 0.125, my + (i % 2 ? -1 : 1) * hr * 0.07);
      g.stroke();
      break;
    default:
      break;
  }
  g.restore();
}

/** A bold flat person. (x, y) is between the feet; h is the full height. */
function figure(g: G, x: number, y: number, h: number, o: Fig = {}): FigInfo {
  const col = o.color ?? '#2d3561';
  const dir = o.dir ?? 1;
  const ph = o.phase ?? 0;
  const pose = o.pose ?? 'stand';
  const lw = Math.max(2, h * 0.075);
  const hr = h * 0.13;
  const hip = y - h * (pose === 'kneel' ? 0.3 : pose === 'sit' ? 0.27 : 0.42);
  const sh = hip - h * 0.32;
  const hy = sh - hr * 1.05;
  const sy = sh + h * 0.03;
  const lean = o.lean ?? 0;
  const cs = Math.cos(lean);
  const sn = Math.sin(lean);
  const toWorld = (p: Pt): Pt => ({ x: x + (p.x - x) * cs - (p.y - y) * sn, y: y + (p.x - x) * sn + (p.y - y) * cs });
  const toLocal = (p: Pt): Pt => ({ x: x + (p.x - x) * cs + (p.y - y) * sn, y: y - (p.x - x) * sn + (p.y - y) * cs });
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  if (lean) {
    g.translate(x, y);
    g.rotate(lean);
    g.translate(-x, -y);
  }
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  // legs
  g.beginPath();
  if (pose === 'kneel') {
    g.moveTo(x, hip);
    g.lineTo(x + dir * h * 0.15, hip + h * 0.02);
    g.lineTo(x + dir * h * 0.15, y);
    g.moveTo(x, hip);
    g.lineTo(x - dir * h * 0.02, y - lw * 0.4);
    g.lineTo(x - dir * h * 0.17, y - lw * 0.4);
  } else if (pose === 'sit') {
    for (const k of [-1, 1]) {
      g.moveTo(x, hip);
      g.lineTo(x + dir * h * 0.2, hip + k * h * 0.01);
      g.lineTo(x + dir * h * 0.2 + k * h * 0.02, y);
    }
  } else {
    const run = pose === 'run';
    const sw = pose === 'stand' ? 0 : Math.sin(ph * (run ? 11 : 7)) * h * (run ? 0.17 : 0.12);
    g.moveTo(x - h * 0.08 + sw, y);
    g.lineTo(x, hip);
    g.lineTo(x + h * 0.08 - sw, y);
  }
  g.stroke();
  // coat
  if (o.coat) {
    g.fillStyle = o.coat;
    g.beginPath();
    g.moveTo(x - h * 0.07, sh - h * 0.01);
    g.lineTo(x + h * 0.07, sh - h * 0.01);
    g.lineTo(x + h * 0.13, hip + h * 0.2);
    g.lineTo(x - h * 0.13, hip + h * 0.2);
    g.closePath();
    g.fill();
    g.fillStyle = col;
  }
  // body
  if (o.dress) {
    g.fillStyle = o.accent ?? col;
    g.beginPath();
    g.moveTo(x - h * 0.05, sh);
    g.lineTo(x + h * 0.05, sh);
    g.lineTo(x + h * 0.16, hip + h * 0.12);
    g.lineTo(x - h * 0.16, hip + h * 0.12);
    g.closePath();
    g.fill();
    g.fillStyle = col;
  } else if (!o.coat) {
    g.lineWidth = lw * 1.9;
    g.beginPath();
    g.moveTo(x, sh);
    g.lineTo(x, hip);
    g.stroke();
    g.lineWidth = lw;
    if (o.accent) {
      g.strokeStyle = o.accent;
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(x, sh + h * 0.02);
      g.lineTo(x, sh + h * 0.14);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = lw;
    }
  }
  if (o.belly) {
    g.fillStyle = o.dress ? (o.accent ?? col) : col;
    g.beginPath();
    g.arc(x + dir * h * 0.07, hip - h * 0.05, h * 0.1, 0, TAU);
    g.fill();
    g.fillStyle = col;
  }
  // arms
  const armLen = h * 0.3;
  const walking = pose === 'walk' || pose === 'run';
  const swingA = walking ? Math.sin(ph * (pose === 'run' ? 11 : 7)) * (pose === 'run' ? 0.6 : 0.35) : 0;
  const handOf = (spec: Arm | undefined, side: number, dflt: number): Pt => {
    const s: Arm = spec ?? dflt;
    if (s === 'face') return { x: x + side * hr * 0.8 + dir * hr * 0.25, y: hy + hr * 0.35 };
    if (s === 'belly') return { x: x + dir * h * (o.belly ? 0.15 : 0.08), y: hip - h * 0.07 };
    if (s === 'chest') return { x: x + dir * h * 0.07, y: sh + h * 0.1 };
    if (typeof s === 'number') return { x: x + side * Math.sin(s) * armLen, y: sy + Math.cos(s) * armLen };
    return toLocal(s);
  };
  const limb = (e: Pt, side: number) => {
    const dx = e.x - x;
    const dy = e.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    g.beginPath();
    g.moveTo(x, sy);
    if (d < armLen * 0.98) {
      const half = armLen / 2;
      const off = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
      let nx = -dy / d;
      let ny = dx / d;
      if (ny + side * nx * 0.8 < 0) {
        nx = -nx;
        ny = -ny;
      }
      g.lineTo(x + dx / 2 + nx * off, sy + dy / 2 + ny * off);
    }
    g.lineTo(e.x, e.y);
    g.stroke();
  };
  const hb = handOf(o.back, -dir, 0.22 - swingA);
  const hf = handOf(o.front, dir, 0.22 + swingA);
  limb(hb, -dir);
  limb(hf, dir);
  // hair + head
  const hairCol = o.hairCol ?? col;
  g.fillStyle = hairCol;
  if (o.hair === 'long') {
    g.beginPath();
    g.ellipse(x - dir * hr * 0.25, hy + hr * 0.45, hr * 1.12, hr * 1.4, 0, 0, TAU);
    g.fill();
  } else if (o.hair === 'bun') {
    g.beginPath();
    g.arc(x - dir * hr * 0.75, hy - hr * 0.6, hr * 0.5, 0, TAU);
    g.fill();
  }
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, hy, hr, 0, TAU);
  g.fill();
  if (o.hairCol) {
    g.fillStyle = hairCol;
    g.beginPath();
    g.arc(x, hy, hr * 1.06, Math.PI * 1.05, Math.PI * 1.95);
    g.lineTo(x, hy - hr * 0.45);
    g.closePath();
    g.fill();
  }
  if (o.hat === 'fedora') {
    g.fillStyle = '#1b1b24';
    g.fillRect(x - hr * 1.6, hy - hr * 0.62, hr * 3.2, hr * 0.28);
    rrect(g, x - hr * 0.95, hy - hr * 1.5, hr * 1.9, hr * 0.95, hr * 0.3);
    g.fill();
    g.fillStyle = '#7a2e3a';
    g.fillRect(x - hr * 0.95, hy - hr * 0.78, hr * 1.9, hr * 0.18);
  } else if (o.hat === 'flower') {
    const fx = x - dir * hr * 0.55;
    const fy = hy - hr * 0.75;
    g.fillStyle = '#ff5d8f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.beginPath();
      g.arc(fx + Math.cos(a) * hr * 0.22, fy + Math.sin(a) * hr * 0.22, hr * 0.18, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.arc(fx, fy, hr * 0.14, 0, TAU);
    g.fill();
  }
  if (o.mood && o.mood !== 'none') face(g, x, hy, hr, dir, o.mood, o.ink ?? 'rgba(255,248,240,0.95)', o.blush ?? 0);
  g.restore();
  const head = toWorld({ x, y: hy });
  return { hx: head.x, hy: head.y, hr, hf: toWorld(hf), hb: toWorld(hb) };
}

/** Where the head of a standing figure sits (no lean). */
const headY = (gy: number, h: number) => gy - h * 0.74 - h * 0.13 * 1.05;

// ================================================================== particles

const HEART = 0;
const SPARK = 1;
const NOTE = 2;
const DOT = 3;
const DROP = 4;
const PETAL = 5;
const PUFF = 6;
const SOCK = 7;
const CONF = 8;

function pt(x: number, y: number, vx: number, vy: number, max: number, size: number, color: string, kind: number, rot = 0, vr = 0): Particle {
  return { x, y, vx, vy, life: 0, max, size, color, kind, rot, vr };
}

/** Emit at `rate` per second into mem[key], capped at `max`. */
function spawn(f: SceneFrame, key: string, rate: number, max: number, make: () => Particle): void {
  const ps = particles(f.mem, key);
  const ak = key + '#acc';
  let acc = ((f.mem[ak] as number | undefined) ?? 0) + rate * f.dt;
  while (acc >= 1) {
    acc -= 1;
    if (ps.length < max) ps.push(make());
  }
  f.mem[ak] = acc;
}

/** One-shot burst, fired the first frame `when` is true. */
function burst(f: SceneFrame, key: string, flag: string, when: boolean, n: number, make: (i: number) => Particle): void {
  if (!when || f.mem[flag]) return;
  f.mem[flag] = 1;
  const ps = particles(f.mem, key);
  for (let i = 0; i < n && ps.length < 300; i++) ps.push(make(i));
}

function sparkle(g: G, x: number, y: number, r: number, color: string, rot = 0): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.22 : r;
    const a = (i * Math.PI) / 4;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function note(g: G, x: number, y: number, s: number, color: string, double = false): void {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.16);
  g.beginPath();
  g.ellipse(x, y, s * 0.42, s * 0.3, -0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.36, y - s * 0.05);
  g.lineTo(x + s * 0.36, y - s * 1.3);
  if (double) {
    g.lineTo(x + s * 1.3, y - s * 1.5);
    g.lineTo(x + s * 1.3, y - s * 0.25);
    g.stroke();
    g.beginPath();
    g.ellipse(x + s * 0.94, y - s * 0.2, s * 0.42, s * 0.3, -0.4, 0, TAU);
    g.fill();
  } else {
    g.quadraticCurveTo(x + s * 0.9, y - s * 1.0, x + s * 0.8, y - s * 0.6);
    g.stroke();
  }
  g.restore();
}

function sock(g: G, x: number, y: number, s: number, color: string, rot: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-s * 0.35, -s);
  g.lineTo(s * 0.35, -s);
  g.lineTo(s * 0.35, s * 0.15);
  g.quadraticCurveTo(s * 1.1, s * 0.15, s * 1.0, s * 0.6);
  g.quadraticCurveTo(s * 0.9, s * 0.95, s * 0.2, s * 0.9);
  g.quadraticCurveTo(-s * 0.4, s * 0.85, -s * 0.35, s * 0.3);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillRect(-s * 0.35, -s, s * 0.7, s * 0.28);
  g.restore();
}

function drawPs(g: G, ps: Particle[]): void {
  for (const p of ps) {
    const a = clamp(p.life / 0.15) * clamp((p.max - p.life) / (p.max * 0.35));
    if (a <= 0) continue;
    g.save();
    g.globalAlpha *= a;
    const rot = p.rot ?? 0;
    switch (p.kind) {
      case HEART:
        heart(g, p.x + Math.sin(p.life * 4 + rot * 3) * p.size * 0.5, p.y, p.size, p.color);
        break;
      case SPARK:
        sparkle(g, p.x, p.y, p.size * (0.65 + 0.35 * Math.sin(p.life * 14 + rot)), p.color, rot);
        break;
      case NOTE:
        note(g, p.x + Math.sin(p.life * 3 + rot) * p.size * 0.8, p.y, p.size, p.color, rot > 0.5);
        break;
      case DOT:
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.fill();
        break;
      case DROP:
        g.strokeStyle = p.color;
        g.lineWidth = p.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        g.stroke();
        break;
      case PETAL:
        g.translate(p.x + Math.sin(p.life * 3 + rot) * p.size, p.y);
        g.rotate(rot);
        g.fillStyle = p.color;
        g.beginPath();
        g.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU);
        g.fill();
        break;
      case PUFF:
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.6 + p.life * 1.6), 0, TAU);
        g.fill();
        break;
      case SOCK:
        sock(g, p.x + Math.sin(p.life * 2.5 + rot * 4) * p.size * 0.8, p.y, p.size, p.color, Math.sin(p.life * 2 + rot) * 0.4);
        break;
      case CONF:
        g.translate(p.x, p.y);
        g.rotate(rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        break;
    }
    g.restore();
  }
}

function runPs(f: SceneFrame, key: string, gravity = 0, drag = 0): void {
  const ps = particles(f.mem, key);
  stepParticles(ps, f.dt, gravity, drag);
  drawPs(f.g, ps);
}

/** Hearts rising gently from around (x, y). */
function heartRise(f: SceneFrame, key: string, x: number, y: number, spread: number, size: number, rate: number, colors = ['#ff5d8f', '#ff8fab', '#ffb3c6']): void {
  const r = f.rand;
  spawn(f, key, rate, 30, () => pt(x + r.range(-1, 1) * spread, y + r.range(-0.3, 0.3) * spread, r.range(-12, 12), -r.range(35, 70), r.range(1.2, 2), size * r.range(0.6, 1.2), r.pick(colors), HEART, r() * 6));
}

function heartBurst(f: SceneFrame, key: string, flag: string, when: boolean, x: number, y: number, size: number, n = 14): void {
  const r = f.rand;
  burst(f, key, flag, when, n, (i) => {
    const a = (i / n) * TAU + r.range(-0.2, 0.2);
    const v = r.range(90, 170);
    return pt(x, y, Math.cos(a) * v, Math.sin(a) * v - 40, r.range(0.9, 1.4), size * r.range(0.6, 1.1), r.pick(['#ff3d6e', '#ff8fab', '#ffd166', '#ffffff']), i % 3 === 0 ? SPARK : HEART, r() * 6);
  });
}

function rainFx(f: SceneFrame, key: string, rate: number, color = 'rgba(170,195,235,0.55)', on = true): void {
  const { L } = f;
  const r = f.rand;
  if (on) spawn(f, key, rate, 160, () => pt(r.range(-60, L.w), r.range(-30, L.h * 0.7), 90, r.range(650, 850), r.range(0.4, 0.8), 1.6, color, DROP));
  runPs(f, key);
}

// ================================================================== props

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

function starfield(f: SceneFrame, n: number, seed: number, bottom: number): void {
  const { g, L, t } = f;
  const r = makeRand(seed);
  g.save();
  g.fillStyle = '#fffbe8';
  for (let i = 0; i < n; i++) {
    const x = r() * L.w;
    const y = r() * bottom;
    const s = r.range(0.8, 2.2);
    const tw = 0.5 + 0.5 * Math.sin(t * r.range(2, 5) + i);
    g.globalAlpha = f.a * (0.3 + 0.7 * tw);
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  g.restore();
}

function moon(g: G, x: number, y: number, r: number, smile = 0, faceOn = false): void {
  glow(g, x, y, r * 3.2, 'rgba(255,236,170,0.32)');
  g.save();
  g.fillStyle = '#fff3c4';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(225,205,140,0.45)';
  for (const [dx, dy, rr] of [
    [-0.4, -0.35, 0.16],
    [0.45, 0.3, 0.12],
    [0.2, -0.5, 0.09],
  ]) {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
    g.fill();
  }
  if (faceOn) {
    g.strokeStyle = '#8a6a3a';
    g.fillStyle = '#8a6a3a';
    g.lineWidth = Math.max(1.5, r * 0.07);
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      if (smile > 0.3) g.arc(x + s * r * 0.33, y - r * 0.08, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      else g.arc(x + s * r * 0.33, y - r * 0.12, r * 0.07, 0, TAU);
      if (smile > 0.3) g.stroke();
      else g.fill();
    }
    g.beginPath();
    const mw = lerp(0.12, 0.38, smile);
    g.arc(x, y + r * 0.05, r * mw * 1.2, Math.PI * (0.5 - 0.35 * (0.3 + smile * 0.7)), Math.PI * (0.5 + 0.35 * (0.3 + smile * 0.7)));
    g.stroke();
    g.globalAlpha *= 0.4 + smile * 0.5;
    g.fillStyle = '#ff9db5';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + s * r * 0.55, y + r * 0.2, r * 0.14, r * 0.09, 0, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

/** A street lamp at (x, gy); returns the lamp head position. */
function lampPost(g: G, x: number, gy: number, h: number, dir: 1 | -1, era: EraLook): Pt {
  const lx = x + dir * h * 0.14;
  const ly = gy - h * 0.93;
  g.save();
  const grad = g.createLinearGradient(0, ly, 0, gy);
  grad.addColorStop(0, 'rgba(255,214,140,0.42)');
  grad.addColorStop(1, 'rgba(255,214,140,0.06)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(lx - h * 0.04, ly);
  g.lineTo(lx + h * 0.04, ly);
  g.lineTo(lx + h * 0.42, gy);
  g.lineTo(lx - h * 0.42, gy);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,214,140,0.22)';
  g.beginPath();
  g.ellipse(lx, gy, h * 0.45, h * 0.06, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#1a1726';
  g.fillRect(x - h * 0.018, gy - h, h * 0.036, h);
  g.fillRect(x - h * 0.045, gy - h * 0.06, h * 0.09, h * 0.06);
  g.strokeStyle = '#1a1726';
  g.lineWidth = h * 0.022;
  g.beginPath();
  g.moveTo(x, gy - h * 0.99);
  g.quadraticCurveTo(x + dir * h * 0.02, gy - h * 1.06, lx, gy - h * 1.0);
  g.lineTo(lx, ly - h * 0.04);
  g.stroke();
  g.fillStyle = before(era, 'industrial') ? '#3a2a1a' : '#1a1726';
  g.beginPath();
  g.moveTo(lx - h * 0.06, ly);
  g.lineTo(lx - h * 0.035, ly - h * 0.05);
  g.lineTo(lx + h * 0.035, ly - h * 0.05);
  g.lineTo(lx + h * 0.06, ly);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffe2a0';
  g.beginPath();
  g.arc(lx, ly + h * 0.012, h * 0.032, 0, TAU);
  g.fill();
  g.restore();
  glow(g, lx, ly, h * 0.35, 'rgba(255,220,150,0.55)');
  return { x: lx, y: ly };
}

function cloud(g: G, x: number, y: number, s: number, color: string): void {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x - s * 0.55, y + s * 0.1, s * 0.38, 0, TAU);
  g.arc(x - s * 0.1, y - s * 0.15, s * 0.5, 0, TAU);
  g.arc(x + s * 0.45, y, s * 0.42, 0, TAU);
  g.arc(x + s * 0.05, y + s * 0.2, s * 0.4, 0, TAU);
  g.fill();
  g.restore();
}

function candle(g: G, x: number, y: number, s: number, t: number, seed = 0): void {
  g.save();
  g.fillStyle = '#fff4dc';
  g.fillRect(x - s * 0.12, y - s, s * 0.24, s);
  const fl = 1 + Math.sin(t * 17 + seed) * 0.12 + Math.sin(t * 29 + seed * 2) * 0.08;
  glow(g, x, y - s * 1.2, s * 2.2, 'rgba(255,190,90,0.45)');
  g.fillStyle = '#ffb347';
  g.beginPath();
  g.ellipse(x, y - s * 1.2, s * 0.14, s * 0.3 * fl, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#fff6c2';
  g.beginPath();
  g.ellipse(x, y - s * 1.15, s * 0.06, s * 0.14 * fl, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** Wine glass with its base at (x, y). */
function wineGlass(g: G, x: number, y: number, s: number, wine = '#9b1b45'): void {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1.2, s * 0.06);
  g.beginPath();
  g.moveTo(x - s * 0.25, y);
  g.lineTo(x + s * 0.25, y);
  g.moveTo(x, y);
  g.lineTo(x, y - s * 0.5);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.moveTo(x - s * 0.3, y - s);
  g.quadraticCurveTo(x - s * 0.3, y - s * 0.5, x, y - s * 0.5);
  g.quadraticCurveTo(x + s * 0.3, y - s * 0.5, x + s * 0.3, y - s);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = wine;
  g.beginPath();
  g.moveTo(x - s * 0.27, y - s * 0.78);
  g.quadraticCurveTo(x - s * 0.25, y - s * 0.53, x, y - s * 0.53);
  g.quadraticCurveTo(x + s * 0.25, y - s * 0.53, x + s * 0.27, y - s * 0.78);
  g.closePath();
  g.fill();
  g.restore();
}

function tankard(g: G, x: number, y: number, s: number): void {
  g.save();
  g.fillStyle = '#8a5a2b';
  rrect(g, x - s * 0.28, y - s * 0.8, s * 0.56, s * 0.8, s * 0.06);
  g.fill();
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.arc(x + s * 0.3, y - s * 0.42, s * 0.18, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.fillStyle = '#5c3a1a';
  g.fillRect(x - s * 0.28, y - s * 0.6, s * 0.56, s * 0.07);
  g.fillRect(x - s * 0.28, y - s * 0.25, s * 0.56, s * 0.07);
  g.fillStyle = '#fff6e0';
  g.beginPath();
  g.arc(x - s * 0.15, y - s * 0.82, s * 0.14, 0, TAU);
  g.arc(x + s * 0.05, y - s * 0.86, s * 0.16, 0, TAU);
  g.arc(x + s * 0.2, y - s * 0.8, s * 0.12, 0, TAU);
  g.fill();
  g.restore();
}

function flute(g: G, x: number, y: number, s: number, fill: number, rot = 0): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = Math.max(1.2, s * 0.05);
  g.beginPath();
  g.moveTo(-s * 0.18, 0);
  g.lineTo(s * 0.18, 0);
  g.moveTo(0, 0);
  g.lineTo(0, -s * 0.4);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.moveTo(-s * 0.16, -s * 1.15);
  g.lineTo(s * 0.16, -s * 1.15);
  g.lineTo(s * 0.09, -s * 0.42);
  g.lineTo(-s * 0.09, -s * 0.42);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#ffd166';
  const top = lerp(-s * 0.45, -s * 1.05, fill);
  const wTop = lerp(0.095, 0.155, fill) * s;
  g.beginPath();
  g.moveTo(-wTop, top);
  g.lineTo(wTop, top);
  g.lineTo(s * 0.09, -s * 0.43);
  g.lineTo(-s * 0.09, -s * 0.43);
  g.closePath();
  g.fill();
  g.restore();
}

function diningTable(g: G, x: number, gy: number, fh: number, w: number, cloth: string, wood: string): number {
  const top = gy - fh * 0.4;
  g.save();
  g.fillStyle = wood;
  g.fillRect(x - w * 0.8, top, fh * 0.04, gy - top);
  g.fillRect(x + w * 0.8 - fh * 0.04, top, fh * 0.04, gy - top);
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(x - w, top);
  g.lineTo(x + w, top);
  g.lineTo(x + w * 1.03, top + fh * 0.2);
  const n = Math.max(4, Math.round(w / (fh * 0.08)));
  for (let i = 0; i <= n; i++) {
    const px = x + w * 1.03 - (i / n) * w * 2.06;
    g.quadraticCurveTo(px + w / n, top + fh * 0.24, px, top + fh * 0.2);
  }
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x - w, top, w * 2, fh * 0.025);
  g.restore();
  return top;
}

function chair(g: G, x: number, gy: number, fh: number, dir: 1 | -1, col: string): void {
  g.save();
  g.fillStyle = col;
  const seat = gy - fh * 0.27;
  g.fillRect(x - dir * fh * 0.1 - fh * 0.02, seat - fh * 0.42, fh * 0.04, fh * 0.42 + (gy - seat));
  g.fillRect(Math.min(x - dir * fh * 0.1, x + dir * fh * 0.16), seat, fh * 0.26, fh * 0.035);
  g.fillRect(x + dir * fh * 0.14 - fh * 0.015, seat, fh * 0.03, gy - seat);
  g.restore();
}

function house(g: G, x: number, gy: number, w: number, h: number, wall: string, roof: string, lit: number, era: EraLook): Pt {
  g.save();
  g.fillStyle = wall;
  g.fillRect(x - w / 2, gy - h, w, h);
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - w * 0.62, gy - h);
  g.lineTo(x, gy - h - w * (before(era, 'early') ? 0.48 : 0.4));
  g.lineTo(x + w * 0.62, gy - h);
  g.closePath();
  g.fill();
  g.fillRect(x + w * 0.22, gy - h - w * 0.36, w * 0.1, w * 0.22);
  // door
  g.fillStyle = 'rgba(0,0,0,0.35)';
  rrect(g, x - w * 0.32, gy - h * 0.55, w * 0.18, h * 0.55, w * 0.05);
  g.fill();
  // window
  const wx = x + w * 0.16;
  const wy = gy - h * 0.62;
  const ww = w * 0.24;
  const wh = h * 0.3;
  if (lit > 0.01) glow(g, wx, wy, w * 0.7, 'rgba(255,205,110,0.5)', lit);
  g.fillStyle = '#1a2142';
  g.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
  g.globalAlpha *= lit;
  g.fillStyle = '#ffd27a';
  g.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
  g.restore();
  g.save();
  g.strokeStyle = roof;
  g.lineWidth = Math.max(2, w * 0.02);
  g.strokeRect(wx - ww / 2, wy - wh / 2, ww, wh);
  g.beginPath();
  g.moveTo(wx, wy - wh / 2);
  g.lineTo(wx, wy + wh / 2);
  g.moveTo(wx - ww / 2, wy);
  g.lineTo(wx + ww / 2, wy);
  g.stroke();
  g.restore();
  return { x: wx, y: wy };
}

function palm(g: G, x: number, gy: number, h: number, t: number, trunk = '#6b4226', leaf = '#2f7d4a', lean = 0.12): Pt {
  const tx = x + h * lean;
  const ty = gy - h;
  g.save();
  g.strokeStyle = trunk;
  g.lineCap = 'round';
  g.lineWidth = h * 0.06;
  g.beginPath();
  g.moveTo(x, gy);
  g.quadraticCurveTo(x - h * lean * 0.3, gy - h * 0.5, tx, ty);
  g.stroke();
  g.fillStyle = leaf;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.6 + i) * 0.05;
    const len = h * (0.42 + (i % 2) * 0.08);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + len * 0.35;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.6 - h * 0.08, ex, ey);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.45, ty + Math.sin(a) * len * 0.4, tx, ty);
    g.fill();
  }
  g.fillStyle = '#5a3a1e';
  g.beginPath();
  g.arc(tx - h * 0.03, ty + h * 0.03, h * 0.035, 0, TAU);
  g.arc(tx + h * 0.03, ty + h * 0.04, h * 0.035, 0, TAU);
  g.fill();
  g.restore();
  return { x: tx, y: ty };
}

function balloon(g: G, x: number, y: number, r: number, color: string, stringLen: number, t: number, heartShape = false): void {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, y + r * 1.05);
  g.quadraticCurveTo(x + Math.sin(t * 2 + x) * r * 0.5, y + r + stringLen * 0.5, x, y + r + stringLen);
  g.stroke();
  if (heartShape) heart(g, x, y, r * 1.05, color);
  else {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, r * 0.86, r, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(x, y + r * 0.95);
    g.lineTo(x - r * 0.12, y + r * 1.12);
    g.lineTo(x + r * 0.12, y + r * 1.12);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(x - r * 0.32, y - r * 0.35, r * 0.15, r * 0.26, -0.5, 0, TAU);
  g.fill();
  g.restore();
}

function gift(g: G, x: number, gy: number, s: number, box: string, ribbon: string): void {
  g.save();
  g.fillStyle = box;
  g.fillRect(x - s / 2, gy - s, s, s);
  g.fillStyle = 'rgba(0,0,0,0.1)';
  g.fillRect(x - s / 2, gy - s, s, s * 0.22);
  g.fillStyle = ribbon;
  g.fillRect(x - s * 0.08, gy - s, s * 0.16, s);
  g.fillRect(x - s / 2, gy - s * 0.86, s, s * 0.12);
  g.beginPath();
  g.ellipse(x - s * 0.17, gy - s * 1.08, s * 0.18, s * 0.1, 0.5, 0, TAU);
  g.ellipse(x + s * 0.17, gy - s * 1.08, s * 0.18, s * 0.1, -0.5, 0, TAU);
  g.fill();
  g.restore();
}

/** Envelope centred at (x, y); open 0..1 lifts the flap and slides the letter out. */
function envelope(g: G, x: number, y: number, w: number, rot: number, open: number, letter: number, seal = '#e63973'): void {
  const h = w * 0.64;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const L = -w / 2;
  const T = -h / 2;
  g.fillStyle = '#f1e0c8';
  g.fillRect(L, T, w, h);
  const flapOpen = open > 0.5;
  const fy = T + h * 0.55 * (1 - 2 * clamp(open));
  if (flapOpen) {
    g.fillStyle = '#e8d2b0';
    g.beginPath();
    g.moveTo(L, T);
    g.lineTo(0, fy);
    g.lineTo(-L, T);
    g.closePath();
    g.fill();
  }
  if (letter > 0) {
    const ly = T + h * 0.1 - letter * h * 0.75;
    g.fillStyle = '#fffdf6';
    g.fillRect(L + w * 0.08, ly, w * 0.84, h * 0.85);
    g.strokeStyle = 'rgba(120,80,90,0.5)';
    g.lineWidth = Math.max(1, w * 0.012);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      g.moveTo(L + w * 0.17, ly + h * (0.16 + i * 0.12));
      g.lineTo(L + w * (i === 3 ? 0.5 : 0.82), ly + h * (0.16 + i * 0.12));
    }
    g.stroke();
    heart(g, w * 0.22, ly + h * 0.6, w * 0.07, '#e63973');
  }
  g.fillStyle = '#f6e9d6';
  g.beginPath();
  g.moveTo(L, T + h * 0.08);
  g.lineTo(0, T + h * 0.62);
  g.lineTo(-L, T + h * 0.08);
  g.lineTo(-L, -T);
  g.lineTo(L, -T);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(160,120,90,0.35)';
  g.lineWidth = Math.max(1, w * 0.012);
  g.beginPath();
  g.moveTo(L, -T);
  g.lineTo(0, T + h * 0.5);
  g.lineTo(-L, -T);
  g.stroke();
  if (!flapOpen) {
    g.fillStyle = '#ead6b6';
    g.beginPath();
    g.moveTo(L, T);
    g.lineTo(0, fy);
    g.lineTo(-L, T);
    g.closePath();
    g.fill();
    if (open < 0.15) heart(g, 0, fy - h * 0.05, w * 0.1, seal);
  }
  g.restore();
}

function jaggedBubble(g: G, x: number, y: number, r: number, fill: string, text: string, textCol: string, spin: number): void {
  g.save();
  g.fillStyle = fill;
  g.beginPath();
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + spin;
    const rr = i % 2 ? r * 0.72 : r * (1 + 0.08 * Math.sin(i * 7.3));
    g.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.85);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = Math.max(1.5, r * 0.06);
  g.stroke();
  g.fillStyle = textCol;
  g.font = `900 ${r * 0.62}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y + r * 0.04);
  g.restore();
}

/** A heart split down a jagged crack; `split` 0..1 pulls the halves apart. */
function crackedHeart(g: G, x: number, y: number, r: number, color: string, split: number): void {
  const crack = [
    [0, -0.45],
    [-0.15, -0.15],
    [0.12, 0.1],
    [-0.1, 0.4],
    [0, 0.9],
  ];
  for (const side of [-1, 1]) {
    g.save();
    g.translate(x + side * split * r * 0.5, y + split * r * 0.25);
    g.rotate(side * split * 0.35);
    g.beginPath();
    g.moveTo(crack[0][0] * r, crack[0][1] * r);
    for (const [cx, cy] of crack) g.lineTo(cx * r, cy * r);
    g.lineTo(side * r * 2, r);
    g.lineTo(side * r * 2, -r * 2);
    g.closePath();
    g.clip();
    heart(g, 0, 0, r, color);
    g.restore();
  }
  if (split < 0.05) {
    g.save();
    g.strokeStyle = 'rgba(40,0,10,0.7)';
    g.lineWidth = Math.max(1.5, r * 0.06);
    g.beginPath();
    for (const [cx, cy] of crack.slice(0, Math.max(2, Math.round(1 + split * 60)))) g.lineTo(x + cx * r, y + cy * r);
    g.stroke();
    g.restore();
  }
}

function gullV(g: G, x: number, y: number, s: number, t: number, color = 'rgba(40,20,40,0.7)'): void {
  const flap = Math.sin(t * 8 + x * 0.05) * s * 0.35;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.12);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s, y - flap);
  g.quadraticCurveTo(x - s * 0.4, y - s * 0.4, x, y);
  g.quadraticCurveTo(x + s * 0.4, y - s * 0.4, x + s, y - flap);
  g.stroke();
  g.restore();
}

function floorFill(g: G, L: Layout, gy: number, top: string, bottom: string): void {
  const grad = g.createLinearGradient(0, gy, 0, L.h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.save();
  g.fillStyle = grad;
  g.fillRect(0, gy, L.w, L.h - gy);
  g.restore();
}

function hill(g: G, L: Layout, cx: number, topY: number, w: number, color: string): void {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - w, L.h);
  const cy = L.h - (L.h - topY) / 0.75;
  g.bezierCurveTo(cx - w * 0.6, cy, cx + w * 0.6, cy, cx + w, L.h);
  g.closePath();
  g.fill();
  g.restore();
}

function bush(g: G, x: number, gy: number, s: number, leaf: string, flower: string): void {
  g.save();
  g.fillStyle = leaf;
  g.beginPath();
  g.arc(x - s * 0.5, gy - s * 0.35, s * 0.45, 0, TAU);
  g.arc(x + s * 0.4, gy - s * 0.38, s * 0.5, 0, TAU);
  g.arc(x, gy - s * 0.6, s * 0.5, 0, TAU);
  g.fill();
  g.fillRect(x - s * 0.9, gy - s * 0.4, s * 1.8, s * 0.4);
  g.fillStyle = flower;
  const r = makeRand(Math.round(x));
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(x + r.range(-0.75, 0.75) * s, gy - r.range(0.2, 0.95) * s, s * 0.11, 0, TAU);
    g.fill();
  }
  g.restore();
}

function stringLights(f: SceneFrame, y0: number, sag: number, spans: number, seed: number): void {
  const { g, L, t } = f;
  const segW = L.w / spans;
  const r = makeRand(seed);
  const cols = ['#ffd166', '#ff8fab', '#9be7ff', '#ffe8a3', '#c3a6ff'];
  g.save();
  g.strokeStyle = 'rgba(30,20,30,0.85)';
  g.lineWidth = 1.5;
  for (let s = 0; s < spans; s++) {
    const x0 = s * segW;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + segW / 2, y0 + sag * 2, x0 + segW, y0);
    g.stroke();
  }
  const n = Math.round(L.w / 34);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (L.w / n);
    const u = (x % segW) / segW;
    const y = y0 + sag * 4 * u * (1 - u) + 5;
    const c = cols[i % cols.length];
    const tw = 0.65 + 0.35 * Math.sin(t * 3 + r() * 6);
    g.globalAlpha = f.a * 0.3 * tw;
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, 11, 0, TAU);
    g.fill();
    g.globalAlpha = f.a;
    g.beginPath();
    g.arc(x, y, 4, 0, TAU);
    g.fill();
  }
  g.restore();
}

// ================================================================== palette

const ME = '#2f3e6e';
const ME_TIE = '#ff6b6b';
const YOU = '#7a2e5c';
const YOU_DRESS = '#ff5d8f';

// ================================================================== 1. date

function dinnerSet(f: SceneFrame, S: Stage, x: number, mood: (side: 0 | 1) => Mood, clinkT: number, blush: number): number {
  const { g, t, era } = f;
  const { fh, gy } = S;
  const old = before(era, 'industrial');
  const tw = fh * 0.46;
  const ax = x - tw - fh * 0.05;
  const bx = x + tw + fh * 0.05;
  const chairCol = old ? '#5a3418' : '#3b1d2c';
  chair(g, ax, gy, fh, 1, chairCol);
  chair(g, bx, gy, fh, -1, chairCol);
  const top = gy - fh * 0.4;
  const gs = fh * 0.17;
  const gax = lerp(x - tw * 0.55, x - gs * 0.28, clinkT);
  const gbx = lerp(x + tw * 0.55, x + gs * 0.28, clinkT);
  const gyy = lerp(top, top - fh * 0.2, clinkT);
  figure(g, ax, gy, fh, { color: ME, accent: ME_TIE, pose: 'sit', dir: 1, mood: mood(0), blush, front: { x: gax, y: gyy - gs * (old ? 0.45 : 0.4) } });
  figure(g, bx, gy, fh * 0.96, { color: YOU, pose: 'sit', dir: -1, dress: true, accent: YOU_DRESS, hair: 'long', mood: mood(1), blush, front: { x: gbx, y: gyy - gs * (old ? 0.45 : 0.4) } });
  diningTable(g, x, gy, fh, tw, old ? '#8a5a33' : '#f5e6d3', old ? '#5a3418' : '#3b1d2c');
  if (old) {
    tankard(g, gax, gyy, gs * 0.9);
    tankard(g, gbx, gyy, gs * 0.9);
  } else {
    wineGlass(g, gax, gyy, gs);
    wineGlass(g, gbx, gyy, gs);
  }
  // plates
  g.save();
  g.fillStyle = old ? '#c9a46a' : '#ffffff';
  g.beginPath();
  g.ellipse(x - tw * 0.45, top - 2, fh * 0.11, fh * 0.02, 0, 0, TAU);
  g.ellipse(x + tw * 0.45, top - 2, fh * 0.11, fh * 0.02, 0, 0, TAU);
  g.fill();
  g.restore();
  candle(g, x - fh * 0.03, top, fh * 0.12, t, 1);
  candle(g, x + fh * 0.04, top, fh * 0.09, t, 4);
  return top;
}

const date = def(3.0, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  const old = before(era, 'industrial');
  if (old) {
    sky(g, L, ['#2a170c', '#4a2a15', '#6b3d1e']);
    g.save();
    g.fillStyle = 'rgba(30,15,5,0.55)';
    for (let x = 30; x < L.w; x += 160) g.fillRect(x, 0, 18, gy);
    g.fillRect(0, L.h * 0.08, L.w, 16);
    g.restore();
    // hearth
    const hx = S.alt ?? L.w * 0.86;
    const hw = S.port ? fh * 0.5 : fh * 0.9;
    g.save();
    g.fillStyle = '#3a2416';
    g.fillRect(hx - hw / 2, gy - hw * 0.9, hw, hw * 0.9);
    g.fillStyle = '#120804';
    g.beginPath();
    g.arc(hx, gy - hw * 0.35, hw * 0.3, Math.PI, 0);
    g.lineTo(hx + hw * 0.3, gy);
    g.lineTo(hx - hw * 0.3, gy);
    g.fill();
    g.restore();
    glow(g, hx, gy - hw * 0.2, hw * 1.4, 'rgba(255,140,40,0.45)', 0.8 + 0.2 * Math.sin(t * 9));
    g.save();
    g.fillStyle = '#ff9a2e';
    for (let i = 0; i < 3; i++) {
      const fx = hx + (i - 1) * hw * 0.12;
      const fl = hw * (0.22 + 0.06 * Math.sin(t * 13 + i * 2));
      g.beginPath();
      g.moveTo(fx - hw * 0.07, gy);
      g.quadraticCurveTo(fx, gy - fl * 1.6, fx + hw * 0.07, gy);
      g.fill();
    }
    g.restore();
    floorFill(g, L, gy, '#3a2212', '#1e1008');
  } else {
    sky(g, L, ['#1a1030', '#341a42', '#55243f']);
    // window with a night skyline
    const wx = S.alt ?? L.w * 0.5;
    const ww = S.port ? L.w * 0.7 : S.sideW * 0.62;
    const wt = S.port ? L.h * 0.04 : L.h * 0.12;
    const wb = gy - fh * 0.75;
    g.save();
    g.beginPath();
    g.rect(wx - ww / 2, wt, ww, wb - wt);
    g.clip();
    sky(g, L, ['#0b1030', '#24305e', '#4a3a6e']);
    skyline(g, L, wb, era, '#141a35', 23, 'rgba(255,214,120,0.8)');
    moon(g, wx + ww * 0.28, wt + (wb - wt) * 0.25, fh * 0.1);
    g.restore();
    g.save();
    g.strokeStyle = '#2a1424';
    g.lineWidth = 8;
    g.strokeRect(wx - ww / 2, wt, ww, wb - wt);
    g.beginPath();
    g.moveTo(wx, wt);
    g.lineTo(wx, wb);
    g.stroke();
    g.restore();
    floorFill(g, L, gy, '#2a1424', '#14080f');
  }
  // pendant lamps
  for (const lx of S.port ? [L.w * 0.18, L.w * 0.82] : [main - S.sideW * 0.35, main + S.sideW * 0.35]) {
    g.save();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(lx, 0);
    g.lineTo(lx, L.h * (S.port ? 0.1 : 0.2));
    g.stroke();
    g.restore();
    glow(g, lx, L.h * (S.port ? 0.11 : 0.21), fh * 0.5, 'rgba(255,200,120,0.55)');
  }
  glow(g, main, gy - fh * 0.55, fh * 1.4, 'rgba(255,170,90,0.35)', 0.9 + Math.sin(t * 7) * 0.08);
  const clink = span(p, 0.3, 0.45) - span(p, 0.62, 0.8);
  const top = dinnerSet(f, S, main, () => (p > 0.42 && p < 0.65 ? 'calm' : 'smile'), clink, 0.3 + span(p, 0.4, 0.6) * 0.6);
  const r = f.rand;
  burst(f, 'clink', 'clinked', p > 0.44, 10, () => {
    const a = r() * TAU;
    return pt(main, top - fh * 0.38, Math.cos(a) * 90, Math.sin(a) * 90, 0.6, fh * 0.035, '#fff3b0', SPARK, r() * 3);
  });
  runPs(f, 'clink', 0, 1.5);
  heartRise(f, 'hearts', main, top - fh * 0.2, fh * 0.15, fh * 0.04, 3);
  runPs(f, 'hearts');
  // waiter
  if (S.alt !== null) {
    const wx = S.alt - S.sideW * 0.15 + (1 - easeOut(span(p, 0, 0.35))) * S.sideW * 0.12;
    const info = figure(g, wx, gy, fh * 1.02, { color: '#1c1c28', accent: '#ffffff', dir: -1, mood: 'smile', front: Math.PI / 2 - 0.1, back: 0.5, pose: p < 0.3 ? 'walk' : 'stand', phase: t });
    g.save();
    g.fillStyle = '#d9d9e3';
    g.fillRect(info.hf.x - fh * 0.14, info.hf.y - 3, fh * 0.28, 4);
    g.beginPath();
    g.arc(info.hf.x, info.hf.y - 3, fh * 0.11, Math.PI, 0);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(info.hb.x - 4, info.hb.y - 18, 8, 22);
    g.restore();
  }
});

// ================================================================== 2. kiss

const kiss = def(2.8, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#0a0e2c', '#22195a', '#5a2d6e']);
  starfield(f, 90, 11, gy);
  moon(g, S.alt ?? L.w * 0.8, S.port ? L.h * 0.1 : L.h * 0.22, S.port ? fh * 0.2 : fh * 0.32);
  skyline(g, L, gy, era, '#160f2e', 5, 'rgba(255,210,120,0.55)');
  floorFill(g, L, gy, '#1d1838', '#0b0918');
  lampPost(g, main - (S.port ? fh * 0.7 : fh * 0.75), gy, fh * 1.45, 1, era);
  const k = span(p, 0.1, 0.42);
  const d = lerp(fh * 0.34, fh * 0.21, k);
  const lean = lerp(0, 0.12, k);
  const kissing = p > 0.42;
  figure(g, main - d, gy, fh, { color: ME, accent: ME_TIE, dir: 1, lean, mood: kissing ? 'kiss' : 'smile', blush: k, front: Math.PI / 2 - 0.25 });
  figure(g, main + d, gy, fh * 0.94, { color: YOU, dir: -1, lean: -lean, dress: true, accent: YOU_DRESS, hair: 'long', mood: kissing ? 'kiss' : 'smile', blush: k, front: 2.3 });
  const hy = headY(gy, fh) + fh * 0.03;
  if (kissing) glow(g, main, hy, fh * 0.6, 'rgba(255,120,170,0.45)', span(p, 0.42, 0.6));
  heartBurst(f, 'burst', 'b1', kissing, main, hy - fh * 0.1, fh * 0.06, 16);
  runPs(f, 'burst', 40, 1.6);
  if (kissing) heartRise(f, 'rise', main, hy - fh * 0.15, fh * 0.2, fh * 0.05, 6);
  runPs(f, 'rise');
  // fireflies
  const r = makeRand(3);
  g.save();
  for (let i = 0; i < 14; i++) {
    const fx = (S.port ? L.w * r() : (r() < 0.5 ? main : (S.alt ?? main)) + r.range(-0.45, 0.45) * S.sideW);
    const fy = gy - fh * r.range(0.1, 1.2) + Math.sin(t * 1.5 + i) * 8;
    g.globalAlpha = f.a * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
    g.fillStyle = '#fff2a0';
    g.beginPath();
    g.arc(fx + Math.cos(t + i) * 10, fy, 2.2, 0, TAU);
    g.fill();
  }
  g.restore();
});

// ================================================================== 3. dance

function gramophone(g: G, x: number, gy: number, s: number): Pt {
  g.save();
  g.fillStyle = '#5a3418';
  g.fillRect(x - s * 0.35, gy - s * 0.35, s * 0.7, s * 0.35);
  g.fillStyle = '#2a1a0e';
  g.beginPath();
  g.ellipse(x, gy - s * 0.37, s * 0.3, s * 0.05, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#c9a24a';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(x + s * 0.15, gy - s * 0.38);
  g.quadraticCurveTo(x + s * 0.2, gy - s * 0.7, x + s * 0.05, gy - s * 0.8);
  g.stroke();
  g.fillStyle = '#e0b74f';
  g.beginPath();
  g.moveTo(x + s * 0.05, gy - s * 0.78);
  g.lineTo(x - s * 0.5, gy - s * 1.35);
  g.quadraticCurveTo(x - s * 0.15, gy - s * 1.25, x - s * 0.02, gy - s * 0.82);
  g.lineTo(x + s * 0.1, gy - s * 0.82);
  g.quadraticCurveTo(x + s * 0.3, gy - s * 1.4, x - s * 0.5, gy - s * 1.35);
  g.closePath();
  g.fill();
  g.restore();
  return { x: x - s * 0.25, y: gy - s * 1.3 };
}

const dance = def(3.0, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#22174a', '#5c3070', '#d9776a']);
  starfield(f, 40, 21, gy * 0.6);
  stringLights(f, S.port ? L.h * 0.06 : L.h * 0.08, S.port ? L.h * 0.03 : L.h * 0.06, S.port ? 2 : 4, 9);
  stringLights(f, S.port ? L.h * 0.15 : L.h * 0.24, S.port ? L.h * 0.025 : L.h * 0.05, S.port ? 1 : 3, 13);
  floorFill(g, L, gy, '#3a2448', '#1a1024');
  g.save();
  g.fillStyle = 'rgba(255,200,150,0.18)';
  g.beginPath();
  g.ellipse(main, gy + fh * 0.05, fh * 0.9, fh * 0.12, 0, 0, TAU);
  g.fill();
  g.restore();
  glow(g, main, gy - fh * 0.5, fh * 1.1, 'rgba(255,170,200,0.35)');
  const sw = Math.sin(t * 2.2);
  const off = sw * fh * 0.06;
  const hands = { x: main + off + fh * 0.02, y: gy - fh * 0.88 };
  figure(g, main - fh * 0.16 + off, gy, fh, { color: ME, accent: ME_TIE, dir: 1, lean: sw * 0.04, mood: 'calm', blush: 0.6, front: Math.PI / 2 - 0.15, back: hands });
  figure(g, main + fh * 0.16 + off, gy, fh * 0.94, { color: YOU, dir: -1, lean: sw * 0.04, dress: true, accent: YOU_DRESS, hair: 'long', hat: 'flower', mood: 'calm', blush: 0.6, back: hands, front: 2.4 });
  // the dress swishes
  const gp = S.alt !== null ? gramophone(g, S.alt, gy, fh * 0.7) : gramophone(g, L.w * 0.88, gy, fh * 0.42);
  const r = f.rand;
  spawn(f, 'notes', 5, 18, () => pt(gp.x, gp.y, r.range(-50, -10) * (S.alt !== null ? 1 : 0.6), r.range(-50, -30), r.range(1.8, 2.6), fh * r.range(0.05, 0.08), r.pick(['#ffd166', '#ffffff', '#ff8fab']), NOTE, r()));
  spawn(f, 'notes2', 3, 10, () => pt(main + r.range(-1, 1) * fh * 0.5, gy - fh * 1.1, r.range(-15, 15), r.range(-40, -25), r.range(1.4, 2), fh * r.range(0.05, 0.07), r.pick(['#ffd166', '#ffffff', '#c3a6ff']), NOTE, r()));
  runPs(f, 'notes');
  runPs(f, 'notes2');
});

// ================================================================== 4. flirt

const flirt = def(2.8, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main, gap } = S;
  sky(g, L, ['#3d2418', '#6b3e24', '#9a5f35']);
  // wallpaper stripes
  g.save();
  g.fillStyle = 'rgba(255,220,170,0.06)';
  for (let x = 0; x < L.w; x += 44) g.fillRect(x, 0, 18, gy);
  g.restore();
  // shelves + bottles
  const shelfY = [gy - fh * 1.15, gy - fh * 0.85];
  const shelves = S.port ? [{ c: L.w / 2, w: L.w * 0.9 }] : [{ c: main, w: S.sideW * 0.85 }, { c: S.alt ?? main, w: S.sideW * 0.85 }];
  const br = makeRand(5);
  for (const sh of shelves) {
    for (const sy of shelfY) {
      g.save();
      g.fillStyle = '#2a170c';
      g.fillRect(sh.c - sh.w / 2, sy, sh.w, 6);
      const n = Math.floor(sh.w / (fh * 0.09));
      for (let i = 0; i < n; i++) {
        if (br() < 0.3) continue;
        const bx = sh.c - sh.w / 2 + (i + 0.5) * (sh.w / n);
        const bh = fh * br.range(0.12, 0.2);
        g.fillStyle = br.pick(['#2f7d4a', '#8a2b3a', '#c99a3a', '#3a5f8a', '#6b3a8a']);
        g.globalAlpha = f.a * 0.85;
        rrect(g, bx - fh * 0.025, sy - bh, fh * 0.05, bh, fh * 0.015);
        g.fill();
        g.fillRect(bx - fh * 0.01, sy - bh - fh * 0.04, fh * 0.02, fh * 0.05);
      }
      g.restore();
    }
  }
  for (const lx of S.port ? [L.w * 0.25, L.w * 0.75] : [main - S.sideW * 0.25, main + S.sideW * 0.25, (S.alt ?? 0) - S.sideW * 0.2, (S.alt ?? 0) + S.sideW * 0.2]) {
    glow(g, lx, L.h * 0.07, fh * 0.6, 'rgba(255,200,120,0.6)');
    g.save();
    g.fillStyle = '#1a0f08';
    g.beginPath();
    g.arc(lx, L.h * 0.07, fh * 0.06, Math.PI, 0);
    g.fill();
    g.restore();
  }
  floorFill(g, L, gy, '#2a170c', '#140a05');
  // bar counter behind the figures
  const ct = gy - fh * 0.5;
  g.save();
  g.fillStyle = '#4a2a16';
  g.fillRect(0, ct, L.w, gy - ct);
  g.fillStyle = '#c98b4f';
  g.fillRect(0, ct - fh * 0.04, L.w, fh * 0.05);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 20; x < L.w; x += 70) g.fillRect(x, ct + fh * 0.06, 34, gy - ct - fh * 0.1);
  g.restore();
  // cups on the counter
  for (const cx of [main - gap * 0.2, main + gap * 0.25]) {
    g.save();
    g.fillStyle = '#fff6e8';
    rrect(g, cx - fh * 0.035, ct - fh * 0.1, fh * 0.07, fh * 0.07, fh * 0.015);
    g.fill();
    g.restore();
  }
  const ax = main - gap * 0.85;
  const bx = main + gap * 0.85;
  const winking = p > 0.28 && p < 0.5;
  const a = figure(g, ax, gy, fh, { color: ME, accent: ME_TIE, dir: 1, mood: winking ? 'wink' : 'smile', back: { x: ax - fh * 0.12, y: ct - fh * 0.04 }, front: 0.3 });
  const got = span(p, 0.62, 0.75);
  const b = figure(g, bx, gy, fh * 0.95, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'bun', mood: got > 0.5 ? 'smile' : 'none', blush: got, back: { x: bx + fh * 0.12, y: ct - fh * 0.04 }, front: got > 0.5 ? 'face' : 0.25 });
  if (got <= 0.5) face(g, b.hx, b.hy, b.hr, -1, 'smile', 'rgba(255,248,240,0.95)', 0);
  if (winking) {
    const k = Math.sin(((p - 0.28) / 0.22) * Math.PI);
    sparkle(g, a.hx + a.hr * 1.1, a.hy - a.hr * 0.6, fh * 0.07 * k, '#fff3b0', t * 3);
    sparkle(g, a.hx + a.hr * 1.6, a.hy - a.hr * 1.2, fh * 0.04 * k, '#ffffff', -t * 3);
  }
  // a little heart floats across
  const hp = span(p, 0.42, 0.66);
  if (hp > 0 && hp < 1) {
    const hx = lerp(a.hx + a.hr, b.hx - b.hr, hp);
    const hy = lerp(a.hy, b.hy, hp) - Math.sin(hp * Math.PI) * fh * 0.35;
    glow(g, hx, hy, fh * 0.15, 'rgba(255,120,170,0.5)');
    heart(g, hx, hy, fh * 0.06 * (1 + 0.15 * Math.sin(t * 14)), '#ff4d7e');
  }
  heartBurst(f, 'pop', 'popped', p > 0.66, b.hx, b.hy - b.hr, fh * 0.035, 8);
  runPs(f, 'pop', 60, 2);
  if (S.alt !== null) {
    figure(g, S.alt, gy, fh, { color: '#1c1c28', accent: '#ffffff', dir: -1, mood: 'smile', front: { x: S.alt - fh * 0.14, y: gy - fh * 0.62 + Math.sin(t * 8) * fh * 0.03 }, back: { x: S.alt - fh * 0.1, y: gy - fh * 0.58 } });
    wineGlass(g, S.alt - fh * 0.13, gy - fh * 0.54 + Math.sin(t * 8) * fh * 0.03, fh * 0.12, 'rgba(0,0,0,0)');
  }
});

// ================================================================== 5. romance (beach walk)

const romance = def(3.0, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  const hz = gy - fh * 0.45;
  sky(g, L, ['#3b2a63', '#b8457a', '#ff8c5a', '#ffd27a']);
  const sx = S.alt ?? L.w * 0.72;
  const sr = S.port ? fh * 0.32 : fh * 0.45;
  glow(g, sx, hz, sr * 4, 'rgba(255,200,120,0.55)');
  g.save();
  g.beginPath();
  g.rect(0, 0, L.w, hz);
  g.clip();
  g.fillStyle = '#ffdf8a';
  g.beginPath();
  g.arc(sx, hz + sr * 0.25, sr, 0, TAU);
  g.fill();
  g.restore();
  // sea
  const sea = g.createLinearGradient(0, hz, 0, gy);
  sea.addColorStop(0, '#c45a7a');
  sea.addColorStop(1, '#5a3a7a');
  g.save();
  g.fillStyle = sea;
  g.fillRect(0, hz, L.w, gy - hz);
  g.fillStyle = 'rgba(255,220,140,0.6)';
  for (let i = 0; i < 9; i++) {
    const yy = hz + (i + 0.5) * ((gy - hz) / 9);
    const ww = sr * (1.4 - i * 0.08) * (0.7 + 0.3 * Math.sin(t * 3 + i * 1.7));
    g.fillRect(sx - ww / 2, yy, ww, 2.5);
  }
  g.restore();
  // sand + foam
  floorFill(g, L, gy - fh * 0.04, '#e3a86e', '#9a5a3a');
  g.save();
  g.strokeStyle = 'rgba(255,240,230,0.8)';
  g.lineWidth = 3;
  g.beginPath();
  const wy = gy - fh * 0.04 + Math.sin(t * 1.8) * 3;
  for (let x = 0; x <= L.w; x += 20) g.lineTo(x, wy + Math.sin(x * 0.04 + t * 2) * 3);
  g.stroke();
  g.restore();
  // palm
  palm(g, S.port ? L.w * 0.1 : main - S.sideW * 0.4, gy + fh * 0.04, fh * 1.3, t, '#3a1f2a', '#2a1530', 0.18);
  if (S.alt !== null) palm(g, S.alt + S.sideW * 0.35, gy + fh * 0.04, fh * 1.1, t + 1, '#3a1f2a', '#2a1530', -0.15);
  // walking couple
  const x = main - fh * 0.42 + p * fh * 0.6;
  const fy = gy + fh * 0.02;
  g.save();
  g.fillStyle = 'rgba(110,60,40,0.35)';
  for (let i = 0; i < 12; i++) {
    const px = x - fh * 0.05 - i * fh * 0.07;
    if (px < main - fh * 0.6) break;
    g.beginPath();
    g.ellipse(px, fy + (i % 2 ? 4 : -2), 4, 2, 0, 0, TAU);
    g.ellipse(px + fh * 0.28, fy + (i % 2 ? -2 : 4), 4, 2, 0, 0, TAU);
    g.fill();
  }
  g.restore();
  const hold = { x: x + fh * 0.14, y: gy - fh * 0.48 };
  figure(g, x, fy, fh, { color: '#2c1a35', dir: 1, pose: 'walk', phase: t, front: hold, mood: 'smile', ink: 'rgba(255,200,170,0.9)' });
  figure(g, x + fh * 0.28, fy, fh * 0.94, { color: '#4a1f45', dir: 1, pose: 'walk', phase: t + 0.45, dress: true, accent: '#d94a7a', hair: 'long', back: hold, mood: 'smile', ink: 'rgba(255,200,170,0.9)' });
  heartRise(f, 'h', x + fh * 0.14, gy - fh * 1.05, fh * 0.12, fh * 0.035, 2.5);
  runPs(f, 'h');
  const r = makeRand(8);
  for (let i = 0; i < 3; i++) {
    const bx = ((r() * L.w + t * r.range(25, 45)) % (L.w + 60)) - 30;
    gullV(g, bx, L.h * r.range(0.08, S.port ? 0.2 : 0.3), fh * 0.06, t + i);
  }
});

// ================================================================== 6. nightTogether

const nightTogether = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#060a22', '#121a46', '#28285c']);
  starfield(f, 110, 31, gy);
  const off = span(p, 0.38, 0.42);
  const flick = p > 0.33 && p < 0.38 ? (Math.sin(t * 60) > 0 ? 1 : 0.4) : 1;
  const lit = (1 - off) * flick;
  // moon
  const mx = S.alt ?? L.w * 0.8;
  const my = S.port ? L.h * 0.1 : L.h * 0.25;
  const mr = S.port ? fh * 0.24 : fh * 0.4;
  moon(g, mx, my, mr, span(p, 0.45, 0.7), true);
  floorFill(g, L, gy, '#151a38', '#080a18');
  hill(g, L, main, gy - fh * 0.12, S.port ? L.w * 0.75 : S.sideW * 0.75, '#1a2044');
  const hw = S.port ? fh * 1.0 : fh * 1.15;
  // tree + fence
  g.save();
  g.fillStyle = '#0e1230';
  g.fillRect(main - hw * 0.95, gy - fh * 0.6, fh * 0.05, fh * 0.6);
  g.beginPath();
  g.arc(main - hw * 0.93, gy - fh * 0.75, fh * 0.28, 0, TAU);
  g.fill();
  for (let i = -6; i <= 6; i++) g.fillRect(main + i * fh * 0.12, gy - fh * 0.16, fh * 0.03, fh * 0.16);
  g.fillRect(main - fh * 0.75, gy - fh * 0.11, fh * 1.5, fh * 0.025);
  g.restore();
  const win = house(g, main + hw * 0.08, gy - fh * 0.05, hw, hw * 0.62, '#2a2f5a', '#1a1d3e', lit, era);
  const r = f.rand;
  if (p > 0.44)
    spawn(f, 'h', 5, 22, () => pt(win.x + r.range(-0.1, 0.1) * hw, win.y, r.range(-15, 20), -r.range(30, 55), r.range(1.6, 2.4), fh * r.range(0.035, 0.06), r.pick(['#ff6b9a', '#ff8fab', '#ffb3c6']), HEART, r() * 6));
  runPs(f, 'h');
  if (p > 0.5) {
    const z = span(p, 0.5, 0.75);
    caption(g, 'z', mx + mr * 1.1, my - mr * (0.6 + z * 0.4), mr * 0.35, '#fff3c4', z * 0.7);
  }
});

// ================================================================== 7. proposal

const proposal = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#ff9f7a', '#ffc58f', '#ffe6c2']);
  const bk = makeRand(17);
  for (let i = 0; i < 18; i++) {
    const bx = bk() * L.w;
    const by = bk() * gy * 0.9 + Math.sin(t * 0.8 + i) * 6;
    glow(g, bx, by, fh * bk.range(0.08, 0.2), bk.pick(['rgba(255,255,255,0.5)', 'rgba(255,200,140,0.5)', 'rgba(255,170,190,0.5)']));
  }
  floorFill(g, L, gy, '#7fb860', '#4a8a3a');
  // rose arch
  const ax = S.alt ?? (S.port ? L.w * 0.5 : main);
  const ar = S.port ? fh * 0.75 : fh * 0.65;
  g.save();
  g.strokeStyle = '#3f7a3a';
  g.lineWidth = fh * 0.05;
  g.beginPath();
  g.moveTo(ax - ar, gy);
  g.lineTo(ax - ar, gy - fh * 0.9);
  g.arc(ax, gy - fh * 0.9, ar, Math.PI, 0);
  g.lineTo(ax + ar, gy);
  g.stroke();
  const fr = makeRand(4);
  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    let fx: number;
    let fy: number;
    if (u < 0.25) {
      fx = ax - ar;
      fy = gy - (u / 0.25) * fh * 0.9;
    } else if (u > 0.75) {
      fx = ax + ar;
      fy = gy - ((1 - u) / 0.25) * fh * 0.9;
    } else {
      const a = Math.PI + ((u - 0.25) / 0.5) * Math.PI;
      fx = ax + Math.cos(a) * ar;
      fy = gy - fh * 0.9 + Math.sin(a) * ar;
    }
    g.fillStyle = fr.pick(['#ff5d8f', '#ffffff', '#ff8fab', '#e63973']);
    g.beginPath();
    g.arc(fx + fr.range(-5, 5), fy + fr.range(-5, 5), fh * 0.035, 0, TAU);
    g.fill();
  }
  g.restore();
  const kx = main - fh * 0.3;
  const bx = main + fh * 0.24;
  const open = span(p, 0.2, 0.32);
  const react = span(p, 0.32, 0.42);
  const boxP = { x: kx + fh * 0.27, y: gy - fh * 0.42 };
  figure(g, kx, gy, fh, { color: ME, accent: ME_TIE, dir: 1, pose: 'kneel', mood: 'smile', front: boxP, back: 0.3 });
  const hop = p > 0.6 ? Math.abs(Math.sin((p - 0.6) * 18)) * fh * 0.05 : 0;
  figure(g, bx, gy - hop, fh * 0.95, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'long', hat: 'flower', mood: react > 0.5 ? (p > 0.6 ? 'calm' : 'shock') : 'smile', blush: react, front: react > 0.3 ? 'face' : 0.25, back: react > 0.3 ? 'face' : 0.25 });
  // ring box
  const s = fh * 0.12;
  g.save();
  g.translate(boxP.x + s * 0.3, boxP.y);
  g.fillStyle = '#b3123c';
  rrect(g, -s * 0.5, -s * 0.45, s, s * 0.5, s * 0.1);
  g.fill();
  if (open > 0) {
    glow(g, 0, -s * 0.55, s * 3 * open, 'rgba(255,250,210,0.7)');
    g.strokeStyle = '#ffd166';
    g.lineWidth = s * 0.14;
    g.beginPath();
    g.arc(0, -s * 0.6, s * 0.2, 0, TAU);
    g.stroke();
    sparkle(g, 0, -s * 0.85, s * 0.35 * (0.7 + 0.3 * Math.sin(t * 12)) * open, '#ffffff', t * 2);
  }
  g.save();
  g.translate(-s * 0.5, -s * 0.45);
  g.rotate(-open * 1.9);
  g.fillStyle = '#d61f50';
  rrect(g, 0, -s * 0.35, s, s * 0.35, s * 0.1);
  g.fill();
  g.restore();
  g.restore();
  const r = f.rand;
  burst(f, 'sp', 'open', open > 0.6, 14, () => {
    const a = r() * TAU;
    const v = r.range(60, 140);
    return pt(boxP.x + s * 0.3, boxP.y - s * 0.8, Math.cos(a) * v, Math.sin(a) * v, r.range(0.6, 1.1), fh * r.range(0.03, 0.05), r.pick(['#ffffff', '#fff3b0', '#ffd166']), SPARK, r() * 3);
  });
  runPs(f, 'sp', 0, 2);
  heartBurst(f, 'yes', 'yes', p > 0.6, main, headY(gy, fh) - fh * 0.1, fh * 0.05, 16);
  runPs(f, 'yes', 40, 1.5);
  if (p > 0.62) heartRise(f, 'rise', main, gy - fh * 1.1, fh * 0.3, fh * 0.04, 6);
  runPs(f, 'rise');
});

// ================================================================== 8. honeymoon

const honeymoon = def(3.2, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy, main } = S;
  const hz = gy - fh * 0.75;
  sky(g, L, ['#5a3a8f', '#e0607a', '#ff9f5a', '#ffd38a']);
  const sx = S.port ? L.w * 0.72 : main + S.sideW * 0.2;
  const sr = fh * 0.35;
  glow(g, sx, hz, sr * 4, 'rgba(255,210,130,0.6)');
  g.save();
  g.beginPath();
  g.rect(0, 0, L.w, hz);
  g.clip();
  g.fillStyle = '#ffe08a';
  g.beginPath();
  g.arc(sx, hz + sr * 0.3, sr, 0, TAU);
  g.fill();
  g.restore();
  const sea = g.createLinearGradient(0, hz, 0, L.h);
  sea.addColorStop(0, '#2fa6b8');
  sea.addColorStop(1, '#14527a');
  g.save();
  g.fillStyle = sea;
  g.fillRect(0, hz, L.w, L.h - hz);
  g.fillStyle = 'rgba(255,230,160,0.55)';
  for (let i = 0; i < 10; i++) {
    const yy = hz + 4 + i * fh * 0.07;
    const ww = sr * (1.6 - i * 0.1) * (0.6 + 0.4 * Math.sin(t * 3 + i * 1.3));
    g.fillRect(sx - ww / 2, yy, ww, 2.5);
  }
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const yy = gy + i * fh * 0.12 - fh * 0.1;
    g.beginPath();
    for (let x = 0; x <= L.w; x += 24) g.lineTo(x, yy + Math.sin(x * 0.05 + t * 2 + i) * 3);
    g.stroke();
  }
  g.restore();
  // bungalow over the water
  const bx = S.alt ?? (S.port ? L.w * 0.86 : main);
  const bw = S.port ? fh * 0.55 : fh * 0.95;
  const deck = gy - fh * 0.22;
  g.save();
  g.fillStyle = '#5a3a22';
  for (let i = 0; i < 5; i++) g.fillRect(bx - bw * 0.6 + i * bw * 0.3, deck, bw * 0.05, gy - deck + fh * 0.15);
  g.fillStyle = '#8a5a33';
  g.fillRect(bx - bw * 0.7, deck - fh * 0.03, bw * 1.4, fh * 0.04);
  g.fillStyle = '#c98b4f';
  g.fillRect(bx - bw * 0.45, deck - bw * 0.55, bw * 0.9, bw * 0.55);
  g.fillStyle = '#ffd27a';
  g.fillRect(bx - bw * 0.12, deck - bw * 0.42, bw * 0.24, bw * 0.24);
  g.fillStyle = '#d9a45a';
  g.beginPath();
  g.moveTo(bx - bw * 0.65, deck - bw * 0.5);
  g.lineTo(bx, deck - bw * 1.05);
  g.lineTo(bx + bw * 0.65, deck - bw * 0.5);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(120,70,30,0.6)';
  g.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.moveTo(bx - bw * 0.65 + i * bw * 0.13, deck - bw * 0.5);
    g.lineTo(bx, deck - bw * 1.05);
    g.stroke();
  }
  g.restore();
  // sandy islet with palms + hammock
  const ix = S.port ? L.w * 0.42 : main;
  const iw = S.port ? L.w * 0.42 : fh * 1.1;
  g.save();
  g.fillStyle = '#f0c987';
  g.beginPath();
  g.ellipse(ix, gy, iw, fh * 0.1, 0, Math.PI, 0);
  g.fill();
  g.restore();
  const span2 = S.port ? Math.min(iw * 0.75, fh * 0.75) : fh * 0.72;
  const p1 = palm(g, ix - span2, gy - fh * 0.04, fh * 1.25, t, '#6b4226', '#2f8a4a', 0.08);
  const p2 = palm(g, ix + span2, gy - fh * 0.04, fh * 1.15, t + 1, '#6b4226', '#3a9a52', -0.08);
  const ay = lerp(p1.y, gy, 0.55);
  const by = lerp(p2.y, gy, 0.55);
  const ax2 = lerp(p1.x, ix - span2, 0.55);
  const bx2 = lerp(p2.x, ix + span2, 0.55);
  const sag = fh * 0.22 + Math.sin(t * 1.8) * fh * 0.02;
  const swing = Math.sin(t * 1.8) * fh * 0.04;
  const midX = (ax2 + bx2) / 2 + swing;
  const midY = (ay + by) / 2 + sag;
  // the couple, snuggled in the hammock
  const hc = fh * 0.17;
  g.save();
  g.fillStyle = '#3a2340';
  g.beginPath();
  g.arc(midX - fh * 0.2, midY - hc * 1.3, hc, 0, TAU);
  g.fill();
  g.fillStyle = '#6a2a55';
  g.beginPath();
  g.arc(midX - fh * 0.06, midY - hc * 1.45, hc * 1.2, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(midX - fh * 0.04, midY - hc * 1.5, hc, 0, TAU);
  g.fill();
  face(g, midX - fh * 0.2, midY - hc * 1.3, hc, 1, 'calm', 'rgba(255,240,230,0.9)', 0.6);
  face(g, midX - fh * 0.04, midY - hc * 1.5, hc, -1, 'calm', 'rgba(255,240,230,0.9)', 0.6);
  g.fillStyle = '#3a2340';
  g.beginPath();
  g.ellipse(midX + fh * 0.12, midY - hc * 0.9, fh * 0.2, hc * 0.7, -0.15, 0, TAU);
  g.fill();
  g.restore();
  g.save();
  g.fillStyle = '#ff7a5a';
  g.strokeStyle = '#ffd166';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(ax2, ay);
  g.quadraticCurveTo(midX, midY + sag * 0.9, bx2, by);
  g.quadraticCurveTo(midX, midY + sag * 0.15, ax2, ay);
  g.fill();
  g.stroke();
  g.restore();
  heartRise(f, 'h', midX, midY - fh * 0.3, fh * 0.15, fh * 0.04, 3.5);
  runPs(f, 'h');
  const r = makeRand(2);
  for (let i = 0; i < 3; i++) gullV(g, ((r() * L.w + t * 30) % (L.w + 60)) - 30, L.h * r.range(0.06, 0.2), fh * 0.05, t + i, 'rgba(60,20,60,0.6)');
});

// ================================================================== 9. jealousy

const jealousy = def(3.0, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#7cc0f5', '#b5defb', '#e8f6ff']);
  skyline(g, L, gy, era, 'rgba(150,182,212,0.6)', 44);
  floorFill(g, L, gy, '#8fcf6e', '#5a9a4a');
  const wallR = S.port ? L.w * 0.34 : main + fh * 0.05;
  const wallW = fh * 0.5;
  const peekX = wallR - fh * 0.3;
  const peek = span(p, 0.05, 0.25);
  const lean = 0.12 + peek * 0.3;
  // green aura
  const pulse = 0.75 + 0.25 * Math.sin(t * 6);
  glow(g, wallR + fh * 0.05, headY(gy, fh), fh * 0.7 * pulse, 'rgba(90,230,90,0.65)');
  const pk = figure(g, peekX, gy, fh, { color: '#2f6b3f', dir: 1, lean, mood: 'angry', ink: '#d6ffcf' });
  // wall
  g.save();
  g.fillStyle = '#b5583a';
  g.fillRect(wallR - wallW, gy - fh * 1.2, wallW, fh * 1.2);
  g.fillStyle = 'rgba(80,30,20,0.35)';
  const bh = fh * 0.1;
  for (let row = 0; row < 12; row++) {
    const yy = gy - fh * 1.2 + row * bh;
    g.fillRect(wallR - wallW, yy, wallW, 2);
    for (let c = 0; c < 4; c++) g.fillRect(wallR - wallW + ((c + (row % 2) * 0.5) * wallW) / 3, yy, 2, bh);
  }
  g.fillStyle = '#9a4a30';
  g.fillRect(wallR - wallW - 4, gy - fh * 1.24, wallW + 8, fh * 0.05);
  g.restore();
  // fingers on the wall edge
  g.save();
  g.fillStyle = '#2f6b3f';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(wallR + 2, pk.hy + pk.hr * (1.6 + i * 0.35), fh * 0.022, 0, TAU);
    g.fill();
  }
  g.restore();
  // steam
  const r = f.rand;
  spawn(f, 'steam', 14, 40, () => {
    const s = r() < 0.5 ? -1 : 1;
    return pt(pk.hx + s * pk.hr, pk.hy - pk.hr * 0.2, s * r.range(30, 60), -r.range(50, 90), r.range(0.5, 0.9), fh * r.range(0.02, 0.035), 'rgba(255,255,255,0.85)', PUFF);
  });
  runPs(f, 'steam', -20, 0.5);
  // the happy couple
  const cx = S.alt ?? L.w * 0.7;
  const sway = Math.sin(t * 3) * fh * 0.02;
  const hold = { x: cx + sway, y: gy - fh * 0.48 };
  const ch = S.port ? fh * 0.85 : fh;
  figure(g, cx - ch * 0.17 + sway, gy, ch, { color: '#3a5a9b', accent: '#ffd166', dir: 1, mood: 'grin', front: hold, lean: 0.04 });
  figure(g, cx + ch * 0.17 + sway, gy, ch * 0.94, { color: '#c0396b', dir: -1, dress: true, accent: '#ff8fab', hair: 'long', mood: 'grin', front: hold, lean: -0.04 });
  heartRise(f, 'hh', cx, gy - ch * 1.05, ch * 0.15, ch * 0.04, 4);
  runPs(f, 'hh');
});

// ================================================================== 10. affair

const affair = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#070a18', '#151c32', '#28344a']);
  starfield(f, 30, 41, gy * 0.5);
  // building with a lit window and a watcher
  const bxc = S.alt ?? L.w * 0.16;
  const bw = S.port ? L.w * 0.3 : S.sideW * 0.55;
  const btop = S.port ? L.h * 0.05 : L.h * 0.12;
  g.save();
  g.fillStyle = '#121626';
  g.fillRect(bxc - bw / 2, btop, bw, gy - btop);
  g.fillStyle = '#1d2236';
  const wr = makeRand(6);
  const cols = 3;
  const rows = 5;
  for (let c = 0; c < cols; c++)
    for (let rw = 0; rw < rows; rw++) {
      const wx = bxc - bw / 2 + ((c + 0.5) * bw) / cols;
      const wy = btop + ((rw + 0.5) * (gy - btop)) / (rows + 0.5);
      g.fillStyle = wr() < 0.15 ? 'rgba(255,214,120,0.35)' : '#1d2236';
      g.fillRect(wx - bw * 0.09, wy - bw * 0.1, bw * 0.18, bw * 0.2);
    }
  g.restore();
  const wx = bxc + (S.port ? 0 : bw / cols);
  const wy = btop + (1.5 * (gy - btop)) / (rows + 0.5);
  const ww = bw * 0.2;
  glow(g, wx, wy, ww * 2.5, 'rgba(255,200,110,0.45)');
  g.save();
  g.fillStyle = '#ffcf7a';
  g.fillRect(wx - ww / 2, wy - ww * 0.55, ww, ww * 1.1);
  // watcher silhouette
  g.beginPath();
  g.rect(wx - ww / 2, wy - ww * 0.55, ww, ww * 1.1);
  g.clip();
  g.fillStyle = '#16121e';
  const lean = Math.sin(t * 1.4) * ww * 0.06;
  g.beginPath();
  g.arc(wx + lean, wy - ww * 0.05, ww * 0.2, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(wx + lean, wy + ww * 0.5, ww * 0.38, ww * 0.35, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillRect(wx + lean - ww * 0.11, wy - ww * 0.08, ww * 0.06, ww * 0.04);
  g.fillRect(wx + lean + ww * 0.05, wy - ww * 0.08, ww * 0.06, ww * 0.04);
  g.fillStyle = '#8a2b3a';
  g.fillRect(wx - ww / 2, wy - ww * 0.55, ww * 0.18, ww * 1.1);
  g.restore();
  if (p > 0.6) {
    const k = span(p, 0.6, 0.7);
    caption(g, '!', wx + ww * 0.8, wy - ww * 0.9 - k * 6, fh * 0.2, '#ff5d5d', k);
  }
  floorFill(g, L, gy, '#1a1e2e', '#090b14');
  // wet street reflection
  g.save();
  g.fillStyle = 'rgba(255,214,140,0.08)';
  for (let i = 0; i < 6; i++) g.fillRect(0, gy + 6 + i * 10, L.w, 2);
  g.restore();
  lampPost(g, main, gy, fh * 1.5, 1, era);
  const lx = main + fh * 1.5 * 0.14;
  const m = easeOut(span(p, 0, 0.5));
  const ax = lerp(lx - fh * 0.9, lx - fh * 0.18, m);
  const bx = lerp(lx + fh * 0.9, lx + fh * 0.18, m);
  const walking = p < 0.5;
  const glance = p > 0.55 && p < 0.75 ? -1 : 1;
  figure(g, ax, gy, fh, { color: '#24202a', coat: '#8a6d4a', hat: 'fedora', dir: glance as 1 | -1, pose: walking ? 'walk' : 'stand', phase: t, mood: 'nervous', front: walking ? undefined : Math.PI / 2 - 0.2 });
  figure(g, bx, gy, fh * 0.95, { color: '#2a1f28', coat: '#6b3a4a', hat: 'fedora', dir: -1, pose: walking ? 'walk' : 'stand', phase: t + 0.4, mood: p > 0.5 ? 'smile' : 'nervous', front: walking ? undefined : Math.PI / 2 - 0.2 });
  if (p > 0.5) {
    const k = span(p, 0.5, 0.6);
    heart(g, lx, headY(gy, fh) - fh * 0.12 - k * fh * 0.08, fh * 0.05 * k, '#ff4d7e');
  }
  // fog
  const fr = makeRand(14);
  g.save();
  for (let i = 0; i < 6; i++) {
    const fx = ((fr() * L.w + t * fr.range(10, 25)) % (L.w + 300)) - 150;
    g.globalAlpha = f.a * 0.12;
    g.fillStyle = '#c9d3e6';
    g.beginPath();
    g.ellipse(fx, gy - fh * fr.range(0, 0.3), fh * fr.range(0.6, 1.1), fh * 0.08, 0, 0, TAU);
    g.fill();
  }
  g.restore();
});

// ================================================================== 11. argument

const argument = def(3.0, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  const flash = Math.max(0, 1 - Math.abs(p - 0.35) * 25) + Math.max(0, 1 - Math.abs(p - 0.72) * 25);
  sky(g, L, ['#3a3d55', '#5a5d75', '#8a8296']);
  // living room wall + picture frame
  g.save();
  g.fillStyle = 'rgba(30,30,45,0.35)';
  for (let x = 0; x < L.w; x += 60) g.fillRect(x, 0, 2, gy);
  g.restore();
  floorFill(g, L, gy, '#4a3a3a', '#241a1a');
  const cy = headY(gy, fh) - fh * 0.62;
  const sh = Math.sin(t * 30) * 2;
  cloud(g, main + sh, cy, fh * 0.42, '#2c2f42');
  if (flash > 0) {
    g.save();
    g.globalAlpha *= clamp(flash);
    g.strokeStyle = '#fff6a0';
    g.lineWidth = fh * 0.025;
    g.beginPath();
    g.moveTo(main, cy + fh * 0.15);
    g.lineTo(main - fh * 0.08, cy + fh * 0.3);
    g.lineTo(main + fh * 0.03, cy + fh * 0.33);
    g.lineTo(main - fh * 0.05, cy + fh * 0.5);
    g.stroke();
    g.restore();
    g.save();
    g.globalAlpha *= clamp(flash) * 0.25;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, L.w, L.h);
    g.restore();
  }
  const r = f.rand;
  spawn(f, 'rain', 30, 40, () => pt(main + r.range(-1, 1) * fh * 0.4, cy + fh * 0.15, 0, r.range(300, 400), 0.5, 1.5, 'rgba(150,180,230,0.7)', DROP));
  runPs(f, 'rain');
  const ag = Math.sin(t * 9);
  figure(g, main - fh * 0.3, gy, fh, { color: ME, accent: ME_TIE, dir: 1, mood: 'angry', front: Math.PI / 2 + ag * 0.6, back: 0.6, lean: 0.03 });
  figure(g, main + fh * 0.3, gy, fh * 0.95, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'bun', mood: 'angry', front: Math.PI / 2 - Math.cos(t * 8) * 0.6, back: 'belly', lean: -0.03 });
  const hy = headY(gy, fh);
  const bubbles: [number, number, string, number, number][] = [
    [main - fh * 0.42, hy - fh * 0.32, '#@!', 0.05, 0.4],
    [main + fh * 0.44, hy - fh * 0.38, '!!', 0.3, 0.65],
    [main - fh * 0.4, hy - fh * 0.34, '?!', 0.55, 0.85],
    [main + fh * 0.42, hy - fh * 0.32, '%&!', 0.72, 1],
  ];
  for (const [bx, by, txt, a0, a1] of bubbles) {
    if (p < a0 || p > a1) continue;
    const k = easeOut(clamp((p - a0) / 0.06)) * clamp((a1 - p) / 0.05);
    jaggedBubble(g, clamp(bx, fh * 0.2, L.w - fh * 0.2), by, fh * 0.2 * k, '#ffffff', txt, '#d62839', t * 0.5);
  }
  if (S.alt !== null) {
    cloud(g, S.alt, L.h * 0.25, fh * 0.6, '#2c2f42');
    spawn(f, 'rain2', 40, 60, () => pt((S.alt ?? 0) + r.range(-1, 1) * fh * 0.55, L.h * 0.3, 0, r.range(400, 500), 0.9, 1.5, 'rgba(150,180,230,0.6)', DROP));
    runPs(f, 'rain2');
    crackedHeart(g, S.alt, gy - fh * 0.55, fh * 0.3, '#d62839', span(p, 0.4, 0.7));
  }
}, (t, dur) => {
  const p = t / dur;
  return Math.max(0, 1 - Math.abs(p - 0.35) * 20) * 6 + Math.max(0, 1 - Math.abs(p - 0.72) * 20) * 6;
});

// ================================================================== 12. makeup

const makeup = def(3.2, (f, S) => {
  const { g, L, p } = f;
  const { fh, gy, main } = S;
  const clear = span(p, 0.3, 0.55);
  sky(g, L, ['#4a4e69', '#6c6f88', '#9a9aae']);
  sky(g, L, ['#5fb0f0', '#a8dcff', '#fff1d6'], clear);
  glow(g, S.port ? L.w * 0.85 : main + S.sideW * 0.4, L.h * 0.1, fh * 1.2, 'rgba(255,235,160,0.8)', clear);
  // rainbow
  const rb = span(p, 0.42, 0.75);
  if (rb > 0) {
    const rcx = S.port ? L.w * 0.5 : main;
    const rr = S.port ? L.w * 0.46 : S.sideW * 0.46;
    const bands = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    g.save();
    g.globalAlpha *= 0.75;
    g.lineWidth = rr * 0.06;
    bands.forEach((c, i) => {
      g.strokeStyle = c;
      g.beginPath();
      g.arc(rcx, gy, rr - i * rr * 0.06, Math.PI, Math.PI + Math.PI * rb);
      g.stroke();
    });
    g.restore();
  }
  for (const [cx, cy, s] of [
    [S.port ? L.w * 0.2 : main - S.sideW * 0.3, L.h * 0.08, fh * 0.4],
    [S.port ? L.w * 0.7 : main + S.sideW * 0.2, L.h * 0.13, fh * 0.35],
  ] as const) {
    cloud(g, cx - clear * fh, cy, s, '#4a4e66');
    cloud(g, cx - clear * fh, cy, s, `rgba(255,255,255,${clear})`);
  }
  floorFill(g, L, gy, '#6aaa52', '#3f7a3a');
  // puddles
  g.save();
  g.fillStyle = 'rgba(160,200,240,0.55)';
  g.beginPath();
  g.ellipse(main - fh * 0.5, gy + fh * 0.06, fh * 0.2, fh * 0.03, 0, 0, TAU);
  g.ellipse(main + fh * 0.55, gy + fh * 0.1, fh * 0.16, fh * 0.025, 0, 0, TAU);
  g.fill();
  g.restore();
  rainFx(f, 'rain', 120, 'rgba(180,200,240,0.6)', p < 0.38);
  const hug = span(p, 0.08, 0.3);
  const d = lerp(fh * 0.3, fh * 0.12, hug);
  const lean = hug * 0.1;
  const hb = { x: main + fh * 0.05, y: gy - fh * 0.62 };
  figure(g, main - d, gy, fh, { color: ME, accent: ME_TIE, dir: 1, lean, mood: hug > 0.5 ? 'calm' : 'sad', blush: clear, front: hug > 0.3 ? hb : 0.2 });
  figure(g, main + d, gy, fh * 0.94, { color: YOU, dir: -1, lean: -lean, dress: true, accent: YOU_DRESS, hair: 'long', mood: hug > 0.5 ? 'calm' : 'sad', blush: clear, front: hug > 0.3 ? { x: main - fh * 0.08, y: gy - fh * 0.66 } : 0.2 });
  if (p > 0.5) heartRise(f, 'h', main, headY(gy, fh) - fh * 0.1, fh * 0.2, fh * 0.045, 6);
  runPs(f, 'h');
  if (S.alt !== null) {
    bush(g, S.alt - S.sideW * 0.2, gy, fh * 0.35, '#3f8a3a', '#ff8fab');
    bush(g, S.alt + S.sideW * 0.15, gy, fh * 0.28, '#4a9a42', '#ffd166');
    glow(g, S.alt, gy - fh * 0.6, fh * 0.8, 'rgba(255,240,180,0.5)', clear);
  }
});

// ================================================================== 13. loveLetter

const loveLetter = def(3.0, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#ffc2d4', '#ffe1ea', '#fff4e3']);
  const br = makeRand(12);
  for (let i = 0; i < 10; i++) glow(g, br() * L.w, br() * gy, fh * br.range(0.15, 0.35), 'rgba(255,255,255,0.6)');
  floorFill(g, L, gy, '#f7c6d2', '#e89ab0');
  // fluttering envelopes
  const er = makeRand(33);
  const n = S.port ? 7 : 12;
  for (let i = 0; i < n; i++) {
    const sp = er.range(40, 80);
    const baseY = er() * L.h * (S.port ? 0.5 : 0.75);
    const x0 = er() * L.w;
    const x = ((x0 + t * sp) % (L.w + 120)) - 60;
    const y = baseY + Math.sin(t * 2 + i) * fh * 0.08 - t * 12;
    envelope(g, x, y, fh * er.range(0.18, 0.28), Math.sin(t * 2.5 + i * 1.3) * 0.35, 0, 0);
  }
  // the one that opens
  const cx = S.port ? L.w * 0.5 : main;
  const cy = S.port ? L.h * 0.3 : gy - fh * 0.85;
  const ew = S.port ? L.w * 0.5 : fh * 1.05;
  const arrive = easeOut(span(p, 0, 0.25));
  const open = span(p, 0.28, 0.45);
  const letter = span(p, 0.45, 0.65);
  glow(g, cx, cy, ew * 1.1, 'rgba(255,150,190,0.5)', 0.5 + open * 0.5);
  envelope(g, cx, lerp(cy - fh * 0.4, cy, arrive) + Math.sin(t * 2) * 4, ew, (1 - arrive) * 0.4 + Math.sin(t * 1.5) * 0.03, open, letter);
  heartBurst(f, 'b', 'b', letter > 0.9, cx, cy - ew * 0.45, fh * 0.05, 16);
  runPs(f, 'b', 30, 1.5);
  if (letter > 0.5) heartRise(f, 'r', cx, cy - ew * 0.3, ew * 0.4, fh * 0.04, 6);
  runPs(f, 'r');
  if (S.alt !== null) {
    const a = figure(g, S.alt, gy, fh, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'long', mood: 'calm', blush: 0.4 + letter * 0.5, front: 'chest', back: 'chest' });
    envelope(g, a.hf.x - fh * 0.04, a.hf.y, fh * 0.2, -0.2, 1, 0);
    heartRise(f, 'r2', a.hx, a.hy - fh * 0.15, fh * 0.1, fh * 0.035, 3);
    runPs(f, 'r2');
  }
});

// ================================================================== 14. datingApp

function profileCard(g: G, x: number, y: number, w: number, h: number, hue: number, seed: number): void {
  const r = makeRand(seed);
  g.save();
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, `hsl(${hue},70%,70%)`);
  grad.addColorStop(1, `hsl(${hue + 30},60%,45%)`);
  g.fillStyle = grad;
  rrect(g, x, y, w, h, w * 0.08);
  g.fill();
  g.fillStyle = `hsl(${hue + 200},35%,25%)`;
  g.beginPath();
  g.arc(x + w / 2, y + h * 0.4, w * 0.18, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(x + w / 2, y + h * 0.78, w * 0.34, h * 0.2, 0, Math.PI, 0);
  g.fill();
  if (r() < 0.5) {
    g.beginPath();
    g.ellipse(x + w / 2, y + h * 0.44, w * 0.23, w * 0.26, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.92)';
  rrect(g, x + w * 0.1, y + h * 0.8, w * r.range(0.4, 0.6), h * 0.06, h * 0.03);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  rrect(g, x + w * 0.1, y + h * 0.89, w * 0.3, h * 0.04, h * 0.02);
  g.fill();
  g.restore();
}

function pigeon(g: G, x: number, y: number, s: number, t: number, dir: 1 | -1, letter: string | null): void {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = '#9aa0b5';
  g.beginPath();
  g.ellipse(0, 0, s * 0.55, s * 0.32, -0.1, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.45, -s * 0.05);
  g.lineTo(-s * 0.95, -s * 0.15);
  g.lineTo(-s * 0.9, s * 0.15);
  g.closePath();
  g.fill();
  g.fillStyle = '#7f86a0';
  g.beginPath();
  g.arc(s * 0.5, -s * 0.22, s * 0.2, 0, TAU);
  g.fill();
  g.fillStyle = '#ffb347';
  g.beginPath();
  g.moveTo(s * 0.66, -s * 0.24);
  g.lineTo(s * 0.86, -s * 0.18);
  g.lineTo(s * 0.66, -s * 0.12);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(s * 0.55, -s * 0.27, s * 0.04, 0, TAU);
  g.fill();
  const flap = Math.sin(t * 16) * s * 0.55;
  g.fillStyle = '#b5bacb';
  g.beginPath();
  g.moveTo(-s * 0.2, -s * 0.1);
  g.lineTo(s * 0.25, -s * 0.1);
  g.lineTo(-s * 0.1, -s * 0.1 - flap);
  g.closePath();
  g.fill();
  if (letter) {
    g.fillStyle = '#f1e0c8';
    g.fillRect(s * 0.72, -s * 0.18, s * 0.42, s * 0.3);
    heart(g, s * 0.93, -s * 0.03, s * 0.08, letter);
  }
  g.restore();
}

const datingApp = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  const match = p > 0.5;
  const mk = span(p, 0.5, 0.6);
  if (before(era, 'modern')) {
    // letters by pigeon post
    sky(g, L, ['#7cc0f5', '#b5defb', '#fff1d6']);
    skyline(g, L, gy, era, 'rgba(150,170,200,0.55)', 19);
    floorFill(g, L, gy, '#a8c97a', '#7aa05a');
    const fx = S.port ? L.w * 0.42 : main - fh * 0.2;
    const handT = { x: fx + fh * 0.25, y: gy - fh * 0.6 };
    const cheer = p > 0.62;
    const info = figure(g, fx, gy, fh, { color: YOU, dir: 1, dress: true, accent: YOU_DRESS, hair: 'long', mood: cheer ? 'grin' : p > 0.5 ? 'shock' : 'nervous', blush: mk, front: cheer ? 'face' : handT, back: cheer ? 'face' : 0.2 });
    const from = { x: S.alt ?? L.w + 40, y: S.port ? L.h * 0.06 : L.h * 0.15 };
    const tosses = ['#7a7a7a', '#7a7a7a', '#e63973'];
    for (let i = 0; i < 3; i++) {
      const a0 = 0.02 + i * 0.18;
      const k = span(p, a0, a0 + 0.14);
      const away = span(p, a0 + 0.14, a0 + 0.3);
      if (k <= 0) continue;
      if (away < 1) {
        const px = lerp(lerp(from.x, info.hf.x + fh * 0.12, k), from.x + (S.port ? -L.w : 0), away);
        const py = lerp(from.y, info.hf.y - fh * 0.1, Math.sin(k * Math.PI * 0.5)) - away * L.h * 0.2;
        pigeon(g, px, py, fh * 0.26, t + i, k < 1 ? -1 : 1, k < 1 ? tosses[i] : null);
      }
      if (k >= 1) {
        if (i < 2) {
          const tt = span(p, a0 + 0.17, a0 + 0.3);
          if (tt < 1) {
            const lx = info.hf.x - tt * fh * 0.8;
            const ly = info.hf.y - Math.sin(tt * Math.PI) * fh * 0.4 + tt * fh * 0.5;
            g.save();
            g.globalAlpha *= 1 - tt;
            envelope(g, lx, ly, fh * 0.18, tt * 6, 0, 0, '#7a7a7a');
            g.restore();
          }
        } else {
          envelope(g, info.hf.x + fh * 0.06, info.hf.y - fh * 0.05, fh * 0.22, -0.15, span(p, 0.55, 0.62), span(p, 0.6, 0.66) * 0.6, '#e63973');
        }
      }
    }
    if (match) {
      glow(g, fx, gy - fh * 0.9, fh * 1.2 * mk, 'rgba(255,120,170,0.5)');
      caption(g, 'MATCH!', fx + fh * 0.1, (S.port ? L.h * 0.08 : gy - fh * 1.55) + (1 - mk) * 20, fh * 0.22 * (0.8 + 0.2 * mk), '#ff4d7e', mk);
    }
    heartBurst(f, 'mb', 'mb', match, fx + fh * 0.1, gy - fh * 1.1, fh * 0.06, 18);
    runPs(f, 'mb', 30, 1.4);
    return;
  }
  const fut = era === 'future';
  sky(g, L, fut ? ['#0a1030', '#1a2a5a', '#3a2a6a'] : ['#ff7eb3', '#ff9a8b', '#ffd3a5']);
  const br = makeRand(9);
  for (let i = 0; i < 14; i++) glow(g, br() * L.w, br() * gy, fh * br.range(0.1, 0.3), fut ? 'rgba(120,220,255,0.35)' : 'rgba(255,255,255,0.45)');
  floorFill(g, L, gy, fut ? '#1a2048' : '#f0a0b0', fut ? '#0a0e24' : '#d07890');
  const ph = S.port ? L.h * 0.4 : fh * 1.6;
  const pw = ph * 0.52;
  const px = S.port ? L.w * 0.5 : main;
  const py = S.port ? L.h * 0.28 : gy - fh * 0.92;
  const bounce = match ? Math.sin(Math.min(1, mk) * Math.PI) * 8 : 0;
  g.save();
  g.translate(px, py - bounce);
  if (match) glow(g, 0, 0, ph * 0.9, fut ? 'rgba(120,230,255,0.55)' : 'rgba(255,90,150,0.55)', mk);
  g.fillStyle = fut ? 'rgba(80,220,255,0.25)' : '#1b1b26';
  rrect(g, -pw / 2, -ph / 2, pw, ph, pw * 0.14);
  g.fill();
  if (fut) {
    g.strokeStyle = 'rgba(120,230,255,0.9)';
    g.lineWidth = 2;
    g.stroke();
  }
  const sw = pw * 0.88;
  const sh = ph * 0.88;
  g.fillStyle = fut ? 'rgba(20,40,80,0.6)' : '#fff5f8';
  rrect(g, -sw / 2, -sh / 2, sw, sh, pw * 0.09);
  g.fill();
  g.save();
  rrect(g, -sw / 2, -sh / 2, sw, sh, pw * 0.09);
  g.clip();
  // app bar
  g.fillStyle = '#ff4d7e';
  heart(g, 0, -sh / 2 + sh * 0.06, sw * 0.05, '#ff4d7e');
  const cw = sw * 0.84;
  const ch = sh * 0.66;
  const cx0 = -cw / 2;
  const cy0 = -sh / 2 + sh * 0.12;
  const swipes: [number, number, number][] = [
    [-1, 0.08, 0.2],
    [-1, 0.22, 0.34],
    [1, 0.36, 0.5],
  ];
  for (let i = swipes.length - 1; i >= 0; i--) {
    const [d, a0, a1] = swipes[i];
    const k = span(p, a0, a1);
    if (k >= 1) continue;
    const pre = i === 0 ? 1 : span(p, swipes[i - 1][1], swipes[i - 1][2]);
    const sc = lerp(0.94, 1, pre);
    g.save();
    g.translate(d * k * sw * 1.3, k * sh * 0.05);
    g.rotate(d * k * 0.35);
    g.translate(cx0 + cw / 2, cy0 + ch / 2);
    g.scale(sc, sc);
    profileCard(g, -cw / 2, -ch / 2, cw, ch, [200, 30, 320][i], 4 + i);
    if (k > 0.05) {
      g.save();
      g.globalAlpha *= clamp(k * 3);
      g.rotate(-d * 0.3);
      g.font = `900 ${cw * 0.18}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = cw * 0.025;
      g.strokeStyle = d > 0 ? '#2ec27e' : '#ff3d3d';
      g.fillStyle = d > 0 ? '#2ec27e' : '#ff3d3d';
      g.strokeRect(-cw * 0.32, -ch * 0.38, cw * 0.64, cw * 0.24);
      g.fillText(d > 0 ? 'LIKE' : 'NOPE', 0, -ch * 0.38 + cw * 0.19);
      g.restore();
    }
    g.restore();
  }
  // buttons
  const byy = sh / 2 - sh * 0.1;
  g.fillStyle = '#ffffff';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * sw * 0.22, byy, sw * 0.1, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#ff3d3d';
  g.lineWidth = sw * 0.025;
  g.beginPath();
  g.moveTo(-sw * 0.26, byy - sw * 0.04);
  g.lineTo(-sw * 0.18, byy + sw * 0.04);
  g.moveTo(-sw * 0.18, byy - sw * 0.04);
  g.lineTo(-sw * 0.26, byy + sw * 0.04);
  g.stroke();
  heart(g, sw * 0.22, byy, sw * 0.05, '#2ec27e');
  if (match) {
    g.globalAlpha *= mk;
    const mg = g.createLinearGradient(0, -sh / 2, 0, sh / 2);
    mg.addColorStop(0, '#ff4d7e');
    mg.addColorStop(1, '#ff9a5a');
    g.fillStyle = mg;
    g.fillRect(-sw / 2, -sh / 2, sw, sh);
    const sep = lerp(sw * 0.45, sw * 0.17, mk);
    for (const [s, col] of [
      [-1, '#3a5a9b'],
      [1, '#c0396b'],
    ] as const) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(s * sep, 0, sw * 0.17, 0, TAU);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.arc(s * sep, -sw * 0.03, sw * 0.07, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(s * sep, sw * 0.11, sw * 0.11, sw * 0.07, 0, Math.PI, 0);
      g.fill();
    }
    heart(g, 0, -sw * 0.32, sw * 0.12 * (1 + 0.1 * Math.sin(t * 12)), '#ffffff');
  }
  g.restore();
  g.restore();
  if (match) caption(g, 'MATCH!', px, py - ph / 2 - fh * 0.12 + (1 - mk) * 20, (S.port ? L.w * 0.13 : fh * 0.24) * (0.8 + 0.2 * mk), '#ffffff', mk);
  const r = f.rand;
  burst(f, 'conf', 'mc', match, 60, () => {
    const a = r() * TAU;
    const v = r.range(150, 380);
    return pt(px, py - bounce, Math.cos(a) * v, Math.sin(a) * v - 120, r.range(1.2, 1.8), r.range(6, 11), r.pick(CONFETTI_COLORS), CONF, r() * 6, r.range(-8, 8));
  });
  runPs(f, 'conf', 380, 0.8);
  heartBurst(f, 'mh', 'mh', match, px, py, fh * 0.07, 16);
  runPs(f, 'mh', 0, 1.2);
  if (S.alt !== null) {
    const hand = { x: S.alt + fh * 0.2, y: gy - fh * 0.66 };
    const info = figure(g, S.alt - fh * 0.05, gy, fh, { color: '#3a5a9b', accent: '#ffd166', dir: 1, mood: match ? 'grin' : 'smile', blush: mk, front: match ? Math.PI - 0.3 + Math.sin(t * 10) * 0.2 : hand, back: match ? Math.PI - 0.4 : hand, phase: t });
    if (!match) {
      g.save();
      g.fillStyle = '#1b1b26';
      rrect(g, hand.x - fh * 0.04, hand.y - fh * 0.08, fh * 0.08, fh * 0.14, fh * 0.015);
      g.fill();
      g.fillStyle = '#ff9ab8';
      g.fillRect(hand.x - fh * 0.03 + Math.sin(t * 9) * 3, hand.y - fh * 0.065, fh * 0.06, fh * 0.11);
      g.restore();
    } else heart(g, info.hx, info.hy - fh * 0.25, fh * 0.06 * (1 + 0.15 * Math.sin(t * 12)), '#ff4d7e');
  }
});

// ================================================================== 15. serenade

function lute(g: G, x: number, y: number, s: number, rot: number, old: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (old) {
    g.fillStyle = '#b5762e';
    g.beginPath();
    g.ellipse(0, 0, s * 0.5, s * 0.38, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#5a3418';
    g.fillRect(s * 0.3, -s * 0.06, s * 0.65, s * 0.12);
    g.save();
    g.translate(s * 0.95, 0);
    g.rotate(0.9);
    g.fillRect(0, -s * 0.06, s * 0.22, s * 0.12);
    g.restore();
    g.fillStyle = '#3a200e';
    g.beginPath();
    g.arc(-s * 0.05, 0, s * 0.11, 0, TAU);
    g.fill();
  } else {
    g.fillStyle = '#c0392b';
    g.beginPath();
    g.arc(-s * 0.18, 0, s * 0.38, 0, TAU);
    g.arc(s * 0.25, 0, s * 0.28, 0, TAU);
    g.fill();
    g.fillStyle = '#3a200e';
    g.fillRect(s * 0.3, -s * 0.05, s * 0.9, s * 0.1);
    g.fillRect(s * 1.15, -s * 0.09, s * 0.18, s * 0.18);
    g.beginPath();
    g.arc(-s * 0.02, 0, s * 0.11, 0, TAU);
    g.fill();
  }
  g.restore();
}

const serenade = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  const old = before(era, 'industrial');
  sky(g, L, ['#0a0e2c', '#1f1a50', '#4a2a6a']);
  starfield(f, 80, 51, gy);
  moon(g, S.alt ?? L.w * 0.85, S.port ? L.h * 0.08 : L.h * 0.2, S.port ? fh * 0.17 : fh * 0.3);
  // building with balcony
  const balX = S.port ? L.w * 0.68 : main + fh * 0.42;
  const balY = gy - fh * 1.1;
  const bw = fh * 0.62;
  g.save();
  g.fillStyle = '#c9a27a';
  g.fillRect(balX - bw * 0.9, 0, bw * 2.6, gy);
  g.fillStyle = 'rgba(80,50,30,0.25)';
  for (let yy = 20; yy < gy; yy += 30) g.fillRect(balX - bw * 0.9, yy, bw * 2.6, 2);
  // balcony doorway, lit
  g.fillStyle = '#ffcf7a';
  g.beginPath();
  g.moveTo(balX - bw * 0.35, balY);
  g.lineTo(balX - bw * 0.35, balY - fh * 0.75);
  g.arc(balX, balY - fh * 0.75, bw * 0.35, Math.PI, 0);
  g.lineTo(balX + bw * 0.35, balY);
  g.fill();
  g.restore();
  glow(g, balX, balY - fh * 0.5, fh * 0.9, 'rgba(255,200,110,0.4)');
  const lean = 0.08 + Math.sin(t * 2) * 0.03;
  const b = figure(g, balX, balY, fh * 0.92, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'long', hat: 'flower', lean: -lean, mood: 'calm', blush: 0.4 + span(p, 0.3, 0.7) * 0.6, front: 'face', back: 'chest' });
  g.save();
  g.fillStyle = '#8a6a4a';
  g.fillRect(balX - bw * 0.6, balY, bw * 1.2, fh * 0.07);
  g.fillRect(balX - bw * 0.6, balY - fh * 0.32, bw * 1.2, fh * 0.04);
  for (let i = 0; i <= 6; i++) g.fillRect(balX - bw * 0.6 + (i * bw * 1.2) / 6 - fh * 0.012, balY - fh * 0.3, fh * 0.024, fh * 0.3);
  g.restore();
  // ivy + roses under the balcony
  bush(g, balX - bw * 0.2, gy, fh * 0.32, '#2f6a3a', '#e63946');
  bush(g, balX + bw * 0.6, gy, fh * 0.26, '#2f6a3a', '#ff5d8f');
  floorFill(g, L, gy, '#2a2a40', '#121220');
  // the serenader
  const sx = S.port ? L.w * 0.25 : main - fh * 0.42;
  const strum = Math.sin(t * 14) * 0.25;
  const inst = { x: sx + fh * 0.08, y: gy - fh * 0.5 };
  figure(g, sx, gy, fh, { color: ME, accent: ME_TIE, dir: 1, lean: -0.05, mood: 'calm', blush: 0.4, hat: 'none', front: { x: inst.x + fh * 0.2, y: inst.y - fh * 0.12 }, back: { x: inst.x - fh * 0.02, y: inst.y + fh * 0.04 + strum * fh * 0.08 } });
  lute(g, inst.x, inst.y, fh * 0.3, -0.5, old);
  const r = f.rand;
  spawn(f, 'notes', 6, 22, () => pt(inst.x + fh * 0.1, inst.y - fh * 0.2, r.range(20, 50) * (balX > sx ? 1 : -1), -r.range(45, 75), r.range(1.6, 2.4), fh * r.range(0.05, 0.075), r.pick(['#ffd166', '#ffffff', '#ff8fab']), NOTE, r()));
  runPs(f, 'notes');
  spawn(f, 'petals', 4, 14, () => pt(balX + r.range(-1, 1) * bw * 0.5, balY, r.range(-30, 10), r.range(20, 40), r.range(2, 3), fh * 0.025, r.pick(['#e63946', '#ff5d8f']), PETAL, r() * 6, r.range(-3, 3)));
  runPs(f, 'petals');
  heartRise(f, 'h', b.hx, b.hy - fh * 0.12, fh * 0.1, fh * 0.035, 3);
  runPs(f, 'h');
});

// ================================================================== 16. anniversary

function cake(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(x, y, s * 0.75, s * 0.08, 0, 0, TAU);
  g.fill();
  const tiers: [number, number, string][] = [
    [s * 0.6, s * 0.38, '#ffd6e0'],
    [s * 0.42, s * 0.32, '#fff0f4'],
  ];
  let top = y;
  for (const [w, h, c] of tiers) {
    g.fillStyle = c;
    g.fillRect(x - w, top - h, w * 2, h);
    g.fillStyle = '#ff8fab';
    g.beginPath();
    g.moveTo(x - w, top - h);
    g.lineTo(x + w, top - h);
    g.lineTo(x + w, top - h * 0.75);
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const px = x + w - (i / n) * w * 2;
      g.quadraticCurveTo(px + w / n, top - h * (i % 2 ? 0.45 : 0.75), px, top - h * 0.75);
    }
    g.closePath();
    g.fill();
    top -= h;
  }
  for (let i = -1; i <= 1; i++) candle(g, x + i * s * 0.22, top, s * 0.22, t, i * 3);
  heart(g, x, y - s * 0.2, s * 0.08, '#e63973');
  g.restore();
}

const anniversary = def(3.0, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#22122e', '#4a1f45', '#7a2e4a']);
  const br = makeRand(77);
  for (let i = 0; i < 22; i++) glow(g, br() * L.w, br() * gy, fh * br.range(0.08, 0.22), br.pick(['rgba(255,200,120,0.45)', 'rgba(255,140,180,0.4)', 'rgba(255,255,255,0.3)']));
  floorFill(g, L, gy, '#3a1a2e', '#1a0a14');
  const cx = S.port ? L.w * 0.5 : main;
  const tableTop = gy - fh * 0.3;
  g.save();
  g.fillStyle = '#f5e6d3';
  g.fillRect(cx - fh * 0.75, tableTop, fh * 1.5, gy - tableTop);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(cx - fh * 0.75, tableTop + fh * 0.04, fh * 1.5, 3);
  g.restore();
  const cs = S.port ? fh * 0.7 : fh * 0.75;
  glow(g, cx, tableTop - cs * 0.9, cs * 1.4, 'rgba(255,190,100,0.4)');
  cake(g, cx, tableTop, cs, t);
  // flutes clink above
  const k = span(p, 0.12, 0.38);
  const back = span(p, 0.6, 0.85) * 0.4;
  const fsz = S.port ? fh * 0.5 : fh * 0.55;
  const gyy = tableTop - cs * 1.25 - fsz * 0.2;
  const sep = lerp(fh * 0.9, fsz * 0.17, k) + back * fh;
  const tilt = lerp(0.1, 0.32, k) - back * 0.3;
  flute(g, cx - sep, gyy, fsz, 0.85, tilt);
  flute(g, cx + sep, gyy, fsz, 0.85, -tilt);
  const hit = p > 0.38;
  const tipY = gyy - fsz * 1.1;
  if (hit && p < 0.55) glow(g, cx, tipY, fsz * 0.7, 'rgba(255,240,180,0.8)', 1 - span(p, 0.38, 0.55));
  const r = f.rand;
  burst(f, 'clink', 'c', hit, 26, (i) => {
    const a = -Math.PI / 2 + r.range(-1.2, 1.2);
    const v = r.range(80, 220);
    return pt(cx, tipY, Math.cos(a) * v, Math.sin(a) * v, r.range(0.6, 1.2), i % 2 ? fh * 0.04 : fh * 0.02, i % 2 ? '#fff3b0' : '#ffd166', i % 2 ? SPARK : DOT, r() * 3);
  });
  runPs(f, 'clink', 200, 0.5);
  spawn(f, 'tw', 8, 30, () => pt(r() * L.w, r() * gy, 0, -10, r.range(0.6, 1.2), fh * r.range(0.025, 0.05), r.pick(['#ffffff', '#ffd166', '#ffb3c6']), SPARK, r() * 3));
  runPs(f, 'tw');
  if (S.alt !== null) {
    const ax = S.alt;
    const raise = span(p, 0.3, 0.45);
    const ha = { x: ax - fh * 0.02, y: gy - fh * lerp(0.6, 0.95, raise) };
    figure(g, ax - fh * 0.28, gy, fh, { color: ME, accent: ME_TIE, dir: 1, mood: 'smile', blush: 0.5, front: ha, lean: 0.03 });
    figure(g, ax + fh * 0.26, gy, fh * 0.94, { color: YOU, dir: -1, dress: true, accent: YOU_DRESS, hair: 'bun', mood: 'smile', blush: 0.5, front: { x: ha.x + fh * 0.04, y: ha.y }, lean: -0.03 });
    flute(g, ha.x - fh * 0.03, ha.y + fh * 0.04, fh * 0.2, 0.8, 0.2);
    flute(g, ha.x + fh * 0.07, ha.y + fh * 0.04, fh * 0.2, 0.8, -0.2);
    heartRise(f, 'h', ax, gy - fh * 1.1, fh * 0.2, fh * 0.04, 3);
    runPs(f, 'h');
  }
});

// ================================================================== 17. pregnancy

const pregnancy = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#ffd9e4', '#fff1e6', '#dcecfb']);
  glow(g, main, gy - fh * 0.6, fh * 1.6, 'rgba(255,240,200,0.8)', 0.85 + 0.15 * Math.sin(t * 3));
  floorFill(g, L, gy, '#f5d6c6', '#e8b8a8');
  const bx = main + fh * 0.12;
  const ax = main - fh * 0.24;
  const hold = span(p, 0.05, 0.25);
  const belly = { x: bx - fh * 0.15, y: gy - fh * 0.45 };
  figure(g, bx, gy, fh * 0.95, { color: YOU, dir: -1, dress: true, accent: '#ff8fab', hair: 'long', belly: true, mood: 'calm', blush: 0.6, front: 'belly', back: 0.3 });
  figure(g, ax, gy, fh, { color: ME, accent: ME_TIE, dir: 1, mood: p > 0.4 ? 'grin' : 'smile', blush: 0.5, front: hold > 0.5 ? belly : 0.2 + hold, lean: 0.05 * hold, back: 0.2 });
  glow(g, belly.x, belly.y, fh * 0.25, 'rgba(255,180,200,0.7)', 0.6 + 0.4 * Math.sin(t * 7));
  // heartbeat line
  const lw = S.port ? L.w * 0.75 : S.sideW * 0.75;
  const lx0 = main - lw / 2;
  const ly = headY(gy, fh) - fh * 0.5;
  const reveal = span(p, 0.1, 0.8);
  g.save();
  g.strokeStyle = '#ff4d7e';
  g.lineWidth = Math.max(2, fh * 0.018);
  g.lineJoin = 'round';
  g.beginPath();
  const steps = 60;
  let lastX = lx0;
  let lastY = ly;
  for (let i = 0; i <= steps * reveal; i++) {
    const u = i / steps;
    const x = lx0 + u * lw;
    const ph = (u * 3) % 1;
    let y = ly;
    if (ph > 0.4 && ph < 0.45) y = ly - fh * 0.1;
    else if (ph >= 0.45 && ph < 0.5) y = ly + fh * 0.05;
    else if (ph >= 0.5 && ph < 0.55) y = ly - fh * 0.03;
    g.lineTo(x, y);
    lastX = x;
    lastY = y;
  }
  g.stroke();
  g.restore();
  if (reveal > 0 && reveal < 1) glow(g, lastX, lastY, fh * 0.06, 'rgba(255,80,130,0.9)');
  const beat = 1 + 0.25 * Math.max(0, Math.sin(t * 9));
  heart(g, main, ly - fh * 0.22, fh * 0.07 * beat * span(p, 0.2, 0.35), '#ff4d7e');
  const r = f.rand;
  spawn(f, 'socks', 3, 12, () => pt(main + r.range(-1, 1) * (S.port ? L.w * 0.4 : S.sideW * 0.4), gy - fh * r.range(0, 0.4), r.range(-10, 10), -r.range(30, 50), r.range(2, 3), fh * r.range(0.04, 0.06), r.pick(['#a8d8ff', '#ffc2d4', '#fff1a8', '#c3f0c8']), SOCK, r() * 6));
  runPs(f, 'socks');
  if (S.alt !== null) {
    const cx = S.alt;
    g.save();
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#e8b8a8';
    g.lineWidth = fh * 0.025;
    g.fillRect(cx - fh * 0.45, gy - fh * 0.5, fh * 0.9, fh * 0.3);
    for (let i = 0; i <= 8; i++) {
      const x = cx - fh * 0.45 + i * fh * 0.1125;
      g.beginPath();
      g.moveTo(x, gy - fh * 0.5);
      g.lineTo(x, gy);
      g.stroke();
    }
    g.strokeRect(cx - fh * 0.45, gy - fh * 0.62, fh * 0.9, fh * 0.12);
    // mobile
    g.beginPath();
    g.moveTo(cx, gy - fh * 1.4);
    g.lineTo(cx, gy - fh * 1.15);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const a = t * 1.2 + (i * TAU) / 4;
      const mx = cx + Math.cos(a) * fh * 0.25;
      const my = gy - fh * 1.15 + Math.sin(a) * fh * 0.03;
      g.beginPath();
      g.moveTo(cx, gy - fh * 1.15);
      g.lineTo(mx, my);
      g.lineTo(mx, my + fh * 0.12);
      g.stroke();
      star(g, mx, my + fh * 0.16, fh * 0.05, ['#ffd166', '#a8d8ff', '#ffc2d4', '#c3f0c8'][i], a);
    }
    g.restore();
  }
});

// ================================================================== 18. babyShower

function stork(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.scale(-1, 1);
  const flap = Math.sin(t * 7);
  // bundle
  g.strokeStyle = '#d0d0d8';
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.moveTo(s * 1.05, s * 0.02);
  g.lineTo(s * 0.95, s * 0.42);
  g.moveTo(s * 1.05, s * 0.02);
  g.lineTo(s * 1.2, s * 0.42);
  g.stroke();
  g.fillStyle = '#ffc2d4';
  g.beginPath();
  g.moveTo(s * 0.88, s * 0.4);
  g.quadraticCurveTo(s * 1.07, s * 0.95, s * 1.28, s * 0.4);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffe0c8';
  g.beginPath();
  g.arc(s * 1.08, s * 0.47, s * 0.09, 0, TAU);
  g.fill();
  // legs
  g.strokeStyle = '#ff8a3a';
  g.lineWidth = s * 0.04;
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.05);
  g.lineTo(-s * 0.95, s * 0.2);
  g.stroke();
  // body
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(0, 0, s * 0.45, s * 0.18, -0.05, 0, TAU);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(s * 0.35, -s * 0.05);
  g.quadraticCurveTo(s * 0.6, -s * 0.2, s * 0.72, -s * 0.12);
  g.stroke();
  g.beginPath();
  g.arc(s * 0.74, -s * 0.12, s * 0.08, 0, TAU);
  g.fillStyle = '#ffffff';
  g.fill();
  g.fillStyle = '#ff8a3a';
  g.beginPath();
  g.moveTo(s * 0.8, -s * 0.15);
  g.lineTo(s * 1.1, s * 0.0);
  g.lineTo(s * 0.8, -s * 0.07);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(s * 0.76, -s * 0.15, s * 0.018, 0, TAU);
  g.fill();
  // wing
  g.fillStyle = '#f2f2f6';
  g.beginPath();
  g.moveTo(-s * 0.2, -s * 0.05);
  g.lineTo(s * 0.2, -s * 0.05);
  g.lineTo(-s * 0.1 + flap * s * 0.1, -s * 0.05 - flap * s * 0.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#222';
  g.beginPath();
  g.moveTo(-s * 0.1 + flap * s * 0.1, -s * 0.05 - flap * s * 0.6);
  g.lineTo(-s * 0.02 + flap * s * 0.06, -s * 0.05 - flap * s * 0.36);
  g.lineTo(-s * 0.2 + flap * s * 0.06, -s * 0.05 - flap * s * 0.4);
  g.closePath();
  g.fill();
  g.restore();
}

const babyShower = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#cde7ff', '#ffe1ef', '#fff6d8']);
  // bunting
  g.save();
  const by = S.port ? L.h * 0.04 : L.h * 0.06;
  g.strokeStyle = 'rgba(120,100,140,0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, by);
  g.quadraticCurveTo(L.w / 2, by + L.h * 0.05, L.w, by);
  g.stroke();
  const pc = ['#a8d8ff', '#ffc2d4', '#fff1a8', '#c3f0c8'];
  for (let i = 0; i < L.w / 36; i++) {
    const x = i * 36 + 18;
    const u = x / L.w;
    const y = by + L.h * 0.05 * 2 * u * (1 - u) * 2 * 0.5 + 2;
    g.fillStyle = pc[i % 4];
    g.beginPath();
    g.moveTo(x - 12, y);
    g.lineTo(x + 12, y);
    g.lineTo(x, y + 22);
    g.closePath();
    g.fill();
  }
  g.restore();
  floorFill(g, L, gy, '#c8e6b0', '#9ac884');
  // balloon clusters
  const groups = S.alt !== null ? [main - fh * 0.75, S.alt] : [L.w * 0.12, L.w * 0.88];
  const br = makeRand(5);
  for (const gx of groups) {
    const n = S.port ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const bx = gx + (i - (n - 1) / 2) * fh * 0.16 + br.range(-8, 8);
      const bb = gy - fh * br.range(0.95, 1.45) + Math.sin(t * 2 + i) * 5;
      balloon(g, bx, bb, fh * 0.12, br.pick(['#a8d8ff', '#ffc2d4', '#fff1a8', '#c3f0c8', '#d9c2ff']), gy - bb - fh * 0.12, t);
    }
  }
  // gifts
  const gx0 = S.port ? L.w * 0.65 : main + fh * 0.32;
  gift(g, gx0, gy, fh * 0.34, '#a8d8ff', '#ff8fab');
  gift(g, gx0 + fh * 0.32, gy, fh * 0.26, '#ffc2d4', '#e63973');
  gift(g, gx0 + fh * 0.12, gy - fh * 0.34, fh * 0.2, '#fff1a8', '#7ab8ff');
  // parents-to-be
  const px = S.port ? L.w * 0.36 : main - fh * 0.2;
  const cheer = p > 0.5;
  figure(g, px, gy, fh * 0.95, { color: YOU, dir: 1, dress: true, accent: '#ff8fab', hair: 'long', belly: true, mood: cheer ? 'grin' : 'smile', blush: 0.5, front: cheer ? Math.PI - 0.5 + Math.sin(t * 9) * 0.15 : 'belly', back: cheer ? Math.PI - 0.5 : 0.25 });
  // stork
  const sp = span(p, 0.05, 0.95);
  const sx = lerp(L.w + fh, -fh, sp);
  const sy = (S.port ? L.h * 0.16 : L.h * 0.22) + Math.sin(t * 3) * 8;
  stork(g, sx, sy, S.port ? fh * 0.55 : fh * 0.7, t);
  const r = f.rand;
  spawn(f, 'conf', 18, 70, () => pt(r() * L.w, -10, r.range(-20, 20), r.range(60, 110), r.range(2.5, 3.5), r.range(5, 9), r.pick(pc), CONF, r() * 6, r.range(-4, 4)));
  runPs(f, 'conf');
});

// ================================================================== 19. lonely

const lonely = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#0d1020', '#151a2e', '#1c2238']);
  const wx = S.port ? L.w * 0.6 : main + fh * 0.3;
  const ww = S.port ? L.w * 0.62 : fh * 1.0;
  const wt = S.port ? L.h * 0.06 : gy - fh * 1.55;
  const wb = gy - fh * 0.42;
  g.save();
  g.beginPath();
  g.rect(wx - ww / 2, wt, ww, wb - wt);
  g.clip();
  const out = g.createLinearGradient(0, wt, 0, wb);
  out.addColorStop(0, '#16224a');
  out.addColorStop(1, '#2a3a6a');
  g.fillStyle = out;
  g.fillRect(wx - ww / 2, wt, ww, wb - wt);
  skyline(g, L, wb, era, '#0e1430', 61, 'rgba(255,214,120,0.6)');
  const br = makeRand(3);
  for (let i = 0; i < 10; i++) glow(g, wx + br.range(-0.5, 0.5) * ww, br.range(wt, wb), fh * 0.08, br.pick(['rgba(255,200,120,0.5)', 'rgba(255,120,120,0.4)', 'rgba(120,200,255,0.4)']));
  // rain outside
  g.strokeStyle = 'rgba(170,195,235,0.45)';
  g.lineWidth = 1.2;
  g.beginPath();
  const rr = makeRand(8);
  for (let i = 0; i < 40; i++) {
    const x = wx - ww / 2 + rr() * ww;
    const y = wt + ((rr() * (wb - wt) + t * 520) % (wb - wt));
    g.moveTo(x, y);
    g.lineTo(x - 3, y - 14);
  }
  g.stroke();
  // drops sliding down the glass
  g.fillStyle = 'rgba(200,220,255,0.5)';
  const dr = makeRand(19);
  for (let i = 0; i < 12; i++) {
    const x = wx - ww / 2 + dr() * ww;
    const y = wt + ((dr() * (wb - wt) + t * dr.range(20, 60)) % (wb - wt));
    g.beginPath();
    g.arc(x, y, dr.range(2, 3.5), 0, TAU);
    g.fill();
  }
  g.restore();
  g.save();
  g.strokeStyle = '#2a2f48';
  g.lineWidth = fh * 0.05;
  g.strokeRect(wx - ww / 2, wt, ww, wb - wt);
  g.lineWidth = fh * 0.025;
  g.beginPath();
  g.moveTo(wx, wt);
  g.lineTo(wx, wb);
  g.moveTo(wx - ww / 2, (wt + wb) / 2);
  g.lineTo(wx + ww / 2, (wt + wb) / 2);
  g.stroke();
  g.fillStyle = '#3a3f5a';
  g.fillRect(wx - ww / 2 - fh * 0.06, wb, ww + fh * 0.12, fh * 0.05);
  g.restore();
  glow(g, wx, (wt + wb) / 2, ww * 0.9, 'rgba(120,150,220,0.2)');
  floorFill(g, L, gy, '#1a1e30', '#0a0c16');
  // the lonely figure with tea
  const fx = S.port ? L.w * 0.3 : main - fh * 0.38;
  const cup = { x: fx + fh * 0.12, y: gy - fh * 0.62 };
  const sip = p > 0.45 && p < 0.65 ? span(p, 0.45, 0.52) - span(p, 0.58, 0.65) : 0;
  const cupP = { x: lerp(cup.x, fx + fh * 0.12, sip), y: lerp(cup.y, gy - fh * 0.82, sip) };
  glow(g, fx, gy - fh * 0.6, fh * 0.7, 'rgba(120,150,220,0.3)');
  figure(g, fx, gy, fh, { color: '#4a5478', dir: 1, mood: 'sad', ink: '#e0e8ff', front: { x: cupP.x - fh * 0.02, y: cupP.y }, back: { x: cupP.x - fh * 0.06, y: cupP.y + fh * 0.02 }, lean: -0.02 });
  g.save();
  g.fillStyle = '#e8eefc';
  rrect(g, cupP.x - fh * 0.04, cupP.y - fh * 0.06, fh * 0.08, fh * 0.07, fh * 0.015);
  g.fill();
  g.strokeStyle = '#e8eefc';
  g.lineWidth = fh * 0.012;
  g.beginPath();
  g.arc(cupP.x + fh * 0.045, cupP.y - fh * 0.025, fh * 0.018, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = fh * 0.01;
  g.beginPath();
  for (const dx of [-0.015, 0.015]) {
    const sx = cupP.x + dx * fh;
    g.moveTo(sx, cupP.y - fh * 0.07);
    for (let i = 1; i <= 5; i++) g.lineTo(sx + Math.sin(t * 4 + i + dx * 99) * fh * 0.012, cupP.y - fh * 0.07 - i * fh * 0.025);
  }
  g.stroke();
  g.restore();
  if (S.alt !== null) {
    // an empty armchair under a dim lamp
    const ax = S.alt;
    glow(g, ax + fh * 0.4, gy - fh * 1.1, fh * 0.6, 'rgba(255,190,110,0.35)');
    g.save();
    g.fillStyle = '#2a2236';
    rrect(g, ax - fh * 0.35, gy - fh * 0.75, fh * 0.7, fh * 0.6, fh * 0.1);
    g.fill();
    g.fillStyle = '#342a44';
    rrect(g, ax - fh * 0.45, gy - fh * 0.42, fh * 0.9, fh * 0.32, fh * 0.08);
    g.fill();
    g.fillRect(ax - fh * 0.35, gy - fh * 0.12, fh * 0.05, fh * 0.12);
    g.fillRect(ax + fh * 0.3, gy - fh * 0.12, fh * 0.05, fh * 0.12);
    g.fillStyle = '#1e1a28';
    g.fillRect(ax + fh * 0.39, gy - fh * 1.05, fh * 0.03, fh * 1.05);
    g.fillStyle = '#c9a27a';
    g.beginPath();
    g.moveTo(ax + fh * 0.3, gy - fh * 1.0);
    g.lineTo(ax + fh * 0.5, gy - fh * 1.0);
    g.lineTo(ax + fh * 0.46, gy - fh * 1.18);
    g.lineTo(ax + fh * 0.34, gy - fh * 1.18);
    g.closePath();
    g.fill();
    g.restore();
  }
});

// ================================================================== 20. stargazing

const stargazing = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#03051a', '#0d1240', '#26245a']);
  // milky way
  g.save();
  g.translate(L.w * 0.5, gy * 0.45);
  g.rotate(-0.35);
  const mw = g.createLinearGradient(0, -L.h * 0.12, 0, L.h * 0.12);
  mw.addColorStop(0, 'rgba(160,140,255,0)');
  mw.addColorStop(0.5, 'rgba(190,170,255,0.22)');
  mw.addColorStop(1, 'rgba(160,140,255,0)');
  g.fillStyle = mw;
  g.fillRect(-L.w, -L.h * 0.12, L.w * 2, L.h * 0.24);
  g.restore();
  starfield(f, 170, 71, gy);
  // shooting star
  const sk = span(p, 0.3, 0.55);
  if (sk > 0 && sk < 1) {
    const x0 = S.port ? L.w * 0.9 : main + S.sideW * 0.45;
    const y0 = S.port ? L.h * 0.05 : L.h * 0.08;
    const x1 = S.port ? L.w * 0.15 : main - S.sideW * 0.45;
    const y1 = S.port ? L.h * 0.22 : L.h * 0.35;
    const hx = lerp(x0, x1, sk);
    const hy = lerp(y0, y1, sk);
    const tl = 0.22;
    const tx = lerp(x0, x1, Math.max(0, sk - tl));
    const ty = lerp(y0, y1, Math.max(0, sk - tl));
    const grad = g.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,250,220,0.95)');
    g.save();
    g.strokeStyle = grad;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(hx, hy);
    g.stroke();
    g.restore();
    glow(g, hx, hy, fh * 0.12, 'rgba(255,250,220,0.9)');
    star(g, hx, hy, fh * 0.03, '#ffffff', t * 4);
  }
  const hillTop = gy - fh * 0.08;
  hill(g, L, main, hillTop - fh * 0.15, S.port ? L.w * 0.9 : S.sideW * 0.75, '#121a3a');
  floorFill(g, L, gy + fh * 0.1, '#0d132c', '#060914');
  hill(g, L, main, hillTop - fh * 0.15, S.port ? L.w * 0.9 : S.sideW * 0.75, '#121a3a');
  // grass tufts
  g.save();
  g.strokeStyle = '#1e2a52';
  g.lineWidth = 2;
  const gr = makeRand(4);
  g.beginPath();
  for (let i = 0; i < 26; i++) {
    const x = main + gr.range(-0.6, 0.6) * (S.port ? L.w : S.sideW);
    const u = (x - main) / (S.port ? L.w * 0.9 : S.sideW * 0.75);
    const y = hillTop + Math.abs(u) * Math.abs(u) * fh * 0.6;
    g.moveTo(x, y);
    g.lineTo(x + gr.range(-3, 3), y - fh * 0.05);
  }
  g.stroke();
  g.restore();
  // lying, head to head, on a picnic blanket
  const lh = fh * (S.port ? 0.82 : 0.85);
  const ly = hillTop - lh * 0.13 * 0.75;
  g.save();
  g.fillStyle = '#b5304a';
  g.beginPath();
  g.ellipse(main, hillTop + fh * 0.02, lh * 1.0, fh * 0.07, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = -4; i <= 4; i++) g.fillRect(main + i * lh * 0.2 - lh * 0.04, hillTop - fh * 0.02, lh * 0.08, fh * 0.08);
  g.restore();
  glow(g, main, ly - fh * 0.05, lh * 0.8, 'rgba(160,170,255,0.25)');
  const point = span(p, 0.32, 0.42) - span(p, 0.75, 0.9);
  // A: feet to the left, head to the right
  const aFeet = main - lh * 0.88;
  figure(g, aFeet, ly, lh, { color: '#3a5a9b', accent: '#ffd166', dir: -1, lean: Math.PI / 2, mood: p > 0.45 ? 'grin' : 'smile', front: lerp(0.15, Math.PI / 2 + 0.3, point), back: 0.2 });
  figure(g, main + lh * 0.88, ly, lh * 0.95, { color: '#c0396b', dir: 1, lean: -Math.PI / 2, dress: true, accent: '#ff8fab', hair: 'long', mood: p > 0.45 ? 'calm' : 'smile', blush: 0.5, back: 0.2, front: 0.2 });
  if (p > 0.5) heartRise(f, 'h', main, ly - fh * 0.2, fh * 0.12, fh * 0.035, 3.5);
  runPs(f, 'h');
  const r = f.rand;
  burst(f, 'wish', 'wish', p > 0.55, 12, () => {
    const a = r() * TAU;
    return pt(main, ly - fh * 0.35, Math.cos(a) * 60, Math.sin(a) * 60 - 20, r.range(0.8, 1.3), fh * r.range(0.025, 0.045), r.pick(['#ffffff', '#fff3b0']), SPARK, r() * 3);
  });
  runPs(f, 'wish', 0, 1.5);
});

// ================================================================== 21. valentine

function rose(g: G, x: number, y: number, s: number): void {
  g.save();
  g.fillStyle = '#d61f45';
  g.beginPath();
  g.arc(x, y, s, 0, TAU);
  g.fill();
  g.strokeStyle = '#8a0f2a';
  g.lineWidth = Math.max(1, s * 0.18);
  g.beginPath();
  g.arc(x, y, s * 0.55, 0.3, Math.PI * 1.7);
  g.stroke();
  g.beginPath();
  g.arc(x + s * 0.1, y, s * 0.25, Math.PI, Math.PI * 2.6);
  g.stroke();
  g.restore();
}

const valentine = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#ff7aa2', '#ffb3c8', '#ffe2ea']);
  const br = makeRand(23);
  for (let i = 0; i < 14; i++) {
    const x = br() * L.w;
    const y = br() * gy;
    heart(g, x, y - t * 8, fh * br.range(0.05, 0.12), 'rgba(255,255,255,0.25)');
  }
  floorFill(g, L, gy, '#ff9ab5', '#e26a8e');
  // rising heart balloons
  const hb = makeRand(41);
  const n = S.port ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const side = S.port ? hb.range(0.06, 0.94) * L.w : (i % 2 ? (S.alt ?? main) : main) + hb.range(-0.45, 0.45) * S.sideW;
    const start = gy + hb.range(-0.2, 0.4) * fh;
    const sp = hb.range(60, 110);
    const y = start - (t + hb() * 0.8) * sp;
    const x = side + Math.sin(t * 1.5 + i) * fh * 0.08;
    balloon(g, x, y, fh * hb.range(0.1, 0.17), hb.pick(['#ff2e63', '#e0144c', '#ff5d8f', '#ffffff', '#ff8fab']), fh * 0.4, t, true);
  }
  // table with roses and chocolates
  const cx = S.port ? L.w * 0.5 : main;
  const top = gy - fh * 0.3;
  g.save();
  g.fillStyle = '#ffffff';
  g.fillRect(cx - fh * 0.7, top, fh * 1.4, gy - top);
  g.fillStyle = '#ffd6e0';
  g.fillRect(cx - fh * 0.7, top, fh * 1.4, fh * 0.04);
  g.restore();
  // bouquet
  const bqx = cx - fh * 0.3;
  g.save();
  g.strokeStyle = '#2f7d4a';
  g.lineWidth = fh * 0.015;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(bqx, top - fh * 0.05);
    g.lineTo(bqx + i * fh * 0.06, top - fh * 0.42);
    g.stroke();
  }
  g.fillStyle = '#3a9a52';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(bqx + s * fh * 0.1, top - fh * 0.3, fh * 0.06, fh * 0.025, s * 0.6, 0, TAU);
    g.fill();
  }
  g.restore();
  for (const [dx, dy] of [
    [-0.12, -0.42],
    [0, -0.47],
    [0.12, -0.42],
    [-0.06, -0.36],
    [0.07, -0.37],
  ]) rose(g, bqx + dx * fh, top + dy * fh, fh * 0.055);
  g.save();
  g.fillStyle = '#ffe9c2';
  g.beginPath();
  g.moveTo(bqx - fh * 0.16, top - fh * 0.32);
  g.lineTo(bqx + fh * 0.16, top - fh * 0.32);
  g.lineTo(bqx + fh * 0.03, top);
  g.lineTo(bqx - fh * 0.03, top);
  g.closePath();
  g.fill();
  g.fillStyle = '#e63973';
  g.fillRect(bqx - fh * 0.06, top - fh * 0.12, fh * 0.12, fh * 0.03);
  g.restore();
  // chocolates
  const chx = cx + fh * 0.32;
  const lid = span(p, 0.25, 0.45);
  heart(g, chx, top - fh * 0.08, fh * 0.17, '#a3123a');
  heart(g, chx, top - fh * 0.08, fh * 0.14, '#5a2a1a');
  const cr = makeRand(2);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.fillStyle = cr.pick(['#3a1a0a', '#6b3a1e', '#8a4a2a']);
    g.beginPath();
    g.arc(chx + cr.range(-0.08, 0.08) * fh, top - fh * cr.range(0.06, 0.16), fh * 0.028, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(chx + fh * 0.18, top - fh * 0.08);
  g.rotate(-lid * 0.5);
  g.translate(-fh * 0.18 * (1 - lid) - lid * fh * 0.05, -lid * fh * 0.25);
  heart(g, 0, 0, fh * 0.17 * (1 - lid * 0.2), '#e0144c');
  g.restore();
  const r = f.rand;
  spawn(f, 'pet', 8, 30, () => pt(r() * L.w, -10, r.range(-15, 15), r.range(40, 70), r.range(3, 4), fh * r.range(0.02, 0.035), r.pick(['#d61f45', '#ff5d8f', '#ffffff']), PETAL, r() * 6, r.range(-3, 3)));
  runPs(f, 'pet');
  if (S.alt !== null) {
    const ax = S.alt + fh * 0.1;
    const a = figure(g, ax, gy, fh, { color: '#3a5a9b', accent: '#ff2e63', dir: -1, mood: 'smile', blush: 0.7, front: { x: ax - fh * 0.24, y: gy - fh * 0.65 } });
    for (const [dx, dy] of [
      [-0.03, -0.08],
      [0.03, -0.1],
      [0, -0.04],
    ]) rose(g, a.hf.x + dx * fh, a.hf.y + dy * fh, fh * 0.04);
  }
});

// ================================================================== 22. breakupText

const breakupText = def(3.2, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#141826', '#232a3e', '#363f56']);
  cloud(g, L.w * 0.2, L.h * 0.05, fh * 0.6, '#1e2436');
  cloud(g, L.w * 0.75, L.h * 0.08, fh * 0.7, '#1e2436');
  skyline(g, L, gy, era, '#1a1f30', 81, 'rgba(255,214,120,0.3)');
  floorFill(g, L, gy, '#262c40', '#11141e');
  const crack = span(p, 0.5, 0.6);
  const split = span(p, 0.6, 0.85);
  const ph = S.port ? L.h * 0.34 : fh * 1.45;
  const pw = ph * 0.52;
  const px = S.port ? L.w * 0.36 : main;
  const py = S.port ? L.h * 0.24 : gy - fh * 0.9;
  if (before(era, 'modern')) {
    // a letter instead of a phone
    g.save();
    g.translate(px, py);
    g.rotate(-0.06 + Math.sin(t) * 0.02);
    g.fillStyle = '#efe0c2';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = 'rgba(120,90,60,0.25)';
    g.fillRect(-pw / 2, ph / 2 - 8, pw, 8);
    g.font = `italic 700 ${pw * 0.13}px Georgia, serif`;
    g.textAlign = 'center';
    g.fillStyle = '#4a2a1a';
    if (p > 0.08) g.fillText('Farewell,', 0, -ph * 0.3);
    g.strokeStyle = 'rgba(74,42,26,0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    const lines = Math.floor(span(p, 0.12, 0.45) * 6);
    for (let i = 0; i < lines; i++) {
      g.moveTo(-pw * 0.38, -ph * 0.18 + i * ph * 0.07);
      g.lineTo(pw * (i === 5 ? 0.05 : 0.38), -ph * 0.18 + i * ph * 0.07);
    }
    g.stroke();
    g.restore();
    crackedHeart(g, px, py + ph * 0.3, pw * 0.16, '#a3123a', split);
  } else {
    g.save();
    g.translate(px, py);
    g.rotate(-0.04);
    g.fillStyle = '#16161e';
    rrect(g, -pw / 2, -ph / 2, pw, ph, pw * 0.14);
    g.fill();
    const sw = pw * 0.88;
    const sh = ph * 0.88;
    g.fillStyle = '#eef1f7';
    rrect(g, -sw / 2, -sh / 2, sw, sh, pw * 0.09);
    g.fill();
    g.fillStyle = '#cfd6e4';
    g.fillRect(-sw / 2, -sh / 2 + sh * 0.02, sw, sh * 0.1);
    g.fillStyle = '#7a8296';
    g.beginPath();
    g.arc(-sw * 0.32, -sh / 2 + sh * 0.07, sw * 0.06, 0, TAU);
    g.fill();
    const fs = sw * 0.085;
    g.font = `600 ${fs}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    const msgs: [string, number][] = [
      ['We need to talk.', 0.08],
      ["I'm sorry...", 0.22],
      ["It's over.", 0.36],
    ];
    msgs.forEach(([m, at], i) => {
      const k = span(p, at, at + 0.06);
      if (k <= 0) return;
      const by = -sh / 2 + sh * 0.2 + i * sh * 0.12;
      g.save();
      g.globalAlpha *= k;
      const tw2 = g.measureText(m).width + fs * 1.2;
      g.fillStyle = '#d6dbe6';
      rrect(g, -sw / 2 + sw * 0.06, by - fs * 0.8, tw2, fs * 1.6, fs * 0.6);
      g.fill();
      g.fillStyle = '#222631';
      g.fillText(m, -sw / 2 + sw * 0.06 + fs * 0.6, by);
      g.restore();
    });
    g.restore();
    if (p > 0.45) crackedHeart(g, px, py + sh * 0.22, sw * 0.26 * (1 + (1 - crack) * 0.1 * Math.sin(t * 20)), '#ff3d6e', split);
  }
  if (crack > 0 && crack < 1) glow(g, px, py + ph * 0.25, pw * 0.5, 'rgba(255,80,110,0.5)', 1 - crack);
  // walking away in the rain
  const wx0 = S.alt ?? L.w * 0.7;
  const wk = span(p, 0.3, 1);
  const wx = wx0 - (S.port ? 0 : S.sideW * 0.18) + wk * (S.port ? L.w * 0.25 : S.sideW * 0.45);
  const scale = S.port ? lerp(0.85, 0.6, wk) : lerp(1, 0.8, wk);
  figure(g, wx, gy - (1 - scale) * fh * 0.25, fh * scale, { color: '#3b4a66', dir: 1, pose: p > 0.3 ? 'walk' : 'stand', phase: t, alpha: 1 - span(p, 0.75, 1) * 0.5 });
  rainFx(f, 'rain', 140);
  // splashes
  const r = f.rand;
  spawn(f, 'spl', 20, 30, () => pt(r() * L.w, gy + r.range(0, fh * 0.3), 0, -20, 0.3, r.range(2, 4), 'rgba(180,200,240,0.5)', PUFF));
  runPs(f, 'spl');
});

// ================================================================== 23. blindDate

const blindDate = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#4a2a3a', '#7a4a4a', '#b5785a']);
  g.save();
  g.fillStyle = 'rgba(255,230,190,0.07)';
  for (let x = 0; x < L.w; x += 50) g.fillRect(x, 0, 22, gy);
  g.restore();
  for (const lx of S.port ? [L.w * 0.5] : [main, S.alt ?? main]) glow(g, lx, L.h * 0.08, fh * 0.9, 'rgba(255,210,140,0.55)');
  floorFill(g, L, gy, '#3a2020', '#1a0e0e');
  const shy = p > 0.55;
  const sk = span(p, 0.55, 0.7);
  const top = dinnerSet(f, S, main, (side) => (shy ? (side ? 'calm' : 'smile') : 'nervous'), 0, sk);
  const hy = headY(gy, fh) + fh * 0.15;
  const tw = fh * 0.46;
  const xs = [main - tw - fh * 0.05, main + tw + fh * 0.05];
  // question marks + sweat
  if (p < 0.65) {
    const k = 1 - span(p, 0.52, 0.62);
    xs.forEach((x, i) => {
      const bob = Math.sin(t * 6 + i * 2) * fh * 0.03;
      caption(g, '?', x + (i ? 1 : -1) * fh * 0.05, hy - fh * 0.38 + bob, fh * 0.3, '#ffd166', k);
      caption(g, '?', x + (i ? -1 : 1) * fh * 0.1, hy - fh * 0.52 - bob, fh * 0.2, '#ffffff', k * 0.8);
    });
  }
  const r = f.rand;
  if (p < 0.55)
    spawn(f, 'sweat', 3, 8, () => {
      const i = r() < 0.5 ? 0 : 1;
      return pt(xs[i] + (i ? 1 : -1) * fh * 0.13, hy - fh * 0.05, (i ? 1 : -1) * 15, -30, 0.7, fh * 0.025, '#8fd3ff', DOT);
    });
  runPs(f, 'sweat', 220);
  burst(f, 'pop', 'pop', p > 0.56, 10, () => {
    const a = r() * TAU;
    return pt(main + r.range(-1, 1) * tw, hy - fh * 0.4, Math.cos(a) * 60, Math.sin(a) * 60, 0.7, fh * 0.03, '#fff3b0', SPARK, r() * 3);
  });
  runPs(f, 'pop', 0, 1.5);
  if (shy) {
    const hk = easeOut(sk);
    const hx = main;
    const hyy = lerp(top - fh * 0.1, top - fh * 0.55, hk) + Math.sin(t * 4) * 4;
    glow(g, hx, hyy, fh * 0.3 * hk, 'rgba(255,120,170,0.6)');
    heart(g, hx, hyy, fh * 0.08 * hk * (1 + 0.08 * Math.sin(t * 10)), '#ff4d7e');
  }
  if (S.alt !== null) {
    // a rose on the table at the next booth
    const ax = S.alt;
    g.save();
    g.fillStyle = '#5a2a2a';
    g.fillRect(ax - fh * 0.5, gy - fh * 0.4, fh, fh * 0.05);
    g.fillRect(ax - fh * 0.03, gy - fh * 0.4, fh * 0.06, fh * 0.4);
    g.restore();
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    rrect(g, ax - fh * 0.05, gy - fh * 0.6, fh * 0.1, fh * 0.2, fh * 0.03);
    g.fill();
    g.strokeStyle = '#2f7d4a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(ax, gy - fh * 0.42);
    g.lineTo(ax, gy - fh * 0.75);
    g.stroke();
    g.restore();
    rose(g, ax, gy - fh * 0.77, fh * 0.05);
    candle(g, ax + fh * 0.25, gy - fh * 0.4, fh * 0.1, t, 2);
  }
});

// ================================================================== 24. familyDinner

const familyDinner = def(3.2, (f, S) => {
  const { g, L, t, p } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#6b2f22', '#a3532f', '#d98a4a']);
  g.save();
  g.fillStyle = 'rgba(255,230,180,0.08)';
  for (let x = 0; x < L.w; x += 70) g.fillRect(x, 0, 30, gy);
  g.restore();
  // window with curtains
  const wx = S.alt ?? L.w * 0.5;
  const ww = S.port ? L.w * 0.35 : S.sideW * 0.45;
  const wt = S.port ? L.h * 0.05 : L.h * 0.15;
  const wh = S.port ? L.h * 0.13 : L.h * 0.3;
  g.save();
  const wg = g.createLinearGradient(0, wt, 0, wt + wh);
  wg.addColorStop(0, '#2a2a6a');
  wg.addColorStop(1, '#e07a5a');
  g.fillStyle = wg;
  g.fillRect(wx - ww / 2, wt, ww, wh);
  g.fillStyle = '#8a1f2a';
  g.fillRect(wx - ww / 2 - ww * 0.12, wt - 6, ww * 0.25, wh + 12);
  g.fillRect(wx + ww / 2 - ww * 0.13, wt - 6, ww * 0.25, wh + 12);
  g.restore();
  // pendant lamp
  const lampX = S.port ? L.w * 0.5 : main;
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.moveTo(lampX, 0);
  g.lineTo(lampX, L.h * (S.port ? 0.05 : 0.12));
  g.stroke();
  g.fillStyle = '#2a1408';
  g.beginPath();
  g.moveTo(lampX - fh * 0.15, L.h * (S.port ? 0.08 : 0.16));
  g.lineTo(lampX - fh * 0.06, L.h * (S.port ? 0.05 : 0.12));
  g.lineTo(lampX + fh * 0.06, L.h * (S.port ? 0.05 : 0.12));
  g.lineTo(lampX + fh * 0.15, L.h * (S.port ? 0.08 : 0.16));
  g.fill();
  g.restore();
  glow(g, lampX, L.h * (S.port ? 0.1 : 0.18), fh * 1.4, 'rgba(255,210,140,0.5)');
  floorFill(g, L, gy, '#4a2416', '#24100a');
  // family behind the table
  const tw = S.port ? L.w * 0.44 : Math.min(S.sideW * 0.44, fh * 1.25);
  const raise = span(p, 0.35, 0.5) - span(p, 0.78, 0.92);
  const fam: [number, string, number, Fig][] = [
    [-0.82, '#3a5a9b', 1, { accent: '#ffd166' }],
    [-0.42, '#c0396b', 0.95, { dress: true, accent: '#ff8fab', hair: 'long' }],
    [0, '#5a5a6a', 0.92, { hairCol: '#e6e6ee', dress: true, accent: '#9a8ab5', hair: 'bun' }],
    [0.42, '#2a9d8f', 0.7, {}],
    [0.8, '#e76f51', 0.62, { hair: 'long', dress: true, accent: '#ffd166' }],
  ];
  const tableTop = gy - fh * 0.38;
  const glasses: Pt[] = [];
  g.save();
  g.beginPath();
  g.rect(0, 0, L.w, gy - fh * 0.05);
  g.clip();
  fam.forEach(([u, col, sc, extra], i) => {
    const x = main + u * tw;
    const h = fh * sc;
    const yy = tableTop + h * 0.58;
    const arm = lerp(0.35, Math.PI - 0.4, raise * (i % 2 ? 1 : 0.95));
    const info = figure(g, x, yy, h, { color: col, dir: u < 0 ? 1 : -1, mood: raise > 0.5 ? 'grin' : 'smile', front: arm, back: 0.4, ...extra });
    if (raise > 0.05) glasses.push(info.hf);
  });
  g.restore();
  // table
  g.save();
  g.fillStyle = '#f5e6d3';
  g.fillRect(main - tw * 1.05, tableTop, tw * 2.1, gy - tableTop);
  g.fillStyle = '#e8d2b0';
  g.fillRect(main - tw * 1.05, tableTop, tw * 2.1, fh * 0.03);
  g.fillStyle = '#5a2a14';
  g.fillRect(main - tw * 1.05, gy - fh * 0.05, tw * 2.1, fh * 0.05);
  g.restore();
  // food
  g.save();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(main, tableTop - 2, fh * 0.22, fh * 0.04, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#c97a3a';
  g.beginPath();
  g.ellipse(main, tableTop - fh * 0.08, fh * 0.16, fh * 0.1, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#f5e6d3';
  g.beginPath();
  g.arc(main - fh * 0.16, tableTop - fh * 0.1, fh * 0.03, 0, TAU);
  g.arc(main + fh * 0.16, tableTop - fh * 0.1, fh * 0.03, 0, TAU);
  g.fill();
  for (const dx of [-0.6, 0.55]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(main + dx * tw, tableTop - 2, fh * 0.1, fh * 0.03, 0, 0, TAU);
    g.fill();
    g.fillStyle = dx < 0 ? '#6aaa52' : '#ffcf5a';
    g.beginPath();
    g.ellipse(main + dx * tw, tableTop - fh * 0.03, fh * 0.07, fh * 0.035, 0, Math.PI, 0);
    g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  g.beginPath();
  for (const dx of [-0.04, 0.03]) {
    const sx = main + dx * fh;
    g.moveTo(sx, tableTop - fh * 0.2);
    for (let i = 1; i <= 4; i++) g.lineTo(sx + Math.sin(t * 4 + i + dx * 80) * 4, tableTop - fh * 0.2 - i * fh * 0.04);
  }
  g.stroke();
  g.restore();
  for (const gp of glasses) wineGlass(g, gp.x, gp.y + fh * 0.04, fh * 0.12, '#9b1b45');
  if (raise > 0.9) for (const gp of glasses) sparkle(g, gp.x, gp.y - fh * 0.1, fh * 0.035 * (0.6 + 0.4 * Math.sin(t * 14 + gp.x)), '#fff3b0', t * 2);
  const r = f.rand;
  burst(f, 'cheers', 'ch', raise > 0.95, 20, () => pt(main + r.range(-1, 1) * tw, tableTop - fh * 0.9, r.range(-40, 40), -r.range(30, 80), r.range(0.8, 1.3), fh * r.range(0.025, 0.045), r.pick(['#fff3b0', '#ffd166', '#ffffff']), SPARK, r() * 3));
  runPs(f, 'cheers', 0, 1);
  if (S.alt !== null) {
    figure(g, (S.alt ?? 0) + fh * 0.25, gy, fh * 0.95, { color: '#6b4a3a', hairCol: '#e6e6ee', hair: 'bun', dress: true, accent: '#ffb38a', dir: -1, mood: 'grin', front: Math.PI / 2 - 0.15, back: Math.PI / 2 - 0.3, pose: 'stand' });
    const pieX = (S.alt ?? 0) + fh * 0.25 - fh * 0.27;
    const pieY = gy - fh * 0.65;
    g.save();
    g.fillStyle = '#d9a45a';
    g.beginPath();
    g.ellipse(pieX, pieY, fh * 0.14, fh * 0.05, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(pieX - fh * 0.16, pieY, fh * 0.32, fh * 0.02);
    g.restore();
    glow(g, pieX, pieY - fh * 0.04, fh * 0.2, 'rgba(255,220,150,0.6)');
  }
});

// ================================================================== 25. playground

const playground = def(3.0, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#5fb0f0', '#a8dcff', '#eef8ff']);
  glow(g, S.port ? L.w * 0.85 : main - S.sideW * 0.38, L.h * 0.09, fh * 0.7, 'rgba(255,240,170,0.9)');
  cloud(g, S.port ? L.w * 0.25 : main + S.sideW * 0.25, L.h * 0.1, fh * 0.3, 'rgba(255,255,255,0.95)');
  if (S.alt !== null) cloud(g, S.alt, L.h * 0.15, fh * 0.35, 'rgba(255,255,255,0.95)');
  floorFill(g, L, gy, '#7cc85e', '#4f9a3f');
  // swing set
  const sx = S.port ? L.w * 0.55 : main + fh * 0.15;
  const top = gy - fh * 1.25;
  const rope = fh * 0.85;
  const sw = fh * 0.5;
  g.save();
  g.strokeStyle = '#e63946';
  g.lineWidth = fh * 0.045;
  g.lineCap = 'round';
  g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(sx + s * sw - s * fh * 0.15, gy);
    g.lineTo(sx + s * sw, top);
    g.lineTo(sx + s * sw + s * fh * 0.15, gy);
  }
  g.moveTo(sx - sw, top);
  g.lineTo(sx + sw, top);
  g.stroke();
  g.restore();
  const th = Math.sin(t * 2.8) * 0.55;
  const seat = { x: sx + Math.sin(th) * rope, y: top + Math.cos(th) * rope };
  g.save();
  g.strokeStyle = '#555a66';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(sx - fh * 0.05, top);
  g.lineTo(seat.x - fh * 0.05 * Math.cos(th), seat.y);
  g.moveTo(sx + fh * 0.05, top);
  g.lineTo(seat.x + fh * 0.05 * Math.cos(th), seat.y);
  g.stroke();
  g.translate(seat.x, seat.y);
  g.rotate(-th);
  g.fillStyle = '#3a2a1a';
  g.fillRect(-fh * 0.09, 0, fh * 0.18, fh * 0.03);
  const kid = fh * 0.55;
  figure(g, -kid * 0.05, kid * 0.27, kid, { color: '#ff9f1c', dir: 1, pose: 'sit', mood: 'grin', hair: 'bun', front: { x: -kid * 0.05, y: -rope * 0.4 }, back: { x: -kid * 0.08, y: -rope * 0.4 } });
  g.restore();
  // parent pushing
  const px = sx - rope * 0.62;
  const push = clamp(-Math.sin(t * 2.8 + 0.2) * 1.3);
  figure(g, px, gy, fh, { color: ME, accent: ME_TIE, dir: 1, mood: 'smile', front: { x: px + fh * lerp(0.1, 0.3, push), y: gy - fh * lerp(0.5, 0.62, push) }, back: { x: px + fh * lerp(0.06, 0.27, push), y: gy - fh * lerp(0.48, 0.6, push) }, lean: push * 0.08 });
  // sandbox
  const bx = S.port ? L.w * 0.15 : main - S.sideW * 0.38;
  g.save();
  g.fillStyle = '#a0522d';
  g.fillRect(bx - fh * 0.3, gy - fh * 0.06, fh * 0.6, fh * 0.12);
  g.fillStyle = '#f2d38a';
  g.beginPath();
  g.ellipse(bx, gy - fh * 0.05, fh * 0.27, fh * 0.05, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#3a86ff';
  g.fillRect(bx + fh * 0.05, gy - fh * 0.12, fh * 0.08, fh * 0.07);
  g.restore();
  // slide
  if (S.alt !== null || S.port) {
    const slx = S.alt ?? L.w * 0.88;
    const ss = S.port ? fh * 0.6 : fh;
    g.save();
    g.strokeStyle = '#3a86ff';
    g.lineWidth = ss * 0.04;
    g.beginPath();
    g.moveTo(slx - ss * 0.35, gy);
    g.lineTo(slx - ss * 0.3, gy - ss * 0.8);
    g.moveTo(slx - ss * 0.15, gy);
    g.lineTo(slx - ss * 0.12, gy - ss * 0.8);
    for (let i = 1; i < 6; i++) {
      g.moveTo(slx - ss * 0.34 + i * ss * 0.008, gy - i * ss * 0.13);
      g.lineTo(slx - ss * 0.15 + i * ss * 0.005, gy - i * ss * 0.13);
    }
    g.stroke();
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(slx - ss * 0.3, gy - ss * 0.82);
    g.lineTo(slx - ss * 0.12, gy - ss * 0.82);
    g.quadraticCurveTo(slx + ss * 0.1, gy - ss * 0.2, slx + ss * 0.45, gy - ss * 0.05);
    g.lineTo(slx + ss * 0.45, gy + ss * 0.02);
    g.quadraticCurveTo(slx + ss * 0.05, gy - ss * 0.1, slx - ss * 0.2, gy - ss * 0.72);
    g.closePath();
    g.fill();
    g.restore();
    if (S.alt !== null) {
      const u = (t * 0.6) % 1;
      const kx = lerp(slx - ss * 0.15, slx + ss * 0.42, u);
      const ky = lerp(gy - ss * 0.82, gy - ss * 0.04, Math.pow(u, 0.8));
      figure(g, kx, ky + ss * 0.12, ss * 0.5, { color: '#06a77d', dir: 1, pose: 'sit', mood: 'grin', front: Math.PI - 0.4, back: Math.PI - 0.4, lean: 0.35 });
    }
  }
  const r = f.rand;
  spawn(f, 'sp', 4, 12, () => pt(seat.x + r.range(-20, 20), seat.y - fh * 0.4, r.range(-20, 20), -40, 0.9, fh * 0.03, r.pick(['#ffd166', '#ffffff', '#ff8fab']), r() < 0.5 ? SPARK : HEART, r() * 3));
  runPs(f, 'sp');
});

// ================================================================== 26. grandparents

const grandparents = def(3.2, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#ffb36b', '#ffd59e', '#fff0d6']);
  glow(g, S.alt ?? L.w * 0.85, gy - fh * 0.5, fh * 2, 'rgba(255,220,150,0.6)');
  floorFill(g, L, gy, '#a5c76a', '#7aa04a');
  // porch
  const cx = S.port ? L.w * 0.5 : main;
  const pw = S.port ? L.w * 0.46 : Math.min(S.sideW * 0.46, fh * 1.2);
  const floorY = gy - fh * 0.12;
  const roofY = gy - fh * 1.45;
  g.save();
  g.fillStyle = '#e8d6b8';
  g.fillRect(cx - pw * 1.1, roofY, pw * 2.2, floorY - roofY);
  g.fillStyle = 'rgba(120,90,60,0.15)';
  for (let yy = roofY + 12; yy < floorY; yy += 14) g.fillRect(cx - pw * 1.1, yy, pw * 2.2, 2);
  g.fillStyle = '#ffcf7a';
  g.fillRect(cx + pw * 0.62, roofY + fh * 0.3, pw * 0.3, fh * 0.35);
  g.fillStyle = '#8a4a2a';
  g.fillRect(cx - pw * 1.2, floorY, pw * 2.4, fh * 0.06);
  g.fillRect(cx - pw * 1.2, floorY + fh * 0.06, fh * 0.04, gy - floorY);
  g.fillRect(cx + pw * 1.2 - fh * 0.04, floorY + fh * 0.06, fh * 0.04, gy - floorY);
  g.fillStyle = '#ffffff';
  g.fillRect(cx - pw * 1.15, roofY, fh * 0.06, floorY - roofY);
  g.fillRect(cx + pw * 1.15 - fh * 0.06, roofY, fh * 0.06, floorY - roofY);
  g.fillStyle = '#6b3a2a';
  g.beginPath();
  g.moveTo(cx - pw * 1.3, roofY + 4);
  g.lineTo(cx - pw * 1.05, roofY - fh * 0.2);
  g.lineTo(cx + pw * 1.05, roofY - fh * 0.2);
  g.lineTo(cx + pw * 1.3, roofY + 4);
  g.closePath();
  g.fill();
  g.restore();
  // porch swing
  const sway = Math.sin(t * 1.6) * fh * 0.04;
  const seatY = floorY - fh * 0.3;
  const sxc = cx - pw * 0.15;
  const sw = fh * 0.5;
  g.save();
  g.strokeStyle = '#555';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(sxc - sw, roofY);
  g.lineTo(sxc - sw + sway, seatY - fh * 0.3);
  g.moveTo(sxc + sw, roofY);
  g.lineTo(sxc + sw + sway, seatY - fh * 0.3);
  g.stroke();
  g.restore();
  const h = fh * 0.95;
  const gx = sxc + sway;
  g.save();
  g.fillStyle = '#7a4a2a';
  g.fillRect(gx - sw, seatY - fh * 0.32, sw * 2, fh * 0.05);
  for (let i = 0; i <= 6; i++) g.fillRect(gx - sw + (i * sw * 2) / 6 - 2, seatY - fh * 0.32, 4, fh * 0.32);
  g.restore();
  const hug = { x: gx, y: seatY - h * 0.38 };
  figure(g, gx - sw * 0.38, seatY + h * 0.27, h, { color: '#5a4a6a', hairCol: '#e6e6ee', accent: '#9ac1e8', dir: 1, pose: 'sit', mood: 'calm', blush: 0.3, front: hug, lean: 0.06 });
  figure(g, gx + sw * 0.38, seatY + h * 0.27, h * 0.95, { color: '#7a4a5a', hairCol: '#f2f2f6', hair: 'bun', dir: -1, pose: 'sit', dress: true, accent: '#d98aa8', mood: 'calm', blush: 0.4, front: hug, lean: -0.06 });
  g.save();
  g.fillStyle = '#7a4a2a';
  g.fillRect(gx - sw, seatY, sw * 2, fh * 0.05);
  g.restore();
  // cane
  g.save();
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = fh * 0.02;
  g.beginPath();
  g.moveTo(gx - sw * 1.05, floorY);
  g.lineTo(gx - sw * 1.0, seatY - fh * 0.08);
  g.arc(gx - sw * 1.05, seatY - fh * 0.08, fh * 0.04, 0, Math.PI, true);
  g.stroke();
  g.restore();
  heartRise(f, 'h', gx, seatY - fh * 1.0, fh * 0.15, fh * 0.035, 2.5, ['#ff8fab', '#ffb3c6', '#ffd166']);
  runPs(f, 'h');
  // grandchildren
  const kids = S.alt !== null ? S.alt : cx;
  const kh = fh * (S.port ? 0.42 : 0.55);
  const k1 = kids + (S.alt !== null ? -fh * 0.4 : -pw * 0.9) + Math.sin(t * 2.2) * fh * (S.alt !== null ? 0.25 : 0.12);
  const k2 = kids + (S.alt !== null ? fh * 0.4 : pw * 0.9) + Math.cos(t * 2.2) * fh * (S.alt !== null ? 0.2 : 0.1);
  const ky = S.alt !== null ? gy : gy + fh * 0.02;
  figure(g, k1, ky - Math.abs(Math.sin(t * 9)) * kh * 0.08, kh, { color: '#ff9f1c', dir: Math.cos(t * 2.2) > 0 ? 1 : -1, pose: 'run', phase: t, mood: 'grin', hair: 'bun' });
  figure(g, k2, ky - Math.abs(Math.cos(t * 9)) * kh * 0.08, kh * 0.9, { color: '#06a77d', dir: Math.sin(t * 2.2) < 0 ? 1 : -1, pose: 'run', phase: t + 0.3, mood: 'grin' });
  const bxp = (k1 + k2) / 2;
  const by = ky - kh * 0.4 - Math.abs(Math.sin(t * 4.4)) * kh * 0.8;
  g.save();
  g.fillStyle = '#e63946';
  g.beginPath();
  g.arc(bxp, by, kh * 0.12, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillRect(bxp - kh * 0.12, by - kh * 0.02, kh * 0.24, kh * 0.04);
  g.restore();
  const r = f.rand;
  spawn(f, 'leaves', 4, 14, () => pt(r() * L.w, -10, r.range(10, 30), r.range(30, 50), r.range(3, 4), fh * 0.025, r.pick(['#e07a2a', '#ffb347', '#c0392b']), PETAL, r() * 6, r.range(-3, 3)));
  runPs(f, 'leaves');
});

// ================================================================== 27. reunion

const reunion = def(3.0, (f, S) => {
  const { g, L, t, p, era } = f;
  const { fh, gy, main } = S;
  sky(g, L, ['#7cc0f5', '#bfe3ff', '#ffe9c7']);
  skyline(g, L, gy - fh * 0.05, era, 'rgba(150,180,215,0.55)', 91);
  floorFill(g, L, gy, '#cfd6de', '#9aa3b0');
  // platform edge stripe
  g.save();
  g.fillStyle = '#ffd166';
  g.fillRect(0, gy + fh * 0.04, L.w, fh * 0.025);
  g.restore();
  // canopy pillars
  g.save();
  g.fillStyle = '#5a6a7a';
  const pil = S.port ? [L.w * 0.08, L.w * 0.92] : [main - S.sideW * 0.45, main + S.sideW * 0.45];
  for (const x of pil) g.fillRect(x - 5, gy - fh * 1.5, 10, fh * 1.5);
  g.fillRect(0, gy - fh * 1.55, L.w, fh * 0.06);
  g.restore();
  const meet = 0.42;
  const run = span(p, 0, meet);
  const reach = S.port ? L.w * 0.42 : S.sideW * 0.42;
  const hugging = p >= meet;
  const d = hugging ? fh * 0.12 : lerp(reach, fh * 0.12, run);
  const hop = hugging ? Math.abs(Math.sin((p - meet) * 12)) * fh * 0.05 * (1 - span(p, 0.6, 0.8)) : 0;
  const lean = hugging ? 0.1 : 0.12;
  figure(g, main - d, gy - hop, fh, { color: '#3a5a9b', accent: '#ffd166', dir: 1, pose: hugging ? 'stand' : 'run', phase: t, lean, mood: hugging ? 'calm' : 'grin', front: hugging ? { x: main + fh * 0.07, y: gy - fh * 0.66 - hop } : Math.PI - 0.6, back: hugging ? 0.3 : undefined });
  figure(g, main + d, gy - hop, fh * 0.95, { color: '#c0396b', dir: -1, pose: hugging ? 'stand' : 'run', phase: t + 0.3, lean: -lean, dress: true, accent: '#ff8fab', hair: 'long', mood: hugging ? 'calm' : 'grin', front: hugging ? { x: main - fh * 0.07, y: gy - fh * 0.7 - hop } : Math.PI - 0.6 });
  const hy = headY(gy, fh);
  if (hugging) glow(g, main, hy + fh * 0.2, fh * 0.9, 'rgba(255,230,150,0.55)', 1 - span(p, 0.8, 1) * 0.5);
  const r = f.rand;
  burst(f, 'sp', 'sp', hugging, 30, (i) => {
    const a = r() * TAU;
    const v = r.range(80, 220);
    return pt(main, hy + fh * 0.1, Math.cos(a) * v, Math.sin(a) * v - 60, r.range(0.8, 1.4), i % 3 ? fh * r.range(0.03, 0.05) : fh * 0.05, i % 3 ? r.pick(['#ffd166', '#ffffff', '#fff3b0']) : '#ff5d8f', i % 3 ? SPARK : HEART, r() * 3);
  });
  runPs(f, 'sp', 60, 1.4);
  if (hugging) heartRise(f, 'h', main, hy - fh * 0.1, fh * 0.2, fh * 0.04, 4);
  runPs(f, 'h');
  if (!hugging) {
    g.save();
    g.globalAlpha *= 0.4;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    for (const s of [-1, 1]) {
      const x = main + s * d;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        g.moveTo(x - s * fh * 0.15, gy - fh * (0.3 + i * 0.2));
        g.lineTo(x - s * fh * 0.35, gy - fh * (0.3 + i * 0.2));
      }
      g.stroke();
    }
    g.restore();
  }
  if (S.alt !== null) {
    const ax = S.alt;
    figure(g, ax - fh * 0.35, gy, fh * 0.95, { color: '#2a9d8f', dir: 1, mood: 'grin', front: Math.PI - 0.3, back: Math.PI - 0.3 });
    figure(g, ax + fh * 0.35, gy, fh, { color: '#6d597a', dir: -1, mood: 'grin', front: Math.PI - 0.3, back: Math.PI - 0.3 });
    const by = gy - fh * 1.2;
    g.save();
    g.fillStyle = '#ffffff';
    rrect(g, ax - fh * 0.55, by - fh * 0.16, fh * 1.1, fh * 0.3, fh * 0.03);
    g.fill();
    g.fillStyle = '#e63973';
    g.font = `900 ${fh * 0.12}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('WELCOME BACK!', ax, by + Math.sin(t * 5) * 1);
    g.restore();
    spawn(f, 'conf', 20, 50, () => pt(ax + r.range(-1, 1) * fh * 0.6, by - fh * 0.2, r.range(-60, 60), -r.range(80, 160), r.range(1.2, 1.8), r.range(5, 9), r.pick(CONFETTI_COLORS), CONF, r() * 6, r.range(-6, 6)));
    runPs(f, 'conf', 260);
  }
});

// ================================================================== export

export const ROMANCE_SCENE_DEFS: Record<RomanceSceneId, SceneDef> = {
  date,
  kiss,
  dance,
  flirt,
  romance,
  nightTogether,
  proposal,
  honeymoon,
  jealousy,
  affair,
  argument,
  makeup,
  loveLetter,
  datingApp,
  serenade,
  anniversary,
  pregnancy,
  babyShower,
  lonely,
  stargazing,
  valentine,
  breakupText,
  blindDate,
  familyDinner,
  playground,
  grandparents,
  reunion,
};
