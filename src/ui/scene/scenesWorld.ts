/**
 * World scenes (group A): invasions, war, disasters, crime, politics, money and sci-fi.
 *
 * Every scene is a short procedural animation drawn on the stage canvas behind the phone.
 * Conventions used throughout this file:
 *  - `mk()` wraps each draw in save/restore and multiplies the global alpha by the fade envelope,
 *    so every helper below only ever *multiplies* globalAlpha.
 *  - Action is placed beside the phone in landscape (L.slots[0] / L.slots[1]) and centred above
 *    the (dipped) phone in portrait; `U(L)` is the size unit (~1 on a 1440x900 desktop).
 *  - Particle kinds: 0 dot, 1 spark, 2 debris chunk, 3 smoke puff (grows), >=4 scene specific.
 */
import type { EraLook, Layout, Particle, SceneDef, SceneFrame } from './kit';
import {
  CONFETTI_COLORS,
  caption,
  clamp,
  drawConfetti,
  easeIn,
  easeInOut,
  easeOut,
  glow,
  heart,
  lerp,
  makeRand,
  particles,
  person,
  sky,
  skyline,
  span,
  star,
} from './kit';
import type { WorldSceneId } from './ids';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ERA_I: Record<EraLook, number> = { ancient: 0, medieval: 1, early: 2, industrial: 3, modern: 4, future: 5 };

// ================================================================== layout helpers

/** Size unit: 1 on a 1440x900 desktop with a 400px phone, smaller on narrow screens. */
function U(L: Layout): number {
  if (L.portrait) return clamp(Math.min(L.w / 420, L.groundY / 480), 0.5, 1.6);
  const fw = Math.min(L.phone.x, L.w - L.phone.x - L.phone.w);
  return clamp(Math.min(fw / 520, L.h / 900), 0.45, 1.6);
}

/** Where feet stand. In portrait it is lifted a little so it stays above the dipped phone. */
function floorY(L: Layout, u: number): number {
  return L.portrait ? L.groundY - 26 * u : L.groundY;
}

/** Main action x: left of the phone in landscape, centre in portrait. */
function mainX(L: Layout): number {
  return L.portrait ? L.w * 0.5 : L.slots[0];
}

/** Two action points: either side of the phone, or either side of the centre in portrait. */
function pair(L: Layout, spread = 0.25): [number, number] {
  return L.portrait ? [L.w * (0.5 - spread), L.w * (0.5 + spread)] : [L.slots[0], L.slots[1]];
}

/** True when x sits behind the phone (landscape only); used to skip invisible work. */
function hidden(L: Layout, x: number, m = 0): boolean {
  return !L.portrait && x > L.phone.x + m && x < L.phone.x + L.phone.w - m;
}

/** A random x somewhere visible. */
function visX(L: Layout, r: () => number, margin = 30): number {
  if (L.portrait) return margin + r() * (L.w - 2 * margin);
  const left = Math.max(10, L.phone.x - margin * 2);
  const right = Math.max(10, L.w - (L.phone.x + L.phone.w) - margin * 2);
  const v = r() * (left + right);
  return v < left ? margin + v : L.phone.x + L.phone.w + margin + (v - left);
}

/** Evenly spaced x positions over the visible area (cached by the caller). */
function rowXs(L: Layout, spacing: number, jitter: number, r: () => number): number[] {
  const xs: number[] = [];
  for (let x = spacing * 0.4; x < L.w; x += spacing) {
    const xx = x + (r() - 0.5) * jitter;
    if (!hidden(L, xx, 12)) xs.push(xx);
  }
  return xs;
}

// ================================================================== frame helpers

function mk(dur: number, draw: (f: SceneFrame) => void, shake?: (t: number, dur: number) => number): SceneDef {
  const def: SceneDef = {
    dur,
    draw: (f) => {
      f.g.save();
      f.g.globalAlpha *= f.a;
      draw(f);
      f.g.restore();
    },
  };
  if (shake) def.shake = shake;
  return def;
}

function once<T>(mem: Record<string, unknown>, key: string, make: () => T): T {
  if (!(key in mem)) mem[key] = make();
  return mem[key] as T;
}

/** True exactly once, on the first frame at or after time tz. */
function at(f: SceneFrame, key: string, tz: number): boolean {
  if (f.t >= tz && !f.mem[key]) {
    f.mem[key] = 1;
    return true;
  }
  return false;
}

/** Call fn `rate` times per second (fractional accumulation). */
function emit(f: SceneFrame, key: string, rate: number, fn: () => void): void {
  let acc = ((f.mem[key] as number | undefined) ?? 0) + rate * f.dt;
  while (acc >= 1) {
    fn();
    acc -= 1;
  }
  f.mem[key] = acc;
}

/** Decaying shake impulses at fixed times. */
function impulses(times: readonly number[], amp: number, decay = 0.35): (t: number) => number {
  return (t) => {
    let s = 0;
    for (const tz of times) {
      const d = t - tz;
      if (d >= 0 && d < decay) s = Math.max(s, amp * (1 - d / decay));
    }
    return s;
  };
}

function P(x: number, y: number, vx: number, vy: number, max: number, size: number, color: string, kind = 0, rot = 0, vr = 0): Particle {
  return { x, y, vx, vy, life: 0, max, size, color, kind, rot, vr };
}

function add(ps: Particle[], p: Particle, cap = 300): void {
  if (ps.length < cap) ps.push(p);
}

/** Step particles: sparks/debris (1, 2) and kinds >= 4 fall, smoke (3) slows down and drifts, 5 is parked. */
function stepParts(ps: Particle[], dt: number, grav: number): void {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    const k = p.kind ?? 0;
    if (k === 5) {
      // parked (e.g. an arrow stuck in the ground): only ages
      p.life += dt;
      if (p.life >= p.max) ps.splice(i, 1);
      continue;
    }
    if (k === 1 || k === 2 || k >= 4) p.vy += grav * dt;
    else if (k === 3) {
      p.vx *= 1 - 0.6 * dt;
      p.vy *= 1 - 0.3 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt;
    p.life += dt;
    if (p.life >= p.max) ps.splice(i, 1);
  }
}

/** Draw particle kinds 0..3. */
function drawParts(g: G, ps: Particle[]): void {
  const base = g.globalAlpha;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const kind = p.kind ?? 0;
    if (kind > 3) continue;
    const k = p.life / p.max;
    g.fillStyle = p.color;
    if (kind === 2) {
      g.globalAlpha = base * clamp((1 - k) * 4);
      const c = Math.cos(p.rot ?? 0) * p.size;
      const s = Math.sin(p.rot ?? 0) * p.size;
      g.beginPath();
      g.moveTo(p.x + c, p.y + s);
      g.lineTo(p.x - s * 0.8, p.y + c * 0.8);
      g.lineTo(p.x - c * 0.7, p.y - s * 0.7);
      g.lineTo(p.x + s, p.y - c);
      g.fill();
    } else if (kind === 3) {
      g.globalAlpha = base * 0.7 * (1 - k) * clamp(k * 8);
      g.beginPath();
      g.arc(p.x, p.y, p.size * (0.5 + k * 1.2), 0, TAU);
      g.fill();
    } else {
      g.globalAlpha = base * (1 - k * k);
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, TAU);
      g.fill();
    }
  }
  g.globalAlpha = base;
}

// ================================================================== shape helpers

function circ(g: G, x: number, y: number, r: number): void {
  g.moveTo(x + r, y);
  g.arc(x, y, Math.max(0, r), 0, TAU);
}

function ell(g: G, x: number, y: number, rx: number, ry: number, rot = 0): void {
  g.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

function line(g: G, x0: number, y0: number, x1: number, y1: number): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

function floor(g: G, L: Layout, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(0, y, L.w, L.h - y);
}

function wash(g: G, L: Layout, color: string, a: number): void {
  if (a <= 0) return;
  const base = g.globalAlpha;
  g.globalAlpha = base * a;
  g.fillStyle = color;
  g.fillRect(-20, -20, L.w + 40, L.h + 40);
  g.globalAlpha = base;
}

function cloud(g: G, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  circ(g, x - r * 0.95, y + r * 0.18, r * 0.55);
  circ(g, x - r * 0.35, y - r * 0.15, r * 0.74);
  circ(g, x + r * 0.42, y - r * 0.04, r * 0.64);
  circ(g, x + r * 1.02, y + r * 0.22, r * 0.46);
  g.rect(x - r * 0.95, y + r * 0.1, r * 1.97, r * 0.56);
  g.fill();
}

function starfield(g: G, L: Layout, n: number, seed: number, t: number, maxY: number): void {
  const r = makeRand(seed);
  const base = g.globalAlpha;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = r() * L.w;
    const y = r() * maxY;
    const s = 0.8 + r() * 1.6;
    const ph = r() * TAU;
    g.globalAlpha = base * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.8 + ph)));
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  g.globalAlpha = base;
}

/** Teardrop flame with three layers; (x, y) is the base. */
const FLAME_LAYERS: [string, number, number][] = [
  ['#ff3d1f', 1, 1],
  ['#ff8f1f', 0.72, 0.78],
  ['#ffd84d', 0.46, 0.55],
  ['#fff6cf', 0.22, 0.3],
];
function flame(g: G, x: number, y: number, w: number, h: number, t: number, seed: number): void {
  for (const [c, kw, kh] of FLAME_LAYERS) {
    const fl = 1 + Math.sin(t * 11 + seed) * 0.12 + Math.sin(t * 23 + seed * 1.7) * 0.07;
    const sway = Math.sin(t * 6.5 + seed * 0.7) * w * 0.35 * kh;
    const ww = w * kw * 0.5;
    const hh = h * kh * fl;
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x + ww, y - ww);
    g.arc(x, y - ww, ww, 0, Math.PI);
    g.bezierCurveTo(x - ww, y - hh * 0.55, x + sway - ww * 0.25, y - hh * 0.8, x + sway, y - hh);
    g.bezierCurveTo(x + sway + ww * 0.25, y - hh * 0.8, x + ww, y - hh * 0.55, x + ww, y - ww);
    g.fill();
  }
}

/** Comic impact burst. */
function burst(g: G, x: number, y: number, r: number, fill: string, stroke: string, rot = 0, n = 11): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr2 = i % 2 ? r * 0.5 : r * (0.85 + ((i * 7) % 5) * 0.06);
    const a = rot + (i * Math.PI) / n;
    g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.max(2, r * 0.08);
  g.strokeStyle = stroke;
  g.stroke();
}

function ring(g: G, x: number, y: number, r: number, w: number, color: string, a: number, sy = 1): void {
  if (a <= 0 || r <= 0) return;
  const base = g.globalAlpha;
  g.globalAlpha = base * a;
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.ellipse(x, y, r, r * sy, 0, 0, TAU);
  g.stroke();
  g.globalAlpha = base;
}

function flash(g: G, L: Layout, a: number, color = '#ffffff'): void {
  wash(g, L, color, clamp(a));
}

function flag(g: G, x: number, y: number, h: number, color: string, t: number, seed = 0, emblem?: string): void {
  g.strokeStyle = '#2a1d14';
  g.lineWidth = Math.max(2, h * 0.025);
  line(g, x, y, x, y - h);
  const fw = h * 0.42;
  const fh = h * 0.26;
  const top = y - h;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, top);
  for (let i = 0; i <= 6; i++) {
    const k = i / 6;
    g.lineTo(x + k * fw, top + Math.sin(t * 6 + k * 4 + seed) * fh * 0.15 * k);
  }
  for (let i = 6; i >= 0; i--) {
    const k = i / 6;
    g.lineTo(x + k * fw, top + fh + Math.sin(t * 6 + k * 4 + seed) * fh * 0.15 * k);
  }
  g.closePath();
  g.fill();
  if (emblem) {
    g.fillStyle = emblem;
    g.beginPath();
    circ(g, x + fw * 0.45, top + fh * 0.5 + Math.sin(t * 6 + 1.8 + seed) * fh * 0.07, fh * 0.22);
    g.fill();
  }
}

// ------------------------------------------------------------------ figures

type Hat = 'none' | 'helmet' | 'shako' | 'cap' | 'beanie' | 'hood' | 'bobby' | 'brim' | 'visor' | 'tri';
interface FigOpts {
  dir?: 1 | -1;
  /** Walking phase in seconds; omitted = standing still. */
  walk?: number;
  /** Arm angles in radians measured from straight down, positive towards the facing direction. */
  armF?: number;
  armB?: number;
  lean?: number;
  hat?: Hat;
  hatColor?: string;
  /** Legs spread for climbing/running. */
  stride?: number;
}
/** Scratch output of fig(): head centre/radius and the two hands. */
const FO = { hx: 0, hy: 0, hr: 0, fx: 0, fy: 0, bx: 0, by: 0, sx: 0, sy: 0 };

/** Stick figure with explicit arm angles (kit.person covers the stock poses). */
function fig(g: G, x: number, y: number, h: number, col: string, o: FigOpts = {}): typeof FO {
  const dir = o.dir ?? 1;
  const lw = Math.max(2, h * 0.08);
  const lean = (o.lean ?? 0) * dir;
  const hipX = x;
  const hipY = y - h * 0.44;
  const shX = hipX + Math.sin(lean) * h * 0.31;
  const shY = hipY - Math.cos(lean) * h * 0.31;
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  const stride = o.stride ?? 0.14;
  const s = o.walk !== undefined ? Math.sin(o.walk * 9) * h * stride : 0;
  const l1 = o.walk !== undefined ? Math.max(0, Math.cos(o.walk * 9)) * h * 0.05 : 0;
  const l2 = o.walk !== undefined ? Math.max(0, -Math.cos(o.walk * 9)) * h * 0.05 : 0;
  g.beginPath();
  g.moveTo(hipX, hipY);
  g.lineTo(x + dir * (h * 0.05 + s), y - l1);
  g.moveTo(hipX, hipY);
  g.lineTo(x + dir * (-h * 0.05 - s), y - l2);
  g.stroke();
  g.lineWidth = lw * 1.9;
  line(g, hipX, hipY, shX, shY);
  g.lineWidth = lw;
  const al = h * 0.3;
  const aF = o.armF ?? 0.25;
  const aB = o.armB ?? -0.25;
  FO.sx = shX;
  FO.sy = shY + h * 0.03;
  FO.fx = shX + dir * Math.sin(aF) * al;
  FO.fy = FO.sy + Math.cos(aF) * al;
  FO.bx = shX + dir * Math.sin(aB) * al;
  FO.by = FO.sy + Math.cos(aB) * al;
  g.beginPath();
  g.moveTo(FO.sx, FO.sy);
  g.lineTo(FO.fx, FO.fy);
  g.moveTo(FO.sx, FO.sy);
  g.lineTo(FO.bx, FO.by);
  g.stroke();
  const hr = h * 0.125;
  const hx = shX + Math.sin(lean) * hr * 1.15;
  const hy = shY - Math.cos(lean) * hr * 1.15;
  FO.hx = hx;
  FO.hy = hy;
  FO.hr = hr;
  g.beginPath();
  circ(g, hx, hy, hr);
  g.fill();
  const hat = o.hat ?? 'none';
  if (hat !== 'none') {
    g.fillStyle = o.hatColor ?? col;
    g.beginPath();
    switch (hat) {
      case 'helmet':
        g.arc(hx, hy - hr * 0.1, hr * 1.2, Math.PI, 0);
        g.rect(hx - hr * 1.35, hy - hr * 0.15, hr * 2.7, hr * 0.25);
        break;
      case 'visor':
        g.arc(hx, hy, hr * 1.2, Math.PI, 0);
        break;
      case 'shako':
        g.rect(hx - hr * 0.85, hy - hr * 2.2, hr * 1.7, hr * 1.6);
        g.rect(hx - hr * 1.1, hy - hr * 0.75, hr * 2.2, hr * 0.3);
        break;
      case 'tri':
        g.moveTo(hx - hr * 1.6, hy - hr * 0.5);
        g.lineTo(hx, hy - hr * 1.9);
        g.lineTo(hx + hr * 1.6, hy - hr * 0.5);
        g.closePath();
        break;
      case 'cap':
        g.arc(hx, hy - hr * 0.25, hr * 1.05, Math.PI, 0);
        g.rect(hx - hr * 1.1, hy - hr * 0.6, hr * 2.2, hr * 0.4);
        g.rect(hx, hy - hr * 0.35, dir * hr * 1.4, hr * 0.25);
        break;
      case 'beanie':
        g.arc(hx, hy - hr * 0.05, hr * 1.08, Math.PI, 0);
        break;
      case 'hood':
        g.moveTo(hx - hr * 1.4, hy + hr * 1.3);
        g.quadraticCurveTo(hx - hr * 1.5, hy - hr * 1.7, hx, hy - hr * 2);
        g.quadraticCurveTo(hx + hr * 1.5, hy - hr * 1.7, hx + hr * 1.4, hy + hr * 1.3);
        g.closePath();
        break;
      case 'bobby':
        g.ellipse(hx, hy - hr * 0.6, hr * 1.0, hr * 1.55, 0, Math.PI, 0);
        g.rect(hx - hr * 1.2, hy - hr * 0.7, hr * 2.4, hr * 0.3);
        break;
      case 'brim':
        g.rect(hx - hr * 1.9, hy - hr * 0.75, hr * 3.8, hr * 0.32);
        g.rect(hx - hr * 0.9, hy - hr * 1.9, hr * 1.8, hr * 1.2);
        break;
    }
    g.fill();
    if (hat === 'visor') {
      g.fillStyle = '#62f6ff';
      g.fillRect(hx - hr * 0.2 + dir * hr * 0.3, hy - hr * 0.25, hr * 0.9 * dir, hr * 0.35);
    }
  }
  return FO;
}

/** Little green alien; (x, y) is between the feet. */
function alienFig(g: G, x: number, y: number, h: number, t: number, wave: boolean): void {
  const hr = h * 0.27;
  const hy = y - h + hr * 1.1;
  const col = '#78f05c';
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineWidth = Math.max(2, h * 0.08);
  g.beginPath();
  g.moveTo(x, y - h * 0.38);
  g.lineTo(x - h * 0.1, y);
  g.moveTo(x, y - h * 0.38);
  g.lineTo(x + h * 0.1, y);
  const wa = wave ? Math.sin(t * 10) * 0.5 : 0;
  g.moveTo(x, y - h * 0.5);
  g.lineTo(x - h * 0.2, y - h * 0.32);
  g.moveTo(x, y - h * 0.5);
  g.lineTo(x + Math.sin(2.4 + wa) * h * 0.28, y - h * 0.5 + Math.cos(2.4 + wa) * h * 0.28);
  g.stroke();
  g.beginPath();
  ell(g, x, y - h * 0.48, h * 0.11, h * 0.16);
  g.fill();
  // antenna
  g.lineWidth = Math.max(1.5, h * 0.035);
  const ax = x + Math.sin(t * 5) * h * 0.06;
  line(g, x, hy - hr, ax, hy - hr * 1.7);
  g.fillStyle = '#ff6af0';
  g.beginPath();
  circ(g, ax, hy - hr * 1.75, h * 0.055);
  g.fill();
  // head
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - hr, hy - hr * 0.1);
  g.bezierCurveTo(x - hr, hy - hr * 1.3, x + hr, hy - hr * 1.3, x + hr, hy - hr * 0.1);
  g.bezierCurveTo(x + hr, hy + hr * 0.6, x + hr * 0.25, hy + hr * 1.05, x, hy + hr * 1.05);
  g.bezierCurveTo(x - hr * 0.25, hy + hr * 1.05, x - hr, hy + hr * 0.6, x - hr, hy - hr * 0.1);
  g.fill();
  alienEyes(g, x, hy, hr);
}

function alienEyes(g: G, x: number, hy: number, hr: number): void {
  g.fillStyle = '#0b0b16';
  g.beginPath();
  ell(g, x - hr * 0.42, hy + hr * 0.08, hr * 0.36, hr * 0.2, 0.5);
  ell(g, x + hr * 0.42, hy + hr * 0.08, hr * 0.36, hr * 0.2, -0.5);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  circ(g, x - hr * 0.5, hy + hr * 0.02, hr * 0.07);
  circ(g, x + hr * 0.34, hy + hr * 0.02, hr * 0.07);
  g.fill();
}

const UFO_LIGHTS = ['#ff4d6d', '#ffd166', '#4cc9f0', '#7CFF6B'];
function saucer(g: G, x: number, y: number, r: number, t: number, alien = true, tint = '#c3cddd'): void {
  glow(g, x, y + r * 0.25, r * 1.25, 'rgba(120,255,190,0.35)');
  // dome
  g.fillStyle = 'rgba(150,225,255,0.45)';
  g.beginPath();
  g.ellipse(x, y - r * 0.12, r * 0.42, r * 0.46, 0, Math.PI, TAU);
  g.fill();
  if (alien) {
    const hr = r * 0.17;
    const hy = y - r * 0.28 + Math.sin(t * 4) * r * 0.02;
    g.fillStyle = '#78f05c';
    g.beginPath();
    ell(g, x, hy, hr, hr * 1.1);
    g.fill();
    alienEyes(g, x, hy, hr);
  }
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(1.5, r * 0.04);
  g.beginPath();
  g.ellipse(x, y - r * 0.12, r * 0.34, r * 0.38, 0, Math.PI * 1.15, Math.PI * 1.45);
  g.stroke();
  // hull
  g.fillStyle = '#5d6a80';
  g.beginPath();
  ell(g, x, y + r * 0.05, r, r * 0.27);
  g.fill();
  g.fillStyle = tint;
  g.beginPath();
  ell(g, x, y - r * 0.04, r * 0.95, r * 0.19);
  g.fill();
  g.fillStyle = '#9dffb8';
  g.beginPath();
  ell(g, x, y + r * 0.25, r * 0.32, r * 0.07);
  g.fill();
  // rotating rim lights (front half only)
  for (let i = 0; i < 10; i++) {
    const a = t * 2.6 + (i * TAU) / 10;
    const s = Math.sin(a);
    if (s < -0.15) continue;
    g.fillStyle = UFO_LIGHTS[(i + Math.floor(t * 5)) % 4];
    g.beginPath();
    circ(g, x + Math.cos(a) * r * 0.8, y + r * 0.06 + s * r * 0.13, r * 0.065 * (0.7 + 0.3 * s));
    g.fill();
  }
}

function tractorBeam(g: G, x: number, y: number, topR: number, botR: number, gy: number, k: number, t: number): void {
  if (k <= 0) return;
  const base = g.globalAlpha;
  const grad = g.createLinearGradient(0, y, 0, gy);
  grad.addColorStop(0, 'rgba(190,255,210,0.6)');
  grad.addColorStop(1, 'rgba(110,255,170,0.18)');
  g.globalAlpha = base * k * (0.85 + 0.15 * Math.sin(t * 31));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - topR, y);
  g.lineTo(x + topR, y);
  g.lineTo(x + botR, gy);
  g.lineTo(x - botR, gy);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(230,255,235,0.3)';
  const span2 = gy - y;
  for (let j = 0; j < 4; j++) {
    const yy = gy - ((t * 140 + (j * span2) / 4) % span2);
    const wid = lerp(topR, botR, (yy - y) / span2);
    g.fillRect(x - wid, yy, wid * 2, Math.max(2, span2 * 0.012));
  }
  g.fillStyle = 'rgba(190,255,210,0.45)';
  g.beginPath();
  ell(g, x, gy, botR, botR * 0.16);
  g.fill();
  g.globalAlpha = base;
}

/** Cartoon cow centred on its body; s = body length. */
function cow(g: G, x: number, y: number, s: number, rot: number, t: number, kick: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = '#2b2b2b';
  g.lineCap = 'round';
  g.lineWidth = Math.max(2, s * 0.08);
  const k = kick ? Math.sin(t * 14) * s * 0.08 : 0;
  g.beginPath();
  for (const lx of [-0.36, -0.2, 0.2, 0.34]) {
    g.moveTo(lx * s, s * 0.15);
    g.lineTo(lx * s + (lx > 0 ? k : -k), s * 0.42);
  }
  g.stroke();
  g.lineWidth = Math.max(1.5, s * 0.03);
  g.beginPath();
  g.moveTo(-s * 0.48, -s * 0.08);
  g.quadraticCurveTo(-s * 0.62, s * 0.05 + k, -s * 0.58, s * 0.2);
  g.stroke();
  g.fillStyle = '#f7f4ee';
  g.beginPath();
  rr(g, -s * 0.5, -s * 0.2, s, s * 0.4, s * 0.16);
  g.fill();
  g.fillStyle = '#ffb3c1';
  g.beginPath();
  ell(g, -s * 0.05, s * 0.2, s * 0.09, s * 0.05);
  g.fill();
  g.fillStyle = '#26262b';
  g.beginPath();
  ell(g, -s * 0.22, -s * 0.05, s * 0.14, s * 0.1, 0.4);
  ell(g, s * 0.18, s * 0.04, s * 0.1, s * 0.09, -0.3);
  ell(g, -s * 0.38, s * 0.1, s * 0.06, s * 0.05);
  g.fill();
  // head
  g.fillStyle = '#f7f4ee';
  g.beginPath();
  rr(g, s * 0.4, -s * 0.36, s * 0.28, s * 0.3, s * 0.1);
  g.fill();
  g.fillStyle = '#ffb3c1';
  g.beginPath();
  rr(g, s * 0.5, -s * 0.16, s * 0.22, s * 0.14, s * 0.06);
  g.fill();
  g.fillStyle = '#26262b';
  g.beginPath();
  circ(g, s * 0.52, -s * 0.27, s * 0.03);
  g.fill();
  g.fillStyle = '#e8dcc0';
  g.beginPath();
  g.moveTo(s * 0.44, -s * 0.34);
  g.lineTo(s * 0.4, -s * 0.46);
  g.lineTo(s * 0.49, -s * 0.36);
  g.fill();
  g.restore();
}

interface CarOpts {
  police?: boolean;
  hover?: boolean;
  t?: number;
  lights?: boolean;
}
/** Side-view car; (x, y) is the middle of the ground contact, len = body length. */
function car(g: G, x: number, y: number, len: number, dir: 1 | -1, body: string, o: CarOpts = {}): void {
  const t = o.t ?? 0;
  const wr = len * 0.11;
  const lift = o.hover ? wr * 1.4 + Math.sin(t * 3) * wr * 0.2 : wr * 0.85;
  const by = y - lift;
  const bh = len * 0.17;
  g.save();
  g.translate(x, by);
  g.scale(dir, 1);
  if (o.hover) glow(g, 0, lift * 0.7, len * 0.55, 'rgba(90,240,255,0.55)');
  g.fillStyle = body;
  g.beginPath();
  rr(g, -len / 2, -bh, len, bh, bh * 0.35);
  g.fill();
  g.beginPath();
  g.moveTo(-len * 0.34, -bh + 1);
  g.lineTo(-len * 0.22, -bh * 2.05);
  g.lineTo(len * 0.12, -bh * 2.05);
  g.lineTo(len * 0.3, -bh + 1);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(180,220,255,0.9)';
  g.beginPath();
  g.moveTo(-len * 0.29, -bh * 1.1);
  g.lineTo(-len * 0.2, -bh * 1.88);
  g.lineTo(-len * 0.06, -bh * 1.88);
  g.lineTo(-len * 0.06, -bh * 1.1);
  g.closePath();
  g.moveTo(-len * 0.02, -bh * 1.1);
  g.lineTo(-len * 0.02, -bh * 1.88);
  g.lineTo(len * 0.1, -bh * 1.88);
  g.lineTo(len * 0.24, -bh * 1.1);
  g.closePath();
  g.fill();
  if (o.police) {
    g.fillStyle = '#1d2b5a';
    g.fillRect(-len * 0.42, -bh * 0.75, len * 0.84, bh * 0.35);
    const on = Math.floor(t * 8) % 2 === 0;
    g.fillStyle = on ? '#ff2b3b' : '#5a1218';
    g.fillRect(-len * 0.14, -bh * 2.35, len * 0.12, bh * 0.3);
    g.fillStyle = on ? '#1c2c70' : '#2f7bff';
    g.fillRect(0, -bh * 2.35, len * 0.12, bh * 0.3);
  }
  // lights
  g.fillStyle = '#fff2b0';
  g.fillRect(len * 0.44, -bh * 0.8, len * 0.06, bh * 0.3);
  g.fillStyle = '#ff4040';
  g.fillRect(-len * 0.5, -bh * 0.8, len * 0.04, bh * 0.3);
  if (!o.hover) {
    g.fillStyle = '#15151b';
    g.beginPath();
    circ(g, -len * 0.3, 0, wr);
    circ(g, len * 0.3, 0, wr);
    g.fill();
    g.fillStyle = '#9aa3b2';
    g.beginPath();
    circ(g, -len * 0.3, 0, wr * 0.45);
    circ(g, len * 0.3, 0, wr * 0.45);
    g.fill();
  }
  g.restore();
}

function tank(g: G, x: number, y: number, s: number, dir: 1 | -1, col: string, hover: boolean, t: number): void {
  g.save();
  g.translate(x, y - (hover ? s * 0.08 + Math.sin(t * 3) * s * 0.01 : 0));
  g.scale(dir, 1);
  if (hover) glow(g, 0, s * 0.06, s * 0.5, 'rgba(90,240,255,0.5)');
  g.fillStyle = '#16181a';
  g.beginPath();
  rr(g, -s * 0.5, -s * 0.15, s, s * 0.15, s * 0.07);
  g.fill();
  g.fillStyle = '#3a3f3a';
  g.beginPath();
  for (let i = 0; i < 6; i++) circ(g, -s * 0.4 + i * s * 0.16, -s * 0.07, s * 0.045);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.15);
  g.lineTo(-s * 0.42, -s * 0.28);
  g.lineTo(s * 0.42, -s * 0.28);
  g.lineTo(s * 0.52, -s * 0.15);
  g.closePath();
  g.fill();
  g.beginPath();
  rr(g, -s * 0.24, -s * 0.42, s * 0.42, s * 0.16, s * 0.06);
  g.fill();
  g.fillRect(s * 0.14, -s * 0.37, s * 0.48, s * 0.045);
  g.restore();
}

function aircraft(g: G, x: number, y: number, s: number, dir: 1 | -1, ei: number, col: string, t: number): void {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = col;
  g.strokeStyle = col;
  if (ei <= 3) {
    // biplane
    g.beginPath();
    rr(g, -s * 0.5, -s * 0.07, s, s * 0.14, s * 0.07);
    g.fill();
    g.fillRect(-s * 0.12, -s * 0.24, s * 0.34, s * 0.05);
    g.fillRect(-s * 0.12, s * 0.04, s * 0.34, s * 0.05);
    g.lineWidth = Math.max(1.5, s * 0.02);
    line(g, -s * 0.06, -s * 0.2, -s * 0.06, s * 0.05);
    line(g, s * 0.16, -s * 0.2, s * 0.16, s * 0.05);
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.05);
    g.lineTo(-s * 0.58, -s * 0.2);
    g.lineTo(-s * 0.42, -s * 0.06);
    g.fill();
    const pr = Math.abs(Math.sin(t * 40)) * s * 0.16;
    g.fillRect(s * 0.5, -pr, s * 0.03, pr * 2);
  } else if (ei === 4) {
    g.beginPath();
    g.moveTo(s * 0.55, 0);
    g.lineTo(s * 0.2, -s * 0.06);
    g.lineTo(-s * 0.05, -s * 0.06);
    g.lineTo(-s * 0.3, -s * 0.32);
    g.lineTo(-s * 0.4, -s * 0.32);
    g.lineTo(-s * 0.3, -s * 0.05);
    g.lineTo(-s * 0.5, -s * 0.05);
    g.lineTo(-s * 0.6, -s * 0.2);
    g.lineTo(-s * 0.66, -s * 0.2);
    g.lineTo(-s * 0.6, s * 0.05);
    g.lineTo(-s * 0.1, s * 0.06);
    g.lineTo(-s * 0.3, s * 0.2);
    g.lineTo(-s * 0.18, s * 0.2);
    g.lineTo(s * 0.12, s * 0.06);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,200,120,0.9)';
    g.beginPath();
    ell(g, -s * 0.66, 0, s * 0.08, s * 0.03);
    g.fill();
  } else {
    // drone
    g.beginPath();
    ell(g, 0, 0, s * 0.3, s * 0.1);
    g.fill();
    g.fillRect(-s * 0.55, -s * 0.06, s * 1.1, s * 0.04);
    g.fillStyle = 'rgba(160,240,255,0.6)';
    g.beginPath();
    ell(g, -s * 0.55, -s * 0.07, s * 0.16, s * 0.03);
    ell(g, s * 0.55, -s * 0.07, s * 0.16, s * 0.03);
    g.fill();
    g.fillStyle = '#ff3b5c';
    g.beginPath();
    circ(g, s * 0.12, s * 0.02, s * 0.045);
    g.fill();
  }
  g.restore();
}

/** Era-aware building; (x, y) bottom centre. */
function building(g: G, x: number, y: number, w: number, h: number, ei: number, wall: string, roof: string, win: string | null, seed: number, lit: number): void {
  g.fillStyle = wall;
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = roof;
  g.beginPath();
  if (ei <= 2) {
    g.moveTo(x - w / 2 - w * 0.08, y - h);
    g.lineTo(x, y - h - w * 0.45);
    g.lineTo(x + w / 2 + w * 0.08, y - h);
    g.closePath();
  } else if (ei === 3) {
    g.rect(x - w / 2 - 3, y - h - 6, w + 6, 8);
    g.rect(x + w * 0.22, y - h - w * 0.45, w * 0.12, w * 0.45);
  } else if (ei === 4) {
    g.rect(x - w / 2 - 2, y - h - 5, w + 4, 6);
    g.rect(x - 1.5, y - h - w * 0.35, 3, w * 0.35);
  } else {
    g.moveTo(x - w / 2, y - h);
    g.lineTo(x, y - h - w * 0.5);
    g.lineTo(x + w / 2, y - h);
    g.closePath();
  }
  g.fill();
  if (!win) return;
  const r = makeRand(seed);
  const cols = Math.max(2, Math.round(w / 28));
  const rows = Math.max(1, Math.floor((h - 14) / 30));
  const cw = w / cols;
  const ww = Math.min(cw * 0.5, 14);
  const wh = Math.min(16, 30 * 0.55);
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      g.fillStyle = r() < lit ? win : 'rgba(0,0,0,0.35)';
      g.fillRect(x - w / 2 + cw * (cx + 0.5) - ww / 2, y - h + 12 + cy * 30, ww, wh);
    }
  }
}

// ------------------------------------------------------------------ explosions

interface Boom {
  x: number;
  y: number;
  r: number;
  t0: number;
  life: number;
}
interface BoomOpts {
  sparks?: number;
  debris?: number;
  smoke?: number;
  debrisColor?: string;
  life?: number;
}
function addBoom(f: SceneFrame, x: number, y: number, r: number, o: BoomOpts = {}): void {
  const list = once(f.mem, 'booms', (): Boom[] => []);
  list.push({ x, y, r, t0: f.t, life: o.life ?? 0.9 });
  const ps = particles(f.mem);
  const R = f.rand;
  for (let i = 0; i < (o.sparks ?? 14); i++) {
    const a = -Math.PI * R();
    const sp = r * (3 + R() * 7);
    add(ps, P(x, y - r * 0.2, Math.cos(a) * sp, Math.sin(a) * sp, 0.4 + R() * 0.5, Math.max(1.5, r * 0.05 + R() * r * 0.05), R.pick(['#fff3b0', '#ffc145', '#ff7a1a']), 1));
  }
  for (let i = 0; i < (o.debris ?? 8); i++) {
    const a = -Math.PI * (0.1 + 0.8 * R());
    const sp = r * (5 + R() * 9);
    add(ps, P(x, y - r * 0.2, Math.cos(a) * sp, Math.sin(a) * sp, 0.9 + R() * 0.6, r * (0.06 + R() * 0.1), o.debrisColor ?? '#2b211c', 2, R() * TAU, (R() - 0.5) * 14));
  }
  for (let i = 0; i < (o.smoke ?? 6); i++) {
    add(ps, P(x + (R() - 0.5) * r, y - R() * r * 0.6, (R() - 0.5) * r * 0.8, -r * (0.6 + R() * 1.2), 1.6 + R() * 1.2, r * (0.45 + R() * 0.4), R.pick(['#4b4141', '#5e5453', '#3b3434']), 3));
  }
}

function drawBooms(g: G, f: SceneFrame): void {
  const list = f.mem.booms as Boom[] | undefined;
  if (!list) return;
  const base = g.globalAlpha;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    const k = (f.t - b.t0) / b.life;
    if (k > 1) {
      list.splice(i, 1);
      continue;
    }
    if (k < 0) continue;
    glow(g, b.x, b.y - b.r * 0.3, b.r * (3 - k * 1.2), 'rgba(255,180,80,0.8)', 1 - k);
    const R = b.r * easeOut(Math.min(1, k * 2.6));
    g.globalAlpha = base * (1 - easeIn(k));
    g.fillStyle = '#ff5a1f';
    g.beginPath();
    circ(g, b.x, b.y - R * 0.25, R);
    circ(g, b.x - R * 0.55, b.y - R * 0.05, R * 0.6);
    circ(g, b.x + R * 0.6, b.y - R * 0.1, R * 0.55);
    g.fill();
    g.fillStyle = '#ffa92b';
    g.beginPath();
    circ(g, b.x, b.y - R * 0.32, R * 0.68);
    g.fill();
    g.globalAlpha = base * clamp(1 - k * 2.2);
    g.fillStyle = '#fff4c4';
    g.beginPath();
    circ(g, b.x, b.y - R * 0.35, R * 0.4);
    g.fill();
    g.globalAlpha = base;
    ring(g, b.x, b.y - b.r * 0.2, b.r * (0.8 + k * 2.6), Math.max(1.5, b.r * 0.08), '#fff2d0', (1 - k) * 0.7);
  }
  g.globalAlpha = base;
}

/** Long horizontal rain streaks drawn in one path. */
interface RainState {
  x: Float32Array;
  y: Float32Array;
  v: Float32Array;
}
function rain(f: SceneFrame, n: number, wind: number, color: string, len: number, lw: number, bottom: number): void {
  const { g, L } = f;
  const R = once(f.mem, 'rain', (): RainState => {
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = f.rand() * (L.w + 300) - 150;
      y[i] = f.rand() * bottom;
      v[i] = 900 + f.rand() * 600;
    }
    return { x, y, v };
  });
  const kx = wind / 1000;
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'butt';
  g.beginPath();
  for (let i = 0; i < n; i++) {
    R.y[i] += R.v[i] * f.dt;
    R.x[i] += kx * R.v[i] * f.dt;
    if (R.y[i] > bottom) {
      R.y[i] -= bottom + len;
      R.x[i] = f.rand() * (L.w + 300) - 150;
    }
    const x = R.x[i];
    const y = R.y[i];
    g.moveTo(x, y);
    g.lineTo(x - kx * len, y - len);
  }
  g.stroke();
}

// ================================================================== ALIENS

const ALIEN_ZAPS = [1.05, 1.38, 1.7, 1.98, 2.24, 2.52, 2.8, 3.06];
interface Ship {
  x: number;
  y: number;
  r: number;
  d: number;
  from: number;
}
function shipPos(s: Ship, i: number, t: number, L: Layout, u: number, out: [number, number, number]): void {
  const kIn = easeOut(clamp((t - s.d) / 1.1));
  const kOut = easeIn(clamp((t - 3.4 - i * 0.09) / 0.7));
  out[0] = lerp(s.x + s.from * L.w * 0.55, s.x, kIn) + Math.sin(t * 1.7 + i) * 9 * u - s.from * kOut * L.w * 0.5;
  out[1] = lerp(-s.r * 2.5, s.y, kIn) + Math.sin(t * 2.4 + i * 2) * 6 * u - kOut * L.h;
  out[2] = kOut;
}

function laser(g: G, x0: number, y0: number, x1: number, y1: number, w: number, a: number): void {
  const base = g.globalAlpha;
  g.lineCap = 'round';
  g.globalAlpha = base * a * 0.55;
  g.strokeStyle = '#ff3d8b';
  g.lineWidth = w * 3.2;
  line(g, x0, y0, x1, y1);
  g.globalAlpha = base * a;
  g.strokeStyle = '#ffffff';
  g.lineWidth = w;
  line(g, x0, y0, x1, y1);
  g.globalAlpha = base;
}

const aliens = mk(
  4.5,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    sky(g, L, ['#04021a', '#170a3a', '#2c1360', '#16454c']);
    starfield(g, L, 90, 3, t, FY * 0.85);
    const attack = t > 1.0 && t < 3.4;
    const blackout = t > 2.3 && t < 2.6;
    const fl = blackout ? 0.05 : attack && Math.sin(t * 41) * Math.sin(t * 13.7) < -0.3 ? 0.25 : 0.9;
    skyline(g, L, FY - 36 * u, era, '#2a1d55', 12);
    skyline(g, L, FY, era, '#0e0a24', 5, `rgba(255,214,110,${fl})`);
    floor(g, L, FY, '#0a0718');

    const ships = once(f.mem, 'ships', (): Ship[] => {
      const [a, b] = pair(L, 0.25);
      const o1 = L.portrait ? L.w * 0.5 : L.slots[2];
      const o2 = L.portrait ? L.w * 0.14 : L.slots[3];
      return [
        { x: a, y: FY * 0.36, r: 72 * u, d: 0.0, from: -1 },
        { x: b, y: FY * 0.3, r: 72 * u, d: 0.18, from: 1 },
        { x: o1, y: FY * 0.11, r: 38 * u, d: 0.45, from: -1 },
        { x: o2, y: FY * (L.portrait ? 0.14 : 0.13), r: 32 * u, d: 0.6, from: 1 },
      ];
    });
    const pos = once(f.mem, 'pos', (): [number, number, number][] => ships.map(() => [0, 0, 0]));
    for (let i = 0; i < ships.length; i++) shipPos(ships[i], i, t, L, u, pos[i]);

    // tractor beams and abductees
    const bi = clamp((t - 1.2) / 0.2) * clamp((3.25 - t) / 0.2);
    const lift = span(t, 1.4, 3.1);
    for (let i = 0; i < 2; i++) {
      const [x, y] = pos[i];
      const r = ships[i].r;
      tractorBeam(g, x, y + r * 0.24, r * 0.26, r * 1.05, FY + 4 * u, bi, t + i);
    }
    if (t < 3.12) {
      for (let i = 0; i < 2; i++) {
        const [x, y] = pos[i];
        const r = ships[i].r;
        const ox = t > 1.4 ? lerp(ships[i].x, x, lift) : ships[i].x;
        const sc = 1 - 0.6 * clamp((lift - 0.75) / 0.25);
        if (i === 0) {
          const s = 70 * u * sc;
          const oy = lerp(FY - s * 0.62, y + r * 0.45, lift);
          cow(g, ox, oy, s, t > 1.4 ? Math.sin(t * 2.2) * 0.45 * lift : 0, t, t > 1.4);
        } else {
          const len = 104 * u * sc;
          const oy = lerp(FY, y + r * 0.55, lift);
          g.save();
          g.translate(ox, oy - len * 0.2);
          g.rotate(t > 1.4 ? -Math.sin(t * 1.8) * 0.5 * lift : 0);
          car(g, 0, len * 0.2, len, -1, '#e84a5f', { t });
          g.restore();
        }
      }
    }

    // ground aliens popping in and waving
    const gx = once(f.mem, 'gx', () => (L.portrait ? [L.w * 0.5] : [L.slots[0] + 150 * u, L.slots[1] - 150 * u]));
    if (t > 0.9 && t < 3.35) {
      const pop = easeOut(clamp((t - 0.9) / 0.35)) * (1 - easeIn(clamp((t - 3.1) / 0.25)));
      for (let i = 0; i < gx.length; i++) {
        if (pop < 0.95) glow(g, gx[i], FY - 30 * u, 60 * u, 'rgba(140,255,160,0.8)', 1 - pop);
        alienFig(g, gx[i], FY, 58 * u * pop, t + i, true);
      }
    }

    // saucers, far ones first
    for (const i of [3, 2, 0, 1]) {
      const [x, y, kOut] = pos[i];
      const r = ships[i].r;
      if (kOut > 0.02) {
        const base = g.globalAlpha;
        g.globalAlpha = base * 0.35 * (1 - kOut * 0.5);
        g.strokeStyle = '#b6ffd8';
        g.lineWidth = r * 0.5;
        g.lineCap = 'round';
        line(g, x, y, x + ships[i].from * kOut * L.w * 0.18, y + kOut * L.h * 0.35);
        g.globalAlpha = base;
      }
      saucer(g, x, y, r, t * (1 + i * 0.2) + i, true);
    }

    // laser zaps
    const zaps = once(f.mem, 'zaps', () => ALIEN_ZAPS.map((tz, i) => ({ tz, s: i % 4 === 3 ? 2 + (i % 8 === 7 ? 1 : 0) : i % 2, dx: (f.rand() - 0.5) * 2 })));
    for (let i = 0; i < zaps.length; i++) {
      const z = zaps[i];
      const d = t - z.tz;
      if (d < 0 || d > 0.2) continue;
      const [sx, sy] = pos[z.s];
      const tx = clamp(ships[z.s].x + z.dx * 160 * u, 20, L.w - 20);
      if (d < 0.16) laser(g, sx, sy + ships[z.s].r * 0.2, tx, FY - 2 * u, 3 * u, 1 - d / 0.16);
      if (at(f, 'zb' + i, z.tz + 0.06)) addBoom(f, tx, FY, 26 * u, { sparks: 12, debris: 6, smoke: 4, life: 0.6 });
    }
    drawBooms(g, f);
    const ps = particles(f.mem);
    stepParts(ps, f.dt, 600 * u);
    drawParts(g, ps);
  },
  (t) => impulses(ALIEN_ZAPS.map((z) => z + 0.06), 5, 0.3)(t) + (t > 1 && t < 3.3 ? 1.2 : 0),
);

// ================================================================== UFO

const ufo = mk(3.6, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#020410', '#0a1432', '#1a2a4e', '#243248']);
  starfield(g, L, 130, 9, t, FY * 0.9);
  const mx = L.portrait ? L.w * 0.82 : L.slots[1] + 80 * u;
  glow(g, mx, FY * 0.2, 90 * u, 'rgba(240,235,200,0.35)');
  g.fillStyle = '#f2eed8';
  g.beginPath();
  circ(g, mx, FY * 0.2, 26 * u);
  g.fill();
  g.fillStyle = 'rgba(30,40,70,0.25)';
  g.beginPath();
  circ(g, mx + 8 * u, FY * 0.2 - 6 * u, 6 * u);
  circ(g, mx - 9 * u, FY * 0.2 + 7 * u, 4 * u);
  g.fill();
  // rolling hills
  g.fillStyle = '#0f1d2c';
  g.beginPath();
  g.moveTo(0, L.h);
  for (let x = 0; x <= L.w + 20; x += 20) g.lineTo(x, FY - 40 * u - Math.sin(x * 0.006 + 1) * 26 * u - Math.sin(x * 0.017) * 8 * u);
  g.lineTo(L.w, L.h);
  g.fill();
  g.fillStyle = '#08121c';
  g.beginPath();
  g.moveTo(0, L.h);
  for (let x = 0; x <= L.w + 20; x += 20) g.lineTo(x, FY - 6 * u - Math.sin(x * 0.009 + 3) * 12 * u);
  g.lineTo(L.w, L.h);
  g.fill();
  // farmhouse with a lit window
  const hx = L.portrait ? L.w * 0.78 : L.slots[1] - 40 * u;
  const hy = FY - 6 * u;
  g.fillStyle = '#060c14';
  g.fillRect(hx - 34 * u, hy - 44 * u, 68 * u, 44 * u);
  g.beginPath();
  g.moveTo(hx - 42 * u, hy - 44 * u);
  g.lineTo(hx, hy - 74 * u);
  g.lineTo(hx + 42 * u, hy - 44 * u);
  g.fill();
  g.fillStyle = '#ffd36b';
  g.fillRect(hx - 18 * u, hy - 32 * u, 12 * u, 12 * u);
  glow(g, hx - 12 * u, hy - 26 * u, 30 * u, 'rgba(255,200,100,0.5)');
  // fence
  g.strokeStyle = '#06101a';
  g.lineWidth = 3 * u;
  g.beginPath();
  for (let x = 6; x < L.w; x += 34 * u) {
    if (hidden(L, x)) continue;
    g.moveTo(x, FY + 2 * u);
    g.lineTo(x, FY - 22 * u);
  }
  g.moveTo(0, FY - 16 * u);
  g.lineTo(L.w, FY - 16 * u);
  g.stroke();

  // saucer path: drift in, hover and beam, zip away
  const r = 58 * u;
  const xh = mainX(L);
  const yh = FY * 0.42;
  let x: number;
  let y: number;
  let zip = 0;
  if (t < 1.25) {
    const k = easeOut(t / 1.25);
    x = lerp(-r * 2, xh, k);
    y = lerp(FY * 0.12, yh, k);
  } else if (t < 2.4) {
    x = xh + Math.sin((t - 1.25) * 3) * 6 * u;
    y = yh + Math.sin(t * 2.5) * 5 * u;
  } else {
    zip = easeIn(clamp((t - 2.4) / 0.6));
    x = lerp(xh, L.w + r * 3, zip);
    y = yh - zip * FY * 0.35;
  }
  const beamK = clamp((t - 1.35) / 0.15) * clamp((2.3 - t) / 0.12);
  tractorBeam(g, x, y + r * 0.24, r * 0.25, r * 0.95, FY - 2 * u, beamK, t);
  // a curious cow that floats up a bit and plops back down
  const cs = 52 * u;
  const cy0 = FY - cs * 0.62;
  const cx = xh + 10 * u;
  let cy = cy0;
  if (t > 1.45 && t < 2.3) cy = cy0 - easeInOut((t - 1.45) / 0.85) * FY * 0.16;
  else if (t >= 2.3) {
    const top = cy0 - FY * 0.16;
    const dtt = t - 2.3;
    cy = Math.min(cy0, top + 0.5 * 1800 * u * dtt * dtt);
    if (cy >= cy0 && at(f, 'plop', t)) {
      const ps = particles(f.mem);
      for (let i = 0; i < 10; i++) add(ps, P(cx + (f.rand() - 0.5) * cs, FY, (f.rand() - 0.5) * 120 * u, -f.rand() * 40 * u, 0.9, 10 * u, '#2c3a3a', 3));
    }
  }
  cow(g, cx, cy, cs, t > 1.45 && t < 2.6 && cy < cy0 ? Math.sin(t * 3) * 0.3 : 0, t, cy < cy0);
  if (beamK > 0) {
    const ps = particles(f.mem);
    emit(f, 'sp', 30 * beamK, () => add(ps, P(x + (f.rand() - 0.5) * r * 1.4, FY - 4 * u, 0, -(60 + f.rand() * 80) * u, 1.2, 2 * u, '#d8ffe4', 0)));
  }
  if (zip > 0.02) {
    const base = g.globalAlpha;
    g.globalAlpha = base * 0.35;
    g.strokeStyle = '#c6ffe0';
    g.lineWidth = r * 0.45;
    g.lineCap = 'round';
    line(g, x, y, x - zip * L.w * 0.3, y + zip * FY * 0.12);
    g.globalAlpha = base;
  }
  saucer(g, x, y, r, t, true);
  const ps = particles(f.mem);
  stepParts(ps, f.dt, 0);
  drawParts(g, ps);
});

// ================================================================== WAR

const WAR_BOOMS = [0.55, 1.1, 1.6, 2.1, 2.6, 3.15];

function soldier(g: G, x: number, y: number, h: number, ei: number, dir: 1 | -1, ph: number, col: string, acc: string): void {
  if (ei <= 1) {
    const swing = 1.5 + Math.sin(ph * 9) * 0.9;
    const o = fig(g, x, y, h, col, { dir, walk: ph * 0.6, armF: swing, armB: 0.9, hat: 'helmet', hatColor: ei === 0 ? '#b8862d' : '#6d7280' });
    // sword along the fighting arm
    const b = swing + 0.5;
    g.strokeStyle = '#e4e8f0';
    g.lineWidth = Math.max(2, h * 0.04);
    line(g, o.fx, o.fy, o.fx + dir * Math.sin(b) * h * 0.42, o.fy + Math.cos(b) * h * 0.42);
    g.fillStyle = acc;
    g.beginPath();
    if (ei === 0) circ(g, x + dir * h * 0.1, y - h * 0.55, h * 0.17);
    else {
      const sx = x + dir * h * 0.12;
      const sy = y - h * 0.68;
      g.moveTo(sx - h * 0.13, sy);
      g.lineTo(sx + h * 0.13, sy);
      g.lineTo(sx + h * 0.11, sy + h * 0.18);
      g.lineTo(sx, sy + h * 0.32);
      g.lineTo(sx - h * 0.11, sy + h * 0.18);
      g.closePath();
    }
    g.fill();
  } else if (ei === 2) {
    const o = fig(g, x, y, h, col, { dir, walk: ph, armF: 0.6, armB: -0.3, hat: 'tri' });
    g.strokeStyle = '#3a2614';
    g.lineWidth = Math.max(2, h * 0.04);
    line(g, o.fx - dir * h * 0.02, o.fy + h * 0.06, o.fx + dir * h * 0.1, o.fy - h * 0.62);
    g.strokeStyle = '#d8dde6';
    g.lineWidth = Math.max(1, h * 0.02);
    line(g, o.fx + dir * h * 0.1, o.fy - h * 0.62, o.fx + dir * h * 0.115, o.fy - h * 0.76);
  } else {
    const o = fig(g, x, y, h, col, { dir, walk: ph, armF: 1.35, armB: 1.0, hat: ei === 5 ? 'visor' : 'helmet', hatColor: ei === 3 ? '#4a4d38' : ei === 4 ? '#3c4a2c' : '#2d3442' });
    g.strokeStyle = ei === 5 ? '#c9d6e8' : '#111111';
    g.lineWidth = Math.max(2, h * 0.05);
    line(g, o.sx - dir * h * 0.08, o.sy + h * 0.06, o.sx + dir * h * 0.4, o.sy + h * 0.02);
  }
}

const war = mk(
  4.0,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    const ei = ERA_I[era];
    const melee = ei <= 1;
    sky(g, L, ei <= 2 ? ['#24121a', '#5e2620', '#b85a2a', '#e8a24c'] : ['#121018', '#33202a', '#7e3424', '#cf6a2e']);
    const ps = particles(f.mem);
    const bg = particles(f.mem, 'bg');
    // burning spots on the skyline and their smoke
    const fires = once(f.mem, 'fires', () => [visX(L, f.rand, 60), visX(L, f.rand, 60), visX(L, f.rand, 60)]);
    emit(f, 'smk', 9, () => {
      const x = fires[Math.floor(f.rand() * fires.length)];
      add(bg, P(x + (f.rand() - 0.5) * 30 * u, FY - 80 * u, (f.rand() - 0.2) * 25 * u, -(30 + f.rand() * 30) * u, 3, (24 + f.rand() * 18) * u, f.rand.pick(['#3a2a28', '#4a3633', '#2e2222']), 3));
    });
    stepParts(bg, f.dt, 0);
    drawParts(g, bg);
    skyline(g, L, FY - 4 * u, era, '#2b1511', 31);
    for (let i = 0; i < fires.length; i++) {
      glow(g, fires[i], FY - 40 * u, 90 * u, 'rgba(255,120,40,0.5)');
      flame(g, fires[i], FY - 10 * u, 34 * u, (70 + 25 * (i % 2)) * u, t, i * 3.1);
    }
    floor(g, L, FY, '#21140e');

    // aircraft overhead (industrial onwards)
    if (ei >= 3) {
      for (let i = 0; i < 2; i++) {
        const dir: 1 | -1 = i ? -1 : 1;
        const speed = (ei === 3 ? 160 : ei === 4 ? 620 : 260) * u;
        const span2 = L.w + 400 * u;
        let x = ((t * speed + i * span2 * 0.5) % span2) - 200 * u;
        if (dir < 0) x = L.w - x;
        const y = FY * (0.12 + i * 0.12) + Math.sin(t * 2 + i) * 6 * u;
        if (ei === 4) {
          const base = g.globalAlpha;
          g.globalAlpha = base * 0.5;
          g.strokeStyle = '#f0e6dc';
          g.lineWidth = 3 * u;
          line(g, x, y, x - dir * 260 * u, y);
          g.globalAlpha = base;
        }
        aircraft(g, x, y, 80 * u, dir, ei, '#17131a', t);
      }
    }

    const [ax, bx] = pair(L, 0.24);
    const n = L.portrait ? 3 : 5;
    const H = (L.portrait ? 66 : 82) * u;
    const sp = (L.portrait ? 30 : 42) * u;
    // tanks behind the infantry
    if (ei >= 4) {
      const tf = [0.9, 2.0, 3.0];
      for (let side = 0; side < 2; side++) {
        const dir: 1 | -1 = side ? -1 : 1;
        const tx = (side ? bx + 95 * u : ax - 95 * u) + dir * t * 6 * u;
        const s = (L.portrait ? 110 : 150) * u;
        const ty = FY - 14 * u;
        tank(g, tx, ty, s, dir, ei === 5 ? '#34404e' : '#3b4430', ei === 5, t);
        for (const tz of tf) {
          const d = t - tz - side * 0.45;
          if (d >= 0 && d < 0.18) {
            const mx = tx + dir * s * 0.64;
            const my = ty - s * 0.35;
            glow(g, mx, my, 40 * u, 'rgba(255,220,120,0.95)', 1 - d / 0.18);
            if (at(f, `tm${side}${tz}`, tz + side * 0.45)) {
              for (let k = 0; k < 4; k++) add(ps, P(mx, my, dir * (40 + f.rand() * 40) * u, -f.rand() * 30 * u, 1.4, 14 * u, '#6b6260', 3));
            }
          }
        }
      }
    }
    // armies
    for (let side = 0; side < 2; side++) {
      const dir: 1 | -1 = side ? -1 : 1;
      const cx = (side ? bx : ax) + dir * Math.min(t, 3) * 7 * u;
      const col = side ? '#1b1712' : '#18131c';
      const acc = side ? '#3d6fb0' : '#b0403d';
      if (ei <= 2) flag(g, cx - dir * sp * (n / 2 + 0.3), FY, H * 1.5, acc, t, side * 2, '#f2d36b');
      for (let i = 0; i < n; i++) {
        const x = cx + (i - (n - 1) / 2) * sp;
        soldier(g, x, FY + (i % 2) * 4 * u, H * (i % 2 ? 0.94 : 1), ei, dir, t + i * 0.37 + side * 0.2, col, acc);
      }
    }

    // projectiles
    if (melee) {
      const vols = [0.2, 0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0];
      for (let vi = 0; vi < vols.length; vi++) {
        if (!at(f, 'v' + vi, vols[vi])) continue;
        const fromL = vi % 2 === 0;
        const x0c = fromL ? ax : bx;
        const x1c = fromL ? bx : ax;
        for (let k = 0; k < (L.portrait ? 7 : 12); k++) {
          const x0 = x0c + (f.rand() - 0.5) * sp * n;
          const y0 = FY - H * 0.85;
          const x1 = x1c + (f.rand() - 0.5) * sp * n * 1.3;
          const T = (L.portrait ? 0.8 : 1.15) + f.rand() * 0.2;
          const grav = 700 * u;
          add(ps, P(x0, y0, (x1 - x0) / T, (FY - y0 - 0.5 * grav * T * T) / T, T + 0.8, f.rand() < 0.3 ? 1 : 0, '#1a120c', 4));
        }
      }
      // arrows: fly, then stick in the ground
      g.lineCap = 'round';
      const base = g.globalAlpha;
      for (const p of ps) {
        if (p.kind !== 4) continue;
        if (p.y >= FY + 2 * u && p.vy > 0) {
          p.rot = Math.atan2(p.vy, p.vx);
          p.vx = 0;
          p.vy = 0;
          p.kind = 5;
        }
      }
      g.strokeStyle = '#1a110b';
      g.lineWidth = 2.6 * u;
      g.beginPath();
      for (const p of ps) {
        if (p.kind !== 4 && p.kind !== 5) continue;
        const a = p.kind === 4 ? Math.atan2(p.vy, p.vx) : p.rot ?? 0;
        const len = 26 * u;
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
      }
      g.stroke();
      g.fillStyle = '#ffb030';
      for (const p of ps) {
        if (p.kind !== 4 || p.size < 1) continue;
        g.globalAlpha = base * 0.9;
        g.beginPath();
        circ(g, p.x, p.y, 4 * u);
        g.fill();
      }
      g.globalAlpha = base;
    } else if (ei === 2) {
      // cannons and musket volleys
      const cxs = L.portrait ? [L.w * 0.08, L.w * 0.92] : [ax - sp * n * 0.5 - 70 * u, bx + sp * n * 0.5 + 70 * u];
      for (let side = 0; side < 2; side++) {
        const dir: 1 | -1 = side ? -1 : 1;
        const x = cxs[side];
        g.save();
        g.translate(x, FY - 16 * u);
        g.scale(dir, 1);
        g.fillStyle = '#1d1712';
        g.save();
        g.rotate(-0.35);
        g.fillRect(-10 * u, -9 * u, 58 * u, 18 * u);
        g.restore();
        g.strokeStyle = '#3a2a1a';
        g.lineWidth = 5 * u;
        g.beginPath();
        circ(g, 0, 4 * u, 14 * u);
        g.stroke();
        g.restore();
      }
      const shots = [0.35, 0.95, 1.6, 2.25, 2.9];
      for (let i = 0; i < shots.length; i++) {
        if (!at(f, 'c' + i, shots[i])) continue;
        const side = i % 2;
        const dir = side ? -1 : 1;
        const mx = cxs[side] + dir * 46 * u;
        const my = FY - 36 * u;
        for (let k = 0; k < 7; k++) add(ps, P(mx, my, dir * (30 + f.rand() * 60) * u, -(10 + f.rand() * 30) * u, 1.6, (16 + f.rand() * 10) * u, '#efe8dc', 3));
        const tx = (side ? ax : bx) + (f.rand() - 0.5) * sp * 2;
        const T = L.portrait ? 0.7 : 1.0;
        const grav = 700 * u;
        add(ps, P(mx, my, (tx - mx) / T, (FY - my - 0.5 * grav * T * T) / T, T, 6 * u, '#0e0b09', 6));
      }
      const vol = [0.75, 1.3, 1.95, 2.6];
      for (let i = 0; i < vol.length; i++) {
        if (!at(f, 'm' + i, vol[i])) continue;
        const side = i % 2;
        const dir = side ? -1 : 1;
        const cx = (side ? bx : ax) + dir * Math.min(t, 3) * 7 * u;
        for (let k = 0; k < n; k++) {
          const x = cx + (k - (n - 1) / 2) * sp + dir * H * 0.12;
          add(ps, P(x, FY - H * 1.35, dir * 30 * u, -10 * u, 1.2, 10 * u, '#f3eee6', 3));
          add(ps, P(x, FY - H * 1.35, 0, 0, 0.12, 7 * u, '#fff1a0', 0));
        }
      }
      for (const p of ps) {
        if (p.kind === 6 && p.life + f.dt >= p.max) {
          addBoom(f, p.x, FY, 22 * u, { sparks: 4, debris: 12, smoke: 3, debrisColor: '#4a3020', life: 0.5 });
          p.kind = 0;
          p.max = 0;
        }
      }
      g.fillStyle = '#0e0b09';
      g.beginPath();
      for (const p of ps) if (p.kind === 6) circ(g, p.x, p.y, p.size);
      g.fill();
    } else {
      // tracers
      const fut = ei === 5;
      emit(f, 'tr', L.portrait ? 9 : 16, () => {
        const side = f.rand() < 0.5 ? 0 : 1;
        const dir = side ? -1 : 1;
        const x0 = (side ? bx : ax) + (f.rand() - 0.5) * sp * n + dir * H * 0.4;
        const sp2 = (1100 + f.rand() * 500) * u;
        add(ps, P(x0, FY - H * 0.62 + (f.rand() - 0.5) * 8 * u, dir * sp2, -(f.rand() * 60 + 10) * u, 0.9, 0, fut ? f.rand.pick(['#55f3ff', '#ff4fd8']) : '#ffe27a', 7));
      });
      g.lineCap = 'round';
      for (const p of ps) {
        if (p.kind !== 7) continue;
        g.strokeStyle = p.color;
        g.lineWidth = (fut ? 4 : 2.6) * u;
        line(g, p.x, p.y, p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      }
      for (let i = 0; i < WAR_BOOMS.length; i++) {
        if (!at(f, 'b' + i, WAR_BOOMS[i])) continue;
        const side = i % 2;
        const cx = side ? bx : ax;
        const x = clamp(cx + (f.rand() - 0.5) * sp * n * 2.2, 10, L.w - 10);
        addBoom(f, hidden(L, x, -40) ? cx : x, FY, 44 * u, { sparks: 16, debris: 14, smoke: 7 });
      }
    }
    drawBooms(g, f);
    stepParts(ps, f.dt, 700 * u);
    drawParts(g, ps);
  },
  (t) => Math.max(impulses(WAR_BOOMS, 6, 0.4)(t), 1.2),
);

// ================================================================== EXPLOSION

const explosion = mk(
  3.6,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    const t0 = 0.4;
    const x0 = mainX(L);
    const ps = particles(f.mem);
    wash(g, L, '#120808', 0.45);
    const d = t - t0;
    // ignition glint
    if (d < 0) {
      const k = clamp(t / t0);
      glow(g, x0, FY - 20 * u, 40 * u * (0.5 + k), 'rgba(255,240,180,1)', k);
      star(g, x0, FY - 20 * u, 12 * u * (0.5 + k), '#fff6d0', t * 6);
    }
    if (at(f, 'go', t0)) {
      for (let i = 0; i < 70; i++) {
        const a = -Math.PI * (0.05 + 0.9 * f.rand());
        const sp = (300 + f.rand() * 900) * u;
        add(ps, P(x0, FY - 30 * u, Math.cos(a) * sp, Math.sin(a) * sp, 1.2 + f.rand() * 1.2, (5 + f.rand() * 9) * u, f.rand.pick(['#2a201c', '#3b2c24', '#51402f']), 2, f.rand() * TAU, (f.rand() - 0.5) * 16));
      }
      for (let i = 0; i < 50; i++) {
        const a = -Math.PI * f.rand();
        const sp = (400 + f.rand() * 900) * u;
        add(ps, P(x0, FY - 40 * u, Math.cos(a) * sp, Math.sin(a) * sp, 0.6 + f.rand() * 0.7, (2 + f.rand() * 3) * u, f.rand.pick(['#fff3b0', '#ffc145', '#ff7a1a']), 1));
      }
    }
    if (!L.portrait && at(f, 'go2', t0 + 0.45)) addBoom(f, L.slots[1], FY, 60 * u, { sparks: 22, debris: 16, smoke: 10 });
    if (d > 0) {
      // smoke column and mushroom cap
      const k = clamp(d / 2.6);
      const R = 150 * u * easeOut(clamp(d / 0.5));
      const rise = 170 * u * easeOut(clamp(d / 2.2));
      emit(f, 'sm', 26, () => {
        const yy = FY - f.rand() * rise;
        add(ps, P(x0 + (f.rand() - 0.5) * 50 * u, yy, (f.rand() - 0.5) * 40 * u, -(40 + f.rand() * 50) * u, 2 + f.rand(), (30 + f.rand() * 25) * u, f.rand.pick(['#3a302e', '#4d4240', '#5e5250']), 3));
      });
      const base = g.globalAlpha;
      const fire = 1 - easeIn(k);
      glow(g, x0, FY - rise, R * 2.6, 'rgba(255,150,60,0.7)', fire);
      g.globalAlpha = base * fire;
      g.fillStyle = '#c2301a';
      g.beginPath();
      circ(g, x0, FY - rise, R);
      circ(g, x0 - R * 0.7, FY - rise + R * 0.2, R * 0.65);
      circ(g, x0 + R * 0.72, FY - rise + R * 0.15, R * 0.6);
      g.rect(x0 - R * 0.28, FY - rise, R * 0.56, rise);
      g.fill();
      g.fillStyle = '#ff7a1f';
      g.beginPath();
      circ(g, x0, FY - rise - R * 0.05, R * 0.72);
      circ(g, x0 - R * 0.55, FY - rise + R * 0.18, R * 0.4);
      circ(g, x0 + R * 0.55, FY - rise + R * 0.12, R * 0.38);
      g.fill();
      g.globalAlpha = base * clamp(1 - d / 0.9);
      g.fillStyle = '#fff1b8';
      g.beginPath();
      circ(g, x0, FY - rise - R * 0.1, R * 0.45);
      g.fill();
      g.globalAlpha = base;
      // shockwave and dust wave
      ring(g, x0, FY - 30 * u, d * 1500 * u, 10 * u, '#ffffff', clamp(1 - d / 1.1) * 0.8);
      ring(g, x0, FY - 30 * u, d * 1100 * u, 4 * u, '#ffd9a0', clamp(1 - d / 1.1) * 0.6);
      const dw = d * 700 * u;
      g.globalAlpha = base * clamp(1 - d / 2) * 0.6;
      g.fillStyle = '#6b5440';
      g.beginPath();
      g.ellipse(x0, FY, dw, 40 * u * clamp(d * 2), 0, Math.PI, TAU);
      g.fill();
      g.globalAlpha = base;
    }
    drawBooms(g, f);
    stepParts(ps, f.dt, 900 * u);
    drawParts(g, ps);
    if (d > 0) flash(g, L, 1 - d / 0.45, era === 'future' ? '#e8fbff' : '#fffaf0');
  },
  (t) => {
    const d = t - 0.4;
    if (d < 0) return 0;
    return Math.max(0, 16 * (1 - d / 1.2)) + (d > 0.45 && d < 0.85 ? 6 : 0);
  },
);

// ================================================================== FIRE

const fire = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#12080c', '#3a1410', '#7a2c14', '#c4561e']);
  skyline(g, L, FY, era, '#1d0d0a', 17);
  floor(g, L, FY, '#1a0d09');
  const ps = particles(f.mem);
  const spots = once(f.mem, 'spots', () => (L.portrait ? [L.w * 0.5] : [L.slots[0], L.slots[1]]));
  const bw = (L.portrait ? 170 : 190) * u;
  const bh = (ei <= 2 ? 150 : ei === 5 ? 280 : 230) * u;
  const wall = ei <= 2 ? '#4a2c1c' : ei === 3 ? '#4d2a22' : ei === 4 ? '#2e2a33' : '#22303d';
  for (let s = 0; s < spots.length; s++) {
    const x = spots[s];
    glow(g, x, FY - bh * 0.5, bh * 1.3, 'rgba(255,120,40,0.55)', 0.8 + 0.2 * Math.sin(t * 9 + s));
    building(g, x, FY, bw, bh, ei, wall, '#1a0f0c', null, 0, 0);
    // windows: glowing, some with flames licking out
    const cols = 3;
    const rows = Math.max(2, Math.floor(bh / (58 * u)));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const wx = x - bw / 2 + bw * (cx + 0.5) / cols;
        const wy = FY - bh + 26 * u + cy * 56 * u;
        const fl = 0.7 + 0.3 * Math.sin(t * 13 + cx * 3 + cy * 5 + s);
        g.fillStyle = `rgba(255,${Math.round(150 + 70 * fl)},60,1)`;
        g.fillRect(wx - 15 * u, wy, 30 * u, 34 * u);
        if ((cx + cy + s) % 2 === 0) flame(g, wx, wy + 10 * u, 26 * u, 56 * u, t, cx * 2 + cy * 7 + s);
      }
    }
    const roofY = FY - bh - (ei <= 2 ? bw * 0.25 : 0);
    flame(g, x - bw * 0.22, roofY + 14 * u, 70 * u, 130 * u, t, 1 + s);
    flame(g, x + bw * 0.2, roofY + 14 * u, 60 * u, 110 * u, t, 4 + s);
    flame(g, x, roofY + 10 * u, 80 * u, 160 * u, t * 1.1, 7 + s);
    emit(f, 'smoke' + s, 14, () => add(ps, P(x + (f.rand() - 0.5) * bw * 0.6, roofY - 90 * u, (f.rand() - 0.3) * 30 * u, -(50 + f.rand() * 40) * u, 2.6, (22 + f.rand() * 18) * u, f.rand.pick(['#2b2222', '#3a2e2c', '#4a3c38']), 3)));
    emit(f, 'emb' + s, 22, () => add(ps, P(x + (f.rand() - 0.5) * bw, roofY - 20 * u, (f.rand() - 0.5) * 60 * u, -(80 + f.rand() * 120) * u, 1.6, (1.5 + f.rand() * 2) * u, f.rand.pick(['#ffd34d', '#ff8f1f', '#fff1a0']), 0)));
  }
  // modern firefighters spray water at the first building
  if (ei >= 3) {
    const x = spots[0] + (L.portrait ? -bw * 0.75 : bw * 0.75) * (L.portrait ? 0.55 : 1);
    const dir: 1 | -1 = L.portrait ? 1 : -1;
    const o = fig(g, x, FY, 70 * u, '#151012', { dir, armF: 1.9, armB: 1.6, hat: 'helmet', hatColor: '#d8a21c' });
    const base = g.globalAlpha;
    g.globalAlpha = base * 0.75;
    g.strokeStyle = '#bfe6ff';
    g.lineWidth = 4 * u;
    g.setLineDash([10 * u, 8 * u]);
    g.lineDashOffset = -t * 300 * u;
    g.beginPath();
    g.moveTo(o.fx, o.fy);
    g.quadraticCurveTo(o.fx + dir * 70 * u, o.fy - 120 * u, spots[0] + dir * -bw * 0.2, FY - bh * 0.7);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = base;
  }
  stepParts(ps, f.dt, 0);
  for (const p of ps) if (p.kind === 0) p.vx += Math.sin(t * 6 + p.y * 0.05) * 40 * u * f.dt;
  drawParts(g, ps);
});

// ================================================================== STORM

const STRIKES = [0.85, 1.95, 2.6];
const storm = mk(
  3.6,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    let fl = 0;
    for (const s of STRIKES) {
      const d = t - s;
      if (d >= 0 && d < 0.35) fl = Math.max(fl, (1 - d / 0.35) * (d < 0.06 || (d > 0.12 && d < 0.18) ? 1 : 0.45));
    }
    sky(g, L, ['#0a0e18', '#161d2b', '#232c3c', '#1a202a']);
    wash(g, L, '#cfd8ff', fl * 0.35);
    skyline(g, L, FY, era, fl > 0.5 ? '#2a3140' : '#0b0f16', 23, 'rgba(255,220,140,0.55)');
    floor(g, L, FY, '#0a0d13');
    // lightning bolts
    const bolts = once(f.mem, 'bolts', () =>
      STRIKES.map((_, i) => {
        const x = i === 1 && !L.portrait ? L.slots[1] : L.portrait ? L.w * (0.3 + 0.4 * f.rand()) : L.slots[0] + (f.rand() - 0.5) * 160 * u;
        const pts: number[] = [];
        let xx = x;
        const steps = 11;
        for (let k = 0; k <= steps; k++) {
          pts.push(xx, lerp(FY * 0.12, FY, k / steps));
          xx += (f.rand() - 0.5) * 50 * u;
        }
        return pts;
      }),
    );
    for (let i = 0; i < STRIKES.length; i++) {
      const d = t - STRIKES[i];
      if (d < 0 || d > 0.3) continue;
      const pts = bolts[i];
      const a = d < 0.08 || (d > 0.13 && d < 0.2) ? 1 : 0.3;
      glow(g, pts[pts.length - 2], FY, 120 * u, 'rgba(200,215,255,0.8)', a);
      const base = g.globalAlpha;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (const [w, c, al] of [
        [14, '#8fa8ff', 0.35],
        [5, '#e6ecff', 1],
      ] as [number, string, number][]) {
        g.globalAlpha = base * a * al;
        g.strokeStyle = c;
        g.lineWidth = w * u;
        g.beginPath();
        for (let k = 0; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
        g.moveTo(pts[8], pts[9]);
        g.lineTo(pts[8] + 40 * u, pts[9] + 60 * u);
        g.stroke();
      }
      g.globalAlpha = base;
    }
    // heavy clouds racing
    const cl = once(f.mem, 'clouds', () => {
      const out: number[] = [];
      for (let i = 0; i < 9; i++) out.push(f.rand() * L.w * 1.3 - L.w * 0.15, f.rand() * FY * 0.22, (80 + f.rand() * 70) * u, 20 + f.rand() * 30);
      return out;
    });
    for (let i = 0; i < cl.length; i += 4) {
      const x = cl[i] + t * cl[i + 3] * u;
      cloud(g, x, cl[i + 1] + 10 * u, cl[i + 2], fl > 0.5 ? '#3a4458' : '#1e2533');
      cloud(g, x + 12 * u, cl[i + 1] + 34 * u, cl[i + 2] * 0.8, fl > 0.5 ? '#2d3546' : '#151b26');
    }
    rain(f, L.portrait ? 160 : 260, -260, 'rgba(170,195,230,0.55)', 30 * u, 1.6 * u, L.h);
    // splashes on the ground
    const ps = particles(f.mem);
    emit(f, 'spl', 40, () => {
      const x = visX(L, f.rand, 10);
      for (let k = 0; k < 2; k++) add(ps, P(x, FY, (f.rand() - 0.5) * 80 * u, -(40 + f.rand() * 60) * u, 0.3, 1.5 * u, '#b8c8e0', 1));
    });
    stepParts(ps, f.dt, 600 * u);
    drawParts(g, ps);
  },
  impulses(STRIKES.map((s) => s + 0.1), 5, 0.5),
);

// ================================================================== QUAKE

interface Bld {
  x: number;
  w: number;
  h: number;
  c: string;
  ph: number;
  fall: number;
  seed: number;
}
const quakeI = (t: number) => span(t, 0.1, 0.5) * (1 - span(t, 2.9, 3.9));
const quake = mk(
  4.0,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    const ei = ERA_I[era];
    const I = quakeI(t);
    sky(g, L, ['#4a5468', '#7c7f8c', '#b39a7c', '#8a6e52']);
    skyline(g, L, FY - 20 * u, era, '#6a6066', 41);
    const blds = once(f.mem, 'blds', (): Bld[] => {
      const out: Bld[] = [];
      const cols = ['#8a5a44', '#6f6d7a', '#9a8064', '#5f6a78', '#7d5d52'];
      let x = 10 * u;
      let i = 0;
      while (x < L.w) {
        const w = (60 + f.rand() * 50) * u;
        const cx = x + w / 2;
        if (!hidden(L, cx, -w / 2)) {
          out.push({ x: cx, w, h: (ei <= 2 ? 80 + f.rand() * 60 : 120 + f.rand() * 150) * u, c: cols[i % cols.length], ph: f.rand() * TAU, fall: i % 3 === 1 ? (f.rand() < 0.5 ? -1 : 1) : 0, seed: i * 13 + 1 });
          i++;
        }
        x += w + (6 + f.rand() * 14) * u;
      }
      return out;
    });
    const ps = particles(f.mem);
    const crumble = easeIn(clamp((t - 1.0) / 1.6));
    for (const b of blds) {
      const ang = Math.sin(t * 21 + b.ph) * 0.035 * I + b.fall * crumble * 0.22;
      g.save();
      g.translate(b.x + Math.sin(t * 33 + b.ph) * 3 * u * I, FY);
      g.rotate(ang);
      building(g, 0, 0, b.w, b.h, ei, b.c, '#3a2f2c', 'rgba(255,240,200,0.55)', b.seed, 0.4);
      // cracks on the facade
      if (t > 0.6) {
        const k = clamp((t - 0.6) / 1.2);
        g.strokeStyle = '#1d1514';
        g.lineWidth = 2.5 * u;
        g.beginPath();
        g.moveTo(-b.w * 0.1, -b.h);
        g.lineTo(b.w * 0.05, -b.h + b.h * 0.25 * k);
        g.lineTo(-b.w * 0.12, -b.h + b.h * 0.45 * k);
        g.lineTo(b.w * 0.08, -b.h + b.h * 0.7 * k);
        g.stroke();
      }
      g.restore();
      if (I > 0.3) {
        emit(f, 'deb' + b.seed, 2.2 * I, () => add(ps, P(b.x + (f.rand() - 0.5) * b.w, FY - b.h, (f.rand() - 0.5) * 60 * u, -f.rand() * 60 * u, 1.4, (4 + f.rand() * 6) * u, b.c, 2, f.rand() * TAU, (f.rand() - 0.5) * 10)));
        emit(f, 'dust' + b.seed, 3 * I, () => add(ps, P(b.x + (f.rand() - 0.5) * b.w, FY - f.rand() * 10 * u, (f.rand() - 0.5) * 50 * u, -(10 + f.rand() * 30) * u, 2.2, (18 + f.rand() * 20) * u, f.rand.pick(['#9d8a72', '#b6a184', '#857360']), 3)));
      }
    }
    floor(g, L, FY, '#5a4636');
    // ground fissures
    const fis = once(f.mem, 'fis', () =>
      (L.portrait ? [L.w * 0.3, L.w * 0.72] : [L.slots[0], L.slots[1]]).map((x0) => {
        const pts: number[] = [];
        let x = x0 - 120 * u;
        for (let k = 0; k < 10; k++) {
          pts.push(x, FY + 4 * u + f.rand() * 14 * u);
          x += 26 * u;
        }
        return pts;
      }),
    );
    const open = easeOut(clamp((t - 0.5) / 1.2)) * (1 - 0.3 * span(t, 3, 3.8));
    g.fillStyle = '#140c08';
    for (const pts of fis) {
      g.beginPath();
      const nn = Math.max(2, Math.round((pts.length / 2) * open));
      for (let k = 0; k < nn; k++) g.lineTo(pts[k * 2], pts[k * 2 + 1] - 5 * u * open);
      for (let k = nn - 1; k >= 0; k--) g.lineTo(pts[k * 2] + 3 * u, pts[k * 2 + 1] + 6 * u * open);
      g.closePath();
      g.fill();
    }
    stepParts(ps, f.dt, 800 * u);
    for (const p of ps) if (p.kind === 2 && p.y > FY) p.max = 0;
    drawParts(g, ps);
    wash(g, L, '#b39a7c', 0.15 * I);
  },
  (t) => 3 + 12 * quakeI(t) * (0.7 + 0.3 * Math.sin(t * 9)),
);

// ================================================================== FLOOD

const flood = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#26303e', '#3e4b5c', '#5c6b7c', '#4a5868']);
  const cl = once(f.mem, 'cl', () => {
    const out: number[] = [];
    for (let i = 0; i < 7; i++) out.push(f.rand() * L.w, f.rand() * FY * 0.2, (90 + f.rand() * 60) * u);
    return out;
  });
  for (let i = 0; i < cl.length; i += 3) cloud(g, cl[i] + t * 12 * u, cl[i + 1], cl[i + 2], '#323c4a');
  skyline(g, L, FY + 30 * u, era, '#1d2633', 8, 'rgba(255,220,140,0.6)');
  const level = FY + 30 * u - easeOut(clamp((t - 0.2) / 2.8)) * 150 * u;
  // rooftop with a waving survivor
  const rx = mainX(L) + (L.portrait ? -L.w * 0.18 : 40 * u);
  g.fillStyle = '#4a3a34';
  g.fillRect(rx - 55 * u, level - 40 * u, 110 * u, 200 * u);
  g.fillStyle = '#7a3b2e';
  g.beginPath();
  g.moveTo(rx - 70 * u, level - 40 * u);
  g.lineTo(rx, level - 90 * u);
  g.lineTo(rx + 70 * u, level - 40 * u);
  g.fill();
  person(g, rx + 10 * u, level - 82 * u, 60 * u, { color: '#1d1a22', pose: 'wave', phase: t, dir: 1 });
  // water body
  const wav = (x: number, ph: number) => Math.sin(x * 0.012 + t * 2.2 + ph) * 7 * u + Math.sin(x * 0.031 - t * 3.1 + ph) * 3 * u;
  const grad = g.createLinearGradient(0, level - 10 * u, 0, L.h);
  grad.addColorStop(0, '#3f86b0');
  grad.addColorStop(1, '#14354f');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, L.h);
  for (let x = 0; x <= L.w + 16; x += 16) g.lineTo(x, level + wav(x, 0));
  g.lineTo(L.w, L.h);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(220,240,255,0.65)';
  g.lineWidth = 3 * u;
  g.beginPath();
  for (let x = 0; x <= L.w + 16; x += 16) g.lineTo(x, level + wav(x, 0));
  g.stroke();
  // floating things
  const items = once(f.mem, 'items', () => [visX(L, f.rand, 60), visX(L, f.rand, 60), visX(L, f.rand, 60), visX(L, f.rand, 60)]);
  for (let i = 0; i < items.length; i++) {
    const x = items[i] + Math.sin(t * 0.8 + i) * 20 * u + t * 14 * u;
    const y = level + wav(x, 0) - 2 * u;
    const rot = Math.sin(t * 2 + i * 2) * 0.15;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    if (i === 0) {
      // rubber duck
      g.fillStyle = '#ffd23f';
      g.beginPath();
      ell(g, 0, -8 * u, 18 * u, 11 * u);
      circ(g, 12 * u, -24 * u, 9 * u);
      g.fill();
      g.fillStyle = '#ff8c1a';
      g.fillRect(19 * u, -25 * u, 9 * u, 4 * u);
      g.fillStyle = '#111';
      g.beginPath();
      circ(g, 14 * u, -27 * u, 1.8 * u);
      g.fill();
    } else if (i === 1) {
      g.fillStyle = '#7a4a2a';
      g.fillRect(-18 * u, -30 * u, 36 * u, 34 * u);
      g.fillStyle = '#4a2a14';
      g.fillRect(-18 * u, -22 * u, 36 * u, 4 * u);
      g.fillRect(-18 * u, -8 * u, 36 * u, 4 * u);
    } else if (i === 2 && ERA_I[era] >= 4) {
      car(g, 0, 18 * u, 96 * u, 1, '#3b82c4', {});
    } else {
      g.fillStyle = '#5a3a20';
      g.fillRect(-46 * u, -6 * u, 92 * u, 8 * u);
      g.fillStyle = '#4c7a2c';
      g.beginPath();
      circ(g, 40 * u, -10 * u, 12 * u);
      g.fill();
    }
    g.restore();
  }
  rain(f, L.portrait ? 140 : 220, -120, 'rgba(190,210,235,0.5)', 26 * u, 1.5 * u, L.h);
  const ps = particles(f.mem);
  emit(f, 'rip', 8, () => add(ps, P(visX(L, f.rand, 20), level + 6 * u + f.rand() * 40 * u, 0, 0, 1, 1, '#d6ecff', 8)));
  stepParts(ps, f.dt, 0);
  const base = g.globalAlpha;
  g.strokeStyle = '#d6ecff';
  g.lineWidth = 1.5 * u;
  for (const p of ps) {
    const k = p.life / p.max;
    g.globalAlpha = base * (1 - k) * 0.7;
    g.beginPath();
    g.ellipse(p.x, p.y, 4 * u + k * 26 * u, 1.5 * u + k * 6 * u, 0, 0, TAU);
    g.stroke();
  }
  g.globalAlpha = base;
});

// ================================================================== PLAGUE

function germ(g: G, x: number, y: number, r: number, rot: number, col: string): void {
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineWidth = Math.max(1.5, r * 0.18);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * TAU) / 8;
    g.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    g.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
  }
  g.stroke();
  g.beginPath();
  circ(g, x, y, r);
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * TAU) / 8;
    circ(g, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, r * 0.2);
  }
  g.fill();
  g.fillStyle = 'rgba(20,40,10,0.75)';
  g.beginPath();
  circ(g, x - r * 0.32, y - r * 0.1, r * 0.16);
  circ(g, x + r * 0.32, y - r * 0.1, r * 0.16);
  g.fill();
  g.strokeStyle = 'rgba(20,40,10,0.75)';
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.arc(x, y + r * 0.45, r * 0.3, Math.PI * 1.15, Math.PI * 1.85);
  g.stroke();
}

function plagueDoctor(g: G, x: number, y: number, h: number, t: number): void {
  const col = '#16121c';
  const bob = Math.sin(t * 3) * h * 0.01;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - h * 0.07, y - h * 0.75 + bob);
  g.lineTo(x + h * 0.07, y - h * 0.75 + bob);
  g.lineTo(x + h * 0.22, y);
  g.lineTo(x - h * 0.22, y);
  g.closePath();
  g.fill();
  const hy = y - h * 0.84 + bob;
  g.beginPath();
  circ(g, x, hy, h * 0.09);
  g.fill();
  g.fillStyle = '#e2d6bb';
  g.beginPath();
  g.moveTo(x + h * 0.04, hy - h * 0.02);
  g.quadraticCurveTo(x + h * 0.2, hy + h * 0.0, x + h * 0.32, hy + h * 0.12);
  g.lineTo(x + h * 0.05, hy + h * 0.07);
  g.closePath();
  g.fill();
  g.fillStyle = '#b8ff6a';
  g.beginPath();
  circ(g, x + h * 0.045, hy - h * 0.015, h * 0.025);
  g.fill();
  g.fillStyle = col;
  g.fillRect(x - h * 0.19, hy - h * 0.09, h * 0.38, h * 0.035);
  g.fillRect(x - h * 0.085, hy - h * 0.21, h * 0.17, h * 0.13);
  g.strokeStyle = '#3a2a1c';
  g.lineWidth = Math.max(2, h * 0.025);
  line(g, x + h * 0.16, y - h * 0.5, x + h * 0.24, y);
}

const plague = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#0d160c', '#1f3018', '#3c5520', '#56702a']);
  skyline(g, L, FY, era, '#131c0e', 27, ei > 0 ? 'rgba(200,255,120,0.35)' : undefined);
  floor(g, L, FY, '#10170b');
  // drifting haze blobs
  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.31 + t * 0.03) % 1) * L.w;
    glow(g, x, FY * (0.3 + 0.18 * (i % 3)), 220 * u, 'rgba(150,220,60,0.35)');
  }
  // figure(s)
  const xs = L.portrait ? [L.w * 0.32] : [L.slots[0], L.slots[1] - 40 * u];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (ei <= 2) plagueDoctor(g, x, FY, 130 * u, t + i);
    else {
      const o = fig(g, x, FY, 110 * u, '#151a12', { dir: i ? -1 : 1, lean: 0.25 + 0.1 * Math.sin(t * 5 + i), armF: 2.2, armB: 0.3 });
      g.fillStyle = ei === 3 ? '#4a4d3a' : '#dfe9f0';
      g.beginPath();
      ell(g, o.hx + (i ? -1 : 1) * o.hr * 0.4, o.hy + o.hr * 0.3, o.hr * 0.75, o.hr * 0.5);
      g.fill();
      if (Math.sin(t * 5 + i) > 0.85 && at(f, 'cough' + i + Math.floor(t * 5 / TAU), t)) {
        const ps = particles(f.mem);
        for (let k = 0; k < 5; k++) add(ps, P(o.hx, o.hy, (i ? -1 : 1) * (40 + f.rand() * 50) * u, (f.rand() - 0.5) * 30 * u, 1.4, (8 + f.rand() * 8) * u, '#9fd34a', 3));
      }
    }
  }
  const ps = particles(f.mem);
  stepParts(ps, f.dt, 0);
  drawParts(g, ps);
  // germs
  const germs = once(f.mem, 'germs', () => {
    const out: number[] = [];
    for (let i = 0; i < (L.portrait ? 18 : 34); i++) out.push(visX(L, f.rand, 20), f.rand() * FY, (8 + f.rand() * 14) * u, f.rand() * TAU, (f.rand() - 0.5) * 40, -(10 + f.rand() * 30));
    return out;
  });
  const cols = ['#9be15d', '#c3f05a', '#79c84a'];
  for (let i = 0; i < germs.length; i += 6) {
    const x = germs[i] + germs[i + 4] * u * t + Math.sin(t * 1.5 + i) * 12 * u;
    let y = germs[i + 1] + germs[i + 5] * u * t;
    if (y < -20) y += FY;
    const pulse = 1 + 0.08 * Math.sin(t * 6 + i);
    germ(g, x, y, germs[i + 2] * pulse, germs[i + 3] + t * 0.8, cols[(i / 6) % 3]);
  }
  wash(g, L, '#9be15d', 0.07 + 0.03 * Math.sin(t * 2));
});

// ================================================================== HOSPITAL

function ecgY(x: number, period: number, amp: number): number {
  const ph = (((x % period) + period) % period) / period;
  if (ph > 0.1 && ph < 0.2) return -Math.sin(((ph - 0.1) / 0.1) * Math.PI) * amp * 0.12;
  if (ph > 0.36 && ph < 0.39) return ((ph - 0.36) / 0.03) * amp * 0.15;
  if (ph >= 0.39 && ph < 0.42) return lerp(amp * 0.15, -amp, (ph - 0.39) / 0.03);
  if (ph >= 0.42 && ph < 0.46) return lerp(-amp, amp * 0.35, (ph - 0.42) / 0.04);
  if (ph >= 0.46 && ph < 0.49) return lerp(amp * 0.35, 0, (ph - 0.46) / 0.03);
  if (ph > 0.6 && ph < 0.75) return -Math.sin(((ph - 0.6) / 0.15) * Math.PI) * amp * 0.2;
  return 0;
}

function redCross(g: G, x: number, y: number, s: number, color = '#ff3348'): void {
  g.fillStyle = color;
  g.fillRect(x - s * 0.18, y - s * 0.5, s * 0.36, s);
  g.fillRect(x - s * 0.5, y - s * 0.18, s, s * 0.36);
}

const hospital = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#04121a', '#0a2430', '#0f3442', '#0a1c24']);
  skyline(g, L, FY, era, '#061219', 19, 'rgba(180,240,255,0.35)');
  floor(g, L, FY, '#050e12');
  const [ax, bx] = pair(L, 0.24);
  // hospital building with a glowing cross
  const hx = L.portrait ? L.w * 0.7 : bx;
  const hw = (L.portrait ? 150 : 230) * u;
  const hh = (L.portrait ? 170 : 220) * u;
  g.fillStyle = '#d9e4ea';
  g.fillRect(hx - hw / 2, FY - hh, hw, hh);
  g.fillStyle = '#b8c8d2';
  g.fillRect(hx - hw / 2, FY - hh, hw, 10 * u);
  const r = makeRand(4);
  for (let cy = 0; cy < 4; cy++)
    for (let cx = 0; cx < 4; cx++) {
      g.fillStyle = r() < 0.6 ? '#bff2ff' : '#55707c';
      g.fillRect(hx - hw / 2 + hw * (cx + 0.5) / 4 - 9 * u, FY - hh + 50 * u + cy * (hh - 70 * u) / 4, 18 * u, 16 * u);
    }
  g.fillStyle = '#7fa6b8';
  g.fillRect(hx - 18 * u, FY - 40 * u, 36 * u, 40 * u);
  const pulse = 0.75 + 0.25 * Math.sin(t * 6);
  glow(g, hx, FY - hh - 34 * u, 80 * u, 'rgba(255,60,80,0.8)', pulse);
  g.fillStyle = '#ffffff';
  g.fillRect(hx - 28 * u, FY - hh - 62 * u, 56 * u, 56 * u);
  redCross(g, hx, FY - hh - 34 * u, 44 * u);
  // ambulance or a healer's lantern
  const amx = L.portrait ? L.w * 0.28 : ax;
  if (ei >= 3) {
    const len = (L.portrait ? 130 : 170) * u;
    const ph = Math.floor(t * 7) % 2;
    glow(g, amx - len * 0.12, FY - len * 0.5, 120 * u, ph ? 'rgba(255,40,60,0.75)' : 'rgba(60,140,255,0.75)');
    const by = FY - len * 0.1;
    g.fillStyle = ei === 3 ? '#e8e2d0' : '#f4f6f8';
    g.beginPath();
    rr(g, amx - len / 2, by - len * 0.42, len * 0.68, len * 0.42, 6 * u);
    rr(g, amx + len * 0.16, by - len * 0.3, len * 0.34, len * 0.3, 8 * u);
    g.fill();
    g.fillStyle = '#9ccbe8';
    g.fillRect(amx + len * 0.26, by - len * 0.26, len * 0.18, len * 0.12);
    g.fillStyle = '#ff3348';
    g.fillRect(amx - len / 2, by - len * 0.14, len, len * 0.05);
    redCross(g, amx - len * 0.16, by - len * 0.25, len * 0.18);
    g.fillStyle = ph ? '#ff2b3b' : '#5a1218';
    g.fillRect(amx - len * 0.45, by - len * 0.48, len * 0.1, len * 0.06);
    g.fillStyle = ph ? '#1c2c70' : '#3d8bff';
    g.fillRect(amx + len * 0.02, by - len * 0.48, len * 0.1, len * 0.06);
    g.fillStyle = '#15151b';
    g.beginPath();
    circ(g, amx - len * 0.3, by, len * 0.08);
    circ(g, amx + len * 0.3, by, len * 0.08);
    g.fill();
  } else {
    const ly = FY - 120 * u;
    glow(g, amx, ly, 90 * u, 'rgba(255,190,90,0.7)', 0.8 + 0.2 * Math.sin(t * 12));
    g.fillStyle = '#e8dcc0';
    g.fillRect(amx - 50 * u, ly - 50 * u, 100 * u, 100 * u);
    redCross(g, amx, ly, 70 * u, '#c42b2b');
    g.strokeStyle = '#3a2a1a';
    g.lineWidth = 5 * u;
    line(g, amx, ly + 50 * u, amx, FY);
  }
  // heartbeat monitor line across the view
  const ey = FY * (L.portrait ? 0.24 : 0.28);
  const amp = 60 * u;
  const period = 300 * u;
  const head = ((t * 0.42) % 1.2) * (L.w + 200) - 100;
  const trail = L.w * 0.5;
  g.strokeStyle = 'rgba(70,255,150,0.08)';
  g.lineWidth = 1;
  g.beginPath();
  for (let gx = 0; gx < L.w; gx += 40 * u) {
    g.moveTo(gx, ey - amp * 1.4);
    g.lineTo(gx, ey + amp * 0.6);
  }
  g.stroke();
  const base = g.globalAlpha;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const seg = trail / 10;
  for (let j = 0; j < 10; j++) {
    const x1 = head - j * seg;
    const x0 = x1 - seg;
    if (x1 < 0 || x0 > L.w) continue;
    g.globalAlpha = base * (1 - j / 10);
    g.strokeStyle = '#46ff96';
    g.lineWidth = 4 * u;
    g.beginPath();
    for (let x = x0; x <= x1 + 0.1; x += 4) g.lineTo(x, ey + ecgY(x, period, amp));
    g.stroke();
  }
  g.globalAlpha = base;
  glow(g, head, ey + ecgY(head, period, amp), 26 * u, 'rgba(180,255,210,1)');
  // pulsing heart beside the trace
  const beat = Math.pow(Math.max(0, Math.sin(t * 7.5)), 8);
  heart(g, L.portrait ? L.w * 0.12 : L.slots[2], ey - amp * 0.4, (16 + 6 * beat) * u, '#ff3d5a');
});

// ================================================================== POLICE

const police = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#03060f', '#0a1228', '#121c38', '#0a1020']);
  skyline(g, L, FY, era, '#060a16', 29, 'rgba(255,214,120,0.5)');
  floor(g, L, FY, '#05070e');
  const [ax, bx] = pair(L, 0.22);
  const ph = Math.floor(t * 7) % 2;
  if (ei >= 4) {
    // strobe wash, alternating sides
    glow(g, ph ? 0 : L.w, FY * 0.6, L.w * 0.55, ph ? 'rgba(255,30,50,0.45)' : 'rgba(40,110,255,0.5)');
    const len = (L.portrait ? 140 : 190) * u;
    const fut = ei === 5;
    const cars: [number, 1 | -1][] = L.portrait ? [[L.w * 0.5, 1]] : [[ax, 1], [bx, -1]];
    for (let i = 0; i < cars.length; i++) {
      const [x, dir] = cars[i];
      const p2 = (ph + i) % 2;
      glow(g, x - dir * len * 0.04, FY - len * 0.45, 130 * u, p2 ? 'rgba(255,40,60,0.85)' : 'rgba(60,130,255,0.85)');
      car(g, x, FY, len, dir, '#f2f4f8', { police: true, hover: fut, t: t + i * 0.07 });
      // officer with flashlight
      const ox = x - dir * len * 0.68;
      if (!L.portrait || i === 0) {
        const o = fig(g, ox, FY, 92 * u, '#0f1630', { dir, armF: 1.55, armB: 0.2, hat: 'cap', hatColor: '#0b1022' });
        const base = g.globalAlpha;
        g.globalAlpha = base * 0.35;
        g.fillStyle = '#fff6c8';
        g.beginPath();
        g.moveTo(o.fx, o.fy);
        g.lineTo(o.fx + dir * 220 * u, o.fy - 40 * u);
        g.lineTo(o.fx + dir * 220 * u, o.fy + 60 * u);
        g.closePath();
        g.fill();
        g.globalAlpha = base;
      }
    }
    // siren rings
    for (let k = 0; k < 2; k++) {
      const kk = ((t * 1.3 + k * 0.5) % 1);
      ring(g, cars[0][0], FY - len * 0.42, 20 * u + kk * 160 * u, 3 * u, ph ? '#ff6070' : '#70a0ff', (1 - kk) * 0.6);
    }
  } else {
    // night watch: lanterns, halberds (pre-industrial) or bobbies with a blue lamp (industrial)
    const n = L.portrait ? 3 : 3;
    const groups = L.portrait ? [L.w * 0.5] : [ax, bx];
    for (let gi = 0; gi < groups.length; gi++) {
      const dir: 1 | -1 = gi ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const x = groups[gi] + (i - 1) * 70 * u + dir * t * 12 * u;
        const h = 104 * u;
        const ph2 = t + i * 0.3 + gi;
        const o = fig(g, x, FY, h, '#141018', { dir, walk: ph2 * 0.8, armF: 1.1, armB: 0.3 + 0.2 * Math.sin(ph2 * 7), hat: ei === 3 ? 'bobby' : i === 1 ? 'brim' : 'hood', hatColor: ei === 3 ? '#0d1530' : '#1a1418' });
        const lx = o.fx + dir * 10 * u + Math.sin(t * 4 + i) * 6 * u;
        const ly = o.fy + 24 * u;
        g.strokeStyle = '#2a1d10';
        g.lineWidth = 2 * u;
        line(g, o.fx, o.fy, lx, ly - 8 * u);
        glow(g, lx, ly, 70 * u, 'rgba(255,190,80,0.75)', 0.85 + 0.15 * Math.sin(t * 17 + i));
        g.fillStyle = '#ffd36b';
        g.fillRect(lx - 6 * u, ly - 8 * u, 12 * u, 16 * u);
        g.fillStyle = '#2a1d10';
        g.fillRect(lx - 7 * u, ly - 10 * u, 14 * u, 3 * u);
        if (ei <= 2 && i !== 1) {
          // halberd on the back arm
          g.strokeStyle = '#3a2a1a';
          g.lineWidth = 3 * u;
          const px = o.bx;
          line(g, px, FY - 4 * u, px + dir * 6 * u, FY - h * 1.35);
          g.fillStyle = '#c6ccd6';
          g.beginPath();
          g.moveTo(px + dir * 6 * u, FY - h * 1.35);
          g.lineTo(px + dir * 26 * u, FY - h * 1.22);
          g.lineTo(px + dir * 5 * u, FY - h * 1.12);
          g.closePath();
          g.fill();
        }
      }
    }
    if (ei === 3) {
      // blue police lamp and whistle blasts
      const lx = L.portrait ? L.w * 0.86 : L.slots[1] + 150 * u;
      g.strokeStyle = '#1a1a22';
      g.lineWidth = 6 * u;
      line(g, lx, FY, lx, FY - 190 * u);
      glow(g, lx, FY - 205 * u, 90 * u, 'rgba(70,130,255,0.9)', 0.7 + 0.3 * Math.sin(t * 5));
      g.fillStyle = '#5a9aff';
      g.fillRect(lx - 16 * u, FY - 225 * u, 32 * u, 36 * u);
      g.fillStyle = '#ffffff';
      g.font = `900 ${8 * u}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText('POLICE', lx, FY - 204 * u);
    }
    // alarm marks around the leader's head
    const wx = groups[0];
    const k = (t * 2) % 1;
    const base = g.globalAlpha;
    g.globalAlpha = base * (1 - k);
    g.strokeStyle = '#ffe9a0';
    g.lineWidth = 3 * u;
    for (let j = -1; j <= 1; j++) {
      const a = -Math.PI / 2 + j * 0.5;
      const r0 = 20 * u + k * 30 * u;
      line(g, wx + Math.cos(a) * r0, FY - 150 * u + Math.sin(a) * r0, wx + Math.cos(a) * (r0 + 14 * u), FY - 150 * u + Math.sin(a) * (r0 + 14 * u));
    }
    g.globalAlpha = base;
  }
});

// ================================================================== PRISON

const PRISON_CLANG = 1.25;
const prison = mk(
  3.4,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const FY = floorY(L, u);
    wash(g, L, '#1a222c', 0.35 + 0.35 * span(t, 0.2, 1.5));
    const k = t < PRISON_CLANG ? easeIn(clamp((t - 0.2) / (PRISON_CLANG - 0.2))) : 1;
    const d = t - PRISON_CLANG;
    const bounce = d > 0 ? Math.sin(d * 28) * Math.exp(-d * 7) * 12 * u : 0;
    const jamb = 26 * u;
    const edge = lerp(L.w + 30 * u, jamb, k) + bounce;
    const sp = 62 * u;
    const bw = 15 * u;
    const rails = [L.portrait ? FY * 0.16 : L.h * 0.12, L.portrait ? FY * 0.7 : L.h * 0.62];
    // bar shadows on the floor once shut
    // static wall post on the left
    g.fillStyle = '#2a3038';
    g.fillRect(0, 0, jamb, L.h);
    g.fillStyle = '#4a525c';
    g.fillRect(jamb - 4 * u, 0, 4 * u, L.h);
    // door
    for (let x = edge + sp * 0.35; x < L.w + bw; x += sp) {
      if (hidden(L, x, bw)) continue;
      g.fillStyle = '#3a414b';
      g.fillRect(x - bw / 2, -10, bw, L.h + 20);
      g.fillStyle = '#9aa4b2';
      g.fillRect(x - bw / 2 + bw * 0.18, -10, bw * 0.22, L.h + 20);
      g.fillStyle = '#20252c';
      g.fillRect(x + bw * 0.25, -10, bw * 0.25, L.h + 20);
    }
    for (const ry of rails) {
      g.fillStyle = '#353c45';
      g.fillRect(edge, ry - 11 * u, L.w - edge + 10, 22 * u);
      g.fillStyle = '#8c96a4';
      g.fillRect(edge, ry - 11 * u, L.w - edge + 10, 4 * u);
      g.fillStyle = '#5e6773';
      g.beginPath();
      for (let x = edge + sp * 0.35; x < L.w; x += sp) circ(g, x, ry, 3.5 * u);
      g.fill();
    }
    // lock plate on the leading edge
    g.fillStyle = '#2b3138';
    g.fillRect(edge - 4 * u, rails[1] - 40 * u, 26 * u, 80 * u);
    g.fillStyle = '#7d8794';
    g.fillRect(edge - 4 * u, rails[1] - 40 * u, 26 * u, 4 * u);
    g.fillStyle = '#0a0c0f';
    g.beginPath();
    circ(g, edge + 9 * u, rails[1] - 6 * u, 4 * u);
    g.fill();
    g.fillRect(edge + 7 * u, rails[1] - 6 * u, 4 * u, 14 * u);
    // the clang
    const ps = particles(f.mem);
    if (at(f, 'clang', PRISON_CLANG)) {
      for (const ry of rails)
        for (let i = 0; i < 14; i++) {
          const a = (f.rand() - 0.5) * Math.PI * 1.2;
          const s = (200 + f.rand() * 400) * u;
          add(ps, P(edge, ry, Math.cos(a) * s, Math.sin(a) * s - 80 * u, 0.5 + f.rand() * 0.3, (1.5 + f.rand() * 2) * u, f.rand.pick(['#fff3b0', '#ffd166', '#ffffff']), 1));
        }
    }
    if (d > 0 && d < 0.5) {
      for (const ry of rails) ring(g, edge, ry, 20 * u + d * 260 * u, 4 * u, '#e8f0ff', 1 - d / 0.5);
      flash(g, L, (1 - d / 0.25) * 0.35, '#dfe8ff');
    }
    stepParts(ps, f.dt, 900 * u);
    drawParts(g, ps);
    // cold vignette
    const base = g.globalAlpha;
    const grad = g.createRadialGradient(L.w / 2, L.h * 0.45, Math.min(L.w, L.h) * 0.25, L.w / 2, L.h * 0.45, Math.max(L.w, L.h) * 0.75);
    grad.addColorStop(0, 'rgba(10,14,20,0)');
    grad.addColorStop(1, 'rgba(10,14,20,0.75)');
    g.globalAlpha = base * span(t, 0.8, 2);
    g.fillStyle = grad;
    g.fillRect(0, 0, L.w, L.h);
    g.globalAlpha = base;
  },
  impulses([PRISON_CLANG], 9, 0.45),
);

// ================================================================== COURT

const GAVEL = [1.15, 2.15];
const court = mk(
  3.6,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const FY = floorY(L, u);
    sky(g, L, ['#1c120c', '#3a2618', '#54371f', '#2a1a10']);
    // colonnade
    const top = L.portrait ? FY * 0.12 : L.h * 0.08;
    const cw = 46 * u;
    const step = 150 * u;
    g.fillStyle = '#cdbfa6';
    g.fillRect(0, top - 34 * u, L.w, 34 * u);
    g.fillStyle = '#a99a80';
    g.fillRect(0, top - 6 * u, L.w, 6 * u);
    g.fillStyle = '#b8aa90';
    for (let x = 6 * u; x < L.w; x += 26 * u) g.fillRect(x, top - 28 * u, 12 * u, 14 * u);
    for (let x = step * 0.5; x < L.w + cw; x += step) {
      if (hidden(L, x, cw)) continue;
      g.fillStyle = '#e2d8c4';
      g.fillRect(x - cw / 2, top, cw, FY - top - 20 * u);
      g.fillStyle = 'rgba(120,100,70,0.35)';
      for (let k = -1; k <= 1; k++) g.fillRect(x + k * cw * 0.28 - 2 * u, top + 16 * u, 4 * u, FY - top - 56 * u);
      g.fillStyle = '#d3c7b0';
      g.fillRect(x - cw * 0.7, top, cw * 1.4, 16 * u);
      g.fillRect(x - cw * 0.7, FY - 26 * u, cw * 1.4, 14 * u);
    }
    g.fillStyle = '#3b2617';
    g.fillRect(0, FY - 12 * u, L.w, L.h);
    // scales of justice
    const sx = L.portrait ? L.w * 0.27 : L.slots[0];
    const sy = L.portrait ? FY * 0.42 : FY * 0.42;
    const tilt = Math.sin(t * 2.4) * 0.28 * Math.exp(-t * 0.5);
    const arm = 90 * u;
    glow(g, sx, sy, 150 * u, 'rgba(255,210,120,0.35)');
    g.strokeStyle = '#e8b84a';
    g.fillStyle = '#e8b84a';
    g.lineWidth = 6 * u;
    g.lineCap = 'round';
    line(g, sx, sy - 10 * u, sx, sy + 150 * u);
    g.fillRect(sx - 40 * u, sy + 146 * u, 80 * u, 10 * u);
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    line(g, sx - c * arm, sy - s * arm, sx + c * arm, sy + s * arm);
    g.beginPath();
    circ(g, sx, sy - 14 * u, 8 * u);
    g.fill();
    for (const side of [-1, 1]) {
      const px = sx + side * c * arm;
      const py = sy + side * s * arm;
      g.lineWidth = 2 * u;
      line(g, px, py, px - 24 * u, py + 60 * u);
      line(g, px, py, px + 24 * u, py + 60 * u);
      g.beginPath();
      g.ellipse(px, py + 60 * u, 30 * u, 10 * u, 0, 0, Math.PI);
      g.fill();
    }
    // bench and gavel
    const gx = L.portrait ? L.w * 0.7 : L.slots[1];
    const by = L.portrait ? FY - 40 * u : FY - 70 * u;
    g.fillStyle = '#5a3a22';
    g.fillRect(gx - 140 * u, by, 280 * u, FY - by);
    g.fillStyle = '#6e4a2c';
    g.fillRect(gx - 150 * u, by - 10 * u, 300 * u, 14 * u);
    g.fillStyle = '#3a2414';
    g.beginPath();
    rr(g, gx - 30 * u, by - 26 * u, 60 * u, 18 * u, 4 * u);
    g.fill();
    let ang = -1.1;
    for (const tz of GAVEL) {
      const d = t - tz;
      if (d > -0.35 && d < 0) ang = lerp(-1.1, 0, easeIn((d + 0.35) / 0.35));
      else if (d >= 0 && d < 0.5) ang = lerp(0, -1.1, easeInOut(clamp((d - 0.15) / 0.35)));
    }
    const pivot = [gx + 120 * u, by - 34 * u];
    g.save();
    g.translate(pivot[0], pivot[1]);
    g.rotate(ang);
    g.fillStyle = '#7a4a26';
    g.fillRect(-120 * u, -5 * u, 110 * u, 10 * u);
    g.fillStyle = '#5c3418';
    g.beginPath();
    rr(g, -150 * u, -22 * u, 46 * u, 44 * u, 6 * u);
    g.fill();
    g.fillStyle = '#d8b46a';
    g.fillRect(-140 * u, -22 * u, 6 * u, 44 * u);
    g.fillRect(-120 * u, -22 * u, 6 * u, 44 * u);
    g.restore();
    for (const tz of GAVEL) {
      const d = t - tz;
      if (d < 0 || d > 0.6) continue;
      const k = d / 0.6;
      ring(g, gx, by - 20 * u, 30 * u + k * 160 * u, 5 * u, '#ffe9b0', 1 - k, 0.45);
      ring(g, gx, by - 20 * u, 20 * u + k * 90 * u, 3 * u, '#ffffff', 1 - k, 0.45);
      if (d < 0.2) burst(g, gx, by - 40 * u, 46 * u * (0.6 + d * 2), 'rgba(255,236,170,0.9)', 'rgba(120,70,20,0.6)', d * 3);
    }
    if (t > GAVEL[0]) caption(g, 'ORDER!', gx, L.portrait ? FY * 0.2 : FY * 0.3, 54 * u, '#ffe7a8', clamp((t - GAVEL[0]) / 0.2) * clamp((3.2 - t) / 0.4));
  },
  impulses(GAVEL, 5, 0.3),
);

// ================================================================== ESCAPE

const escape = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#02040b', '#0a1124', '#141e36', '#0a0f1c']);
  starfield(g, L, 60, 21, t, FY * 0.4);
  const wallTop = FY - (L.portrait ? 170 : 210) * u;
  // searchlights from towers, sweeping
  const towers = L.portrait ? [L.w * 0.06, L.w * 0.94] : [L.slots[2], L.slots[3]];
  const base = g.globalAlpha;
  const runX = mainX(L) + (L.portrait ? 0 : 30 * u);
  for (let i = 0; i < 2; i++) {
    const tx = towers[i];
    const ty = wallTop - 110 * u;
    const sweep = Math.sin(t * 1.4 + i * 2.2);
    const aim = i === 0 ? runX + sweep * 260 * u : runX - 60 * u + sweep * 280 * u;
    const ax2 = aim;
    const ay2 = FY;
    const dx = ax2 - tx;
    const dy = ay2 - ty;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const wid = 70 * u;
    g.globalAlpha = base * 0.22;
    g.fillStyle = '#fff6c8';
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(ax2 + nx * wid, ay2 + ny * wid);
    g.lineTo(ax2 - nx * wid, ay2 - ny * wid);
    g.closePath();
    g.fill();
    g.globalAlpha = base;
    glow(g, ax2, Math.min(ay2, FY - 20 * u), 90 * u, 'rgba(255,246,200,0.55)');
  }
  // prison wall with barbed wire
  g.fillStyle = '#2b2e36';
  g.fillRect(0, wallTop, L.w, FY - wallTop);
  g.strokeStyle = '#22252c';
  g.lineWidth = 2 * u;
  g.beginPath();
  for (let y = wallTop + 26 * u; y < FY; y += 26 * u) {
    g.moveTo(0, y);
    g.lineTo(L.w, y);
  }
  g.stroke();
  g.fillStyle = '#3a3e48';
  g.fillRect(0, wallTop - 8 * u, L.w, 10 * u);
  g.strokeStyle = '#8890a0';
  g.lineWidth = 1.5 * u;
  g.beginPath();
  for (let x = 0; x < L.w; x += 18 * u) {
    if (hidden(L, x)) continue;
    g.moveTo(x + 9 * u + 9 * u, wallTop - 20 * u);
    g.arc(x + 9 * u, wallTop - 20 * u, 9 * u, 0, TAU);
  }
  g.stroke();
  // towers
  for (const tx of towers) {
    g.fillStyle = '#1a1c22';
    g.fillRect(tx - 18 * u, wallTop - 100 * u, 36 * u, FY - wallTop + 100 * u);
    g.fillRect(tx - 34 * u, wallTop - 128 * u, 68 * u, 30 * u);
    g.beginPath();
    g.moveTo(tx - 40 * u, wallTop - 128 * u);
    g.lineTo(tx, wallTop - 158 * u);
    g.lineTo(tx + 40 * u, wallTop - 128 * u);
    g.fill();
    glow(g, tx, wallTop - 110 * u, 28 * u, 'rgba(255,250,220,1)');
    if (t > 2.9 && Math.floor(t * 6) % 2 === 0) glow(g, tx, wallTop - 160 * u, 40 * u, 'rgba(255,40,40,0.9)');
  }
  floor(g, L, FY, '#121318');
  // the runner: dash, climb a rope, vanish over the top
  const h = (L.portrait ? 72 : 86) * u;
  const ropeX = runX;
  g.strokeStyle = '#c9a46a';
  g.lineWidth = 3 * u;
  line(g, ropeX + 6 * u, wallTop - 10 * u, ropeX + 6 * u + Math.sin(t * 3) * 2 * u, FY - 4 * u);
  g.fillStyle = '#8890a0';
  g.fillRect(ropeX - 2 * u, wallTop - 16 * u, 16 * u, 6 * u);
  const startX = L.portrait ? -40 * u : -40 * u;
  const col = '#f08a24';
  if (t < 1.3) {
    const x = lerp(startX, ropeX - 4 * u, easeOut(clamp(t / 1.3)) * 0.4 + clamp(t / 1.3) * 0.6);
    fig(g, x, FY, h, col, { dir: 1, walk: t * 1.6, armF: 1.0 + Math.sin(t * 14.4) * 0.7, armB: -0.6 - Math.sin(t * 14.4) * 0.7, lean: 0.25, stride: 0.2, hat: 'beanie', hatColor: '#222' });
  } else if (t < 2.6) {
    const k = (t - 1.3) / 1.3;
    const y = lerp(FY, wallTop + h * 0.95, easeInOut(k));
    const c2 = Math.sin(t * 12);
    fig(g, ropeX, y, h, col, { dir: 1, walk: t * 0.7, armF: Math.PI - 0.15 + c2 * 0.25, armB: Math.PI - 0.15 - c2 * 0.25, stride: 0.08, hat: 'beanie', hatColor: '#222' });
  } else if (t < 3.05) {
    const k = clamp((t - 2.6) / 0.45);
    const x = ropeX + k * 30 * u;
    const y = wallTop - 6 * u - Math.sin(k * Math.PI) * 26 * u + k * k * 40 * u;
    g.save();
    g.beginPath();
    g.rect(0, -L.h, L.w, wallTop - 4 * u + L.h);
    g.clip();
    fig(g, x, y, h * 0.9, col, { dir: 1, armF: 2.4, armB: 2.0, lean: 0.6, stride: 0.2, walk: 0.3, hat: 'beanie', hatColor: '#222' });
    g.restore();
  }
  if (t > 3.0) caption(g, 'ESCAPED!', mainX(L), wallTop - 80 * u, 44 * u, '#ffd36b', clamp((t - 3) / 0.2));
});

// ================================================================== CRIME

function burglar(g: G, x: number, y: number, h: number, t: number, caught: number): void {
  const dir: 1 | -1 = 1;
  const tip = caught > 0 ? undefined : t * 0.55;
  const armsUp = caught;
  const o = fig(g, x, y, h, '#1c1a26', {
    dir,
    walk: tip,
    lean: caught > 0 ? 0 : 0.18,
    armF: lerp(1.6, Math.PI - 0.35, armsUp),
    armB: lerp(-0.9, Math.PI - 0.35, armsUp),
    stride: 0.12,
  });
  // stripes on the torso
  g.strokeStyle = '#e9e6f0';
  g.lineWidth = Math.max(1.5, h * 0.025);
  for (let k = 0; k < 3; k++) {
    const yy = o.sy + h * 0.06 + k * h * 0.08;
    const xx = lerp(o.sx, x, (yy - o.sy) / (y - h * 0.44 - o.sy));
    line(g, xx - h * 0.05, yy, xx + h * 0.05, yy);
  }
  // face, beanie and mask
  g.fillStyle = '#f0c9a0';
  g.beginPath();
  circ(g, o.hx, o.hy, o.hr * 0.95);
  g.fill();
  g.fillStyle = '#1c1a26';
  g.beginPath();
  g.arc(o.hx, o.hy - o.hr * 0.1, o.hr * 1.06, Math.PI, 0);
  g.fill();
  g.fillRect(o.hx - o.hr * 1.05, o.hy - o.hr * 0.05, o.hr * 2.1, o.hr * 0.5);
  g.fillStyle = '#ffffff';
  g.beginPath();
  circ(g, o.hx + o.hr * 0.05, o.hy + o.hr * 0.2, o.hr * 0.17);
  circ(g, o.hx + o.hr * 0.58, o.hy + o.hr * 0.2, o.hr * 0.17);
  g.fill();
  // loot sack
  const sx = caught > 0 ? x - h * 0.28 : o.sx - h * 0.18;
  const sy = caught > 0 ? y - h * 0.16 : o.sy + h * 0.02;
  g.fillStyle = '#c9a46a';
  g.beginPath();
  circ(g, sx, sy, h * 0.2);
  g.fill();
  g.fillStyle = '#a8844c';
  g.fillRect(sx - h * 0.04, sy - h * 0.25, h * 0.08, h * 0.08);
  g.fillStyle = '#4a3418';
  g.font = `900 ${h * 0.2}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', sx, sy + h * 0.02);
}

const crime = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#03040a', '#0a0e1c', '#131a2c', '#0a0d16']);
  skyline(g, L, FY, era, '#070a12', 33, 'rgba(255,214,120,0.35)');
  floor(g, L, FY, '#06080d');
  const x = mainX(L) + (L.portrait ? 0 : -20 * u) + Math.min(t, 1.6) * 30 * u;
  const caughtT = 1.7;
  const caught = easeOut(clamp((t - caughtT) / 0.25));
  // sweeping searchlight that locks onto the thief
  const sweepX = t < caughtT ? lerp(L.portrait ? L.w * 1.0 : L.slots[0] + 300 * u, x, easeInOut(t / caughtT)) + Math.sin(t * 4) * 40 * u * (1 - t / caughtT) : x;
  const srcX = L.portrait ? L.w * 0.9 : L.slots[0] + 180 * u;
  const base = g.globalAlpha;
  g.globalAlpha = base * 0.3;
  g.fillStyle = '#fffbe0';
  g.beginPath();
  g.moveTo(srcX - 10 * u, -10);
  g.lineTo(srcX + 10 * u, -10);
  g.lineTo(sweepX + 70 * u, FY);
  g.lineTo(sweepX - 70 * u, FY);
  g.closePath();
  g.fill();
  g.globalAlpha = base * 0.55;
  g.beginPath();
  ell(g, sweepX, FY, 80 * u, 16 * u);
  g.fill();
  g.globalAlpha = base;
  glow(g, sweepX, FY - 60 * u, 110 * u, 'rgba(255,250,210,0.35)');
  burglar(g, x, FY, (L.portrait ? 100 : 120) * u, t, caught);
  if (caught > 0) {
    const h = (L.portrait ? 100 : 120) * u;
    caption(g, '!', x + 6 * u, FY - h * 1.3 - Math.sin(clamp((t - caughtT) * 6) * Math.PI) * 10 * u, 60 * u, '#ffe14d', caught);
  }
  // an open vault on the other side (landscape) with an alarm light
  if (!L.portrait) {
    const vx = L.slots[1];
    const vy = FY - 130 * u;
    g.fillStyle = '#4a5260';
    g.beginPath();
    rr(g, vx - 110 * u, vy - 110 * u, 220 * u, 240 * u, 14 * u);
    g.fill();
    glow(g, vx, vy, 120 * u, 'rgba(255,210,90,0.7)', 0.8 + 0.2 * Math.sin(t * 8));
    g.fillStyle = '#1a1c22';
    g.beginPath();
    circ(g, vx, vy, 80 * u);
    g.fill();
    g.fillStyle = '#ffcf4a';
    for (let i = 0; i < 6; i++) g.fillRect(vx - 50 * u + (i % 3) * 34 * u, vy + 30 * u - Math.floor(i / 3) * 18 * u, 30 * u, 14 * u);
    // swung-open door
    g.fillStyle = '#6a7484';
    g.beginPath();
    g.ellipse(vx + 120 * u, vy, 26 * u, 82 * u, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#38404c';
    g.lineWidth = 4 * u;
    line(g, vx + 120 * u, vy - 50 * u, vx + 120 * u, vy + 50 * u);
    const on = Math.floor(t * 6) % 2 === 0;
    glow(g, vx, vy - 150 * u, 60 * u, on ? 'rgba(255,40,40,0.9)' : 'rgba(255,40,40,0.2)');
    g.fillStyle = on ? '#ff3a3a' : '#5a1a1a';
    g.beginPath();
    g.arc(vx, vy - 140 * u, 16 * u, Math.PI, 0);
    g.fill();
  }
  // dropped coins
  const ps = particles(f.mem);
  if (t < caughtT) emit(f, 'coin', 3, () => add(ps, P(x - 30 * u, FY - 80 * u, (f.rand() - 0.5) * 60 * u, -60 * u, 0.9, 6 * u, '#ffd34d', 1)));
  stepParts(ps, f.dt, 900 * u);
  for (const p of ps) if (p.y > FY - p.size) {
    p.y = FY - p.size;
    p.vy = -p.vy * 0.3;
    p.vx *= 0.6;
  }
  drawParts(g, ps);
});

// ================================================================== FIGHT

const PUNCHES = [0.55, 0.95, 1.4, 1.8, 2.2, 2.6];
const BAMS = ['POW!', 'BAM!', 'WHAM!', 'BIFF!', 'SOCK!', 'KAPOW!'];
const fight = mk(
  3.3,
  (f) => {
    const { g, L, t, era } = f;
    const u = U(L);
    const FY = floorY(L, u);
    sky(g, L, ['#1d1530', '#3a2650', '#6a3c58', '#3a2430']);
    skyline(g, L, FY, era, '#1a1224', 37, 'rgba(255,200,120,0.4)');
    floor(g, L, FY, '#140e14');
    const ps = particles(f.mem);
    const pairs = L.portrait ? [L.w * 0.5] : [L.slots[0], L.slots[1]];
    for (let pi = 0; pi < pairs.length; pi++) {
      const cx = pairs[pi];
      const h = (L.portrait ? 130 : 150) * u;
      const gap = h * 0.36;
      const off = pi * 0.2;
      // who punches now?
      let lunge = 0;
      let who = 0;
      for (let i = 0; i < PUNCHES.length; i++) {
        const d = t - PUNCHES[i] - off;
        if (d > -0.15 && d < 0.2) {
          lunge = d < 0 ? easeIn((d + 0.15) / 0.15) : 1 - easeOut(d / 0.2);
          who = i % 2;
        }
      }
      // Bright cartoon fighters so they read against the night city.
      const cols = pi ? ['#ffb02e', '#a06bff'] : ['#4c8dff', '#ff6b4a'];
      glow(g, cx, FY - h * 0.5, h * 1.2, 'rgba(255,200,140,0.45)');
      for (let s = 0; s < 2; s++) {
        const dir: 1 | -1 = s ? -1 : 1;
        const bob = Math.sin(t * 8 + s * 2 + pi) * 3 * u;
        const attacking = who === s ? lunge : 0;
        const hit = who !== s ? lunge : 0;
        const x = cx - dir * (gap - attacking * h * 0.12 + hit * h * 0.08);
        const o = fig(g, x, FY + bob * 0.2, h, cols[s], { dir, lean: attacking * 0.2 - hit * 0.25, armF: lerp(2.0, 1.6, attacking) + Math.sin(t * 9 + s) * 0.15, armB: 2.3 + Math.sin(t * 7 + s) * 0.2, walk: undefined, stride: 0.16 });
        g.fillStyle = cols[s];
        g.beginPath();
        circ(g, o.fx, o.fy, h * 0.055);
        circ(g, o.bx, o.by, h * 0.05);
        g.fill();
        // dizzy stars near the end
        if (t > 2.75 + off && s === 1) {
          for (let k = 0; k < 3; k++) {
            const a = t * 6 + (k * TAU) / 3;
            star(g, o.hx + Math.cos(a) * h * 0.14, o.hy - h * 0.12 + Math.sin(a) * h * 0.04, 6 * u, '#ffe14d', a);
          }
        }
      }
      for (let i = 0; i < PUNCHES.length; i++) {
        const tz = PUNCHES[i] + off;
        const d = t - tz;
        if (d < 0 || d > 0.32) continue;
        const k = d / 0.32;
        const bx = cx + (i % 2 ? -1 : 1) * h * 0.06;
        const by = FY - h * 0.8;
        burst(g, bx, by, h * (0.3 + 0.15 * easeOut(k)), '#ffe14d', '#ff5a1f', i);
        caption(g, BAMS[(i + pi) % BAMS.length], bx, by, h * 0.17, '#ff3d3d', 1 - k * 0.5);
        if (at(f, `p${pi}${i}`, tz)) for (let q = 0; q < 6; q++) add(ps, P(cx + (f.rand() - 0.5) * h * 0.6, FY, (f.rand() - 0.5) * 80 * u, -f.rand() * 40 * u, 1, (10 + f.rand() * 10) * u, '#6a5a50', 3));
      }
    }
    stepParts(ps, f.dt, 0);
    drawParts(g, ps);
  },
  impulses(PUNCHES, 3, 0.18),
);

// ================================================================== RIOT

const riot = mk(4.0, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#0e0808', '#2a120e', '#6a2a14', '#a8461c']);
  const ps = particles(f.mem);
  const smokeX = once(f.mem, 'sx', () => [visX(L, f.rand, 60), visX(L, f.rand, 60)]);
  emit(f, 'sm', 10, () => {
    const x = smokeX[Math.floor(f.rand() * 2)];
    add(ps, P(x + (f.rand() - 0.5) * 40 * u, FY - 40 * u, (f.rand() - 0.2) * 30 * u, -(40 + f.rand() * 30) * u, 3, (22 + f.rand() * 20) * u, f.rand.pick(['#3a2a28', '#4a3633', '#2e2222']), 3));
  });
  skyline(g, L, FY - 10 * u, era, '#1e0f0c', 43, 'rgba(255,170,80,0.45)');
  drawParts(g, ps);
  for (const x of smokeX) {
    glow(g, x, FY - 30 * u, 100 * u, 'rgba(255,130,40,0.6)');
    flame(g, x, FY - 4 * u, 46 * u, 90 * u, t, x);
  }
  floor(g, L, FY, '#140a08');
  // the crowd: back row then front row
  const rows = once(f.mem, 'rows', () => [rowXs(L, 34 * u, 14 * u, f.rand), rowXs(L, 46 * u, 18 * u, f.rand)]);
  const flagCol = ['#d62828', '#111111', '#f2c94c'];
  for (let r = 0; r < 2; r++) {
    const xs = rows[r];
    const h = (r ? 96 : 74) * u * (L.portrait ? 0.85 : 1);
    const y = FY + (r ? 10 : -4) * u;
    const col = r ? '#140b0c' : '#2a1614';
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] + Math.sin(t * 2 + i) * 4 * u + t * 6 * u;
      const ph = t * 1.3 + i * 0.77 + r;
      const pump = Math.sin(ph * 6);
      const role = (i * 7 + r * 3) % 6;
      const o = fig(g, x, y - Math.max(0, pump) * 4 * u, h, col, { dir: i % 2 ? 1 : -1, armF: Math.PI - 0.35 + pump * 0.25, armB: role === 0 ? 0.3 : Math.PI - 0.6 - pump * 0.2 });
      g.fillStyle = col;
      g.beginPath();
      circ(g, o.fx, o.fy, h * 0.05);
      g.fill();
      if (r === 1 && role === 1) {
        // torch
        g.strokeStyle = '#3a2410';
        g.lineWidth = 3 * u;
        line(g, o.fx, o.fy + 10 * u, o.fx, o.fy - 18 * u);
        glow(g, o.fx, o.fy - 30 * u, 40 * u, 'rgba(255,170,60,0.7)');
        flame(g, o.fx, o.fy - 16 * u, 16 * u, 34 * u, t, i);
      } else if (r === 1 && role === 3) {
        if (ei >= 4) {
          // placard
          g.strokeStyle = '#3a2410';
          g.lineWidth = 3 * u;
          line(g, o.fx, o.fy + 10 * u, o.fx, o.fy - 36 * u);
          g.fillStyle = '#efe6d2';
          g.fillRect(o.fx - 28 * u, o.fy - 70 * u, 56 * u, 36 * u);
          g.fillStyle = '#c42b2b';
          g.font = `900 ${18 * u}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(i % 2 ? 'NO!' : '!!!', o.fx, o.fy - 52 * u);
        } else {
          // pitchfork
          g.strokeStyle = '#4a3418';
          g.lineWidth = 3 * u;
          line(g, o.fx, o.fy + 20 * u, o.fx, o.fy - 50 * u);
          g.strokeStyle = '#9aa0aa';
          g.beginPath();
          for (const dx of [-8, 0, 8]) {
            g.moveTo(o.fx + dx * u, o.fy - 50 * u);
            g.lineTo(o.fx + dx * u, o.fy - 70 * u);
          }
          g.moveTo(o.fx - 8 * u, o.fy - 50 * u);
          g.lineTo(o.fx + 8 * u, o.fy - 50 * u);
          g.stroke();
        }
      } else if (r === 1 && role === 5) {
        flag(g, o.fx, o.fy + 30 * u, 120 * u, flagCol[i % 3], t, i);
      }
    }
  }
  stepParts(ps, f.dt, 0);
});

// ================================================================== ELECTION

function ballot(g: G, x: number, y: number, s: number, rot: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#ffffff';
  g.fillRect(-s * 0.5, -s * 0.35, s, s * 0.7);
  g.strokeStyle = '#2a7a3a';
  g.lineWidth = Math.max(1.5, s * 0.1);
  g.beginPath();
  g.moveTo(-s * 0.25, 0);
  g.lineTo(-s * 0.05, s * 0.18);
  g.lineTo(s * 0.3, -s * 0.2);
  g.stroke();
  g.restore();
}

const election = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#081030', '#14245e', '#24398a', '#162258']);
  // spotlights sweeping
  const base = g.globalAlpha;
  g.fillStyle = '#e6f0ff';
  const beams = L.portrait ? [L.w * 0.15, L.w * 0.85] : [L.slots[2], L.slots[4], L.slots[5], L.slots[3]];
  for (let i = 0; i < beams.length; i++) {
    const a = Math.sin(t * 1.3 + i * 1.7) * 0.45 + (i % 2 ? -0.1 : 0.1);
    const len = L.h;
    g.globalAlpha = base * 0.12;
    g.beginPath();
    g.moveTo(beams[i], FY);
    g.lineTo(beams[i] + Math.sin(a - 0.06) * len, FY - Math.cos(a - 0.06) * len);
    g.lineTo(beams[i] + Math.sin(a + 0.06) * len, FY - Math.cos(a + 0.06) * len);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = base;
  // bunting across the top
  for (let s = 0; s < 2; s++) {
    const y0 = (L.portrait ? 18 : 30) * u + s * 46 * u;
    const sag = 40 * u;
    const w2 = 34 * u;
    g.strokeStyle = '#e8e8f0';
    g.lineWidth = 1.5 * u;
    g.beginPath();
    for (let x = 0; x <= L.w; x += 20) g.lineTo(x, y0 + Math.sin((x / L.w) * Math.PI * (L.portrait ? 1 : 3)) * sag * (s ? 0.5 : 1));
    g.stroke();
    const cols = ['#e63946', '#f1faee', '#457bff'];
    let ci = s;
    for (let x = w2 * 0.5; x < L.w; x += w2) {
      if (hidden(L, x, 10)) continue;
      const y = y0 + Math.sin((x / L.w) * Math.PI * (L.portrait ? 1 : 3)) * sag * (s ? 0.5 : 1);
      const sway = Math.sin(t * 4 + x * 0.05) * 3 * u;
      g.fillStyle = cols[ci++ % 3];
      g.beginPath();
      g.moveTo(x - w2 * 0.42, y);
      g.lineTo(x + w2 * 0.42, y);
      g.lineTo(x + sway, y + w2 * 0.9);
      g.closePath();
      g.fill();
    }
  }
  // podium and speaker
  const px = L.portrait ? L.w * 0.5 : L.slots[0];
  const ph = (L.portrait ? 110 : 130) * u;
  const sh = (L.portrait ? 120 : 140) * u;
  person(g, px, FY - ph * 0.55, sh, { color: '#141a2e', pose: 'wave', phase: t, dir: 1, accent: '#e63946' });
  g.fillStyle = '#2a3f8a';
  g.beginPath();
  g.moveTo(px - ph * 0.42, FY - ph);
  g.lineTo(px + ph * 0.42, FY - ph);
  g.lineTo(px + ph * 0.32, FY);
  g.lineTo(px - ph * 0.32, FY);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8eefc';
  g.fillRect(px - ph * 0.42, FY - ph, ph * 0.84, ph * 0.08);
  star(g, px, FY - ph * 0.5, ph * 0.16, '#f2c94c', 0);
  g.strokeStyle = '#111';
  g.lineWidth = 3 * u;
  line(g, px + ph * 0.1, FY - ph, px + ph * 0.18, FY - ph - sh * 0.3);
  // ballot box with ballots dropping in (landscape right, portrait off to the side)
  const bx = L.portrait ? L.w * 0.82 : L.slots[1];
  const bs = (L.portrait ? 70 : 120) * u;
  const ps = particles(f.mem);
  emit(f, 'bal', 2.5, () => add(ps, P(bx + (f.rand() - 0.5) * bs * 0.4, FY - bs * 2.6, 0, 60 * u, 1.3, bs * 0.32, '#ffffff', 9, f.rand() * 0.6 - 0.3, (f.rand() - 0.5) * 3)));
  g.fillStyle = '#3b5bd6';
  g.fillRect(bx - bs / 2, FY - bs, bs, bs);
  g.fillStyle = '#2a44a8';
  g.fillRect(bx - bs / 2, FY - bs, bs, bs * 0.12);
  g.fillStyle = '#0b1230';
  g.fillRect(bx - bs * 0.3, FY - bs - 2 * u, bs * 0.6, 6 * u);
  g.fillStyle = '#ffffff';
  g.font = `900 ${bs * 0.26}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('VOTE', bx, FY - bs * 0.48);
  for (const p of ps) if (p.kind === 9) {
    p.vy = Math.min(p.vy, 260 * u);
    if (p.y > FY - bs) p.max = 0;
  }
  // cheering crowd
  const xs = once(f.mem, 'crowd', () => rowXs(L, 40 * u, 14 * u, f.rand));
  for (let i = 0; i < xs.length; i++) {
    if (Math.abs(xs[i] - px) < ph * 0.6 || Math.abs(xs[i] - bx) < bs * 0.7) continue;
    person(g, xs[i], FY + 30 * u, (L.portrait ? 70 : 84) * u, { color: '#0c1024', pose: i % 3 ? 'cheer' : 'wave', phase: t + i * 0.4, dir: i % 2 ? 1 : -1 });
  }
  // confetti and ballots in the air
  emit(f, 'conf', L.portrait ? 40 : 70, () => {
    const x = visX(L, f.rand, 0);
    if (f.rand() < 0.15) add(ps, P(x, -20, (f.rand() - 0.5) * 40 * u, (60 + f.rand() * 60) * u, 3.6, (16 + f.rand() * 8) * u, '#fff', 9, f.rand() * TAU, (f.rand() - 0.5) * 4));
    else add(ps, P(x, -10, (f.rand() - 0.5) * 60 * u, (80 + f.rand() * 100) * u, 3.6, (7 + f.rand() * 6) * u, f.rand.pick(CONFETTI_COLORS), 8, f.rand() * TAU, (f.rand() - 0.5) * 10));
  });
  stepParts(ps, f.dt, 40 * u);
  for (const p of ps) if (p.kind === 8 || p.kind === 9) p.x += Math.sin(t * 3 + p.y * 0.02) * 20 * u * f.dt;
  drawConfetti(g, ps.filter((p) => p.kind === 8));
  for (const p of ps) if (p.kind === 9) ballot(g, p.x, p.y, p.size, p.rot ?? 0);
});

// ================================================================== SCANDAL

const HEADLINES = ['SCANDAL!', 'EXPOSED!', 'SHOCK!', 'OUTRAGE!', 'LEAKED!'];
function paper(g: G, x: number, y: number, s: number, rot: number, kind: number, text: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (kind === 0) {
    // scroll / pamphlet
    g.fillStyle = '#ecdcb2';
    g.fillRect(-s * 0.5, -s * 0.36, s, s * 0.72);
    g.fillStyle = '#c9b07a';
    g.fillRect(-s * 0.56, -s * 0.42, s * 1.12, s * 0.08);
    g.fillRect(-s * 0.56, s * 0.34, s * 1.12, s * 0.08);
    g.fillStyle = '#5a2a14';
    g.font = `900 ${s * 0.15}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, -s * 0.12);
    g.fillStyle = 'rgba(90,42,20,0.4)';
    for (let k = 0; k < 3; k++) g.fillRect(-s * 0.36, s * 0.04 + k * s * 0.08, s * 0.72, s * 0.03);
    g.fillStyle = '#b3261e';
    g.beginPath();
    circ(g, s * 0.3, s * 0.22, s * 0.08);
    g.fill();
  } else if (kind === 1) {
    // newspaper
    g.fillStyle = '#f4f1e8';
    g.fillRect(-s * 0.5, -s * 0.38, s, s * 0.76);
    g.fillStyle = '#111';
    g.font = `900 ${s * 0.16}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, -s * 0.22);
    g.fillRect(-s * 0.44, -s * 0.11, s * 0.88, s * 0.02);
    g.fillStyle = '#9a9a9a';
    g.fillRect(-s * 0.44, -s * 0.05, s * 0.38, s * 0.36);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 5; k++) g.fillRect(s * 0.0, -s * 0.05 + k * s * 0.075, s * 0.44, s * 0.03);
  } else {
    // phone with a viral post
    g.fillStyle = '#16161c';
    g.beginPath();
    rr(g, -s * 0.28, -s * 0.5, s * 0.56, s, s * 0.08);
    g.fill();
    g.fillStyle = '#2b2f45';
    g.fillRect(-s * 0.24, -s * 0.42, s * 0.48, s * 0.84);
    g.fillStyle = '#ffffff';
    g.font = `900 ${s * 0.1}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, -s * 0.28);
    g.fillStyle = '#ff3b6b';
    g.beginPath();
    circ(g, s * 0.22, -s * 0.46, s * 0.09);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText('!', s * 0.22, -s * 0.455);
    heart(g, -s * 0.1, s * 0.15, s * 0.07, '#ff3b6b');
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(-s * 0.18, -s * 0.12, s * 0.36, s * 0.04);
    g.fillRect(-s * 0.18, -s * 0.04, s * 0.26, s * 0.04);
  }
  g.restore();
}

const scandal = mk(3.8, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#12050e', '#2e0b24', '#4a1238', '#1a0814']);
  const ps = particles(f.mem);
  // paparazzi row with flashes
  const xs = once(f.mem, 'pap', () => rowXs(L, 52 * u, 16 * u, f.rand));
  emit(f, 'fl', L.portrait ? 6 : 10, () => {
    const i = Math.floor(f.rand() * xs.length);
    add(ps, P(xs[i] + 14 * u, FY - 78 * u, 0, 0, 0.22, (50 + f.rand() * 30) * u, '#ffffff', 10, f.rand() * 0.6));
  });
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const dir: 1 | -1 = x < L.w / 2 ? 1 : -1;
    const o = fig(g, x, FY + 16 * u, 86 * u, '#0d0610', { dir, armF: 2.2, armB: 2.0, hat: ei <= 2 ? 'brim' : 'none' });
    if (ei >= 3) {
      g.fillStyle = '#0d0610';
      g.fillRect(o.fx - 10 * u, o.fy - 14 * u, 22 * u, 16 * u);
    }
  }
  // swirling papers
  const centers = L.portrait ? [[L.w * 0.5, FY * 0.45]] : [[L.slots[0], FY * 0.45], [L.slots[1], FY * 0.45]];
  const items = once(f.mem, 'items', () => {
    const out: number[] = [];
    for (let i = 0; i < (L.portrait ? 9 : 16); i++) out.push(i % centers.length, f.rand() * TAU, 0.3 + f.rand() * 0.9, f.rand() * 0.8, f.rand() * HEADLINES.length);
    return out;
  });
  for (let i = 0; i < items.length; i += 5) {
    const [cx, cy] = centers[items[i]];
    const life = (t * 0.45 + items[i + 3]) % 1.1;
    const a = items[i + 1] + t * 1.6 * (items[i] ? -1 : 1);
    const rad = (60 + life * 220) * u * items[i + 2];
    const s = (40 + life * 120) * u;
    const kind = ei <= 1 ? 0 : ei <= 3 ? 1 : (i / 5) % 3 === 0 ? 2 : 1;
    const base = g.globalAlpha;
    g.globalAlpha = base * clamp((1.1 - life) * 4) * clamp(life * 6);
    paper(g, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.6, s, Math.sin(a * 1.3) * 0.5, kind, HEADLINES[Math.floor(items[i + 4])]);
    g.globalAlpha = base;
  }
  stepParts(ps, f.dt, 0);
  for (const p of ps) {
    if (p.kind !== 10) continue;
    const k = p.life / p.max;
    glow(g, p.x, p.y, p.size * 1.6, 'rgba(255,255,255,0.9)', 1 - k);
    star(g, p.x, p.y, p.size * 0.45 * (1 - k * 0.5), '#ffffff', p.rot ?? 0);
  }
  const big = clamp((t - 0.6) / 0.3) * clamp((3.4 - t) / 0.3);
  caption(g, ei <= 1 ? 'DISGRACE!' : 'SCANDAL!', mainX(L), FY * (L.portrait ? 0.12 : 0.12), 64 * u * (0.9 + 0.1 * Math.sin(t * 6)), '#ff4d8d', big);
});

// ================================================================== MONEY UP

function coin(g: G, x: number, y: number, r: number, spin: number): void {
  const sx = Math.abs(Math.cos(spin));
  g.fillStyle = '#c9901a';
  g.beginPath();
  ell(g, x, y, Math.max(1, r * sx) + r * 0.1, r);
  g.fill();
  g.fillStyle = '#ffd34d';
  g.beginPath();
  ell(g, x, y, Math.max(1, r * sx * 0.9), r * 0.9);
  g.fill();
  if (sx > 0.4) {
    g.fillStyle = '#e8a91f';
    g.beginPath();
    ell(g, x, y, r * sx * 0.55, r * 0.55);
    g.fill();
  }
}

function note(g: G, x: number, y: number, s: number, rot: number, flip: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(flip)));
  g.fillStyle = '#5fae5a';
  g.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
  g.fillStyle = '#8fd48a';
  g.fillRect(-s * 0.44, -s * 0.19, s * 0.88, s * 0.38);
  g.fillStyle = '#3c7a3a';
  g.beginPath();
  ell(g, 0, 0, s * 0.15, s * 0.15);
  g.fill();
  g.fillRect(-s * 0.4, -s * 0.06, s * 0.08, s * 0.12);
  g.fillRect(s * 0.32, -s * 0.06, s * 0.08, s * 0.12);
  g.restore();
}

const moneyUp = mk(3.6, (f) => {
  const { g, L, t, era } = f;
  const u = U(L);
  const FY = floorY(L, u);
  const ei = ERA_I[era];
  sky(g, L, ['#1a1204', '#3d2a08', '#6b4a0e', '#3a2806'], 0.85);
  const [ax, bx] = pair(L, 0.22);
  glow(g, ax, FY * 0.5, 320 * u, 'rgba(255,210,90,0.45)');
  if (!L.portrait) glow(g, bx, FY * 0.5, 320 * u, 'rgba(255,210,90,0.45)');
  const ps = particles(f.mem);
  emit(f, 'rain', L.portrait ? 26 : 46, () => {
    const x = visX(L, f.rand, 10);
    const isNote = ei >= 3 && f.rand() < 0.55;
    add(ps, P(x, -30 * u, (f.rand() - 0.5) * 40 * u, (60 + f.rand() * 120) * u, 4, isNote ? (44 + f.rand() * 16) * u : (11 + f.rand() * 6) * u, '#fff', isNote ? 11 : 12, f.rand() * TAU, (f.rand() - 0.5) * (isNote ? 3 : 10)));
  });
  emit(f, 'spark', 18, () => add(ps, P(visX(L, f.rand, 10), f.rand() * FY, 0, -10 * u, 0.7, (6 + f.rand() * 8) * u, '#fff6c0', 13, f.rand())));
  stepParts(ps, f.dt, 220 * u);
  // coin piles growing
  const piles = L.portrait ? [L.w * 0.5] : [ax, bx];
  const grow = easeOut(clamp(t / 3));
  for (const px of piles) {
    const pw = 150 * u;
    const ph = 20 * u + 60 * u * grow;
    g.fillStyle = '#b67d12';
    g.beginPath();
    g.ellipse(px, FY, pw, ph, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = '#ffd34d';
    g.beginPath();
    g.ellipse(px, FY + 2 * u, pw * 0.92, ph * 0.9, 0, Math.PI, TAU);
    g.fill();
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k + 0.5) * (Math.PI / 7);
      coin(g, px + Math.cos(a) * pw * 0.7, FY + Math.sin(a) * ph * 0.7, 10 * u, k);
    }
    if (ei <= 2) {
      g.fillStyle = '#e8b42a';
      g.fillRect(px - 30 * u, FY - ph - 14 * u, 60 * u, 16 * u);
      g.fillStyle = '#ffe48a';
      g.fillRect(px - 26 * u, FY - ph - 14 * u, 52 * u, 4 * u);
    }
  }
  for (const p of ps) {
    if (p.kind === 11) {
      p.vy = Math.min(p.vy, 170 * u);
      p.x += Math.sin(t * 3 + p.rot!) * 30 * u * f.dt;
      note(g, p.x, p.y, p.size, (p.rot ?? 0) * 0.3, (p.rot ?? 0) * 2);
    } else if (p.kind === 12) {
      coin(g, p.x, p.y, p.size, (p.rot ?? 0) * 1.5);
    }
  }
  for (const p of ps) {
    if (p.kind !== 13) continue;
    const k = p.life / p.max;
    const s = Math.sin(k * Math.PI);
    star(g, p.x, p.y, p.size * s, '#fff6c0', p.rot ?? 0);
  }
  caption(g, '+$$$', mainX(L), FY * 0.2, 60 * u, '#ffe066', clamp((t - 0.4) / 0.3) * clamp((3.2 - t) / 0.3));
});

// ================================================================== MONEY DOWN

const moneyDown = mk(3.6, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#16050a', '#330a12', '#521219', '#22080c']);
  // grid
  g.strokeStyle = 'rgba(255,120,120,0.12)';
  g.lineWidth = 1;
  g.beginPath();
  for (let y = FY * 0.1; y < FY; y += 50 * u) {
    g.moveTo(0, y);
    g.lineTo(L.w, y);
  }
  for (let x = 0; x < L.w; x += 70 * u) {
    g.moveTo(x, 0);
    g.lineTo(x, FY);
  }
  g.stroke();
  // chart: rises then crashes
  const pts = once(f.mem, 'pts', () => {
    const out: number[] = [];
    const N = 46;
    const peak = L.portrait ? 0.45 : 0.62;
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const x = k * L.w;
      let y: number;
      if (k < peak) y = lerp(FY * 0.62, FY * 0.22, k / peak) + (f.rand() - 0.5) * 30 * u;
      else y = lerp(FY * 0.22, FY * 1.02, easeIn((k - peak) / (1 - peak))) + (f.rand() - 0.5) * 24 * u;
      out.push(x, y);
    }
    return out;
  });
  const prog = clamp((t - 0.2) / 2.4);
  const nn = pts.length / 2;
  const headF = prog * (nn - 1);
  const hi = Math.floor(headF);
  const fr = headF - hi;
  const hx = hi + 1 < nn ? lerp(pts[hi * 2], pts[hi * 2 + 2], fr) : pts[hi * 2];
  const hy = hi + 1 < nn ? lerp(pts[hi * 2 + 1], pts[hi * 2 + 3], fr) : pts[hi * 2 + 1];
  const base = g.globalAlpha;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [w, c, a] of [
    [16, '#ff2a3a', 0.25],
    [6, '#ff4a55', 1],
  ] as [number, string, number][]) {
    g.globalAlpha = base * a;
    g.strokeStyle = c;
    g.lineWidth = w * u;
    g.beginPath();
    for (let i = 0; i <= hi; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1]);
    g.lineTo(hx, hy);
    g.stroke();
  }
  g.globalAlpha = base;
  // arrow head
  const pi = Math.max(0, hi);
  const ang = Math.atan2(hy - pts[pi * 2 + 1], hx - pts[pi * 2] || 1);
  g.fillStyle = '#ff4a55';
  g.beginPath();
  g.moveTo(hx + Math.cos(ang) * 26 * u, hy + Math.sin(ang) * 26 * u);
  g.lineTo(hx + Math.cos(ang + 2.5) * 22 * u, hy + Math.sin(ang + 2.5) * 22 * u);
  g.lineTo(hx + Math.cos(ang - 2.5) * 22 * u, hy + Math.sin(ang - 2.5) * 22 * u);
  g.closePath();
  g.fill();
  glow(g, hx, hy, 60 * u, 'rgba(255,60,70,0.6)');
  // despairing figure
  const fx = L.portrait ? L.w * 0.2 : L.slots[0];
  person(g, fx, FY, 110 * u, { color: '#12070a', pose: 'kneel', dir: 1 });
  // falling percentages and blowing papers
  const ps = particles(f.mem);
  if (prog > 0.5) emit(f, 'pct', 5, () => add(ps, P(visX(L, f.rand, 40), -20, 0, (80 + f.rand() * 80) * u, 3, (22 + f.rand() * 10) * u, '#ff5a64', 14, (f.rand() < 0.5 ? -1 : 1) * (5 + Math.floor(f.rand() * 40)))));
  emit(f, 'pap', L.portrait ? 6 : 10, () => add(ps, P(-30 * u, FY * (0.3 + f.rand() * 0.6), (260 + f.rand() * 240) * u, -(f.rand() * 60) * u, 4, (26 + f.rand() * 14) * u, '#f4f1e8', 15, f.rand() * TAU, (f.rand() - 0.5) * 8)));
  stepParts(ps, f.dt, 30 * u);
  g.font = `900 ${24 * u}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of ps) {
    if (p.kind === 14) {
      g.fillStyle = p.color;
      g.font = `900 ${p.size}px system-ui, sans-serif`;
      g.fillText(`▼ -${Math.abs(Math.round(p.rot ?? 0))}%`, p.x, p.y);
    } else if (p.kind === 15) {
      p.vy += Math.sin(t * 5 + p.x * 0.01) * 80 * u * f.dt;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot ?? 0);
      g.scale(1, 0.4 + 0.6 * Math.abs(Math.sin((p.rot ?? 0) * 1.3)));
      g.fillStyle = p.color;
      g.fillRect(-p.size * 0.4, -p.size * 0.5, p.size * 0.8, p.size);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 4; k++) g.fillRect(-p.size * 0.3, -p.size * 0.35 + k * p.size * 0.18, p.size * 0.6, p.size * 0.06);
      g.restore();
    }
  }
  caption(g, 'CRASH', L.portrait ? L.w * 0.5 : L.slots[1], FY * 0.15, 60 * u, '#ff4a55', clamp((prog - 0.6) / 0.15) * clamp((3.3 - t) / 0.3));
});

// ================================================================== CASINO

const SLOT_SYMS = ['7', 'cherry', 'bell', 'bar', 'lemon'];
function slotSymbol(g: G, sym: string, x: number, y: number, s: number): void {
  switch (sym) {
    case '7':
      g.fillStyle = '#e8202f';
      g.font = `900 ${s * 0.9}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('7', x, y + s * 0.04);
      break;
    case 'cherry':
      g.strokeStyle = '#2d8a2d';
      g.lineWidth = s * 0.07;
      g.beginPath();
      g.moveTo(x - s * 0.15, y + s * 0.1);
      g.quadraticCurveTo(x, y - s * 0.4, x + s * 0.15, y - s * 0.35);
      g.moveTo(x + s * 0.18, y + s * 0.12);
      g.lineTo(x + s * 0.15, y - s * 0.35);
      g.stroke();
      g.fillStyle = '#e8202f';
      g.beginPath();
      circ(g, x - s * 0.17, y + s * 0.18, s * 0.17);
      circ(g, x + s * 0.2, y + s * 0.2, s * 0.17);
      g.fill();
      break;
    case 'bell':
      g.fillStyle = '#f2c230';
      g.beginPath();
      g.moveTo(x - s * 0.32, y + s * 0.25);
      g.quadraticCurveTo(x - s * 0.3, y - s * 0.38, x, y - s * 0.38);
      g.quadraticCurveTo(x + s * 0.3, y - s * 0.38, x + s * 0.32, y + s * 0.25);
      g.closePath();
      g.fill();
      g.beginPath();
      circ(g, x, y + s * 0.3, s * 0.08);
      g.fill();
      break;
    case 'bar':
      g.fillStyle = '#16161c';
      g.fillRect(x - s * 0.38, y - s * 0.16, s * 0.76, s * 0.32);
      g.fillStyle = '#ffffff';
      g.font = `900 ${s * 0.24}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('BAR', x, y + s * 0.01);
      break;
    default:
      g.fillStyle = '#f5e33a';
      g.beginPath();
      ell(g, x, y, s * 0.32, s * 0.22, -0.3);
      g.fill();
  }
}

function die(g: G, x: number, y: number, s: number, rot: number, face: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#fbfbff';
  g.beginPath();
  rr(g, -s / 2, -s / 2, s, s, s * 0.18);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(-s / 2 + s * 0.08, s * 0.32, s * 0.84, s * 0.12);
  g.fillStyle = '#c4102a';
  const d = s * 0.25;
  const pip = (px: number, py: number) => {
    g.moveTo(px * d + s * 0.08, py * d);
    g.arc(px * d, py * d, s * 0.08, 0, TAU);
  };
  g.beginPath();
  const f2 = ((face % 6) + 6) % 6;
  if (f2 === 0 || f2 === 2 || f2 === 4) pip(0, 0);
  if (f2 >= 1) {
    pip(-1, -1);
    pip(1, 1);
  }
  if (f2 >= 3) {
    pip(1, -1);
    pip(-1, 1);
  }
  if (f2 === 5) {
    pip(-1, 0);
    pip(1, 0);
  }
  g.fill();
  g.restore();
}

function chip(g: G, x: number, y: number, r: number, flip: number, col: string): void {
  const sy = 0.3 + 0.7 * Math.abs(Math.cos(flip));
  g.fillStyle = col;
  g.beginPath();
  ell(g, x, y, r, r * sy);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = r * 0.18;
  g.setLineDash([r * 0.35, r * 0.35]);
  g.beginPath();
  g.ellipse(x, y, r * 0.82, r * 0.82 * sy, 0, 0, TAU);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  ell(g, x, y, r * 0.45, r * 0.45 * sy);
  g.fill();
}

const REEL_STOP = [1.3, 1.7, 2.1];
const casino = mk(3.8, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#0c0518', '#1e0a38', '#2c104c', '#10071e']);
  // chasing marquee bulbs along the top
  const by = (L.portrait ? 14 : 24) * u;
  for (let x = 12 * u, i = 0; x < L.w; x += 26 * u, i++) {
    if (hidden(L, x)) continue;
    const on = (i + Math.floor(t * 10)) % 3 === 0;
    g.fillStyle = on ? '#fff3a0' : '#6a4a20';
    g.beginPath();
    circ(g, x, by, 6 * u);
    g.fill();
    if (on) glow(g, x, by, 18 * u, 'rgba(255,230,120,0.6)');
  }
  // felt table strip
  g.fillStyle = '#0f5a34';
  g.fillRect(0, FY - 10 * u, L.w, L.h);
  g.fillStyle = '#c9a046';
  g.fillRect(0, FY - 14 * u, L.w, 5 * u);
  // slot machine
  const mx = L.portrait ? L.w * 0.5 : L.slots[1];
  const s = (L.portrait ? 64 : 78) * u;
  const mw = s * 3.6;
  const mh = s * 3.4;
  const my = L.portrait ? FY * 0.2 : FY - mh - 30 * u;
  const win = t > REEL_STOP[2];
  if (win) glow(g, mx, my + mh * 0.4, mw * 1.1, 'rgba(255,220,90,0.7)', 0.7 + 0.3 * Math.sin(t * 18));
  g.fillStyle = '#c4162c';
  g.beginPath();
  rr(g, mx - mw / 2, my, mw, mh, 18 * u);
  g.fill();
  g.fillStyle = '#f2c230';
  g.beginPath();
  rr(g, mx - mw / 2 + 6 * u, my + 6 * u, mw - 12 * u, s * 0.6, 12 * u);
  g.fill();
  g.fillStyle = '#c4162c';
  g.font = `900 ${s * 0.36}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(win ? 'JACKPOT' : 'SLOTS', mx, my + 6 * u + s * 0.3);
  // lever
  const pull = t < 0.5 ? Math.sin((t / 0.5) * Math.PI) : 0;
  g.strokeStyle = '#c0c4cc';
  g.lineWidth = 7 * u;
  g.lineCap = 'round';
  line(g, mx + mw / 2 + 10 * u, my + mh * 0.55, mx + mw / 2 + 18 * u, my + mh * (0.15 + pull * 0.4));
  g.fillStyle = '#e8202f';
  g.beginPath();
  circ(g, mx + mw / 2 + 18 * u, my + mh * (0.15 + pull * 0.4), 14 * u);
  g.fill();
  // reels
  const rw = s * 0.98;
  const rh = s * 1.5;
  const ry = my + s * 0.95;
  for (let i = 0; i < 3; i++) {
    const rx = mx + (i - 1) * (rw + 8 * u);
    g.fillStyle = '#fbf6ea';
    g.fillRect(rx - rw / 2, ry, rw, rh);
    g.save();
    g.beginPath();
    g.rect(rx - rw / 2, ry, rw, rh);
    g.clip();
    let pos: number;
    const spinning = t > 0.35 && t < REEL_STOP[i];
    if (t < 0.35) pos = i * 2 + 1;
    else if (spinning) pos = i * 2 + 1 + (t - 0.35) * 14;
    else {
      const d = t - REEL_STOP[i];
      pos = 5 * Math.ceil((i * 2 + 1 + (REEL_STOP[i] - 0.35) * 14) / 5) - Math.sin(d * 20) * Math.exp(-d * 9) * 0.25;
    }
    const cell = rh / 2;
    const base = Math.floor(pos);
    const frac = pos - base;
    const ga = g.globalAlpha;
    if (spinning) g.globalAlpha = ga * 0.7;
    for (let k = -1; k <= 2; k++) {
      const idx = (((base + k) % 5) + 5) % 5;
      const yy = ry + rh / 2 + (k - frac) * cell;
      slotSymbol(g, SLOT_SYMS[idx], rx, yy, s * 0.8);
    }
    g.globalAlpha = ga;
    g.restore();
    g.strokeStyle = '#8a0e1e';
    g.lineWidth = 3 * u;
    g.strokeRect(rx - rw / 2, ry, rw, rh);
  }
  g.strokeStyle = 'rgba(255,60,60,0.6)';
  g.lineWidth = 2 * u;
  line(g, mx - mw / 2 + 8 * u, ry + rh / 2, mx + mw / 2 - 8 * u, ry + rh / 2);
  const ps = particles(f.mem);
  if (at(f, 'jack', REEL_STOP[2] + 0.05)) {
    for (let i = 0; i < 40; i++) add(ps, P(mx, my + mh * 0.8, (f.rand() - 0.5) * 600 * u, -(300 + f.rand() * 500) * u, 1.6, (8 + f.rand() * 5) * u, '#ffd34d', 12, f.rand() * TAU, (f.rand() - 0.5) * 14));
  }
  // dice tumbling across the felt
  const dx0 = L.portrait ? L.w * 0.1 : L.slots[2];
  const dxs = L.portrait ? [L.w * 0.3, L.w * 0.42] : [L.slots[0] - 10 * u, L.slots[0] + 70 * u];
  for (let i = 0; i < 2; i++) {
    const k = clamp((t - 0.2 - i * 0.1) / 1.6);
    const x = lerp(dx0 - 100 * u, dxs[i], easeOut(k));
    const bounceY = Math.abs(Math.sin(k * Math.PI * 3.2)) * (1 - k) * 160 * u;
    const ds = (L.portrait ? 40 : 52) * u;
    const rot = (1 - easeOut(k)) * 9 + i;
    const face = k < 1 ? Math.floor(t * 12 + i * 3) : i ? 4 : 5;
    die(g, x, FY - 14 * u - ds / 2 - bounceY, ds, k < 1 ? rot : 0.1 * (i ? -1 : 1), face);
  }
  // chip stacks and flipping chips
  const cxs = L.portrait ? [L.w * 0.72, L.w * 0.86] : [L.slots[0] + 170 * u, L.slots[4] - 20 * u];
  const ccol = ['#e8202f', '#2a6cff', '#16161c', '#2a9a4a'];
  for (let j = 0; j < cxs.length; j++) {
    for (let k = 0; k < 6; k++) chip(g, cxs[j], FY - 18 * u - k * 7 * u, 22 * u, 0.0001, ccol[(k + j) % 4]);
  }
  emit(f, 'chips', 4, () => add(ps, P(visX(L, f.rand, 30), FY - 20 * u, (f.rand() - 0.5) * 120 * u, -(380 + f.rand() * 260) * u, 1.6, 16 * u, f.rand.pick(ccol), 16, f.rand() * TAU, 10 + f.rand() * 8)));
  stepParts(ps, f.dt, 800 * u);
  for (const p of ps) {
    if (p.kind === 16) chip(g, p.x, p.y, p.size, p.rot ?? 0, p.color);
    else if (p.kind === 12) coin(g, p.x, p.y, p.size, p.rot ?? 0);
  }
  if (win) caption(g, '777!', L.portrait ? L.w * 0.5 : mx, my - 30 * u, 50 * u, '#ffe066', clamp((t - REEL_STOP[2]) / 0.2));
});

// ================================================================== HACKER

const GLYPHS = '01アカサタナハマヤラワ<>/{}[]$#*+=ｦｱｳｴｵｶｷｸｹｺｻｼｽｾｿ';
const hacker = mk(3.6, (f) => {
  const { g, L, t } = f;
  const u = U(L);
  const FY = floorY(L, u);
  sky(g, L, ['#000300', '#001408', '#00180a', '#000600']);
  const fs = Math.round(15 * u);
  const colW = fs * 1.15;
  const trail = 13;
  const cols = once(f.mem, 'cols', () => {
    const out: number[] = [];
    for (let x = colW * 0.5; x < L.w; x += colW) {
      if (hidden(L, x, 6)) continue;
      out.push(x, f.rand() * L.h, (160 + f.rand() * 260) * u, Math.floor(f.rand() * 1000));
    }
    return out;
  });
  g.font = `700 ${fs}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const base = g.globalAlpha;
  const bottom = L.portrait ? FY + 40 * u : L.h;
  const tick = Math.floor(t * 12);
  g.fillStyle = '#35ff6a';
  for (let i = 0; i < cols.length; i += 4) {
    const x = cols[i];
    const head = ((cols[i + 1] + t * cols[i + 2]) % (bottom + trail * fs)) - fs;
    const seed = cols[i + 3];
    for (let k = 1; k < trail; k++) {
      const y = head - k * fs;
      if (y < -fs || y > bottom) continue;
      g.globalAlpha = base * (1 - k / trail) * 0.85;
      const ci = (seed + k * 7 + ((tick + k) >> 2) * 13) % GLYPHS.length;
      g.fillText(GLYPHS[ci], x, y);
    }
  }
  g.fillStyle = '#d8ffe2';
  for (let i = 0; i < cols.length; i += 4) {
    const head = ((cols[i + 1] + t * cols[i + 2]) % (bottom + trail * fs)) - fs;
    if (head < -fs || head > bottom) continue;
    g.globalAlpha = base;
    g.fillText(GLYPHS[(cols[i + 3] + tick) % GLYPHS.length], cols[i], head);
  }
  g.globalAlpha = base;
  // hooded hacker at a glowing laptop (landscape right side)
  if (!L.portrait) {
    const hx = L.slots[1];
    glow(g, hx + 30 * u, FY - 110 * u, 150 * u, 'rgba(60,255,120,0.4)');
    fig(g, hx - 30 * u, FY, 150 * u, '#030805', { dir: 1, armF: 1.3, armB: 1.1, lean: 0.25, hat: 'hood', hatColor: '#030805' });
    g.fillStyle = '#0a160c';
    g.fillRect(hx - 120 * u, FY - 70 * u, 280 * u, 12 * u);
    g.fillStyle = '#1a2a1e';
    g.beginPath();
    g.moveTo(hx + 30 * u, FY - 70 * u);
    g.lineTo(hx + 110 * u, FY - 70 * u);
    g.lineTo(hx + 96 * u, FY - 140 * u);
    g.lineTo(hx + 44 * u, FY - 140 * u);
    g.closePath();
    g.fill();
    g.fillStyle = '#5dff8a';
    g.fillRect(hx + 52 * u, FY - 132 * u, 36 * u, 50 * u);
  }
  // padlock that springs open, then ACCESS GRANTED
  const lx = mainX(L);
  const ly = L.portrait ? FY * 0.42 : FY * 0.42;
  const ls = (L.portrait ? 70 : 90) * u;
  const open = easeOut(clamp((t - 1.6) / 0.3));
  const ok = t > 1.6;
  const lc = ok ? '#5dff8a' : '#ff4a55';
  glow(g, lx, ly, ls * 2.2, ok ? 'rgba(80,255,130,0.45)' : 'rgba(255,70,80,0.4)');
  g.fillStyle = 'rgba(0,10,4,0.85)';
  g.beginPath();
  rr(g, lx - ls * 1.6, ly - ls * 1.3, ls * 3.2, ls * 2.8, 12 * u);
  g.fill();
  g.strokeStyle = lc;
  g.lineWidth = 3 * u;
  g.stroke();
  g.lineWidth = ls * 0.14;
  g.beginPath();
  g.arc(lx + open * ls * 0.4, ly - ls * 0.15 - open * ls * 0.25, ls * 0.32, Math.PI, 0);
  g.stroke();
  g.fillStyle = lc;
  g.beginPath();
  rr(g, lx - ls * 0.45, ly - ls * 0.15, ls * 0.9, ls * 0.75, ls * 0.1);
  g.fill();
  g.fillStyle = '#001a08';
  g.beginPath();
  circ(g, lx, ly + ls * 0.15, ls * 0.1);
  g.fill();
  g.fillRect(lx - ls * 0.04, ly + ls * 0.15, ls * 0.08, ls * 0.25);
  const txt = ok ? 'ACCESS GRANTED' : `CRACKING ${Math.floor(clamp(t / 1.6) * 100)}%`;
  g.fillStyle = lc;
  g.font = `900 ${Math.round(ls * 0.22)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (!ok || Math.floor(t * 6) % 3 !== 0) g.fillText(txt, lx, ly + ls * 1.0);
});

// ================================================================== ROCKET

const IGNITE = 0.9;
const LIFTOFF = 1.5;
const rocket = mk(
  4.2,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const FY = floorY(L, u);
    sky(g, L, ['#0a1838', '#1d3f7a', '#4f7fbe', '#f3b06a']);
    starfield(g, L, 40, 5, t, FY * 0.3);
    // distant hills
    g.fillStyle = '#2a3a58';
    g.beginPath();
    g.moveTo(0, FY);
    for (let x = 0; x <= L.w + 20; x += 30) g.lineTo(x, FY - 30 * u - Math.sin(x * 0.008) * 20 * u);
    g.lineTo(L.w, FY);
    g.fill();
    floor(g, L, FY, '#1b2436');
    const x = mainX(L);
    const rh = (L.portrait ? 150 : 190) * u;
    const rw = rh * 0.22;
    const lift = t > LIFTOFF ? easeIn(clamp((t - LIFTOFF) / 2.5)) * (FY + rh * 2) : 0;
    const shakeX = t > IGNITE && t < LIFTOFF + 0.5 ? Math.sin(t * 60) * 1.5 * u : 0;
    const ry = FY - 26 * u - lift;
    const rx = x + shakeX;
    // launch tower
    g.strokeStyle = '#3a4258';
    g.lineWidth = 4 * u;
    const tx = x - rw * 1.6;
    g.beginPath();
    g.moveTo(tx - 12 * u, FY);
    g.lineTo(tx - 12 * u, FY - rh * 1.1);
    g.moveTo(tx + 12 * u, FY);
    g.lineTo(tx + 12 * u, FY - rh * 1.1);
    for (let y = FY; y > FY - rh * 1.1; y -= 22 * u) {
      g.moveTo(tx - 12 * u, y);
      g.lineTo(tx + 12 * u, y - 22 * u);
      g.moveTo(tx - 12 * u, y);
      g.lineTo(tx + 12 * u, y);
    }
    const armOut = clamp((t - 0.6) / 0.4);
    g.moveTo(tx + 12 * u, FY - rh * 0.8);
    g.lineTo(lerp(x - rw * 0.5, tx + 30 * u, armOut), FY - rh * 0.8);
    g.stroke();
    g.fillStyle = '#4a5468';
    g.fillRect(x - rw * 2.4, FY - 26 * u, rw * 4.8, 26 * u);
    const ps = particles(f.mem);
    // venting before ignition
    if (t < IGNITE) emit(f, 'vent', 12, () => add(ps, P(rx + (f.rand() < 0.5 ? -1 : 1) * rw * 0.5, ry - rh * 0.4, (f.rand() - 0.5) * 50 * u, -(10 + f.rand() * 20) * u, 1.2, (8 + f.rand() * 6) * u, '#e8eef6', 3)));
    // ignition: big billowing clouds along the ground
    if (t > IGNITE && t < LIFTOFF + 1.4) {
      emit(f, 'bill', 40, () => {
        const dir = f.rand() < 0.5 ? -1 : 1;
        add(ps, P(x + dir * rw, FY - 20 * u, dir * (150 + f.rand() * 260) * u, -(f.rand() * 50) * u, 2.4, (22 + f.rand() * 22) * u, f.rand.pick(['#f2f2f2', '#d8dce4', '#c4c8d2']), 3));
      });
    }
    // exhaust trail during ascent
    if (t > LIFTOFF) emit(f, 'trail', 30, () => add(ps, P(rx + (f.rand() - 0.5) * rw * 0.6, ry + 20 * u, (f.rand() - 0.5) * 30 * u, (20 + f.rand() * 30) * u, 2.6, (14 + f.rand() * 12) * u, f.rand.pick(['#f2f2f2', '#e2e2ea', '#ffe2b0']), 3)));
    stepParts(ps, f.dt, 0);
    drawParts(g, ps);
    // flame
    if (t > IGNITE) {
      const fk = clamp((t - IGNITE) / 0.4);
      const fl = (1 + Math.sin(t * 50) * 0.1) * fk;
      glow(g, rx, ry + rh * 0.15, rh * 0.9 * fk, 'rgba(255,200,90,0.8)');
      g.save();
      g.translate(rx, ry);
      g.scale(1, -1);
      flame(g, 0, 0, rw * 1.1, rh * 0.8 * fl, t, 1);
      g.restore();
    }
    // rocket body
    g.save();
    g.translate(rx, ry);
    g.fillStyle = '#d42a3a';
    g.beginPath();
    g.moveTo(-rw * 0.5, -rh * 0.3);
    g.lineTo(-rw * 1.05, 0);
    g.lineTo(-rw * 0.5, -rh * 0.04);
    g.moveTo(rw * 0.5, -rh * 0.3);
    g.lineTo(rw * 1.05, 0);
    g.lineTo(rw * 0.5, -rh * 0.04);
    g.fill();
    g.fillStyle = '#f2f4f8';
    g.beginPath();
    g.moveTo(-rw * 0.5, 0);
    g.lineTo(-rw * 0.5, -rh * 0.7);
    g.quadraticCurveTo(-rw * 0.45, -rh * 0.92, 0, -rh);
    g.quadraticCurveTo(rw * 0.45, -rh * 0.92, rw * 0.5, -rh * 0.7);
    g.lineTo(rw * 0.5, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#d0d6e0';
    g.fillRect(rw * 0.15, -rh * 0.7, rw * 0.35, rh * 0.7);
    g.fillStyle = '#d42a3a';
    g.beginPath();
    g.moveTo(-rw * 0.47, -rh * 0.78);
    g.quadraticCurveTo(-rw * 0.4, -rh * 0.94, 0, -rh);
    g.quadraticCurveTo(rw * 0.4, -rh * 0.94, rw * 0.47, -rh * 0.78);
    g.closePath();
    g.fill();
    g.fillRect(-rw * 0.5, -rh * 0.2, rw, rh * 0.05);
    g.fillStyle = '#2a4a8a';
    g.beginPath();
    circ(g, 0, -rh * 0.58, rw * 0.22);
    g.fill();
    g.fillStyle = '#9fd8ff';
    g.beginPath();
    circ(g, 0, -rh * 0.58, rw * 0.15);
    g.fill();
    g.fillStyle = '#3a3f4a';
    g.fillRect(-rw * 0.35, 0, rw * 0.7, rh * 0.05);
    g.restore();
    // countdown and onlookers
    const cdx = L.portrait ? L.w * 0.8 : L.slots[1];
    const cdy = L.portrait ? FY * 0.18 : FY * 0.3;
    const n = t < 0.3 ? '' : t < 0.6 ? '3' : t < 0.9 ? '2' : t < 1.2 ? '1' : t < 2.4 ? 'LIFTOFF!' : '';
    if (n) caption(g, n, cdx, cdy, (n.length > 1 ? 52 : 110) * u, '#ffffff', 1);
    const ox = L.portrait ? [L.w * 0.12, L.w * 0.88] : [L.slots[1] - 90 * u, L.slots[1], L.slots[1] + 90 * u];
    for (let i = 0; i < ox.length; i++) person(g, ox[i], FY + 6 * u, 80 * u, { color: '#0e1424', pose: t > LIFTOFF ? 'cheer' : 'stand', phase: t + i, dir: -1 });
  },
  (t) => (t > IGNITE && t < LIFTOFF + 1.2 ? 5 * clamp((t - IGNITE) / 0.3) * (1 - clamp((t - LIFTOFF - 0.4) / 0.8)) : 0),
);

// ================================================================== ROBOTS

function robot(g: G, x: number, y: number, h: number, ph: number, body: string, eye: string, t: number): void {
  const w = h * 0.42;
  const step = Math.sin(ph * 6);
  const lift1 = Math.max(0, step) * h * 0.06;
  const lift2 = Math.max(0, -step) * h * 0.06;
  g.fillStyle = body;
  g.fillRect(x - w * 0.36, y - h * 0.34 - lift1, w * 0.26, h * 0.34);
  g.fillRect(x + w * 0.1, y - h * 0.34 - lift2, w * 0.26, h * 0.34);
  g.fillRect(x - w * 0.42, y - lift1 - h * 0.05, w * 0.36, h * 0.05);
  g.fillRect(x + w * 0.06, y - lift2 - h * 0.05, w * 0.36, h * 0.05);
  // torso
  g.fillRect(x - w * 0.5, y - h * 0.74, w, h * 0.42);
  // arms swing
  const sw = step * h * 0.06;
  g.fillRect(x - w * 0.72, y - h * 0.72 + sw, w * 0.18, h * 0.34);
  g.fillRect(x + w * 0.54, y - h * 0.72 - sw, w * 0.18, h * 0.34);
  // head
  g.fillRect(x - w * 0.34, y - h * 0.98, w * 0.68, h * 0.22);
  g.fillRect(x - 1, y - h * 1.08, 2, h * 0.1);
  // eyes and lights (cheap fake glow)
  const base = g.globalAlpha;
  g.fillStyle = eye;
  g.globalAlpha = base * 0.3;
  g.fillRect(x - w * 0.36, y - h * 0.93, w * 0.72, h * 0.12);
  g.globalAlpha = base;
  g.fillRect(x - w * 0.24, y - h * 0.9, w * 0.48, h * 0.05);
  g.fillStyle = Math.sin(t * 6 + ph) > 0 ? '#ff4d4d' : '#4a1a1a';
  g.beginPath();
  circ(g, x, y - h * 1.09, h * 0.025);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(x - w * 0.4, y - h * 0.68, w * 0.8, h * 0.08);
  g.fillStyle = eye;
  g.fillRect(x - w * 0.12, y - h * 0.56, w * 0.24, h * 0.1);
}

const robots = mk(
  4.0,
  (f) => {
    const { g, L, t } = f;
    const u = U(L);
    const FY = floorY(L, u);
    sky(g, L, ['#04050e', '#0e1330', '#1c1f4a', '#2e1236']);
    // giant robot rising behind the skyline
    const gx = L.portrait ? L.w * 0.5 : L.slots[1];
    const rise = easeOut(clamp((t - 0.3) / 1.6));
    const gh = (L.portrait ? 260 : 360) * u;
    const gy = FY + gh * 0.9 - rise * gh * 0.75;
    g.fillStyle = '#121528';
    g.fillRect(gx - gh * 0.36, gy - gh * 0.56, gh * 0.72, gh);
    g.fillRect(gx - gh * 0.22, gy - gh * 0.86, gh * 0.44, gh * 0.3);
    g.fillRect(gx - gh * 0.6, gy - gh * 0.5, gh * 0.2, gh * 0.6);
    g.fillRect(gx + gh * 0.4, gy - gh * 0.5, gh * 0.2, gh * 0.6);
    const eyeOn = rise > 0.6 ? 1 : 0.3;
    glow(g, gx - gh * 0.09, gy - gh * 0.74, 50 * u, 'rgba(255,40,40,0.9)', eyeOn);
    glow(g, gx + gh * 0.09, gy - gh * 0.74, 50 * u, 'rgba(255,40,40,0.9)', eyeOn);
    g.fillStyle = '#ff4040';
    g.fillRect(gx - gh * 0.14, gy - gh * 0.76, gh * 0.09, gh * 0.04);
    g.fillRect(gx + gh * 0.05, gy - gh * 0.76, gh * 0.09, gh * 0.04);
    // scanning beam from the eyes
    if (rise > 0.7) {
      const a = Math.sin(t * 1.5) * 0.7;
      const base = g.globalAlpha;
      g.globalAlpha = base * 0.2 * clamp((rise - 0.7) * 4);
      g.fillStyle = '#ff3030';
      g.beginPath();
      g.moveTo(gx, gy - gh * 0.74);
      g.lineTo(gx + Math.sin(a - 0.08) * L.h, gy - gh * 0.74 + Math.cos(a - 0.08) * L.h);
      g.lineTo(gx + Math.sin(a + 0.08) * L.h, gy - gh * 0.74 + Math.cos(a + 0.08) * L.h);
      g.closePath();
      g.fill();
      g.globalAlpha = base;
    }
    skyline(g, L, FY - 30 * u, 'future', '#0a0c1c', 51, 'rgba(120,220,255,0.35)');
    floor(g, L, FY - 30 * u, '#080914');
    // drones
    for (let i = 0; i < 3; i++) {
      const dx = ((t * 70 * u + i * L.w * 0.37) % (L.w + 200)) - 100;
      const dy = FY * (0.15 + i * 0.08) + Math.sin(t * 2 + i) * 8 * u;
      aircraft(g, dx, dy, 60 * u, 1, 5, '#1a1e34', t);
    }
    // marching rows
    const ps = particles(f.mem);
    const rows: [number, number, string, string, number][] = [
      [FY - 26 * u, (L.portrait ? 62 : 76) * u, '#2a3048', '#ff5050', 0.5],
      [FY + 6 * u, (L.portrait ? 92 : 112) * u, '#4a5470', '#5cf2ff', 0],
    ];
    for (const [y, h, body, eye, off] of rows) {
      const spacing = h * 0.75;
      const shift = (t * 30 * u) % spacing;
      for (let x = -spacing + shift; x < L.w + spacing; x += spacing) {
        if (hidden(L, x, h * 0.3)) continue;
        robot(g, x, y, h, t + off, body, eye, t);
      }
    }
    // stomp dust on every step
    const stepI = Math.floor((t * 6) / Math.PI);
    if (at(f, 'st' + stepI, t)) {
      for (let k = 0; k < 8; k++) add(ps, P(visX(L, f.rand, 10), FY + 6 * u, (f.rand() - 0.5) * 50 * u, -f.rand() * 20 * u, 0.9, (10 + f.rand() * 10) * u, '#3a3a4a', 3));
    }
    stepParts(ps, f.dt, 0);
    drawParts(g, ps);
  },
  (t) => {
    const ph = ((t * 6) / Math.PI) % 1;
    return ph < 0.15 ? 2.5 * (1 - ph / 0.15) : 0;
  },
);

// ================================================================== registry

export const WORLD_SCENE_DEFS: Record<WorldSceneId, SceneDef> = {
  aliens,
  ufo,
  war,
  explosion,
  fire,
  storm,
  quake,
  flood,
  plague,
  hospital,
  police,
  prison,
  court,
  escape,
  crime,
  fight,
  riot,
  election,
  scandal,
  moneyUp,
  moneyDown,
  casino,
  hacker,
  rocket,
  robots,
};
