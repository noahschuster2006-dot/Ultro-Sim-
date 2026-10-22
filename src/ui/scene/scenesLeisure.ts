/**
 * Leisure scenes: hobbies, outings, sport and fun.
 *
 * Every scene is a short procedural animation painted on the stage canvas behind the phone.
 * The `def` wrapper multiplies everything by the fade envelope (frame.a), so the drawing code
 * paints at full strength. Landscape screens get a main group left of the phone (S.main) and a
 * secondary group right of it (S.alt); portrait screens centre the action in the top half.
 */
import type { LeisureSceneId } from './ids';
import {
  CONFETTI_COLORS,
  type EraLook,
  type Layout,
  type Particle,
  type SceneDef,
  type SceneFrame,
  caption,
  clamp,
  easeOut,
  glow,
  heart,
  lerp,
  makeRand,
  particles,
  sky,
  span,
  star,
  stepParticles,
} from './kit';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
interface P {
  x: number;
  y: number;
}

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
  port: boolean;
}

function stage(L: Layout): Stage {
  if (L.portrait) {
    const fh = Math.min(L.h * 0.18, L.w * 0.42);
    return { fh, gy: L.groundY - L.h * 0.02, main: L.w * 0.5, alt: null, sideW: L.w, port: true };
  }
  const left = L.phone.x;
  const right = L.w - (L.phone.x + L.phone.w);
  const sideW = Math.max(140, Math.min(left, right));
  const fh = Math.min(L.h * 0.22, sideW * 0.6);
  return { fh, gy: L.groundY, main: L.slots[0], alt: L.slots[1] ?? null, sideW, port: false };
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

/** Two anchor x positions: either side of the phone, or spread across a portrait screen. */
function pair(L: Layout, S: Stage, spread = 0.22): [number, number] {
  return S.alt !== null ? [S.main, S.alt] : [L.w * (0.5 - spread), L.w * (0.5 + spread)];
}

const preIndustrial = (e: EraLook) => e === 'ancient' || e === 'medieval' || e === 'early';
const screenAge = (e: EraLook) => e === 'modern' || e === 'future';

// ================================================================== small utilities

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

function spawn(f: SceneFrame, key: string, rate: number, cap: number, make: () => Particle): Particle[] {
  const ps = particles(f.mem, key);
  emit(f, key, rate, () => {
    if (ps.length < cap) ps.push(make());
  });
  return ps;
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + q, y);
  g.arcTo(x + w, y, x + w, y + h, q);
  g.arcTo(x + w, y + h, x, y + h, q);
  g.arcTo(x, y + h, x, y, q);
  g.arcTo(x, y, x + w, y, q);
  g.closePath();
}

function additive(g: G, fn: () => void): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  fn();
  g.restore();
}

/** Round particles without per-particle save/restore. */
function dots(g: G, ps: Particle[], fade = true): void {
  const a = g.globalAlpha;
  for (const p of ps) {
    g.globalAlpha = a * (fade ? clamp(1 - p.life / p.max) : 1);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, TAU);
    g.fill();
  }
  g.globalAlpha = a;
}

function floor(g: G, L: Layout, S: Stage, top: string, bot?: string): void {
  const gr = g.createLinearGradient(0, S.gy, 0, L.h);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bot ?? top);
  g.fillStyle = gr;
  g.fillRect(0, S.gy, L.w, L.h - S.gy);
}

function sun(g: G, x: number, y: number, r: number, col: string, halo: string): void {
  glow(g, x, y, r * 3.2, halo, 0.8);
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function cloud(g: G, x: number, y: number, s: number, col: string): void {
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, s * 0.5, 0, TAU);
  g.arc(x + s * 0.5, y - s * 0.2, s * 0.6, 0, TAU);
  g.arc(x + s * 1.05, y, s * 0.45, 0, TAU);
  g.fill();
  g.fillRect(x, y - s * 0.1, s * 1.05, s * 0.45);
}

function pine(g: G, x: number, y: number, h: number, col: string, snow?: string): void {
  g.fillStyle = col;
  g.fillRect(x - h * 0.04, y - h * 0.16, h * 0.08, h * 0.16);
  for (let i = 0; i < 3; i++) {
    const by = y - h * 0.12 - i * h * 0.24;
    const w = h * (0.3 - i * 0.07);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - w, by);
    g.lineTo(x, by - h * 0.42);
    g.lineTo(x + w, by);
    g.closePath();
    g.fill();
    if (snow) {
      g.fillStyle = snow;
      g.beginPath();
      g.moveTo(x - w * 0.42, by - h * 0.24);
      g.lineTo(x, by - h * 0.42);
      g.lineTo(x + w * 0.42, by - h * 0.24);
      g.quadraticCurveTo(x, by - h * 0.2, x - w * 0.42, by - h * 0.24);
      g.fill();
    }
  }
}

function roundTree(g: G, x: number, y: number, h: number, trunk: string, leaf: string, leaf2: string): void {
  g.fillStyle = trunk;
  g.fillRect(x - h * 0.05, y - h * 0.5, h * 0.1, h * 0.5);
  g.fillStyle = leaf;
  g.beginPath();
  g.arc(x, y - h * 0.7, h * 0.3, 0, TAU);
  g.arc(x - h * 0.22, y - h * 0.52, h * 0.2, 0, TAU);
  g.arc(x + h * 0.22, y - h * 0.54, h * 0.22, 0, TAU);
  g.fill();
  g.fillStyle = leaf2;
  g.beginPath();
  g.arc(x - h * 0.08, y - h * 0.8, h * 0.13, 0, TAU);
  g.fill();
}

function mountains(g: G, L: Layout, baseY: number, hgt: number, col: string, seed: number, step = 170, snow?: string): void {
  const r = makeRand(seed);
  const peaks: P[] = [];
  g.fillStyle = col;
  g.beginPath();
  let x = -step * r();
  g.moveTo(x, baseY);
  while (x < L.w + step) {
    const pk = { x: x + step * (0.4 + r() * 0.3), y: baseY - hgt * (0.55 + r() * 0.45) };
    peaks.push(pk);
    g.lineTo(pk.x, pk.y);
    x += step * (0.85 + r() * 0.5);
    g.lineTo(x, baseY - hgt * r() * 0.25);
  }
  g.lineTo(x, baseY);
  g.closePath();
  g.fill();
  if (snow) {
    g.fillStyle = snow;
    for (const p of peaks) {
      const s = hgt * 0.14;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + s * 0.8, p.y + s);
      g.lineTo(p.x + s * 0.25, p.y + s * 0.8);
      g.lineTo(p.x - s * 0.2, p.y + s * 1.05);
      g.lineTo(p.x - s * 0.8, p.y + s);
      g.closePath();
      g.fill();
    }
  }
}

function noteGlyph(g: G, x: number, y: number, s: number, col: string, dbl: boolean): void {
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineWidth = Math.max(1.5, s * 0.16);
  g.beginPath();
  g.ellipse(x, y, s * 0.42, s * 0.3, -0.4, 0, TAU);
  if (dbl) g.ellipse(x + s * 0.9, y - s * 0.2, s * 0.42, s * 0.3, -0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.36, y);
  g.lineTo(x + s * 0.36, y - s * 1.3);
  if (dbl) {
    g.lineTo(x + s * 1.26, y - s * 1.5);
    g.lineTo(x + s * 1.26, y - s * 0.2);
  } else g.quadraticCurveTo(x + s * 0.9, y - s * 0.9, x + s * 0.8, y - s * 0.55);
  g.stroke();
}

/** Floating music notes rising from (x, y). */
function notes(f: SceneFrame, key: string, x: () => number, y: number, rate: number, cols: string[], size: number): void {
  const ps = spawn(f, key, rate, 40, () => ({
    x: x(),
    y,
    vx: f.rand.range(-25, 25),
    vy: -f.rand.range(50, 95),
    life: 0,
    max: f.rand.range(1.3, 2),
    size: size * f.rand.range(0.75, 1.2),
    color: f.rand.pick(cols),
    kind: f.rand() < 0.4 ? 1 : 0,
    rot: f.rand() * TAU,
  }));
  stepParticles(ps, f.dt);
  const g = f.g;
  const a = g.globalAlpha;
  for (const p of ps) {
    g.globalAlpha = a * clamp(Math.min(p.life * 4, 1.4 - p.life / p.max));
    noteGlyph(g, p.x + Math.sin(p.life * 4 + (p.rot ?? 0)) * 8, p.y, p.size, p.color, p.kind === 1);
  }
  g.globalAlpha = a;
}

/** Floating hearts / sparkles rising. kind 0 heart, 1 star. */
function risers(f: SceneFrame, key: string, x: () => number, y: number, rate: number, cols: string[], size: number, kind: 0 | 1): void {
  const ps = spawn(f, key, rate, 40, () => ({ x: x(), y, vx: f.rand.range(-15, 15), vy: -f.rand.range(40, 80), life: 0, max: f.rand.range(1.2, 1.8), size: size * f.rand.range(0.7, 1.2), color: f.rand.pick(cols), rot: f.rand() * TAU }));
  stepParticles(ps, f.dt);
  const g = f.g;
  const a = g.globalAlpha;
  for (const p of ps) {
    g.globalAlpha = a * clamp(Math.min(p.life * 4, 1.3 - p.life / p.max));
    const px = p.x + Math.sin(p.life * 3 + (p.rot ?? 0)) * 6;
    if (kind === 0) heart(g, px, p.y, p.size, p.color);
    else star(g, px, p.y, p.size, p.color, p.life * 2);
  }
  g.globalAlpha = a;
}

// ================================================================== figures

interface FigO {
  color?: string;
  /** Torso colour (shirt). */
  accent?: string;
  dir?: 1 | -1;
  dress?: boolean;
  /** Arm angles (world space): 0 = down, +PI/2 = toward +x, PI = up. */
  aL?: number;
  aR?: number;
  /** Elbow bends added to the forearm angle. */
  bL?: number;
  bR?: number;
  /** Hand targets (override angles; solved with a 2-bone arm). */
  hL?: P;
  hR?: P;
  legs?: 'stand' | 'walk' | 'sit' | 'kneel' | 'wide' | 'tree' | 'crouch' | 'cross';
  phase?: number;
  /** Upper-body tilt around the hip (radians, + leans toward +x). */
  lean?: number;
  hat?: 'none' | 'chef' | 'cap' | 'beanie' | 'bun' | 'tophat' | 'helmet' | 'bandana' | 'beret';
  hatColor?: string;
}

interface Pose {
  lh: P;
  rh: P;
  head: P;
  hr: number;
  sh: P;
  hip: P;
}

function arm(g: G, s: P, ang: number, bend: number, u: number, fl: number, target: P | undefined, side: 1 | -1): P {
  let e: P;
  let hnd: P;
  if (target) {
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const d = Math.max(1e-3, Math.hypot(dx, dy));
    const dd = Math.min(d, u + fl - 0.01);
    const a = (u * u - fl * fl + dd * dd) / (2 * dd);
    const hh = Math.sqrt(Math.max(0, u * u - a * a));
    const bx = s.x + (dx / d) * a;
    const by = s.y + (dy / d) * a;
    e = { x: bx + side * hh * (-dy / d), y: by + side * hh * (dx / d) };
    hnd = { x: s.x + (dx / d) * dd, y: s.y + (dy / d) * dd };
    if (d <= u + fl) hnd = target;
  } else {
    e = { x: s.x + Math.sin(ang) * u, y: s.y + Math.cos(ang) * u };
    hnd = { x: e.x + Math.sin(ang + bend) * fl, y: e.y + Math.cos(ang + bend) * fl };
  }
  g.beginPath();
  g.moveTo(s.x, s.y);
  g.lineTo(e.x, e.y);
  g.lineTo(hnd.x, hnd.y);
  g.stroke();
  return hnd;
}

/** A flat silhouette figure; (x, y) is the point between the feet, h the standing height. */
function fig(g: G, x: number, y: number, h: number, o: FigO = {}): Pose {
  const col = o.color ?? '#1d2233';
  const dir = o.dir ?? 1;
  const lw = Math.max(2, h * 0.075);
  const legs = o.legs ?? 'stand';
  const ph = o.phase ?? 0;
  let hipY = y - h * 0.42;
  if (legs === 'sit' || legs === 'kneel' || legs === 'crouch') hipY = y - h * 0.3;
  else if (legs === 'cross') hipY = y - h * 0.07;
  else if (legs === 'wide') hipY = y - h * 0.37;
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.beginPath();
  const L = (pts: number[]) => {
    g.moveTo(x, hipY);
    for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  };
  switch (legs) {
    case 'walk': {
      const s = Math.sin(ph * 7) * h * 0.12;
      L([x - h * 0.08 + s, y]);
      L([x + h * 0.08 - s, y]);
      break;
    }
    case 'sit':
      L([x + dir * h * 0.2, hipY, x + dir * h * 0.21, y]);
      L([x + dir * h * 0.17, hipY + h * 0.02, x + dir * h * 0.15, y]);
      break;
    case 'kneel':
      L([x + dir * h * 0.15, y - h * 0.02, x - dir * h * 0.12, y]);
      L([x + dir * h * 0.17, y - h * 0.17, x + dir * h * 0.19, y]);
      break;
    case 'wide':
      L([x - h * 0.13, y - h * 0.18, x - h * 0.22, y]);
      L([x + h * 0.2, y]);
      break;
    case 'tree':
      L([x, y]);
      L([x + dir * h * 0.17, hipY + h * 0.14, x + dir * h * 0.02, hipY + h * 0.2]);
      break;
    case 'crouch':
      L([x + dir * h * 0.15, y - h * 0.15, x, y]);
      L([x + dir * h * 0.12, y - h * 0.14, x - dir * h * 0.04, y]);
      break;
    case 'cross':
      L([x - h * 0.19, y - h * 0.01, x + h * 0.06, y]);
      L([x + h * 0.19, y - h * 0.01, x - h * 0.06, y]);
      break;
    default:
      L([x - h * 0.08, y]);
      L([x + h * 0.08, y]);
  }
  g.stroke();
  const lean = o.lean ?? 0;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const rot = (px: number, py: number): P => {
    const dx = px - x;
    const dy = py - hipY;
    return { x: x + dx * c - dy * s, y: hipY + dx * s + dy * c };
  };
  const top = rot(x, hipY - h * 0.32);
  const hip = { x, y: hipY };
  if (o.dress) {
    const a1 = rot(x - h * 0.05, hipY - h * 0.32);
    const a2 = rot(x + h * 0.05, hipY - h * 0.32);
    const b1 = rot(x + h * 0.15, hipY + h * 0.1);
    const b2 = rot(x - h * 0.15, hipY + h * 0.1);
    g.fillStyle = o.accent ?? col;
    g.beginPath();
    g.moveTo(a1.x, a1.y);
    g.lineTo(a2.x, a2.y);
    g.lineTo(b1.x, b1.y);
    g.lineTo(b2.x, b2.y);
    g.closePath();
    g.fill();
    g.fillStyle = col;
  } else {
    g.strokeStyle = o.accent ?? col;
    g.lineWidth = lw * 2;
    g.beginPath();
    g.moveTo(hip.x, hip.y);
    g.lineTo(top.x, top.y);
    g.stroke();
    g.strokeStyle = col;
    g.lineWidth = lw;
  }
  const shp = rot(x, hipY - h * 0.29);
  const u = h * 0.17;
  const fl = h * 0.16;
  const lh = arm(g, shp, o.aL ?? -0.2, o.bL ?? 0, u, fl, o.hL, -1);
  const rh = arm(g, shp, o.aR ?? 0.2, o.bR ?? 0, u, fl, o.hR, 1);
  const hr = h * 0.13;
  const head = rot(x, hipY - h * 0.32 - hr * 1.05);
  g.beginPath();
  g.arc(head.x, head.y, hr, 0, TAU);
  g.fill();
  const hat = o.hat ?? 'none';
  if (hat !== 'none') {
    g.fillStyle = o.hatColor ?? o.accent ?? '#ffffff';
    const hx = head.x;
    const hy = head.y;
    g.beginPath();
    switch (hat) {
      case 'chef':
        g.fillRect(hx - hr * 0.85, hy - hr * 1.15, hr * 1.7, hr * 0.5);
        g.arc(hx - hr * 0.45, hy - hr * 1.6, hr * 0.6, 0, TAU);
        g.arc(hx + hr * 0.45, hy - hr * 1.6, hr * 0.6, 0, TAU);
        g.arc(hx, hy - hr * 1.95, hr * 0.65, 0, TAU);
        break;
      case 'cap':
        g.arc(hx, hy - hr * 0.2, hr * 1.02, Math.PI, 0);
        g.rect(hx, hy - hr * 0.35, dir * hr * 1.5, hr * 0.28);
        break;
      case 'beanie':
        g.arc(hx, hy - hr * 0.15, hr * 1.08, Math.PI, 0);
        g.arc(hx, hy - hr * 1.3, hr * 0.32, 0, TAU);
        break;
      case 'bun':
        g.arc(hx - dir * hr * 0.4, hy - hr * 1.05, hr * 0.5, 0, TAU);
        break;
      case 'tophat':
        g.rect(hx - hr * 1.3, hy - hr * 0.95, hr * 2.6, hr * 0.3);
        g.rect(hx - hr * 0.8, hy - hr * 2.3, hr * 1.6, hr * 1.4);
        break;
      case 'helmet':
        g.arc(hx, hy - hr * 0.1, hr * 1.18, Math.PI, 0);
        break;
      case 'beret':
        g.ellipse(hx + dir * hr * 0.25, hy - hr * 0.8, hr * 1.15, hr * 0.42, dir * 0.25, 0, TAU);
        break;
      case 'bandana':
        g.rect(hx - hr * 1.02, hy - hr * 0.55, hr * 2.04, hr * 0.38);
        g.moveTo(hx - dir * hr, hy - hr * 0.4);
        g.lineTo(hx - dir * hr * 1.7, hy - hr * 0.1);
        g.lineTo(hx - dir * hr * 1.5, hy + hr * 0.2);
        break;
    }
    g.fill();
  }
  g.restore();
  return { lh, rh, head, hr, sh: shp, hip };
}

// ================================================================== scenes

// ---------------------------------------------------------------- gym

function barbell(g: G, a: P, b: P, h: number, plate: string): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const ext = h * 0.16;
  g.strokeStyle = '#c9ced8';
  g.lineWidth = Math.max(2, h * 0.025);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(a.x - ux * ext, a.y - uy * ext);
  g.lineTo(b.x + ux * ext, b.y + uy * ext);
  g.stroke();
  for (const [p, sgn] of [
    [a, -1],
    [b, 1],
  ] as const) {
    for (let i = 0; i < 2; i++) {
      const cx = p.x + sgn * ux * (ext * (0.62 + i * 0.28));
      const cy = p.y + sgn * uy * (ext * (0.62 + i * 0.28));
      const ph = h * (0.22 - i * 0.05);
      g.fillStyle = i ? '#1d2233' : plate;
      rr(g, cx - h * 0.025, cy - ph / 2, h * 0.05, ph, h * 0.015);
      g.fill();
    }
  }
}

function sweat(f: SceneFrame, key: string, head: P, hr: number, rate: number): void {
  const ps = spawn(f, key, rate, 30, () => ({ x: head.x + f.rand.range(-hr, hr), y: head.y - hr * 0.3, vx: f.rand.range(-80, 80), vy: -f.rand.range(60, 140), life: 0, max: 0.9, size: hr * 0.22, color: '#7fd3ff' }));
  stepParticles(ps, f.dt, 420);
  const g = f.g;
  const a = g.globalAlpha;
  g.fillStyle = '#7fd3ff';
  for (const p of ps) {
    g.globalAlpha = a * clamp(1 - p.life / p.max);
    g.beginPath();
    g.moveTo(p.x, p.y - p.size * 1.8);
    g.quadraticCurveTo(p.x + p.size * 1.1, p.y, p.x, p.y + p.size);
    g.quadraticCurveTo(p.x - p.size * 1.1, p.y, p.x, p.y - p.size * 1.8);
    g.fill();
  }
  g.globalAlpha = a;
}

const gym = def(3.2, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const [ax, bx] = pair(L, S, 0.26);
  const lx = S.port ? L.w * 0.5 : ax;
  if (era === 'ancient') {
    sky(g, L, ['#5fb4ea', '#bfe3f6', '#f8ecd2']);
    floor(g, L, S, '#e7d6b0', '#c9ae7e');
    const colH = fh * 1.75;
    const top = gy - colH;
    g.fillStyle = '#f4ecd8';
    g.fillRect(0, top - fh * 0.16, L.w, fh * 0.16);
    for (const px of S.port ? [L.w * 0.5] : [ax, bx]) {
      g.fillStyle = '#efe3c6';
      g.beginPath();
      g.moveTo(px - fh * 1.3, top - fh * 0.16);
      g.lineTo(px, top - fh * 0.58);
      g.lineTo(px + fh * 1.3, top - fh * 0.16);
      g.closePath();
      g.fill();
      g.fillStyle = '#d8c59c';
      g.beginPath();
      g.moveTo(px - fh * 0.9, top - fh * 0.22);
      g.lineTo(px, top - fh * 0.48);
      g.lineTo(px + fh * 0.9, top - fh * 0.22);
      g.closePath();
      g.fill();
    }
    const step = fh * 0.62;
    for (let x = step * 0.3; x < L.w; x += step) {
      g.fillStyle = '#f7f0df';
      g.fillRect(x - fh * 0.09, top, fh * 0.18, colH);
      g.fillStyle = '#d9c9a5';
      for (let k = -1; k <= 1; k++) g.fillRect(x + k * fh * 0.05 - 1, top + fh * 0.08, 2, colH - fh * 0.16);
      g.fillStyle = '#e6d8b6';
      g.fillRect(x - fh * 0.13, top, fh * 0.26, fh * 0.07);
      g.fillRect(x - fh * 0.13, gy - fh * 0.07, fh * 0.26, fh * 0.07);
    }
    glow(g, lx, gy - fh * 0.6, fh * 1.1, 'rgba(255,214,120,0.55)');
  } else {
    const oldHall = preIndustrial(era);
    sky(g, L, era === 'future' ? ['#0a1030', '#16245a', '#1d3570'] : oldHall ? ['#3a2f2a', '#4e3f36', '#5e4c40'] : ['#1b2340', '#283563', '#344680']);
    g.fillStyle = era === 'future' ? '#00f5d4' : oldHall ? '#b5651d' : '#ff7a3d';
    g.fillRect(0, gy - fh * 1.25, L.w, fh * 0.08);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < L.w; x += fh * 0.9) g.fillRect(x + fh * 0.1, gy - fh * 2.2, fh * 0.55, fh * 0.75);
    floor(g, L, S, '#20232c', '#14161c');
    glow(g, lx, gy - fh * 0.7, fh * 1.2, era === 'future' ? 'rgba(0,245,212,0.35)' : 'rgba(255,140,60,0.4)');
  }
  // lifter: clean-and-press cycle
  const l = 0.5 - 0.5 * Math.cos(t * TAU * 0.6);
  const ft = gy;
  const hipY = ft - fh * 0.42;
  const shY = hipY - fh * 0.29;
  const barY = lerp(shY + fh * 0.02, shY - fh * 0.31, l);
  const hw = fh * 0.2;
  const p = fig(g, lx, ft, fh, {
    color: era === 'ancient' ? '#b5651d' : '#1d2233',
    accent: era === 'ancient' ? '#b5651d' : '#ff4d6d',
    legs: 'wide',
    hL: { x: lx - hw, y: barY },
    hR: { x: lx + hw, y: barY },
    hat: era === 'ancient' ? 'none' : 'bandana',
    hatColor: '#ffd166',
  });
  barbell(g, p.lh, p.rh, fh, era === 'ancient' ? '#8a8f99' : '#ff4d6d');
  if (l > 0.93) {
    additive(g, () => {
      for (let i = 0; i < 3; i++) star(g, lx + (i - 1) * fh * 0.35, barY - fh * 0.2 - Math.abs(i - 1) * -fh * 0.05, fh * 0.06, '#ffe066', t * 3 + i);
    });
  }
  sweat(f, 'sw', p.head, p.hr, 7);
  if (S.port) return;
  // secondary station
  if (screenAge(era)) {
    // treadmill runner
    const tx = bx;
    const base = gy;
    const bw = fh * 0.9;
    g.fillStyle = '#3a3f4d';
    g.beginPath();
    g.moveTo(tx - bw * 0.55, base);
    g.lineTo(tx + bw * 0.45, base);
    g.lineTo(tx + bw * 0.45, base - fh * 0.1);
    g.lineTo(tx - bw * 0.55, base - fh * 0.05);
    g.closePath();
    g.fill();
    g.strokeStyle = '#6c7386';
    g.lineWidth = fh * 0.035;
    g.beginPath();
    g.moveTo(tx + bw * 0.4, base - fh * 0.1);
    g.lineTo(tx + bw * 0.5, base - fh * 0.62);
    g.stroke();
    g.fillStyle = era === 'future' ? '#00f5d4' : '#4cc9f0';
    rr(g, tx + bw * 0.38, base - fh * 0.72, fh * 0.26, fh * 0.12, fh * 0.03);
    g.fill();
    // belt stripes moving
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) {
      const u = (i / 6 + t * 1.6) % 1;
      g.fillRect(tx + bw * 0.4 - u * bw * 0.9, base - fh * 0.07 + u * fh * 0.03, fh * 0.03, fh * 0.03);
    }
    const run = fig(g, tx - fh * 0.05, base - fh * 0.07, fh * 0.95, { color: '#1d2233', accent: '#06d6a0', legs: 'walk', phase: t * 1.8, aL: -0.6 + Math.sin(t * 12.6) * 0.7, bL: 1.6, aR: 0.6 - Math.sin(t * 12.6) * 0.7, bR: 1.6, lean: 0.12, hat: 'cap', hatColor: '#06d6a0' });
    sweat(f, 'sw2', run.head, run.hr, 4);
  } else {
    // weights rack and a figure curling dumbbells (or a discus thrower in antiquity)
    if (era === 'ancient') {
      const sp = t * 5;
      const pp = fig(g, bx, gy, fh, { color: '#a0522d', legs: 'wide', aR: Math.PI / 2 + Math.sin(sp) * 1.1, aL: -Math.PI / 2 - Math.sin(sp) * 0.6, lean: Math.sin(sp) * 0.15 });
      g.fillStyle = '#c0a060';
      g.beginPath();
      g.ellipse(pp.rh.x, pp.rh.y, fh * 0.07, fh * 0.04, sp, 0, TAU);
      g.fill();
    } else {
      g.fillStyle = '#4a3a2a';
      g.fillRect(bx + fh * 0.3, gy - fh * 0.55, fh * 0.06, fh * 0.55);
      g.fillRect(bx + fh * 0.7, gy - fh * 0.55, fh * 0.06, fh * 0.55);
      g.fillRect(bx + fh * 0.28, gy - fh * 0.5, fh * 0.5, fh * 0.04);
      g.fillRect(bx + fh * 0.28, gy - fh * 0.25, fh * 0.5, fh * 0.04);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#2b2b2b';
        g.beginPath();
        g.arc(bx + fh * (0.38 + i * 0.14), gy - fh * 0.56, fh * 0.05, 0, TAU);
        g.arc(bx + fh * (0.38 + i * 0.14), gy - fh * 0.31, fh * 0.06, 0, TAU);
        g.fill();
      }
      const c = 0.5 - 0.5 * Math.cos(t * TAU * 0.9);
      const pp = fig(g, bx - fh * 0.15, gy, fh, { color: '#1d2233', accent: '#e76f51', aL: -0.15, bL: -c * 2.4, aR: 0.15, bR: c * 2.4, hat: era === 'industrial' ? 'none' : 'cap', hatColor: '#e76f51' });
      for (const hnd of [pp.lh, pp.rh]) {
        g.fillStyle = '#2b2b2b';
        g.fillRect(hnd.x - fh * 0.07, hnd.y - fh * 0.012, fh * 0.14, fh * 0.024);
        g.beginPath();
        g.arc(hnd.x - fh * 0.07, hnd.y, fh * 0.035, 0, TAU);
        g.arc(hnd.x + fh * 0.07, hnd.y, fh * 0.035, 0, TAU);
        g.fill();
      }
    }
  }
});

// ---------------------------------------------------------------- yoga

function leaves(f: SceneFrame, key: string, rate: number, cols: string[]): void {
  const { L } = f;
  const ps = spawn(f, key, rate, 40, () => ({ x: f.rand.range(-0.1, 0.8) * L.w, y: -20, vx: f.rand.range(30, 90), vy: f.rand.range(40, 80), life: 0, max: 6, size: f.rand.range(6, 11), color: f.rand.pick(cols), rot: f.rand() * TAU, vr: f.rand.range(-3, 3) }));
  if (!f.mem[`${key}#seed`]) {
    f.mem[`${key}#seed`] = 1;
    for (let i = 0; i < 10; i++) ps.push({ x: f.rand() * L.w, y: f.rand() * L.groundY, vx: f.rand.range(30, 90), vy: f.rand.range(40, 80), life: 0, max: 6, size: f.rand.range(6, 11), color: f.rand.pick(cols), rot: f.rand() * TAU, vr: f.rand.range(-3, 3) });
  }
  stepParticles(ps, f.dt);
  const g = f.g;
  for (const p of ps) {
    const sx = p.x + Math.sin(p.life * 2 + p.size) * 20;
    g.save();
    g.translate(sx, p.y);
    g.rotate(p.rot ?? 0);
    g.fillStyle = p.color;
    g.beginPath();
    g.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
    g.fill();
    g.restore();
  }
}

const yoga = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  const [ax, bx] = pair(L, S);
  sky(g, L, ['#3a2f7a', '#b4508f', '#ff8f6b', '#ffd28a']);
  const sx = S.port ? L.w * 0.5 : ax;
  const sy = lerp(gy - fh * 0.2, gy - fh * 1.15, span(t, 0, 2.6));
  sun(g, sx, sy, fh * 0.42, '#fff1b8', 'rgba(255,200,120,0.9)');
  mountains(g, L, gy, fh * 0.9, '#7a3f7d', 3, 220);
  mountains(g, L, gy, fh * 0.45, '#5a2d66', 9, 140);
  floor(g, L, S, '#3c6e47', '#24452c');
  // breathing rings
  const breathe = 0.5 + 0.5 * Math.sin(t * 2.2);
  g.strokeStyle = 'rgba(255,240,200,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const u = (t * 0.45 + i * 0.5) % 1;
    g.globalAlpha *= 1 - u;
    g.beginPath();
    g.arc(S.port ? L.w * 0.5 : ax, gy - fh * 0.6, fh * (0.5 + u * 0.8), 0, TAU);
    g.stroke();
    g.globalAlpha /= Math.max(0.01, 1 - u);
  }
  const mat = (x: number, col: string) => {
    g.fillStyle = col;
    rr(g, x - fh * 0.42, gy - fh * 0.03, fh * 0.84, fh * 0.06, fh * 0.03);
    g.fill();
  };
  const tx = S.port ? L.w * 0.5 : ax;
  mat(tx, '#06d6a0');
  const sway = Math.sin(t * 1.7) * 0.04;
  fig(g, tx, gy - fh * 0.02, fh, { color: '#2a1e4a', accent: '#ff5d8f', legs: 'tree', lean: sway, hL: { x: tx + sway * fh - fh * 0.02, y: gy - fh * (1.08 + breathe * 0.04) }, hR: { x: tx + sway * fh + fh * 0.02, y: gy - fh * (1.08 + breathe * 0.04) }, hat: 'bun', hatColor: '#2a1e4a' });
  if (!S.port) {
    mat(bx, '#ffd166');
    const reach = Math.sin(t * 1.4) * 0.1;
    fig(g, bx, gy - fh * 0.02, fh * 0.98, { color: '#2a1e4a', accent: '#4cc9f0', legs: 'wide', dress: false, aL: -Math.PI / 2 - reach, aR: Math.PI / 2 - reach, lean: reach * 0.5, hat: 'bun', hatColor: '#2a1e4a' });
  }
  leaves(f, 'lv', 3, ['#ffb703', '#fb8500', '#8ac926', '#e76f51']);
});

// ---------------------------------------------------------------- cinema

function audienceRow(g: G, L: Layout, y: number, s: number, col: string, seed: number, t: number): void {
  const r = makeRand(seed);
  g.fillStyle = col;
  for (let x = -s * 0.3 + r() * s * 0.4; x < L.w + s; x += s * (0.85 + r() * 0.3)) {
    const bob = Math.sin(t * 2 + x * 0.05) * s * 0.02;
    g.beginPath();
    g.arc(x, y - s * 0.62 + bob, s * 0.2, 0, TAU);
    g.fill();
    rr(g, x - s * 0.33, y - s * 0.42 + bob, s * 0.66, s * 0.6, s * 0.2);
    g.fill();
  }
}

const cinema = def(3.4, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const [ax, bx] = pair(L, S);
  const scrTop = S.port ? L.h * 0.07 : L.h * 0.08;
  const scrBot = S.port ? gy - fh * 0.75 : gy - fh * 1.05;
  const sx0 = L.w * 0.04;
  const sx1 = L.w * 0.96;
  const sw = sx1 - sx0;
  const sh = scrBot - scrTop;
  if (preIndustrial(era)) {
    // shadow-puppet theatre: a lamp-lit paper screen
    sky(g, L, ['#120806', '#22100a', '#2e160c']);
    g.fillStyle = '#5a2e14';
    g.fillRect(sx0 - fh * 0.08, scrTop - fh * 0.08, sw + fh * 0.16, sh + fh * 0.16);
    const flick = 0.92 + Math.sin(t * 23) * 0.03 + Math.sin(t * 9) * 0.04;
    const gr = g.createRadialGradient(L.w * 0.5, (scrTop + scrBot) / 2, 0, L.w * 0.5, (scrTop + scrBot) / 2, sw * 0.6);
    gr.addColorStop(0, `rgba(255,214,140,${flick})`);
    gr.addColorStop(1, `rgba(214,120,50,${flick})`);
    g.fillStyle = gr;
    g.fillRect(sx0, scrTop, sw, sh);
    const sg = scrBot - sh * 0.08;
    // puppets: a hero with a sword and a dragon
    const hx = S.port ? L.w * 0.32 : ax + Math.sin(t * 1.3) * fh * 0.3;
    const pp = fig(g, hx, sg + Math.abs(Math.sin(t * 4)) * -fh * 0.05, fh * 0.9, { color: '#1a0c05', aR: Math.PI * 0.75 + Math.sin(t * 5) * 0.4, aL: -0.5, hat: 'helmet', hatColor: '#1a0c05', legs: 'walk', phase: t * 0.6 });
    g.strokeStyle = '#1a0c05';
    g.lineWidth = fh * 0.03;
    g.beginPath();
    g.moveTo(pp.rh.x, pp.rh.y);
    g.lineTo(pp.rh.x + fh * 0.12, pp.rh.y - fh * 0.32);
    g.stroke();
    // control sticks
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(pp.rh.x, pp.rh.y);
    g.lineTo(pp.rh.x - fh * 0.05, scrBot);
    g.moveTo(pp.hip.x, pp.hip.y);
    g.lineTo(pp.hip.x, scrBot);
    g.stroke();
    const dx = S.port ? L.w * 0.7 : bx;
    const dy = scrTop + sh * 0.45 + Math.sin(t * 2.4) * sh * 0.1;
    dragon(g, dx, dy, fh * 0.9, t, '#1a0c05');
    // lamp and audience
    floor(g, L, S, '#1a0c06', '#0d0603');
    audienceRow(g, L, gy + fh * 0.05, fh * 0.8, '#0b0503', 4, t);
    return;
  }
  sky(g, L, ['#07060f', '#0d0b1d', '#120f26']);
  const sepia = era === 'industrial';
  g.fillStyle = '#5b0f1a';
  g.fillRect(sx0 - fh * 0.12, scrTop - fh * 0.1, sw + fh * 0.24, sh + fh * 0.2);
  const flick = sepia ? 0.85 + Math.sin(t * 31) * 0.08 : 1;
  const gr = g.createLinearGradient(0, scrTop, 0, scrBot);
  if (sepia) {
    gr.addColorStop(0, '#e9d9b0');
    gr.addColorStop(1, '#b9a275');
  } else {
    gr.addColorStop(0, '#1b2a6b');
    gr.addColorStop(0.6, '#6c3fa0');
    gr.addColorStop(1, '#ff7e6b');
  }
  g.save();
  g.globalAlpha *= flick;
  g.fillStyle = gr;
  g.fillRect(sx0, scrTop, sw, sh);
  g.beginPath();
  g.rect(sx0, scrTop, sw, sh);
  g.clip();
  if (sepia) {
    // silent comedy: a tramp figure with a cane, scratches
    const px = S.port ? L.w * 0.5 : ax + Math.sin(t * 2) * fh * 0.4;
    fig(g, px, scrBot - sh * 0.06, sh * 0.6, { color: '#3b2e1e', legs: 'walk', phase: t, hat: 'tophat', hatColor: '#3b2e1e', aR: 0.6 + Math.sin(t * 6) * 0.3 });
    g.strokeStyle = 'rgba(60,40,20,0.5)';
    g.lineWidth = 1;
    const r = makeRand(Math.floor(t * 12) + 3);
    for (let i = 0; i < 4; i++) {
      const x = sx0 + r() * sw;
      g.beginPath();
      g.moveTo(x, scrTop);
      g.lineTo(x + r() * 6, scrBot);
      g.stroke();
    }
    if (!S.port) caption(g, 'THE END?', bx, scrTop + sh * 0.45, fh * 0.28, '#3b2e1e', 0.85);
  } else {
    const r = makeRand(5);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) g.fillRect(sx0 + r() * sw, scrTop + r() * sh * 0.7, 2, 2);
    const plx = S.port ? L.w * 0.25 : ax - fh * 0.35;
    g.fillStyle = '#ffb4a2';
    g.beginPath();
    g.arc(plx, scrTop + sh * 0.4, sh * 0.2, 0, TAU);
    g.fill();
    g.strokeStyle = '#ffe5d9';
    g.lineWidth = sh * 0.03;
    g.beginPath();
    g.ellipse(plx, scrTop + sh * 0.4, sh * 0.34, sh * 0.07, -0.3, 0, TAU);
    g.stroke();
    const rx = lerp(S.port ? L.w * 0.1 : ax - fh * 0.2, S.port ? L.w * 0.9 : bx + fh * 0.4, (t / 3.4) % 1);
    rocket(g, rx, scrTop + sh * 0.55 - (t / 3.4) * sh * 0.3, sh * 0.22, t);
  }
  g.restore();
  // screen light spill
  glow(g, L.w * 0.5, scrBot, L.w * 0.6, sepia ? 'rgba(230,210,160,0.25)' : 'rgba(140,110,255,0.25)');
  floor(g, L, S, '#0c0a18', '#06050c');
  // seats + audience
  g.fillStyle = '#7a1424';
  for (let x = fh * 0.2; x < L.w; x += fh * 0.55) {
    rr(g, x - fh * 0.22, gy - fh * 0.22, fh * 0.44, fh * 0.5, fh * 0.08);
    g.fill();
  }
  audienceRow(g, L, gy + fh * 0.02, fh * 0.75, '#05040a', 11, t);
  // popcorn eater
  const mx = S.port ? L.w * 0.5 : ax + fh * 0.4;
  const by = gy - fh * 0.32;
  g.fillStyle = '#05040a';
  g.beginPath();
  g.arc(mx, by - fh * 0.08, fh * 0.12, 0, TAU);
  g.fill();
  rr(g, mx - fh * 0.2, by + fh * 0.04, fh * 0.4, fh * 0.4, fh * 0.12);
  g.fill();
  popcornBucket(f, mx + fh * 0.26, by + fh * 0.02, fh * 0.46);
  if (!S.port) popcornBucket(f, bx - fh * 0.3, by + fh * 0.04, fh * 0.4, 'pc2');
});

function rocket(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(-0.35);
  glow(g, -s * 0.9, 0, s * 0.6, 'rgba(255,190,80,0.9)');
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.12);
  g.lineTo(-s * (0.9 + Math.sin(t * 30) * 0.1), 0);
  g.lineTo(-s * 0.5, s * 0.12);
  g.fill();
  g.fillStyle = '#f1f1f1';
  g.beginPath();
  g.ellipse(0, 0, s * 0.55, s * 0.18, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ef476f';
  g.beginPath();
  g.moveTo(s * 0.35, -s * 0.15);
  g.quadraticCurveTo(s * 0.7, 0, s * 0.35, s * 0.15);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.35, -s * 0.15);
  g.lineTo(-s * 0.55, -s * 0.35);
  g.lineTo(-s * 0.15, -s * 0.15);
  g.moveTo(-s * 0.35, s * 0.15);
  g.lineTo(-s * 0.55, s * 0.35);
  g.lineTo(-s * 0.15, s * 0.15);
  g.fill();
  g.fillStyle = '#4cc9f0';
  g.beginPath();
  g.arc(s * 0.1, 0, s * 0.07, 0, TAU);
  g.fill();
  g.restore();
}

function dragon(g: G, x: number, y: number, s: number, t: number, col: string): void {
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  // body
  g.beginPath();
  g.ellipse(x, y, s * 0.32, s * 0.12, 0, 0, TAU);
  g.fill();
  // neck/head
  g.lineWidth = s * 0.07;
  g.beginPath();
  g.moveTo(x - s * 0.25, y - s * 0.03);
  g.quadraticCurveTo(x - s * 0.42, y - s * 0.25, x - s * 0.5, y - s * 0.2);
  g.stroke();
  g.beginPath();
  g.moveTo(x - s * 0.45, y - s * 0.26);
  g.lineTo(x - s * 0.68, y - s * 0.2);
  g.lineTo(x - s * 0.48, y - s * 0.12);
  g.fill();
  // tail
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(x + s * 0.28, y);
  g.quadraticCurveTo(x + s * 0.5, y + s * 0.15 * Math.sin(t * 3), x + s * 0.65, y - s * 0.08);
  g.stroke();
  // wing flap
  const w = Math.sin(t * 6);
  g.beginPath();
  g.moveTo(x - s * 0.1, y - s * 0.05);
  g.lineTo(x + s * 0.05, y - s * (0.1 + 0.45 * w));
  g.lineTo(x + s * 0.3, y - s * (0.08 + 0.3 * w));
  g.lineTo(x + s * 0.15, y - s * 0.03);
  g.fill();
}

function popcornBucket(f: SceneFrame, x: number, y: number, s: number, key = 'pc'): void {
  const g = f.g;
  const ps = spawn(f, key, 6, 25, () => ({ x: x + f.rand.range(-s * 0.25, s * 0.25), y: y - s * 0.05, vx: f.rand.range(-40, 40), vy: -f.rand.range(120, 200), life: 0, max: 1.2, size: s * f.rand.range(0.07, 0.1), color: f.rand() < 0.3 ? '#ffd166' : '#fff8e1', rot: 0, vr: f.rand.range(-6, 6) }));
  stepParticles(ps, f.dt, 380);
  glow(g, x, y, s * 1.2, 'rgba(255,220,140,0.35)');
  dots(g, ps, false);
  // heap
  g.fillStyle = '#fff3c4';
  g.beginPath();
  for (let i = 0; i < 5; i++) g.arc(x - s * 0.3 + i * s * 0.15, y - s * 0.02 - (i % 2) * s * 0.06, s * 0.12, 0, TAU);
  g.fill();
  // striped bucket
  g.save();
  g.beginPath();
  g.moveTo(x - s * 0.38, y);
  g.lineTo(x + s * 0.38, y);
  g.lineTo(x + s * 0.28, y + s * 0.7);
  g.lineTo(x - s * 0.28, y + s * 0.7);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.clip();
  g.fillStyle = '#e63946';
  for (let i = -3; i <= 3; i += 2) g.fillRect(x + i * s * 0.1 - s * 0.05, y, s * 0.1, s * 0.7);
  g.restore();
}

// ---------------------------------------------------------------- concert

function guitar(g: G, x: number, y: number, h: number, dir: 1 | -1, body: string, t: number, figCol: string, accent: string): Pose {
  const bc = { x: x + dir * h * 0.03, y: y - h * 0.5 };
  const ne = { x: x + dir * h * 0.44, y: y - h * 0.72 };
  const strum = Math.sin(t * 16) * h * 0.04;
  const fret = { x: lerp(bc.x, ne.x, 0.8), y: lerp(bc.y, ne.y, 0.8) };
  const pick = { x: bc.x - dir * h * 0.02, y: bc.y - h * 0.02 + strum };
  const p = fig(g, x, y, h, { color: figCol, accent, dir, hL: dir === 1 ? pick : fret, hR: dir === 1 ? fret : pick });
  g.strokeStyle = '#3b2a1a';
  g.lineWidth = h * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(bc.x, bc.y);
  g.lineTo(ne.x, ne.y);
  g.stroke();
  g.fillStyle = body;
  g.beginPath();
  g.arc(bc.x - dir * h * 0.04, bc.y + h * 0.03, h * 0.11, 0, TAU);
  g.arc(bc.x + dir * h * 0.06, bc.y - h * 0.02, h * 0.08, 0, TAU);
  g.fill();
  g.fillStyle = '#1d1d1d';
  g.beginPath();
  g.arc(bc.x + dir * h * 0.01, bc.y, h * 0.03, 0, TAU);
  g.fill();
  g.fillStyle = figCol;
  g.beginPath();
  g.arc(pick.x, pick.y, h * 0.03, 0, TAU);
  g.fill();
  return p;
}

function drumKit(g: G, x: number, y: number, h: number, t: number, figCol: string, accent: string, logo: string): void {
  const hit = Math.floor(t * 6) % 4;
  const up = (t * 6) % 1 < 0.5;
  const cymL = { x: x - h * 0.42, y: y - h * 0.62 };
  const cymR = { x: x + h * 0.45, y: y - h * 0.68 };
  const tomL = { x: x - h * 0.16, y: y - h * 0.5 };
  const tomR = { x: x + h * 0.18, y: y - h * 0.5 };
  const tL = hit % 2 === 0 ? cymL : tomL;
  const tR = hit < 2 ? tomR : cymR;
  const lift = (p: P, on: boolean): P => ({ x: p.x, y: p.y - (on && up ? h * 0.1 : 0) });
  fig(g, x, y - h * 0.05, h, { color: figCol, accent, legs: 'sit', hL: lift(tL, true), hR: lift(tR, true), hat: 'cap', hatColor: accent });
  g.strokeStyle = '#c9ced8';
  g.lineWidth = 2;
  for (const c of [cymL, cymR]) {
    g.beginPath();
    g.moveTo(c.x, c.y);
    g.lineTo(c.x, y);
    g.stroke();
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.ellipse(c.x, c.y, h * 0.15, h * 0.025, c.x < x ? 0.15 : -0.15, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#e63946';
  for (const tm of [tomL, tomR]) {
    rr(g, tm.x - h * 0.09, tm.y, h * 0.18, h * 0.1, h * 0.02);
    g.fill();
  }
  const kick = 1 + (Math.floor(t * 3) % 2 === 0 && (t * 3) % 1 < 0.2 ? 0.05 : 0);
  g.fillStyle = '#e63946';
  g.beginPath();
  g.arc(x, y - h * 0.2, h * 0.2 * kick, 0, TAU);
  g.fill();
  g.fillStyle = '#f8f9fa';
  g.beginPath();
  g.arc(x, y - h * 0.2, h * 0.16 * kick, 0, TAU);
  g.fill();
  caption(g, logo, x, y - h * 0.2, h * 0.11, '#e63946');
}

function crowd(f: SceneFrame, y: number, s: number, col: string, lights: boolean): void {
  const { g, L, t } = f;
  const r = makeRand(21);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineWidth = s * 0.09;
  const glows: P[] = [];
  for (let x = -s * 0.2; x < L.w + s; x += s * (0.42 + r() * 0.15)) {
    const ph = r() * TAU;
    const bob = Math.abs(Math.sin(t * 5.2 + ph)) * s * 0.08;
    const hy = y - s * 0.55 - bob;
    g.beginPath();
    g.arc(x, hy, s * 0.13, 0, TAU);
    g.fill();
    rr(g, x - s * 0.2, hy + s * 0.12, s * 0.4, s * 0.7, s * 0.12);
    g.fill();
    const both = r() < 0.5;
    const sw = Math.sin(t * 5.2 + ph) * 0.25;
    g.beginPath();
    g.moveTo(x + s * 0.12, hy + s * 0.2);
    const hx = x + s * (0.28 + sw * 0.3);
    const hyy = hy - s * 0.38;
    g.lineTo(hx, hyy);
    if (both) {
      g.moveTo(x - s * 0.12, hy + s * 0.2);
      g.lineTo(x - s * (0.28 - sw * 0.3), hyy);
    }
    g.stroke();
    if (lights && r() < 0.3) glows.push({ x: hx, y: hyy });
  }
  additive(g, () => {
    for (const p of glows) glow(g, p.x, p.y, s * 0.18, 'rgba(255,240,180,0.9)');
  });
}

const concert = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const fut = era === 'future';
  sky(g, L, ['#0b0220', '#1d0636', '#2c0b4a']);
  const stY = S.port ? gy - fh * 0.3 : gy - fh * 0.05;
  const cols = fut ? ['#00f5d4', '#f15bb5', '#9b5de5', '#00bbf9'] : ['#ff5d73', '#ffd166', '#4cc9f0', '#b388ff', '#06d6a0'];
  const trussY = L.h * 0.04;
  g.fillStyle = '#2a2a35';
  g.fillRect(0, trussY, L.w, fh * 0.06);
  const n = S.port ? 4 : 8;
  additive(g, () => {
    for (let i = 0; i < n; i++) {
      const x = (L.w * (i + 0.5)) / n;
      const ang = Math.sin(t * 1.6 + i * 1.3) * 0.45;
      const len = stY - trussY + fh * 0.4;
      const spread = 0.16;
      const col = cols[(i + Math.floor(t * 1.5)) % cols.length];
      const gr = g.createLinearGradient(x, trussY, x + Math.sin(ang) * len, trussY + len);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.45 * f.a;
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, trussY + fh * 0.06);
      g.lineTo(x + Math.sin(ang - spread) * len, trussY + Math.cos(ang - spread) * len);
      g.lineTo(x + Math.sin(ang + spread) * len, trussY + Math.cos(ang + spread) * len);
      g.closePath();
      g.fill();
      g.globalAlpha = f.a;
      glow(g, x, trussY + fh * 0.07, fh * 0.12, col);
    }
  });
  g.fillStyle = '#140d1f';
  g.fillRect(0, stY, L.w, L.h - stY);
  g.fillStyle = fut ? '#00f5d4' : '#ff4dd2';
  g.fillRect(0, stY, L.w, 3);
  const fc = '#120a1e';
  if (S.port) {
    guitar(g, L.w * 0.2, stY, fh * 0.92, 1, '#ffb703', t, fc, '#ef476f');
    const p = fig(g, L.w * 0.5, stY, fh, { color: fc, accent: '#4cc9f0', hR: { x: L.w * 0.5 + fh * 0.12, y: stY - fh * 0.82 }, aL: -2.4 + Math.sin(t * 5) * 0.3 });
    mic(g, L.w * 0.5 + fh * 0.12, stY, fh, p.rh);
    drumKit(g, L.w * 0.8, stY, fh * 0.8, t, fc, '#06d6a0', '★');
  } else {
    const ax = S.main;
    const bx = S.alt ?? S.main;
    const p = fig(g, ax - fh * 0.35, stY, fh, { color: fc, accent: '#4cc9f0', hR: { x: ax - fh * 0.23, y: stY - fh * 0.82 }, aL: -2.4 + Math.sin(t * 5) * 0.3 });
    mic(g, ax - fh * 0.23, stY, fh, p.rh);
    guitar(g, ax + fh * 0.45, stY, fh * 0.95, -1, '#ffb703', t, fc, '#ef476f');
    drumKit(g, bx - fh * 0.3, stY, fh * 0.9, t, fc, '#06d6a0', '★');
    guitar(g, bx + fh * 0.55, stY, fh * 0.95, -1, '#9b5de5', t + 0.3, fc, '#ffd166');
  }
  notes(f, 'nt', () => (S.port ? L.w * f.rand() : f.rand.pick([S.main, S.alt ?? S.main]) + f.rand.range(-1, 1) * fh * 0.8), stY - fh * 1.1, 6, cols, fh * 0.08);
  crowd(f, S.port ? gy + fh * 0.22 : gy + fh * 0.6, fh * 0.75, '#07030d', screenAge(era));
});

function mic(g: G, x: number, y: number, h: number, hand: P): void {
  g.strokeStyle = '#8d99ae';
  g.lineWidth = h * 0.02;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, hand.y + h * 0.05);
  g.stroke();
  g.beginPath();
  g.moveTo(x - h * 0.08, y);
  g.lineTo(x + h * 0.08, y);
  g.stroke();
  g.fillStyle = '#adb5bd';
  g.beginPath();
  g.arc(hand.x - h * 0.01, hand.y - h * 0.04, h * 0.035, 0, TAU);
  g.fill();
}

// ---------------------------------------------------------------- reading

function lamp(g: G, x: number, y: number, h: number, t: number, candle: boolean): void {
  if (candle) {
    g.fillStyle = '#5a3a22';
    g.fillRect(x - h * 0.12, y - h * 0.38, h * 0.24, h * 0.04);
    g.fillRect(x - h * 0.02, y - h * 0.38, h * 0.04, h * 0.38);
    g.fillStyle = '#f1e3c0';
    g.fillRect(x - h * 0.03, y - h * 0.5, h * 0.06, h * 0.12);
    const fl = 1 + Math.sin(t * 17) * 0.1;
    glow(g, x, y - h * 0.55, h * 0.9, 'rgba(255,190,90,0.5)');
    g.fillStyle = '#ffcf5a';
    g.beginPath();
    g.ellipse(x, y - h * 0.55, h * 0.02, h * 0.045 * fl, 0, 0, TAU);
    g.fill();
    return;
  }
  g.fillStyle = '#2b2018';
  g.fillRect(x - h * 0.015, y - h * 0.95, h * 0.03, h * 0.95);
  g.fillRect(x - h * 0.1, y - h * 0.02, h * 0.2, h * 0.02);
  additive(g, () => {
    const gr = g.createLinearGradient(0, y - h * 0.95, 0, y);
    gr.addColorStop(0, 'rgba(255,200,110,0.55)');
    gr.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - h * 0.12, y - h * 0.95);
    g.lineTo(x + h * 0.12, y - h * 0.95);
    g.lineTo(x + h * 0.5, y);
    g.lineTo(x - h * 0.5, y);
    g.closePath();
    g.fill();
    glow(g, x, y - h * 1.0, h * 0.6, 'rgba(255,190,90,0.6)');
  });
  g.fillStyle = '#f4a261';
  g.beginPath();
  g.moveTo(x - h * 0.07, y - h * 1.12);
  g.lineTo(x + h * 0.07, y - h * 1.12);
  g.lineTo(x + h * 0.14, y - h * 0.94);
  g.lineTo(x - h * 0.14, y - h * 0.94);
  g.closePath();
  g.fill();
}

function armchair(g: G, x: number, y: number, h: number, col: string, dark: string, part: 'back' | 'front'): void {
  if (part === 'back') {
    g.fillStyle = dark;
    rr(g, x - h * 0.42, y - h * 0.82, h * 0.6, h * 0.62, h * 0.14);
    g.fill();
    g.fillStyle = col;
    rr(g, x - h * 0.42, y - h * 0.34, h * 0.8, h * 0.22, h * 0.06);
    g.fill();
    g.fillStyle = dark;
    g.fillRect(x - h * 0.36, y - h * 0.12, h * 0.05, h * 0.12);
    g.fillRect(x + h * 0.3, y - h * 0.12, h * 0.05, h * 0.12);
  } else {
    g.fillStyle = col;
    rr(g, x + h * 0.22, y - h * 0.48, h * 0.2, h * 0.38, h * 0.08);
    g.fill();
  }
}

function openBook(g: G, x: number, y: number, s: number, t: number, cover: string): void {
  g.fillStyle = cover;
  g.beginPath();
  g.moveTo(x - s, y - s * 0.12);
  g.lineTo(x, y + s * 0.1);
  g.lineTo(x + s, y - s * 0.12);
  g.lineTo(x + s, y + s * 0.08);
  g.lineTo(x, y + s * 0.28);
  g.lineTo(x - s, y + s * 0.08);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff8e7';
  g.beginPath();
  g.moveTo(x - s * 0.92, y - s * 0.22);
  g.quadraticCurveTo(x - s * 0.45, y - s * 0.35, x, y);
  g.quadraticCurveTo(x + s * 0.45, y - s * 0.35, x + s * 0.92, y - s * 0.22);
  g.lineTo(x + s * 0.92, y + s * 0.02);
  g.quadraticCurveTo(x + s * 0.45, y - s * 0.1, x, y + s * 0.2);
  g.quadraticCurveTo(x - s * 0.45, y - s * 0.1, x - s * 0.92, y + s * 0.02);
  g.closePath();
  g.fill();
  // turning page
  const u = (t * 0.8) % 1;
  if (u < 0.5) {
    const k = Math.cos((u / 0.5) * Math.PI);
    g.fillStyle = '#efe2c4';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + k * s * 0.45, y - s * 0.35 - (1 - Math.abs(k)) * s * 0.3, x + k * s * 0.9, y - s * 0.22 - (1 - Math.abs(k)) * s * 0.25);
    g.lineTo(x + k * s * 0.9, y + s * 0.02 - (1 - Math.abs(k)) * s * 0.25);
    g.quadraticCurveTo(x + k * s * 0.45, y - s * 0.1, x, y + s * 0.2);
    g.closePath();
    g.fill();
  }
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?!&';

function floatingLetters(f: SceneFrame, key: string, x: number, y: number, s: number, cols: string[]): void {
  const g = f.g;
  const ps = spawn(f, key, 9, 40, () => ({ x: x + f.rand.range(-s, s) * 0.5, y, vx: f.rand.range(-30, 30), vy: -f.rand.range(40, 80), life: 0, max: f.rand.range(1.6, 2.4), size: s * f.rand.range(0.25, 0.4), color: f.rand.pick(cols), rot: f.rand.range(-0.5, 0.5), vr: f.rand.range(-1, 1), kind: Math.floor(f.rand() * GLYPHS.length) }));
  stepParticles(ps, f.dt);
  const a = g.globalAlpha;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of ps) {
    g.globalAlpha = a * clamp(Math.min(p.life * 3, 1.3 - p.life / p.max));
    g.font = `800 ${Math.round(p.size)}px Georgia, serif`;
    g.fillStyle = p.color;
    g.save();
    g.translate(p.x + Math.sin(p.life * 3 + p.size) * 10, p.y);
    g.rotate(p.rot ?? 0);
    g.fillText(GLYPHS[p.kind ?? 0], 0, 0);
    g.restore();
  }
  g.globalAlpha = a;
}

function bookshelf(g: G, x: number, y: number, w: number, h: number, seed: number): void {
  const r = makeRand(seed);
  g.fillStyle = '#4a2c18';
  g.fillRect(x - w / 2, y - h, w, h);
  const rows = 4;
  const rh = h / rows;
  const cols = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#f1faee'];
  for (let i = 0; i < rows; i++) {
    const by = y - h + (i + 1) * rh - rh * 0.08;
    g.fillStyle = '#2e1b0f';
    g.fillRect(x - w / 2 + 4, y - h + i * rh + 4, w - 8, rh - 6);
    let bx = x - w / 2 + 6;
    while (bx < x + w / 2 - 12) {
      const bw = 5 + r() * 7;
      const bh = rh * (0.55 + r() * 0.3);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(bx, by - bh, bw, bh);
      bx += bw + 1;
    }
  }
}

const reading = def(3.4, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const old = preIndustrial(era);
  sky(g, L, ['#2e1a12', '#4a2a1b', '#5e3622']);
  g.fillStyle = 'rgba(255,220,180,0.05)';
  for (let x = 0; x < L.w; x += fh * 0.24) g.fillRect(x, 0, fh * 0.1, gy);
  floor(g, L, S, '#3a2214', '#22140b');
  const [ax, bx] = pair(L, S, 0.27);
  const cx = S.port ? L.w * 0.5 : ax + fh * 0.1;
  // window with night sky
  const wx = S.port ? L.w * 0.8 : bx + fh * 0.5;
  const wy = gy - fh * 1.85;
  g.fillStyle = '#6b4226';
  g.fillRect(wx - fh * 0.42, wy - fh * 0.05, fh * 0.84, fh * 0.9);
  const wg = g.createLinearGradient(0, wy, 0, wy + fh * 0.8);
  wg.addColorStop(0, '#0f1b3d');
  wg.addColorStop(1, '#3a4f8a');
  g.fillStyle = wg;
  g.fillRect(wx - fh * 0.36, wy, fh * 0.72, fh * 0.78);
  g.fillStyle = '#fff4c2';
  g.beginPath();
  g.arc(wx + fh * 0.15, wy + fh * 0.2, fh * 0.09, 0, TAU);
  g.fill();
  g.fillStyle = '#6b4226';
  g.fillRect(wx - fh * 0.01, wy, fh * 0.03, fh * 0.78);
  g.fillRect(wx - fh * 0.36, wy + fh * 0.38, fh * 0.72, fh * 0.03);
  // rug
  g.fillStyle = '#8a2c3a';
  g.beginPath();
  g.ellipse(cx, gy + fh * 0.04, fh * 0.75, fh * 0.1, 0, 0, TAU);
  g.fill();
  lamp(g, cx - fh * 0.62, gy, fh * (old ? 1.6 : 1.1), t, old);
  armchair(g, cx, gy, fh, '#c0392b', '#962d22', 'back');
  const bookP = { x: cx + fh * 0.12, y: gy - fh * 0.52 };
  fig(g, cx - fh * 0.08, gy, fh * 0.95, { color: '#24161f', accent: '#2a9d8f', legs: 'sit', hL: { x: bookP.x - fh * 0.1, y: bookP.y + fh * 0.04 }, hR: { x: bookP.x + fh * 0.1, y: bookP.y + fh * 0.04 }, lean: -0.08 });
  armchair(g, cx, gy, fh, '#c0392b', '#962d22', 'front');
  glow(g, bookP.x, bookP.y, fh * 0.45, 'rgba(255,230,160,0.55)');
  openBook(g, bookP.x, bookP.y, fh * 0.16, t, '#264653');
  floatingLetters(f, 'lt', bookP.x, bookP.y - fh * 0.08, fh * 0.4, ['#ffd166', '#fff1c1', '#ffb4a2', '#a8dadc']);
  if (!S.port) {
    bookshelf(g, bx - fh * 0.3, gy, fh * 0.8, fh * 1.35, 4);
    // side table + steaming mug
    const tx = bx + fh * 0.5;
    g.fillStyle = '#5a3a22';
    g.fillRect(tx - fh * 0.2, gy - fh * 0.38, fh * 0.4, fh * 0.05);
    g.fillRect(tx - fh * 0.03, gy - fh * 0.38, fh * 0.06, fh * 0.38);
    g.fillStyle = '#e76f51';
    rr(g, tx - fh * 0.06, gy - fh * 0.5, fh * 0.12, fh * 0.12, fh * 0.02);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const yy = gy - fh * 0.52 - k * fh * 0.04;
        const xx = tx - fh * 0.02 + i * fh * 0.04 + Math.sin(k * 0.9 - t * 4 + i) * fh * 0.025;
        if (k) g.lineTo(xx, yy);
        else g.moveTo(xx, yy);
      }
      g.stroke();
    }
    // sleeping cat
    g.fillStyle = '#1b1220';
    g.beginPath();
    g.ellipse(bx + fh * 0.15, gy - fh * 0.06, fh * 0.16, fh * 0.07 + Math.sin(t * 2) * fh * 0.005, 0, 0, TAU);
    g.arc(bx + fh * 0.02, gy - fh * 0.09, fh * 0.06, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(bx - fh * 0.03, gy - fh * 0.13);
    g.lineTo(bx - fh * 0.01, gy - fh * 0.18);
    g.lineTo(bx + fh * 0.02, gy - fh * 0.14);
    g.moveTo(bx + fh * 0.03, gy - fh * 0.14);
    g.lineTo(bx + fh * 0.06, gy - fh * 0.18);
    g.lineTo(bx + fh * 0.07, gy - fh * 0.12);
    g.fill();
    caption(g, 'z', bx + fh * 0.0 + Math.sin(t * 2) * 4, gy - fh * 0.3 - ((t * 20) % 20), fh * 0.08, '#cdb4db', 0.8);
  }
});

// ---------------------------------------------------------------- shopping

function storefronts(g: G, L: Layout, y: number, s: number, era: EraLook): void {
  const r = makeRand(31);
  const walls = ['#ffb4a2', '#a8dadc', '#ffe8a3', '#cdb4db', '#b7e4c7', '#f4a261'];
  const aw = ['#e63946', '#1d3557', '#2a9d8f', '#9b5de5', '#f77f00', '#ef476f'];
  const old = preIndustrial(era);
  let x = -r() * s * 0.5;
  let i = 0;
  while (x < L.w) {
    const w = s * (1.3 + r() * 0.5);
    const h = s * (1.9 + r() * 0.6);
    g.fillStyle = walls[i % walls.length];
    g.fillRect(x, y - h, w - 4, h);
    if (old) {
      g.fillStyle = '#6b4226';
      g.beginPath();
      g.moveTo(x - 6, y - h);
      g.lineTo(x + w / 2, y - h - s * 0.4);
      g.lineTo(x + w + 2, y - h);
      g.fill();
    }
    // sign
    g.fillStyle = aw[(i + 2) % aw.length];
    g.fillRect(x + w * 0.15, y - h + s * 0.15, w * 0.66, s * 0.22);
    // window
    g.fillStyle = old ? '#6b4226' : '#fff6d6';
    g.fillRect(x + w * 0.08, y - s * 1.05, w * 0.52, s * 0.7);
    if (!old) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(x + w * 0.12, y - s * 1.0, w * 0.06, s * 0.6);
    } else {
      g.fillStyle = aw[(i + 3) % aw.length];
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(x + w * (0.15 + k * 0.12), y - s * 0.45, s * 0.06, 0, TAU);
        g.fill();
      }
    }
    // door
    g.fillStyle = '#3d2b1f';
    g.fillRect(x + w * 0.66, y - s * 0.95, w * 0.24, s * 0.95);
    // awning
    const ay = y - s * 1.25;
    const n = 6;
    for (let k = 0; k < n; k++) {
      g.fillStyle = k % 2 ? '#ffffff' : aw[i % aw.length];
      const x0 = x + (k * (w - 4)) / n;
      const ww = (w - 4) / n;
      g.beginPath();
      g.moveTo(x0, ay - s * 0.22);
      g.lineTo(x0 + ww, ay - s * 0.22);
      g.lineTo(x0 + ww + 2, ay + s * 0.1);
      g.arc(x0 + ww / 2 + 1, ay + s * 0.1, ww / 2 + 1, 0, Math.PI);
      g.closePath();
      g.fill();
    }
    x += w;
    i++;
  }
}

function tags(f: SceneFrame, key: string, rate: number, sym: string): void {
  const { g, L } = f;
  const cols = ['#ffd166', '#ff5d73', '#06d6a0', '#4cc9f0', '#ffffff'];
  const ps = spawn(f, key, rate, 30, () => ({ x: f.rand() * L.w, y: -20, vx: f.rand.range(-20, 20), vy: f.rand.range(70, 120), life: 0, max: 5, size: f.rand.range(12, 20), color: f.rand.pick(cols), rot: f.rand() * TAU, vr: f.rand.range(-3, 3) }));
  stepParticles(ps, f.dt);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of ps) {
    const s = p.size;
    g.save();
    g.translate(p.x + Math.sin(p.life * 3 + s) * 18, p.y);
    g.rotate(p.rot ?? 0);
    g.scale(Math.cos(p.life * 4 + s), 1);
    g.fillStyle = p.color;
    g.beginPath();
    g.moveTo(-s * 0.6, -s * 0.4);
    g.lineTo(s * 0.4, -s * 0.4);
    g.lineTo(s * 0.75, 0);
    g.lineTo(s * 0.4, s * 0.4);
    g.lineTo(-s * 0.6, s * 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#1d2233';
    g.font = `900 ${Math.round(s * 0.6)}px system-ui, sans-serif`;
    g.fillText(sym, -s * 0.1, 1);
    g.restore();
  }
}

function bags(g: G, hand: P, h: number, t: number, cols: string[], side: number): void {
  cols.forEach((c, i) => {
    const sw = Math.sin(t * 5 + i * 1.3) * 0.15;
    const bw = h * (0.16 + (i % 2) * 0.04);
    const bh = h * (0.2 + (i % 3) * 0.03);
    g.save();
    g.translate(hand.x + side * i * h * 0.05, hand.y);
    g.rotate(sw + side * i * 0.12);
    g.strokeStyle = '#1d2233';
    g.lineWidth = Math.max(1.5, h * 0.012);
    g.beginPath();
    g.moveTo(-bw * 0.25, h * 0.09);
    g.lineTo(0, 0);
    g.lineTo(bw * 0.25, h * 0.09);
    g.stroke();
    g.fillStyle = c;
    rr(g, -bw / 2, h * 0.08, bw, bh, h * 0.015);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-bw / 2, h * 0.08, bw, h * 0.03);
    g.restore();
  });
}

const shopping = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#6cc7ff', '#b5e4ff', '#ffe9c7']);
  storefronts(g, L, gy, fh * 0.95, era);
  floor(g, L, S, '#d9cfc2', '#b9ab98');
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < L.w; x += fh * 0.4) g.fillRect(x, gy, 2, L.h - gy);
  const [ax, bx] = pair(L, S);
  const mx = S.port ? L.w * 0.5 : ax;
  glow(g, mx, gy - fh * 0.5, fh * 0.9, 'rgba(255,255,255,0.6)');
  const p = fig(g, mx, gy, fh, { color: '#2b2d42', accent: '#ff5d8f', dress: true, legs: 'walk', phase: t * 0.9, aL: -0.35, aR: 0.35, hat: 'bun', hatColor: '#2b2d42' });
  bags(g, p.lh, fh, t, ['#ff5d73', '#ffd166', '#4cc9f0'], -1);
  bags(g, p.rh, fh, t + 1, ['#06d6a0', '#b388ff', '#ff9f1c'], 1);
  if (!S.port) {
    caption(g, era === 'modern' || era === 'future' ? 'SALE' : 'MARKET', bx, gy - fh * 1.55, fh * 0.32, '#ff5d73', 0.95);
    const q = fig(g, bx + fh * 0.3, gy, fh * 0.98, { color: '#2b2d42', accent: '#4cc9f0', dir: -1, aL: -0.3, hR: { x: bx + fh * 0.48, y: gy - fh * 0.85 } });
    bags(g, q.lh, fh, t + 2, ['#ffd166', '#ef476f'], -1);
    risers(f, 'sp', () => bx + f.rand.range(-1, 1) * fh * 0.6, gy - fh * 0.9, 4, ['#ffd166', '#ffffff'], fh * 0.05, 1);
  } else caption(g, 'SALE', L.w * 0.5, L.h * 0.1, fh * 0.28, '#ff5d73');
  tags(f, 'tg', 4, preIndustrial(era) ? '◎' : '%');
});

// ---------------------------------------------------------------- restaurant

function steamWisps(g: G, x: number, y: number, w: number, h: number, t: number, n: number, col = 'rgba(255,255,255,0.55)'): void {
  g.strokeStyle = col;
  g.lineWidth = Math.max(2, w * 0.05);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = x + (i - (n - 1) / 2) * (w / n);
    g.beginPath();
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const yy = y - u * h;
      const xx = x0 + Math.sin(u * 5 - t * 4 + i * 2) * w * 0.12 * u;
      if (k) g.lineTo(xx, yy);
      else g.moveTo(xx, yy);
    }
    g.stroke();
  }
}

function pendant(g: G, x: number, y: number, s: number, t: number, i: number): void {
  const sw = Math.sin(t * 1.4 + i) * 0.04;
  const lx = x + Math.sin(sw) * y;
  g.strokeStyle = '#1a0a08';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(lx, y);
  g.stroke();
  additive(g, () => glow(g, lx, y + s * 0.2, s * 2.2, 'rgba(255,180,90,0.55)'));
  g.fillStyle = '#d4a017';
  g.beginPath();
  g.moveTo(lx - s * 0.15, y);
  g.lineTo(lx + s * 0.15, y);
  g.lineTo(lx + s * 0.4, y + s * 0.25);
  g.lineTo(lx - s * 0.4, y + s * 0.25);
  g.closePath();
  g.fill();
}

function diningTable(g: G, x: number, y: number, h: number, t: number): void {
  const top = y - h * 0.42;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x - h * 0.45, top);
  g.lineTo(x + h * 0.45, top);
  g.lineTo(x + h * 0.5, top + h * 0.3);
  g.lineTo(x - h * 0.5, top + h * 0.3);
  g.closePath();
  g.fill();
  g.fillStyle = '#e9ecef';
  g.fillRect(x - h * 0.5, top + h * 0.26, h, h * 0.04);
  g.fillStyle = '#3b1f17';
  g.fillRect(x - h * 0.05, top + h * 0.3, h * 0.1, h * 0.12);
  // candle
  glow(g, x, top - h * 0.17, h * 0.4, 'rgba(255,200,100,0.6)');
  g.fillStyle = '#fff3d6';
  g.fillRect(x - h * 0.015, top - h * 0.12, h * 0.03, h * 0.12);
  g.fillStyle = '#ffcf5a';
  g.beginPath();
  g.ellipse(x, top - h * 0.15, h * 0.015, h * 0.03 * (1 + Math.sin(t * 15) * 0.15), 0, 0, TAU);
  g.fill();
  // glasses + plates
  for (const s of [-1, 1]) {
    g.fillStyle = '#ced4da';
    g.beginPath();
    g.ellipse(x + s * h * 0.25, top + h * 0.01, h * 0.1, h * 0.025, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + s * h * 0.12, top);
    g.lineTo(x + s * h * 0.12, top - h * 0.08);
    g.stroke();
    g.fillStyle = '#9d0208';
    g.beginPath();
    g.moveTo(x + s * h * 0.12 - h * 0.035, top - h * 0.14);
    g.lineTo(x + s * h * 0.12 + h * 0.035, top - h * 0.14);
    g.quadraticCurveTo(x + s * h * 0.12 + h * 0.03, top - h * 0.07, x + s * h * 0.12, top - h * 0.075);
    g.quadraticCurveTo(x + s * h * 0.12 - h * 0.03, top - h * 0.07, x + s * h * 0.12 - h * 0.035, top - h * 0.14);
    g.fill();
  }
}

const restaurant = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#2a0f12', '#4a1d1f', '#6b2b26']);
  g.fillStyle = '#3a1512';
  g.fillRect(0, gy - fh * 0.55, L.w, fh * 0.55);
  g.fillStyle = '#d4a017';
  g.fillRect(0, gy - fh * 0.57, L.w, 3);
  floor(g, L, S, '#24100d', '#140806');
  const xs = S.port ? [L.w * 0.2, L.w * 0.8] : [S.main - fh * 0.9, S.main + fh * 0.9, (S.alt ?? 0) - fh * 0.8, (S.alt ?? 0) + fh * 0.8];
  xs.forEach((x, i) => pendant(g, x, gy - fh * 1.9, fh * 0.35, t, i));
  const cx = S.port ? L.w * 0.42 : S.main - fh * 0.2;
  const dir = 1;
  const plate = { x: cx + fh * 0.36, y: gy - fh * 0.68 };
  const lift = span(t, 0.7, 1.6);
  const dome = { x: plate.x - lift * fh * 0.06, y: plate.y - fh * 0.03 - lift * fh * 0.32 };
  glow(g, plate.x, plate.y - fh * 0.1, fh * (0.4 + lift * 0.5), 'rgba(255,220,140,0.7)');
  fig(g, cx, gy, fh, { color: '#2b2d42', accent: '#ffffff', dir, hR: { x: plate.x - fh * 0.08, y: plate.y + fh * 0.03 }, hL: { x: dome.x - fh * 0.02, y: dome.y - fh * 0.16 }, hat: 'chef', hatColor: '#ffffff' });
  // plate + dish
  g.fillStyle = '#f1f3f5';
  g.beginPath();
  g.ellipse(plate.x, plate.y, fh * 0.2, fh * 0.04, 0, 0, TAU);
  g.fill();
  if (lift > 0.05) {
    g.fillStyle = '#c8742a';
    g.beginPath();
    g.ellipse(plate.x, plate.y - fh * 0.05, fh * 0.12, fh * 0.065, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#e09f3e';
    g.beginPath();
    g.ellipse(plate.x - fh * 0.03, plate.y - fh * 0.075, fh * 0.06, fh * 0.03, -0.3, 0, TAU);
    g.fill();
    g.fillStyle = '#52b788';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(plate.x + fh * (0.1 + i * 0.03) - fh * 0.03, plate.y - fh * 0.02, fh * 0.025, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#e63946';
    g.beginPath();
    g.arc(plate.x - fh * 0.12, plate.y - fh * 0.02, fh * 0.02, 0, TAU);
    g.fill();
    g.save();
    g.globalAlpha *= lift;
    steamWisps(g, plate.x, plate.y - fh * 0.1, fh * 0.2, fh * 0.35, t, 3);
    g.restore();
    risers(f, 'sp', () => plate.x + f.rand.range(-1, 1) * fh * 0.25, plate.y - fh * 0.1, 5 * lift, ['#ffd166', '#ffffff'], fh * 0.04, 1);
  }
  // cloche
  g.save();
  g.translate(dome.x, dome.y);
  g.rotate(-lift * 0.35);
  g.fillStyle = '#ced4da';
  g.beginPath();
  g.ellipse(0, 0, fh * 0.17, fh * 0.15, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.fillStyle = '#f8f9fa';
  g.beginPath();
  g.ellipse(-fh * 0.06, -fh * 0.08, fh * 0.03, fh * 0.05, -0.5, 0, TAU);
  g.fill();
  g.fillStyle = '#adb5bd';
  g.beginPath();
  g.arc(0, -fh * 0.16, fh * 0.025, 0, TAU);
  g.fill();
  g.fillRect(-fh * 0.18, -fh * 0.01, fh * 0.36, fh * 0.02);
  g.restore();
  if (!S.port) {
    const tx = S.alt ?? 0;
    fig(g, tx - fh * 0.45, gy, fh * 0.92, { color: '#2b2d42', accent: '#457b9d', legs: 'sit', dir: 1, hR: { x: tx - fh * 0.2, y: gy - fh * 0.5 + Math.sin(t * 3) * 3 } });
    fig(g, tx + fh * 0.45, gy, fh * 0.92, { color: '#2b2d42', accent: '#ef476f', legs: 'sit', dir: -1, dress: true, hL: { x: tx + fh * 0.33, y: gy - fh * 0.6 }, hat: 'bun', hatColor: '#2b2d42' });
    diningTable(g, tx, gy, fh, t);
    risers(f, 'hz', () => tx + f.rand.range(-0.3, 0.3) * fh, gy - fh * 0.75, 1.5, ['#ff8fa3', '#ffd6e0'], fh * 0.04, 0);
  }
});

// ---------------------------------------------------------------- cooking

function flame(g: G, x: number, y: number, s: number, t: number, cols: string[]): void {
  cols.forEach((c, i) => {
    const k = 1 - i * 0.28;
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x - s * 0.5 * k, y);
    for (let j = 0; j <= 4; j++) {
      const u = j / 4;
      const fx = x - s * 0.5 * k + u * s * k;
      const fy = y - s * k * (0.7 + 0.35 * Math.sin(t * 13 + j * 2.1 + i)) * (1 - Math.abs(u - 0.5) * 1.2);
      g.lineTo(fx, fy);
    }
    g.lineTo(x + s * 0.5 * k, y);
    g.closePath();
    g.fill();
  });
}

const cooking = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const old = preIndustrial(era);
  if (old) sky(g, L, ['#3a2416', '#4e3020', '#5c3a26']);
  else sky(g, L, ['#c9f2ea', '#b4e7de', '#a3ddd2']);
  // tiles / bricks
  g.strokeStyle = old ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  const ts = fh * 0.2;
  for (let y = gy; y > 0; y -= ts * (old ? 0.5 : 1)) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(L.w, y);
    g.stroke();
  }
  if (!old)
    for (let x = 0; x < L.w; x += ts) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, gy);
      g.stroke();
    }
  floor(g, L, S, old ? '#2a1a10' : '#6c757d', old ? '#1a0f08' : '#495057');
  const ctY = gy - fh * 0.44;
  const [ax, bx] = pair(L, S, 0.2);
  const cx = S.port ? L.w * 0.32 : ax - fh * 0.25;
  const stoveX = S.port ? L.w * 0.6 : ax + fh * 0.35;
  // flip cycle
  const per = 1.3;
  const u = (t % per) / per;
  const air = u < 0.62 ? u / 0.62 : -1;
  const jerk = u > 0.9 || u < 0.08 ? -fh * 0.04 : 0;
  const panC = { x: stoveX, y: ctY - fh * 0.16 + jerk };
  const handle = { x: panC.x - fh * 0.32, y: panC.y + fh * 0.02 };
  const p = fig(g, cx, gy, fh, { color: '#2b2d42', accent: '#ffffff', hR: handle, aL: -0.3, hat: old ? 'bandana' : 'chef', hatColor: old ? '#e76f51' : '#ffffff' });
  void p;
  // counter
  g.fillStyle = old ? '#6b4226' : '#3d5a80';
  g.fillRect(0, ctY, L.w, gy - ctY);
  g.fillStyle = old ? '#8b5a2b' : '#e9ecef';
  g.fillRect(0, ctY - fh * 0.04, L.w, fh * 0.05);
  if (!old) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = fh * 0.3; x < L.w; x += fh * 0.6) g.fillRect(x, ctY + fh * 0.1, fh * 0.12, fh * 0.03);
  }
  // burner + flame
  const flameCols = old ? ['#e85d04', '#faa307', '#ffe066'] : ['#3a86ff', '#4cc9f0', '#caf0f8'];
  if (old) {
    g.fillStyle = '#2b2b2b';
    g.fillRect(stoveX - fh * 0.2, ctY - fh * 0.06, fh * 0.4, fh * 0.03);
  }
  glow(g, stoveX, ctY - fh * 0.06, fh * 0.35, old ? 'rgba(255,140,40,0.7)' : 'rgba(80,160,255,0.6)');
  flame(g, stoveX, ctY - fh * 0.04, fh * 0.3, t, flameCols);
  // pan
  g.strokeStyle = '#212529';
  g.lineWidth = fh * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(handle.x, handle.y);
  g.lineTo(panC.x - fh * 0.19, panC.y);
  g.stroke();
  g.fillStyle = '#212529';
  g.beginPath();
  g.ellipse(panC.x, panC.y, fh * 0.21, fh * 0.06, 0, 0, Math.PI);
  g.lineTo(panC.x - fh * 0.21, panC.y - fh * 0.01);
  g.closePath();
  g.fill();
  // food
  const fy = air >= 0 ? panC.y - fh * 0.03 - Math.sin(air * Math.PI) * fh * 0.6 : panC.y - fh * 0.03;
  const rot = air >= 0 ? air * TAU : 0;
  const fx = panC.x + (air >= 0 ? Math.sin(air * Math.PI) * fh * 0.04 : 0);
  g.fillStyle = '#e9a23b';
  g.beginPath();
  g.ellipse(fx, fy, fh * 0.15, Math.max(2, Math.abs(Math.cos(rot)) * fh * 0.055 + fh * 0.015), Math.sin(rot) * 0.4, 0, TAU);
  g.fill();
  if (Math.cos(rot) > 0.2) {
    g.fillStyle = '#fff3b0';
    g.fillRect(fx - fh * 0.025, fy - fh * 0.02, fh * 0.05, fh * 0.02);
  }
  // sizzle + steam
  const sz = spawn(f, 'sz', 22, 60, () => ({ x: panC.x + f.rand.range(-1, 1) * fh * 0.12, y: panC.y - fh * 0.03, vx: f.rand.range(-90, 90), vy: -f.rand.range(80, 200), life: 0, max: 0.6, size: f.rand.range(1.2, 2.6), color: f.rand() < 0.5 ? '#ffd166' : '#ffffff' }));
  stepParticles(sz, f.dt, 500);
  additive(g, () => dots(g, sz));
  const st = spawn(f, 'st', 8, 40, () => ({ x: panC.x + f.rand.range(-1, 1) * fh * 0.1, y: panC.y - fh * 0.05, vx: f.rand.range(-10, 10), vy: -f.rand.range(40, 70), life: 0, max: 1.6, size: fh * f.rand.range(0.05, 0.09), color: 'rgba(255,255,255,0.35)' }));
  for (const q of st) q.size += f.dt * fh * 0.05;
  stepParticles(st, f.dt);
  dots(g, st);
  if (!S.port) {
    // pot on a second burner + shelf of jars
    const px = bx;
    flame(g, px, ctY - fh * 0.04, fh * 0.2, t + 1, flameCols);
    g.fillStyle = old ? '#3a3a3a' : '#e63946';
    rr(g, px - fh * 0.22, ctY - fh * 0.38, fh * 0.44, fh * 0.32, fh * 0.04);
    g.fill();
    const jig = Math.sin(t * 22) * fh * 0.01;
    g.fillStyle = old ? '#555' : '#c1121f';
    g.beginPath();
    g.ellipse(px, ctY - fh * 0.4 + jig, fh * 0.24, fh * 0.04, Math.sin(t * 17) * 0.05, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(px, ctY - fh * 0.45 + jig, fh * 0.03, 0, TAU);
    g.fill();
    steamWisps(g, px, ctY - fh * 0.48, fh * 0.4, fh * 0.6, t, 4, 'rgba(255,255,255,0.6)');
    g.fillStyle = old ? '#4a2c18' : '#ffffff';
    g.fillRect(px - fh * 0.7, gy - fh * 1.55, fh * 1.4, fh * 0.04);
    const jc = ['#e63946', '#ffb703', '#2a9d8f', '#9b5de5', '#fb8500'];
    jc.forEach((c, i) => {
      g.fillStyle = c;
      rr(g, px - fh * 0.62 + i * fh * 0.27, gy - fh * 1.75, fh * 0.16, fh * 0.2, fh * 0.03);
      g.fill();
    });
    // hanging utensils
    g.strokeStyle = '#495057';
    g.lineWidth = fh * 0.025;
    for (let i = 0; i < 3; i++) {
      const ux = px - fh * 0.4 + i * fh * 0.4;
      const sw = Math.sin(t * 2 + i) * 0.08;
      g.beginPath();
      g.moveTo(ux, gy - fh * 1.3);
      g.lineTo(ux + Math.sin(sw) * fh * 0.3, gy - fh * 1.0);
      g.stroke();
      g.fillStyle = '#495057';
      g.beginPath();
      g.ellipse(ux + Math.sin(sw) * fh * 0.33, gy - fh * 0.96, fh * 0.04, fh * 0.06, -sw, 0, TAU);
      g.fill();
    }
  }
});

// ---------------------------------------------------------------- beach

function waves(g: G, L: Layout, top: number, bot: number, t: number): void {
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, '#0077b6');
  gr.addColorStop(1, '#48cae4');
  g.fillStyle = gr;
  g.fillRect(0, top, L.w, bot - top);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2.5;
  for (let r = 0; r < 3; r++) {
    const y = lerp(top, bot, 0.25 + r * 0.25);
    g.beginPath();
    for (let x = 0; x <= L.w; x += 16) {
      const yy = y + Math.sin(x * 0.03 + t * (2 + r * 0.5) + r) * 3;
      if (x) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    g.stroke();
  }
  // foam edge
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.moveTo(0, bot);
  for (let x = 0; x <= L.w; x += 20) g.lineTo(x, bot - 3 - Math.abs(Math.sin(x * 0.02 + t * 2.5)) * 6);
  g.lineTo(L.w, bot + 4);
  g.lineTo(0, bot + 4);
  g.closePath();
  g.fill();
}

function gulls(g: G, L: Layout, t: number, y: number, s: number): void {
  g.strokeStyle = '#1d2233';
  g.lineWidth = Math.max(1.5, s * 0.12);
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.27 + t * 0.06) % 1.1) * L.w;
    const yy = y + Math.sin(t * 1.5 + i * 2) * s + i * s * 1.2;
    const fl = Math.sin(t * 8 + i) * s * 0.4;
    g.beginPath();
    g.moveTo(x - s, yy - fl);
    g.quadraticCurveTo(x - s * 0.4, yy - s * 0.5, x, yy);
    g.quadraticCurveTo(x + s * 0.4, yy - s * 0.5, x + s, yy - fl);
    g.stroke();
  }
}

function umbrella(g: G, x: number, y: number, h: number, cols: string[]): void {
  const top = { x: x - h * 0.12, y: y - h * 1.1 };
  g.strokeStyle = '#f8f9fa';
  g.lineWidth = h * 0.03;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(top.x, top.y);
  g.stroke();
  g.save();
  g.translate(top.x, top.y);
  g.rotate(-0.18);
  const r = h * 0.62;
  const n = 6;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, h * 0.22, r, Math.PI + Math.atan2(h * 0.22, r) - 0.05 + (i * (Math.PI - 2 * Math.atan2(h * 0.22, r) + 0.1)) / n, Math.PI + Math.atan2(h * 0.22, r) - 0.05 + ((i + 1) * (Math.PI - 2 * Math.atan2(h * 0.22, r) + 0.1)) / n);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function beachBall(g: G, x: number, y: number, r: number, rot: number): void {
  const cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#ffffff', '#f78c6b'];
  for (let i = 0; i < 6; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, rot + (i * TAU) / 6, rot + ((i + 1) * TAU) / 6);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y, r * 0.2, 0, TAU);
  g.fill();
}

const beach = def(3.3, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#2f9ff0', '#7fd0ff', '#d2f1ff']);
  const [ax, bx] = pair(L, S);
  sun(g, S.port ? L.w * 0.8 : ax - fh * 0.7, L.h * 0.12, fh * 0.28, '#fff3b0', 'rgba(255,230,120,0.9)');
  cloud(g, (L.w * 0.2 + t * 12) % L.w, L.h * 0.14, fh * 0.35, 'rgba(255,255,255,0.9)');
  cloud(g, (L.w * 0.7 + t * 8) % L.w, L.h * 0.22, fh * 0.28, 'rgba(255,255,255,0.85)');
  const seaTop = gy - fh * 0.85;
  const sand = gy - fh * 0.3;
  waves(g, L, seaTop, sand, t);
  additive(g, () => {
    const r = makeRand(8);
    for (let i = 0; i < 14; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7);
      star(g, r() * L.w, lerp(seaTop, sand, r() * 0.8), fh * 0.035 * tw, 'rgba(255,255,255,0.9)');
    }
  });
  const sg = g.createLinearGradient(0, sand, 0, L.h);
  sg.addColorStop(0, '#f7dca8');
  sg.addColorStop(1, '#e3b979');
  g.fillStyle = sg;
  g.fillRect(0, sand, L.w, L.h - sand);
  gulls(g, L, t, L.h * 0.08, fh * 0.07);
  // umbrella + towel
  const ux = S.port ? L.w * 0.75 : bx;
  g.fillStyle = '#4cc9f0';
  g.save();
  g.translate(ux - fh * 0.1, gy - fh * 0.02);
  g.transform(1, 0, -0.5, 1, 0, 0);
  g.fillRect(-fh * 0.2, -fh * 0.06, fh * 0.6, fh * 0.12);
  g.fillStyle = '#ffffff';
  g.fillRect(-fh * 0.2, -fh * 0.01, fh * 0.6, fh * 0.03);
  g.restore();
  umbrella(g, ux, gy, fh, ['#ef476f', '#ffffff']);
  if (!S.port) {
    // sandcastle + bucket
    const sx = bx + fh * 0.65;
    g.fillStyle = '#e0b46f';
    g.fillRect(sx - fh * 0.18, gy - fh * 0.2, fh * 0.36, fh * 0.2);
    g.fillRect(sx - fh * 0.08, gy - fh * 0.34, fh * 0.16, fh * 0.14);
    for (let i = 0; i < 3; i++) g.fillRect(sx - fh * 0.18 + i * fh * 0.14, gy - fh * 0.25, fh * 0.08, fh * 0.05);
    g.strokeStyle = '#1d2233';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(sx, gy - fh * 0.34);
    g.lineTo(sx, gy - fh * 0.48);
    g.stroke();
    g.fillStyle = '#ef476f';
    g.beginPath();
    g.moveTo(sx, gy - fh * 0.48);
    g.lineTo(sx + fh * 0.08 + Math.sin(t * 6) * 3, gy - fh * 0.45);
    g.lineTo(sx, gy - fh * 0.42);
    g.fill();
  }
  // player bouncing a ball
  const px = S.port ? L.w * 0.35 : ax;
  const bounce = Math.abs(Math.sin(t * 2.4));
  const ballY = gy - fh * 1.05 - bounce * fh * 0.55;
  const hitting = bounce < 0.25;
  const p = fig(g, px, gy, fh, { color: '#3d2b1f', accent: '#ffd166', legs: hitting ? 'wide' : 'stand', hL: { x: px - fh * 0.08, y: hitting ? ballY + fh * 0.1 : gy - fh * 0.95 }, hR: { x: px + fh * 0.08, y: hitting ? ballY + fh * 0.1 : gy - fh * 0.95 }, hat: 'cap', hatColor: '#ef476f' });
  void p;
  beachBall(g, px + Math.sin(t * 1.2) * fh * 0.05, ballY, fh * 0.18, t * 3);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.beginPath();
  g.ellipse(px, gy + 2, fh * 0.2 * (1 - bounce * 0.4), fh * 0.03, 0, 0, TAU);
  g.fill();
});

// ---------------------------------------------------------------- camping

function nightSky(g: G, L: Layout, t: number, n: number): void {
  sky(g, L, ['#040817', '#0c1836', '#1c2c58']);
  const r = makeRand(77);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + r() * 3) + i);
    g.globalAlpha *= 0.4 + tw * 0.6;
    const s = 1 + r() * 1.6;
    g.fillRect(r() * L.w, r() * L.groundY * 0.8, s, s);
    g.globalAlpha /= 0.4 + tw * 0.6;
  }
}

function campfire(f: SceneFrame, x: number, y: number, s: number, key: string): void {
  const { g, t } = f;
  glow(g, x, y - s * 0.3, s * 3.2, 'rgba(255,140,40,0.45)');
  g.fillStyle = '#5a3a22';
  g.save();
  g.translate(x, y - s * 0.05);
  g.rotate(0.25);
  g.fillRect(-s * 0.5, -s * 0.06, s, s * 0.12);
  g.rotate(-0.5);
  g.fillRect(-s * 0.5, -s * 0.06, s, s * 0.12);
  g.restore();
  additive(g, () => flame(g, x, y - s * 0.08, s * 0.75, t, ['#e85d04', '#faa307', '#ffe066']));
  const ps = spawn(f, key, 16, 70, () => ({ x: x + f.rand.range(-0.2, 0.2) * s, y: y - s * 0.4, vx: f.rand.range(-25, 25), vy: -f.rand.range(70, 150), life: 0, max: f.rand.range(0.8, 1.6), size: f.rand.range(1.2, 2.6), color: f.rand() < 0.5 ? '#ffb347' : '#ffe066' }));
  for (const p of ps) p.vx += Math.sin(t * 6 + p.y * 0.05) * 30 * f.dt;
  stepParticles(ps, f.dt);
  additive(g, () => dots(g, ps));
}

function tent(g: G, x: number, y: number, s: number, t: number, col: string): void {
  additive(g, () => glow(g, x, y - s * 0.25, s * 0.9, 'rgba(255,190,90,0.35)'));
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - s * 0.6, y);
  g.lineTo(x, y - s * 0.75);
  g.lineTo(x + s * 0.6, y);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffcf7a';
  g.globalAlpha *= 0.85 + Math.sin(t * 9) * 0.05;
  g.beginPath();
  g.moveTo(x - s * 0.22, y);
  g.lineTo(x, y - s * 0.55);
  g.lineTo(x + s * 0.22, y);
  g.closePath();
  g.fill();
  g.globalAlpha /= 0.85 + Math.sin(t * 9) * 0.05;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.moveTo(x, y - s * 0.75);
  g.lineTo(x + s * 0.6, y);
  g.lineTo(x + s * 0.3, y);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y - s * 0.75);
  g.lineTo(x - s * 0.85, y);
  g.moveTo(x, y - s * 0.75);
  g.lineTo(x + s * 0.85, y);
  g.stroke();
}

const camping = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  nightSky(g, L, t, 90);
  g.fillStyle = '#fff6d0';
  glow(g, L.w * 0.82, L.h * 0.1, fh * 0.6, 'rgba(255,250,220,0.4)');
  g.beginPath();
  g.arc(L.w * 0.82, L.h * 0.1, fh * 0.14, 0, TAU);
  g.fill();
  const r = makeRand(12);
  for (let x = -fh * 0.2; x < L.w + fh * 0.3; x += fh * (0.3 + r() * 0.25)) pine(g, x, gy - fh * 0.1, fh * (1.3 + r() * 1.0), '#0a1a24');
  for (let x = -fh * 0.1; x < L.w + fh * 0.3; x += fh * (0.45 + r() * 0.3)) pine(g, x, gy + fh * 0.02, fh * (0.9 + r() * 0.6), '#06110f');
  floor(g, L, S, '#0f1f17', '#08120c');
  const [ax, bx] = pair(L, S, 0.24);
  const fx = S.port ? L.w * 0.52 : ax + fh * 0.25;
  tent(g, S.port ? L.w * 0.18 : bx, gy, fh * (S.port ? 0.85 : 1.1), t, '#f4a261');
  campfire(f, fx, gy, fh * 0.5, 'sp');
  // camper on a log, toasting a marshmallow
  const dir: 1 | -1 = S.port ? -1 : 1;
  const sx = S.port ? L.w * 0.82 : ax - fh * 0.45;
  g.fillStyle = '#6b4226';
  rr(g, sx - fh * 0.22, gy - fh * 0.24, fh * 0.44, fh * 0.24, fh * 0.08);
  g.fill();
  const tip = { x: fx - dir * fh * 0.03, y: gy - fh * 0.45 + Math.sin(t * 2) * fh * 0.02 };
  const hand = { x: sx + dir * fh * 0.3, y: gy - fh * 0.48 };
  fig(g, sx, gy + fh * 0.05, fh * 0.95, { color: '#120d10', accent: '#e63946', dir, legs: 'sit', hL: dir === 1 ? { x: hand.x - fh * 0.05, y: hand.y + fh * 0.04 } : hand, hR: dir === 1 ? hand : { x: hand.x + fh * 0.05, y: hand.y + fh * 0.04 }, hat: 'beanie', hatColor: '#e63946' });
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = Math.max(2, fh * 0.015);
  g.beginPath();
  g.moveTo(hand.x - dir * fh * 0.1, hand.y + fh * 0.04);
  g.lineTo(tip.x, tip.y);
  g.stroke();
  const toast = clamp(t / 3);
  g.fillStyle = `rgb(${Math.round(lerp(255, 196, toast))},${Math.round(lerp(250, 130, toast))},${Math.round(lerp(240, 60, toast))})`;
  rr(g, tip.x - fh * 0.05, tip.y - fh * 0.04, fh * 0.1, fh * 0.08, fh * 0.025);
  g.fill();
  if (!S.port) {
    fig(g, fx + fh * 0.7, gy, fh * 0.9, { color: '#120d10', accent: '#457b9d', dir: -1, legs: 'cross', aL: -2.6 + Math.sin(t * 3) * 0.2, aR: 0.3, hat: 'cap', hatColor: '#457b9d' });
  }
  notes(f, 'nt', () => fx + f.rand.range(-0.5, 0.5) * fh, gy - fh * 1.1, 1.2, ['#ffd166'], fh * 0.06);
});

// ---------------------------------------------------------------- hiking

const hiking = def(3.3, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#4fb6f5', '#a0d8ff', '#e8f6ff']);
  cloud(g, (L.w * 0.1 + t * 10) % L.w, L.h * 0.12, fh * 0.32, 'rgba(255,255,255,0.95)');
  cloud(g, (L.w * 0.6 + t * 14) % L.w, L.h * 0.2, fh * 0.26, 'rgba(255,255,255,0.9)');
  mountains(g, L, gy - fh * 0.3, fh * 1.6, '#9db4d8', 5, 260, '#ffffff');
  const [ax, bx] = pair(L, S, 0.2);
  // the big peak with the summit flag
  const px = S.port ? L.w * 0.62 : bx;
  const peak = { x: px, y: S.port ? L.h * 0.13 : gy - fh * 2.6 };
  const pw = S.port ? L.w * 0.55 : fh * 2.2;
  g.fillStyle = '#6a7fa8';
  g.beginPath();
  g.moveTo(peak.x - pw, gy);
  g.lineTo(peak.x, peak.y);
  g.lineTo(peak.x + pw, gy);
  g.closePath();
  g.fill();
  g.fillStyle = '#4f6390';
  g.beginPath();
  g.moveTo(peak.x, peak.y);
  g.lineTo(peak.x + pw, gy);
  g.lineTo(peak.x + pw * 0.2, gy);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(peak.x, peak.y);
  g.lineTo(peak.x + pw * 0.22, peak.y + (gy - peak.y) * 0.22);
  g.lineTo(peak.x + pw * 0.06, peak.y + (gy - peak.y) * 0.17);
  g.lineTo(peak.x - pw * 0.08, peak.y + (gy - peak.y) * 0.24);
  g.lineTo(peak.x - pw * 0.22, peak.y + (gy - peak.y) * 0.22);
  g.closePath();
  g.fill();
  // zig-zag trail
  g.strokeStyle = '#f2e3b3';
  g.lineWidth = Math.max(2, fh * 0.02);
  g.setLineDash([fh * 0.06, fh * 0.05]);
  g.lineDashOffset = -t * 30;
  g.beginPath();
  const pts = 6;
  for (let i = 0; i <= pts; i++) {
    const u = i / pts;
    const yy = lerp(gy, peak.y + fh * 0.05, u);
    const half = pw * (1 - u) * 0.7;
    const xx = peak.x + (i % 2 ? half : -half) * 0.8;
    if (i) g.lineTo(xx, yy);
    else g.moveTo(xx, yy);
  }
  g.stroke();
  g.setLineDash([]);
  // flag
  g.strokeStyle = '#1d2233';
  g.lineWidth = Math.max(2, fh * 0.015);
  g.beginPath();
  g.moveTo(peak.x, peak.y);
  g.lineTo(peak.x, peak.y - fh * 0.4);
  g.stroke();
  g.fillStyle = '#ef233c';
  g.beginPath();
  g.moveTo(peak.x, peak.y - fh * 0.4);
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    g.lineTo(peak.x + u * fh * 0.3, peak.y - fh * 0.4 + Math.sin(u * 4 - t * 8) * fh * 0.03 * u);
  }
  for (let i = 6; i >= 0; i--) {
    const u = i / 6;
    g.lineTo(peak.x + u * fh * 0.3, peak.y - fh * 0.22 + Math.sin(u * 4 - t * 8) * fh * 0.03 * u - u * fh * 0.04);
  }
  g.closePath();
  g.fill();
  additive(g, () => {
    glow(g, peak.x + fh * 0.1, peak.y - fh * 0.3, fh * 0.5, 'rgba(255,240,170,0.6)');
    for (let i = 0; i < 4; i++) {
      const a = t * 1.5 + (i * TAU) / 4;
      star(g, peak.x + Math.cos(a) * fh * 0.5, peak.y - fh * 0.3 + Math.sin(a) * fh * 0.35, fh * 0.04, '#fff3b0', t * 2);
    }
  });
  // foreground hills
  g.fillStyle = '#5b9a5a';
  g.beginPath();
  g.moveTo(0, gy);
  for (let x = 0; x <= L.w; x += 30) g.lineTo(x, gy - fh * 0.12 - Math.sin(x * 0.006 + 1) * fh * 0.1);
  g.lineTo(L.w, L.h);
  g.lineTo(0, L.h);
  g.closePath();
  g.fill();
  floor(g, L, S, '#4a8a4a', '#2d6a3e');
  // hiker
  const hx = S.port ? L.w * 0.3 : ax;
  const bob = Math.abs(Math.sin(t * 3.5)) * fh * 0.02;
  const stick = { x: hx + fh * 0.32, y: gy - fh * 0.62 - bob };
  const p = fig(g, hx, gy - bob, fh, { color: '#2b2d42', accent: '#2a9d8f', legs: 'walk', phase: t * 0.5, lean: 0.14, hR: stick, aL: -0.2 - Math.sin(t * 3.5) * 0.4, hat: 'cap', hatColor: '#e76f51' });
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = Math.max(2, fh * 0.025);
  g.beginPath();
  g.moveTo(stick.x, stick.y - fh * 0.08);
  g.lineTo(stick.x + fh * 0.05, gy);
  g.stroke();
  const back = { x: (p.sh.x + p.hip.x) / 2 - fh * 0.11, y: (p.sh.y + p.hip.y) / 2 - fh * 0.04 };
  g.save();
  g.translate(back.x, back.y);
  g.rotate(0.14);
  g.fillStyle = '#e76f51';
  rr(g, -fh * 0.1, -fh * 0.16, fh * 0.2, fh * 0.32, fh * 0.06);
  g.fill();
  g.fillStyle = '#f4a261';
  rr(g, -fh * 0.08, fh * 0.02, fh * 0.16, fh * 0.1, fh * 0.03);
  g.fill();
  g.fillStyle = '#264653';
  g.fillRect(-fh * 0.11, -fh * 0.22, fh * 0.22, fh * 0.06);
  g.restore();
  gulls(g, L, t, L.h * 0.25, fh * 0.05);
});

// ---------------------------------------------------------------- fishing

function fish(g: G, x: number, y: number, s: number, ang: number, col: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(0, 0, s * 0.5, s * 0.22, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.4, 0);
  g.lineTo(-s * 0.75, -s * 0.22);
  g.lineTo(-s * 0.75, s * 0.22);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(s * 0.05, s * 0.06, s * 0.3, s * 0.07, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(s * 0.3, -s * 0.05, s * 0.06, 0, TAU);
  g.fill();
  g.fillStyle = '#1d2233';
  g.beginPath();
  g.arc(s * 0.31, -s * 0.05, s * 0.03, 0, TAU);
  g.fill();
  g.restore();
}

const fishing = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#5e60ce', '#ff8fab', '#ffc6a5', '#ffe5c4']);
  const wl = gy - fh * 0.35;
  sun(g, S.port ? L.w * 0.5 : (S.alt ?? 0) + fh * 0.6, wl - fh * 0.25, fh * 0.35, '#fff1c1', 'rgba(255,190,120,0.8)');
  const r = makeRand(4);
  for (let x = -fh * 0.2; x < L.w + fh * 0.2; x += fh * (0.2 + r() * 0.2)) pine(g, x, wl, fh * (0.5 + r() * 0.4), '#3c3a5e');
  const wg = g.createLinearGradient(0, wl, 0, L.h);
  wg.addColorStop(0, '#5c7fb8');
  wg.addColorStop(1, '#1f3b63');
  g.fillStyle = wg;
  g.fillRect(0, wl, L.w, L.h - wl);
  // sun glitter
  additive(g, () => {
    g.fillStyle = 'rgba(255,220,170,0.35)';
    for (let i = 0; i < 10; i++) {
      const yy = wl + 6 + i * fh * 0.06;
      const ww = fh * (0.5 - i * 0.03) * (0.7 + 0.3 * Math.sin(t * 3 + i));
      g.fillRect((S.port ? L.w * 0.5 : (S.alt ?? 0) + fh * 0.6) - ww / 2, yy, ww, 2);
    }
  });
  const [ax, bx] = pair(L, S, 0.24);
  // dock
  const dx = S.port ? L.w * 0.22 : ax - fh * 0.2;
  const dTop = wl - fh * 0.06;
  g.fillStyle = '#5a3a22';
  for (let i = 0; i < 3; i++) g.fillRect(dx - fh * 0.6 + i * fh * 0.4, dTop, fh * 0.06, fh * 0.45);
  g.fillStyle = '#8b5a2b';
  g.fillRect(dx - fh * 0.75, dTop, fh * (S.port ? 1.05 : 1.15), fh * 0.07);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 6; i++) g.fillRect(dx - fh * 0.75 + i * fh * 0.19, dTop, 2, fh * 0.07);
  // angler
  const fx = dx + fh * (S.port ? 0.15 : 0.25);
  const hands = { x: fx + fh * 0.2, y: dTop - fh * 0.28 };
  const nib = Math.sin(t * 7) * (t % 1.7 < 0.5 ? 1 : 0.2);
  const tip = { x: fx + fh * (S.port ? 0.75 : 0.95), y: dTop - fh * 0.8 + nib * fh * 0.04 };
  fig(g, fx, dTop + fh * 0.3, fh, { color: '#22223b', accent: '#f4a261', legs: 'sit', hL: { x: hands.x - fh * 0.06, y: hands.y + fh * 0.04 }, hR: hands, hat: 'cap', hatColor: '#2a9d8f' });
  g.strokeStyle = '#3b2a1a';
  g.lineWidth = Math.max(2, fh * 0.02);
  g.beginPath();
  g.moveTo(hands.x - fh * 0.1, hands.y + fh * 0.05);
  g.lineTo(tip.x, tip.y);
  g.stroke();
  const bob = { x: tip.x + fh * (S.port ? 0.25 : 0.35), y: wl + fh * 0.12 + Math.sin(t * 4) * fh * 0.015 + nib * fh * 0.02 };
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(tip.x, tip.y);
  g.quadraticCurveTo(tip.x + fh * 0.2, tip.y + fh * 0.2, bob.x, bob.y);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 2; i++) {
    const u = (t * 0.8 + i * 0.5) % 1;
    g.globalAlpha *= 1 - u;
    g.beginPath();
    g.ellipse(bob.x, bob.y + fh * 0.02, fh * (0.06 + u * 0.25), fh * (0.015 + u * 0.06), 0, 0, TAU);
    g.stroke();
    g.globalAlpha /= Math.max(0.01, 1 - u);
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(bob.x, bob.y, fh * 0.035, Math.PI, TAU);
  g.fill();
  g.fillStyle = '#ef233c';
  g.beginPath();
  g.arc(bob.x, bob.y, fh * 0.035, 0, Math.PI);
  g.fill();
  // jumping fish
  const jx = S.port ? L.w * 0.72 : bx;
  const per = 1.7;
  const u = ((t + 0.4) % per) / per;
  const air = clamp(u / 0.7);
  if (u < 0.7) {
    const x = jx - fh * 0.35 + air * fh * 0.7;
    const y = wl + fh * 0.1 - Math.sin(air * Math.PI) * fh * 0.9;
    const ang = Math.atan2(-Math.cos(air * Math.PI) * fh * 0.9 * Math.PI, fh * 0.7);
    fish(g, x, y, fh * 0.32, ang, '#ff9f1c');
  }
  const spl = particles(f.mem, 'spl');
  const prevU = (f.mem.pu as number | undefined) ?? 1;
  const burst = (x: number) => {
    for (let i = 0; i < 14; i++) spl.push({ x, y: wl + fh * 0.1, vx: f.rand.range(-90, 90), vy: -f.rand.range(120, 260), life: 0, max: 0.8, size: f.rand.range(1.5, 3.5), color: '#cdeffd' });
  };
  if (prevU > u) burst(jx - fh * 0.35);
  if (prevU < 0.7 && u >= 0.7) burst(jx + fh * 0.35);
  f.mem.pu = u;
  stepParticles(spl, f.dt, 600);
  dots(g, spl);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 1.5;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(jx + sx * fh * 0.35, wl + fh * 0.11, fh * 0.12, fh * 0.025, 0, 0, TAU);
    g.stroke();
  }
});

// ---------------------------------------------------------------- gardening

function flower(g: G, x: number, y: number, h: number, grow: number, col: string, t: number, i: number): void {
  if (grow <= 0) return;
  const sh = h * easeOut(grow);
  const sway = Math.sin(t * 2 + i) * h * 0.04 * grow;
  g.strokeStyle = '#2d6a4f';
  g.lineWidth = Math.max(2, h * 0.05);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + sway * 0.5, y - sh * 0.5, x + sway, y - sh);
  g.stroke();
  g.fillStyle = '#52b788';
  g.beginPath();
  g.ellipse(x + h * 0.08, y - sh * 0.4, h * 0.08 * grow, h * 0.03 * grow, -0.5, 0, TAU);
  g.fill();
  const bloom = clamp((grow - 0.6) / 0.4);
  if (bloom <= 0) return;
  const cx = x + sway;
  const cy = y - sh;
  const pr = h * 0.13 * easeOut(bloom);
  g.fillStyle = col;
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 + t * 0.5;
    g.beginPath();
    g.arc(cx + Math.cos(a) * pr * 0.8, cy + Math.sin(a) * pr * 0.8, pr * 0.55, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.arc(cx, cy, pr * 0.45, 0, TAU);
  g.fill();
}

function butterflies(f: SceneFrame, n: number, s: number, cx: number[], cy: number, spread: number): void {
  const { g, t } = f;
  const cols = ['#ff70a6', '#ffd670', '#70d6ff', '#c77dff'];
  for (let i = 0; i < n; i++) {
    const x0 = cx[i % cx.length];
    const x = x0 + Math.sin(t * 0.9 + i * 2.1) * spread + Math.sin(t * 2.3 + i) * spread * 0.2;
    const y = cy + Math.cos(t * 1.3 + i * 1.7) * spread * 0.4 + Math.sin(t * 4 + i) * s * 0.3;
    const flap = Math.abs(Math.sin(t * 14 + i));
    g.fillStyle = cols[i % cols.length];
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + sd * s * 0.45 * flap, y - s * 0.15, s * 0.5 * flap + 1, s * 0.4, sd * 0.4, 0, TAU);
      g.ellipse(x + sd * s * 0.3 * flap, y + s * 0.25, s * 0.32 * flap + 1, s * 0.26, -sd * 0.4, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#1d2233';
    g.fillRect(x - 1, y - s * 0.4, 2, s * 0.8);
  }
}

function picketFence(g: G, L: Layout, y: number, h: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(0, y - h * 0.75, L.w, h * 0.08);
  g.fillRect(0, y - h * 0.35, L.w, h * 0.08);
  for (let x = 0; x < L.w; x += h * 0.32) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - h * 0.9);
    g.lineTo(x + h * 0.08, y - h);
    g.lineTo(x + h * 0.16, y - h * 0.9);
    g.lineTo(x + h * 0.16, y);
    g.closePath();
    g.fill();
  }
}

const gardening = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#5ab8f5', '#a9defa', '#eefaff']);
  const [ax, bx] = pair(L, S, 0.2);
  sun(g, S.port ? L.w * 0.82 : bx + fh * 0.6, L.h * 0.12, fh * 0.25, '#fff3b0', 'rgba(255,230,120,0.85)');
  cloud(g, (L.w * 0.15 + t * 10) % L.w, L.h * 0.15, fh * 0.3, 'rgba(255,255,255,0.95)');
  picketFence(g, L, gy - fh * 0.15, fh * 0.55, '#ffffff');
  floor(g, L, S, '#7cc26b', '#4f9a4a');
  g.fillStyle = '#7cc26b';
  g.fillRect(0, gy - fh * 0.15, L.w, fh * 0.15);
  // soil bed + flowers
  const bed = (cx: number, w: number, seed: number) => {
    g.fillStyle = '#6f4e37';
    rr(g, cx - w / 2, gy - fh * 0.1, w, fh * 0.14, fh * 0.05);
    g.fill();
    g.fillStyle = '#5a3d2b';
    for (let i = 0; i < 6; i++) g.fillRect(cx - w / 2 + (i + 0.5) * (w / 6), gy - fh * 0.06, 3, 3);
    const r = makeRand(seed);
    const cols = ['#ef476f', '#ffd166', '#b388ff', '#ff9f1c', '#f15bb5', '#4cc9f0'];
    const n = Math.max(3, Math.round(w / (fh * 0.22)));
    for (let i = 0; i < n; i++) {
      const x = cx - w / 2 + ((i + 0.5) * w) / n;
      const delay = 0.2 + r() * 1.2;
      flower(g, x, gy - fh * 0.08, fh * (0.4 + r() * 0.25), clamp((t - delay) / 1.3), cols[Math.floor(r() * cols.length)], t, i);
    }
  };
  const gx = S.port ? L.w * 0.28 : ax - fh * 0.45;
  const bedX = S.port ? L.w * 0.66 : ax + fh * 0.4;
  bed(bedX, S.port ? L.w * 0.5 : fh * 1.1, 3);
  // gardener with watering can
  const can = { x: gx + fh * 0.33, y: gy - fh * 0.6 };
  fig(g, gx, gy, fh, { color: '#283618', accent: '#e76f51', hR: { x: can.x - fh * 0.05, y: can.y - fh * 0.08 }, aL: -0.25, hat: 'cap', hatColor: '#ffd166' });
  const tilt = 0.35 + Math.sin(t * 2) * 0.08;
  g.save();
  g.translate(can.x, can.y);
  g.rotate(tilt);
  g.fillStyle = '#2a9d8f';
  rr(g, -fh * 0.1, -fh * 0.07, fh * 0.2, fh * 0.16, fh * 0.03);
  g.fill();
  g.strokeStyle = '#2a9d8f';
  g.lineWidth = fh * 0.03;
  g.beginPath();
  g.moveTo(fh * 0.08, 0);
  g.lineTo(fh * 0.24, -fh * 0.09);
  g.stroke();
  g.beginPath();
  g.arc(-fh * 0.02, -fh * 0.09, fh * 0.06, Math.PI, 0);
  g.stroke();
  g.restore();
  const spout = { x: can.x + Math.cos(tilt) * fh * 0.24 + Math.sin(tilt) * fh * 0.09, y: can.y + Math.sin(tilt) * fh * 0.24 - Math.cos(tilt) * fh * 0.09 };
  const drops = spawn(f, 'dr', 30, 80, () => ({ x: spout.x, y: spout.y, vx: f.rand.range(60, 110), vy: f.rand.range(-20, 20), life: 0, max: 0.8, size: f.rand.range(1.5, 2.8), color: '#4cc9f0' }));
  stepParticles(drops, f.dt, 500);
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].y > gy - fh * 0.08) drops.splice(i, 1);
  dots(g, drops, false);
  if (!S.port) {
    bed(bx, fh * 1.4, 9);
    // sunflower
    const sx = bx + fh * 0.85;
    const gr = clamp(t / 2.2);
    g.strokeStyle = '#2d6a4f';
    g.lineWidth = fh * 0.04;
    g.beginPath();
    g.moveTo(sx, gy - fh * 0.05);
    g.lineTo(sx, gy - fh * 1.2 * easeOut(gr));
    g.stroke();
    if (gr > 0.5) {
      const pr = fh * 0.2 * easeOut((gr - 0.5) * 2);
      const cy = gy - fh * 1.2 * easeOut(gr);
      g.fillStyle = '#ffbe0b';
      for (let k = 0; k < 12; k++) {
        const a = (k * TAU) / 12 + t * 0.3;
        g.beginPath();
        g.ellipse(sx + Math.cos(a) * pr, cy + Math.sin(a) * pr, pr * 0.5, pr * 0.2, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#6f4e37';
      g.beginPath();
      g.arc(sx, cy, pr * 0.6, 0, TAU);
      g.fill();
    }
  }
  butterflies(f, S.port ? 2 : 4, fh * 0.08, S.port ? [L.w * 0.5] : [ax, bx], gy - fh * 1.0, fh * 0.6);
});

// ---------------------------------------------------------------- painting

function paintingArt(g: G, x: number, y: number, w: number, h: number, t: number): void {
  const sk = g.createLinearGradient(0, y, 0, y + h);
  sk.addColorStop(0, '#4cc9f0');
  sk.addColorStop(1, '#ffd6a5');
  g.fillStyle = sk;
  g.fillRect(x, y, w, h);
  g.fillStyle = '#ffbe0b';
  g.beginPath();
  g.arc(x + w * 0.72, y + h * 0.3, h * 0.14, 0, TAU);
  g.fill();
  g.fillStyle = '#8338ec';
  g.beginPath();
  g.moveTo(x, y + h * 0.75);
  g.lineTo(x + w * 0.3, y + h * 0.4);
  g.lineTo(x + w * 0.6, y + h * 0.75);
  g.fill();
  g.fillStyle = '#06d6a0';
  g.beginPath();
  g.moveTo(x, y + h);
  g.quadraticCurveTo(x + w * 0.3, y + h * 0.6, x + w * 0.6, y + h * 0.78);
  g.quadraticCurveTo(x + w * 0.85, y + h * 0.9, x + w, y + h * 0.7);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
  g.fillStyle = '#ef476f';
  g.fillRect(x + w * 0.62, y + h * 0.7, w * 0.14, h * 0.12);
  g.beginPath();
  g.moveTo(x + w * 0.6, y + h * 0.7);
  g.lineTo(x + w * 0.69, y + h * 0.6);
  g.lineTo(x + w * 0.78, y + h * 0.7);
  g.fill();
  void t;
}

const painting = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#fbefe1', '#f2dcc4', '#e9cdb0']);
  floor(g, L, S, '#a47148', '#7f5539');
  const [ax, bx] = pair(L, S, 0.2);
  // window light
  additive(g, () => glow(g, S.port ? L.w * 0.5 : ax, gy - fh * 1.2, fh * 1.4, 'rgba(255,240,200,0.5)'));
  // splats on the floor
  const r = makeRand(6);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#8338ec'][i % 5];
    g.beginPath();
    g.ellipse(r() * L.w, gy + fh * (0.05 + r() * 0.3), fh * 0.06, fh * 0.02, 0, 0, TAU);
    g.fill();
  }
  const ex = S.port ? L.w * 0.64 : ax + fh * 0.3;
  const cw = fh * 0.7;
  const ch = fh * 0.55;
  const cy = gy - fh * 1.15;
  // easel legs
  g.strokeStyle = '#6f4518';
  g.lineWidth = fh * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex - cw * 0.35, gy);
  g.lineTo(ex, cy - fh * 0.08);
  g.lineTo(ex + cw * 0.35, gy);
  g.moveTo(ex, cy);
  g.lineTo(ex + fh * 0.05, gy);
  g.stroke();
  g.fillStyle = '#6f4518';
  g.fillRect(ex - cw * 0.55, cy + ch, cw * 1.1, fh * 0.04);
  // canvas
  g.fillStyle = '#ffffff';
  g.fillRect(ex - cw / 2, cy, cw, ch);
  const rev = span(t, 0.2, 2.7);
  const edge = ex - cw / 2 + cw * rev;
  g.save();
  g.beginPath();
  g.rect(ex - cw / 2, cy, cw * rev, ch);
  g.clip();
  paintingArt(g, ex - cw / 2, cy, cw, ch, t);
  g.restore();
  // painter
  const px = S.port ? L.w * 0.3 : ax - fh * 0.4;
  const stroke = Math.sin(t * 9);
  const tipP = { x: Math.min(edge, ex + cw * 0.45), y: cy + ch * (0.5 + stroke * 0.35) };
  const hand = { x: tipP.x - fh * 0.16, y: tipP.y + fh * 0.07 };
  const p = fig(g, px, gy, fh, { color: '#3d2c4e', accent: '#ffffff', hR: hand, aL: -0.9, bL: -0.9, hat: 'beret', hatColor: '#e63946' });
  g.strokeStyle = '#6f4518';
  g.lineWidth = Math.max(2, fh * 0.02);
  g.beginPath();
  g.moveTo(hand.x - fh * 0.04, hand.y + fh * 0.02);
  g.lineTo(tipP.x, tipP.y);
  g.stroke();
  const tipCol = ['#ef476f', '#06d6a0', '#ffd166', '#8338ec'][Math.floor(t * 1.5) % 4];
  g.fillStyle = tipCol;
  g.beginPath();
  g.arc(tipP.x, tipP.y, fh * 0.02, 0, TAU);
  g.fill();
  // palette
  g.fillStyle = '#d4a373';
  g.beginPath();
  g.ellipse(p.lh.x, p.lh.y - fh * 0.02, fh * 0.13, fh * 0.07, -0.3, 0, TAU);
  g.fill();
  ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#8338ec'].forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(p.lh.x - fh * 0.08 + i * fh * 0.04, p.lh.y - fh * 0.04 + (i % 2) * fh * 0.03, fh * 0.018, 0, TAU);
    g.fill();
  });
  const sp = spawn(f, 'sp', 14, 50, () => ({ x: tipP.x, y: tipP.y, vx: f.rand.range(-60, 60), vy: f.rand.range(-120, -20), life: 0, max: 0.8, size: f.rand.range(1.5, 3.5), color: f.rand.pick(['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#8338ec']) }));
  stepParticles(sp, f.dt, 400);
  dots(g, sp);
  if (!S.port) {
    // finished works on the wall
    const frames: [number, number, number, number, string[]][] = [
      [bx - fh * 0.5, gy - fh * 1.6, fh * 0.55, fh * 0.42, ['#f15bb5', '#fee440', '#00bbf9']],
      [bx + fh * 0.35, gy - fh * 1.75, fh * 0.42, fh * 0.55, ['#ff9f1c', '#2ec4b6', '#e71d36']],
      [bx - fh * 0.05, gy - fh * 0.95, fh * 0.6, fh * 0.4, ['#8338ec', '#ffbe0b', '#3a86ff']],
    ];
    frames.forEach(([x, y, w, h, cs], i) => {
      g.fillStyle = '#c9a227';
      g.fillRect(x - w / 2 - 5, y - 5, w + 10, h + 10);
      g.fillStyle = cs[0];
      g.fillRect(x - w / 2, y, w, h);
      g.fillStyle = cs[1];
      g.beginPath();
      g.arc(x - w * 0.1, y + h * 0.45, Math.min(w, h) * 0.28, 0, TAU);
      g.fill();
      g.fillStyle = cs[2];
      g.fillRect(x + w * 0.05, y + h * 0.15 + Math.sin(t * 2 + i) * 2, w * 0.3, h * 0.6);
    });
    // paint jars
    ['#ef476f', '#ffd166', '#06d6a0'].forEach((c, i) => {
      const jx = bx - fh * 0.4 + i * fh * 0.22;
      g.fillStyle = 'rgba(255,255,255,0.6)';
      rr(g, jx - fh * 0.07, gy - fh * 0.18, fh * 0.14, fh * 0.18, fh * 0.03);
      g.fill();
      g.fillStyle = c;
      g.fillRect(jx - fh * 0.06, gy - fh * 0.1, fh * 0.12, fh * 0.09);
      g.strokeStyle = '#6f4518';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(jx, gy - fh * 0.1);
      g.lineTo(jx + fh * 0.05 * (i - 1), gy - fh * 0.32);
      g.stroke();
    });
  }
});

// ---------------------------------------------------------------- music

function piano(g: G, x: number, y: number, h: number, t: number, figCol: string, accent: string): void {
  // grand piano facing left, pianist seated on its left
  const kx = x - h * 0.45;
  const ky = y - h * 0.48;
  const press = (i: number) => (Math.floor(t * 6 + i * 1.7) % 3 === 0 ? h * 0.02 : 0);
  fig(g, kx - h * 0.3, y, h * 0.95, { color: figCol, accent, legs: 'sit', hL: { x: kx - h * 0.02, y: ky - h * 0.02 + press(0) }, hR: { x: kx + h * 0.08, y: ky - h * 0.02 + press(1) }, lean: 0.12 + Math.sin(t * 3) * 0.06 });
  g.fillStyle = '#1b1b1f';
  g.fillRect(kx - h * 0.4, y - h * 0.32, h * 0.3, h * 0.04);
  g.fillRect(kx - h * 0.38, y - h * 0.3, h * 0.03, h * 0.3);
  g.fillRect(kx - h * 0.16, y - h * 0.3, h * 0.03, h * 0.3);
  g.fillStyle = '#111116';
  g.beginPath();
  g.moveTo(kx, ky);
  g.lineTo(x + h * 0.25, ky);
  g.bezierCurveTo(x + h * 0.6, ky, x + h * 0.7, ky + h * 0.12, x + h * 0.55, ky + h * 0.16);
  g.lineTo(kx, ky + h * 0.16);
  g.closePath();
  g.fill();
  // lid
  g.beginPath();
  g.moveTo(kx + h * 0.15, ky);
  g.lineTo(x + h * 0.55, ky - h * 0.42);
  g.lineTo(x + h * 0.62, ky);
  g.closePath();
  g.fill();
  g.strokeStyle = '#111116';
  g.lineWidth = h * 0.03;
  for (const lx of [kx + h * 0.05, x + h * 0.45]) {
    g.beginPath();
    g.moveTo(lx, ky + h * 0.16);
    g.lineTo(lx, y);
    g.stroke();
  }
  g.fillStyle = '#f8f9fa';
  g.fillRect(kx - h * 0.08, ky - h * 0.005, h * 0.2, h * 0.035);
  g.fillStyle = '#111116';
  for (let i = 0; i < 6; i++) g.fillRect(kx - h * 0.07 + i * h * 0.033, ky - h * 0.005, h * 0.012, h * 0.018);
}

const music = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#140b2e', '#2a1458', '#3d1f6e']);
  floor(g, L, S, '#24123f', '#120822');
  const [ax, bx] = pair(L, S, 0.2);
  const spot = (x: number, col: string) =>
    additive(g, () => {
      const gr = g.createLinearGradient(0, 0, 0, gy);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, col);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - fh * 0.12, 0);
      g.lineTo(x + fh * 0.12, 0);
      g.lineTo(x + fh * 0.75, gy);
      g.lineTo(x - fh * 0.75, gy);
      g.closePath();
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x, gy + fh * 0.02, fh * 0.75, fh * 0.1, 0, 0, TAU);
      g.fill();
    });
  const gx = S.port ? L.w * 0.5 : ax;
  spot(gx, 'rgba(255,214,120,0.35)');
  // stool
  g.fillStyle = '#c77dff';
  g.fillRect(gx - fh * 0.18, gy - fh * 0.32, fh * 0.26, fh * 0.04);
  g.fillRect(gx - fh * 0.15, gy - fh * 0.3, fh * 0.03, fh * 0.3);
  g.fillRect(gx + fh * 0.03, gy - fh * 0.3, fh * 0.03, fh * 0.3);
  const body = preIndustrial(era) ? '#b5651d' : '#ff7b00';
  guitar(g, gx - fh * 0.05, gy + fh * 0.02, fh, 1, body, t, '#0f0820', '#4cc9f0');
  // sound rings
  g.strokeStyle = 'rgba(255,214,120,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.9 + i / 3) % 1;
    g.globalAlpha *= 1 - u;
    g.beginPath();
    g.arc(gx, gy - fh * 0.5, fh * (0.35 + u * 0.7), -0.9, 0.9);
    g.stroke();
    g.globalAlpha /= Math.max(0.01, 1 - u);
  }
  notes(f, 'n1', () => gx + f.rand.range(-0.3, 0.6) * fh, gy - fh * 0.7, 6, ['#ffd166', '#ff5d8f', '#4cc9f0', '#06d6a0'], fh * 0.09);
  if (!S.port) {
    spot(bx, 'rgba(180,140,255,0.3)');
    piano(g, bx + fh * 0.1, gy, fh, t, '#0f0820', '#ff5d8f');
    notes(f, 'n2', () => bx + f.rand.range(-0.4, 0.6) * fh, gy - fh * 0.9, 5, ['#b388ff', '#ffffff', '#ffd166'], fh * 0.09);
  }
});

// ---------------------------------------------------------------- gaming

function pixelGame(g: G, x: number, y: number, w: number, h: number, t: number, holo: boolean): void {
  const px = w / 32;
  g.fillStyle = holo ? 'rgba(0,245,212,0.18)' : '#5c94fc';
  g.fillRect(x, y, w, h);
  const P = (cx: number, cy: number, cw: number, chh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x + cx * px, y + cy * px, cw * px, chh * px);
  };
  const rows = Math.floor(h / px);
  const gr = rows - 3;
  // clouds
  const cOff = (t * 2) % 32;
  for (const c of [4, 20]) {
    const cx = (c - cOff + 32) % 32;
    P(cx, 2, 5, 2, holo ? 'rgba(255,255,255,0.4)' : '#ffffff');
    P(cx + 1, 1, 3, 1, holo ? 'rgba(255,255,255,0.4)' : '#ffffff');
  }
  // ground
  const scroll = (t * 6) % 2;
  for (let i = -1; i < 33; i++) P(i - scroll, gr, 1, 3, i % 2 ? (holo ? '#00f5d4' : '#c84c0c') : holo ? '#00bbf9' : '#e09050');
  // pipe
  const pipeX = 26 - ((t * 6) % 40);
  P(pipeX, gr - 4, 3, 4, holo ? '#9b5de5' : '#00a800');
  P(pipeX - 0.5, gr - 5, 4, 1.4, holo ? '#f15bb5' : '#00d000');
  // question blocks + coin
  P(14, gr - 8, 2, 2, holo ? '#fee440' : '#f8b800');
  P(18, gr - 8, 2, 2, holo ? '#fee440' : '#f8b800');
  // hero jumps
  const jp = (t * 1.2) % 1;
  const jy = Math.sin(Math.min(1, jp / 0.6) * Math.PI) * 6 * (jp < 0.6 ? 1 : 0);
  const hx = 9;
  const hy = gr - 4 - jy;
  P(hx, hy, 3, 1, holo ? '#f15bb5' : '#e40000');
  P(hx, hy + 1, 3, 1.5, holo ? '#ffd6ff' : '#ffc890');
  P(hx, hy + 2.5, 3, 1.5, holo ? '#00bbf9' : '#2038ec');
  if (jp > 0.25 && jp < 0.55) {
    P(15, gr - 10 - (jp - 0.25) * 12, 1, 1.4, '#ffe066');
  }
}

function controller(g: G, x: number, y: number, s: number, col: string, t: number): void {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x - s * 0.35, y + s * 0.08, s * 0.25, s * 0.3, 0.4, 0, TAU);
  g.ellipse(x + s * 0.35, y + s * 0.08, s * 0.25, s * 0.3, -0.4, 0, TAU);
  g.fill();
  rr(g, x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.35, s * 0.15);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillRect(x - s * 0.4, y - s * 0.06, s * 0.18, s * 0.05);
  g.fillRect(x - s * 0.335, y - s * 0.12, s * 0.05, s * 0.18);
  const bc = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0'];
  bc.forEach((c, i) => {
    const on = Math.floor(t * 5) % 4 === i;
    g.fillStyle = c;
    g.beginPath();
    g.arc(x + s * 0.3 + [0, s * 0.08, 0, -s * 0.08][i], y - s * 0.03 + [-s * 0.08, 0, s * 0.08, 0][i], s * (on ? 0.05 : 0.04), 0, TAU);
    g.fill();
  });
}

function boardGame(f: SceneFrame, x: number, y: number, h: number, era: EraLook, seed: number): void {
  const { g, t } = f;
  const top = y - h * 0.42;
  const bw = h * 0.7;
  glow(g, x, top - h * 0.2, h * 1.1, 'rgba(255,190,100,0.45)');
  // players
  const think = Math.floor(t * 1.5 + seed) % 2;
  fig(g, x - h * 0.6, y, h * 0.92, { color: '#2b1d14', accent: '#c1121f', legs: 'sit', dir: 1, hR: { x: x - h * 0.28, y: top - (think ? h * 0.08 : 0) }, aL: -0.2, hat: era === 'ancient' ? 'none' : 'cap', hatColor: '#c1121f' });
  fig(g, x + h * 0.6, y, h * 0.92, { color: '#2b1d14', accent: '#1d4e89', legs: 'sit', dir: -1, hL: { x: x + h * 0.28, y: top - (think ? 0 : h * 0.08) }, aR: 0.2, dress: true, hat: 'bun', hatColor: '#2b1d14' });
  // table
  g.fillStyle = '#6b4226';
  g.fillRect(x - bw * 0.62, top, bw * 1.24, h * 0.05);
  g.fillRect(x - bw * 0.5, top + h * 0.05, h * 0.05, y - top - h * 0.05);
  g.fillRect(x + bw * 0.5 - h * 0.05, top + h * 0.05, h * 0.05, y - top - h * 0.05);
  // board in perspective
  const n = era === 'ancient' ? 10 : 8;
  const depth = h * 0.16;
  for (let r = 0; r < (era === 'ancient' ? 3 : 4); r++)
    for (let c = 0; c < n; c++) {
      const rows = era === 'ancient' ? 3 : 4;
      const y0 = top - depth + (r * depth) / rows;
      const y1 = top - depth + ((r + 1) * depth) / rows;
      const k0 = 0.75 + (0.25 * r) / rows;
      const k1 = 0.75 + (0.25 * (r + 1)) / rows;
      g.fillStyle = (r + c) % 2 ? '#f1e3c6' : era === 'ancient' ? '#c8963e' : '#3a2416';
      g.beginPath();
      g.moveTo(x + (-bw / 2 + (c * bw) / n) * k0, y0);
      g.lineTo(x + (-bw / 2 + ((c + 1) * bw) / n) * k0, y0);
      g.lineTo(x + (-bw / 2 + ((c + 1) * bw) / n) * k1, y1);
      g.lineTo(x + (-bw / 2 + (c * bw) / n) * k1, y1);
      g.closePath();
      g.fill();
    }
  // pieces hop
  const r = makeRand(seed);
  for (let i = 0; i < 6; i++) {
    const px = x + (r() - 0.5) * bw * 0.8;
    const py = top - depth * r() * 0.8;
    const hop = i === Math.floor(t * 2) % 6 ? Math.abs(Math.sin(t * Math.PI * 2)) * h * 0.08 : 0;
    g.fillStyle = i % 2 ? '#e63946' : '#f8f9fa';
    g.beginPath();
    g.ellipse(px, py - hop, h * 0.035, h * 0.02, 0, 0, TAU);
    g.fill();
    g.fillRect(px - h * 0.035, py - hop - h * 0.02, h * 0.07, h * 0.02);
    g.beginPath();
    g.ellipse(px, py - hop - h * 0.02, h * 0.035, h * 0.02, 0, 0, TAU);
    g.fill();
  }
  // tumbling dice
  for (let i = 0; i < 2; i++) {
    const u = ((t * 0.7 + i * 0.3 + seed * 0.1) % 1);
    const dx = x + (i - 0.5) * h * 0.3 + u * h * 0.1;
    const dy = top - depth - h * 0.05 - Math.abs(Math.sin(u * Math.PI * 3)) * h * 0.25 * (1 - u);
    g.save();
    g.translate(dx, dy);
    g.rotate(u * 9);
    g.fillStyle = '#ffffff';
    rr(g, -h * 0.045, -h * 0.045, h * 0.09, h * 0.09, h * 0.015);
    g.fill();
    g.fillStyle = '#1d2233';
    for (const [ox, oy] of [
      [-1, -1],
      [1, 1],
      [0, 0],
    ])
      g.fillRect(ox * h * 0.022 - 1.5, oy * h * 0.022 - 1.5, 3, 3);
    g.restore();
  }
}

const gaming = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const [ax, bx] = pair(L, S, 0.2);
  if (!screenAge(era)) {
    sky(g, L, era === 'ancient' ? ['#2a1a0e', '#4a2e18', '#6b4426'] : ['#1e120a', '#3a2414', '#4e3018']);
    floor(g, L, S, '#2b1a0e', '#160d06');
    if (S.port) boardGame(f, L.w * 0.5, gy, fh, era, 1);
    else {
      boardGame(f, ax, gy, fh * 1.15, era, 1);
      boardGame(f, bx, gy, fh * 1.05, era, 4);
    }
    risers(f, 'st', () => (S.port ? L.w * 0.5 : f.rand.pick([ax, bx])) + f.rand.range(-0.4, 0.4) * fh, gy - fh * 0.75, 3, ['#ffd166', '#ffffff'], fh * 0.04, 1);
    return;
  }
  const holo = era === 'future';
  sky(g, L, holo ? ['#020617', '#071a33', '#0b2447'] : ['#0b0b1a', '#14142e', '#1d1640']);
  floor(g, L, S, holo ? '#06121f' : '#151225', '#07060f');
  const tx = S.port ? L.w * 0.5 : ax;
  const tw = S.port ? L.w * 0.78 : fh * 1.8;
  const th = tw * 0.56;
  const ty = S.port ? L.h * 0.08 : gy - fh * 0.95 - th;
  additive(g, () => glow(g, tx, ty + th / 2, tw * 0.9, holo ? 'rgba(0,245,212,0.35)' : 'rgba(92,148,252,0.45)'));
  if (!holo) {
    g.fillStyle = '#05050a';
    rr(g, tx - tw / 2 - 6, ty - 6, tw + 12, th + 12, 6);
    g.fill();
    g.fillRect(tx - fh * 0.2, ty + th + 6, fh * 0.4, fh * 0.05);
  }
  g.save();
  g.beginPath();
  g.rect(tx - tw / 2, ty, tw, th);
  g.clip();
  pixelGame(g, tx - tw / 2, ty, tw, th, t, holo);
  g.restore();
  if (holo) {
    g.strokeStyle = 'rgba(0,245,212,0.8)';
    g.lineWidth = 2;
    g.strokeRect(tx - tw / 2, ty, tw, th);
    g.fillStyle = 'rgba(0,245,212,0.08)';
    for (let y = ty; y < ty + th; y += 4) g.fillRect(tx - tw / 2, y + ((t * 40) % 4), tw, 1);
  }
  // pixel burst from screen
  const ps = spawn(f, 'px', 18, 80, () => ({ x: tx + f.rand.range(-0.4, 0.4) * tw, y: ty + th * f.rand.range(0.3, 0.8), vx: f.rand.range(-140, 140), vy: f.rand.range(-140, 40), life: 0, max: f.rand.range(0.8, 1.4), size: f.rand.range(3, 7), color: f.rand.pick(holo ? ['#00f5d4', '#f15bb5', '#9b5de5', '#fee440'] : ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#ffffff']) }));
  stepParticles(ps, f.dt, 120);
  additive(g, () => {
    const a = g.globalAlpha;
    for (const p of ps) {
      g.globalAlpha = a * clamp(1 - p.life / p.max);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = a;
  });
  // gamer on a beanbag, seen from behind
  const gx = tx + (S.port ? 0 : -fh * 0.15);
  const gyy = gy + fh * 0.05;
  g.fillStyle = holo ? '#3a0ca3' : '#ef476f';
  g.beginPath();
  g.ellipse(gx, gyy - fh * 0.12, fh * 0.42, fh * 0.2, 0, 0, TAU);
  g.fill();
  const lean = Math.sin(t * 4) * 0.12;
  g.save();
  g.translate(gx, gyy - fh * 0.2);
  g.rotate(lean);
  g.fillStyle = '#0a0a14';
  rr(g, -fh * 0.17, -fh * 0.38, fh * 0.34, fh * 0.4, fh * 0.12);
  g.fill();
  g.beginPath();
  g.arc(0, -fh * 0.5, fh * 0.13, 0, TAU);
  g.fill();
  // headphones
  g.strokeStyle = holo ? '#00f5d4' : '#4cc9f0';
  g.lineWidth = fh * 0.03;
  g.beginPath();
  g.arc(0, -fh * 0.5, fh * 0.15, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  g.fillStyle = holo ? '#00f5d4' : '#4cc9f0';
  g.fillRect(-fh * 0.18, -fh * 0.52, fh * 0.06, fh * 0.09);
  g.fillRect(fh * 0.12, -fh * 0.52, fh * 0.06, fh * 0.09);
  // arms up holding a controller
  g.strokeStyle = '#0a0a14';
  g.lineWidth = fh * 0.07;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-fh * 0.15, -fh * 0.3);
  g.lineTo(-fh * 0.26, -fh * 0.45);
  g.moveTo(fh * 0.15, -fh * 0.3);
  g.lineTo(fh * 0.26, -fh * 0.45);
  g.stroke();
  controller(g, 0, -fh * 0.55 + Math.sin(t * 20) * 1.5, fh * 0.42, '#1d1d2b', t);
  g.restore();
  if (!S.port) {
    // arcade cabinet with a second player
    const cx = bx;
    const glowCol = holo ? '#f15bb5' : '#ffd166';
    g.fillStyle = holo ? '#240046' : '#5a189a';
    g.beginPath();
    g.moveTo(cx - fh * 0.32, gy);
    g.lineTo(cx - fh * 0.32, gy - fh * 1.45);
    g.lineTo(cx + fh * 0.32, gy - fh * 1.45);
    g.lineTo(cx + fh * 0.32, gy - fh * 0.75);
    g.lineTo(cx + fh * 0.4, gy - fh * 0.62);
    g.lineTo(cx + fh * 0.32, gy - fh * 0.55);
    g.lineTo(cx + fh * 0.32, gy);
    g.closePath();
    g.fill();
    g.fillStyle = glowCol;
    g.fillRect(cx - fh * 0.3, gy - fh * 1.42, fh * 0.6, fh * 0.14);
    caption(g, 'ARCADE', cx, gy - fh * 1.35, fh * 0.09, '#ffffff');
    additive(g, () => glow(g, cx, gy - fh * 1.0, fh * 0.6, holo ? 'rgba(241,91,181,0.5)' : 'rgba(255,209,102,0.45)'));
    g.save();
    g.beginPath();
    g.rect(cx - fh * 0.24, gy - fh * 1.22, fh * 0.48, fh * 0.42);
    g.clip();
    pixelGame(g, cx - fh * 0.24, gy - fh * 1.22, fh * 0.48 * 2, fh * 0.42, t + 0.5, holo);
    g.restore();
    fig(g, cx + fh * 0.72, gy, fh, { color: '#0a0a14', accent: holo ? '#00f5d4' : '#06d6a0', dir: -1, hL: { x: cx + fh * 0.4, y: gy - fh * 0.66 + Math.sin(t * 18) * 3 }, hR: { x: cx + fh * 0.45, y: gy - fh * 0.62 }, lean: -0.1, hat: 'cap', hatColor: '#ef476f' });
    if (Math.floor(t * 1.2) % 2 === 0) caption(g, '+100', cx, gy - fh * 1.6 - ((t * 40) % 30), fh * 0.12, '#ffe066');
  }
});

// ---------------------------------------------------------------- karaoke

function discoBall(g: G, x: number, y: number, r: number, t: number): void {
  g.strokeStyle = '#adb5bd';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, y - r);
  g.stroke();
  g.fillStyle = '#ced4da';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  const r2 = makeRand(3);
  for (let i = 0; i < 16; i++) {
    const a = r2() * TAU;
    const d = r2() * r * 0.85;
    const on = Math.sin(t * 6 + i) > 0.3;
    g.fillStyle = on ? '#ffffff' : '#8d99ae';
    g.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 2, 4, 4);
  }
  additive(g, () => glow(g, x, y, r * 2.5, 'rgba(255,255,255,0.35)'));
}

const LYRICS = ['♪ SING IT LOUD ♪', 'WE SHINE TONIGHT'];

const karaoke = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#1a0533', '#3c096c', '#5a189a']);
  floor(g, L, S, '#240046', '#10002b');
  const [ax, bx] = pair(L, S, 0.2);
  // rotating colour spots on the wall
  additive(g, () => {
    const cols = ['rgba(255,93,143,0.35)', 'rgba(76,201,240,0.35)', 'rgba(255,214,102,0.3)'];
    for (let i = 0; i < 9; i++) {
      const a = t * 0.8 + i * 0.7;
      glow(g, L.w * 0.5 + Math.cos(a) * L.w * 0.45, L.h * 0.3 + Math.sin(a * 1.3) * L.h * 0.2, fh * 0.35, cols[i % 3]);
    }
  });
  discoBall(g, S.port ? L.w * 0.85 : ax + fh * 0.8, L.h * 0.1, fh * 0.13, t);
  // lyric screen
  const sx = S.port ? L.w * 0.5 : bx;
  const sw = S.port ? L.w * 0.8 : fh * 1.9;
  const sh = sw * 0.5;
  const sy = S.port ? L.h * 0.06 : gy - fh * 1.25 - sh;
  g.fillStyle = '#05010d';
  rr(g, sx - sw / 2 - 6, sy - 6, sw + 12, sh + 12, 8);
  g.fill();
  const sg = g.createLinearGradient(0, sy, 0, sy + sh);
  sg.addColorStop(0, '#3a0ca3');
  sg.addColorStop(1, '#7209b7');
  g.fillStyle = sg;
  g.fillRect(sx - sw / 2, sy, sw, sh);
  const fs = Math.round(sw * 0.075);
  g.font = `900 ${fs}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const prog = (t * 0.45) % 1;
  LYRICS.forEach((line, i) => {
    const ly = sy + sh * (0.35 + i * 0.32);
    g.fillStyle = '#ffffff';
    g.fillText(line, sx, ly);
    const lw = g.measureText(line).width;
    const k = clamp(prog * 2 - i);
    if (k > 0) {
      g.save();
      g.beginPath();
      g.rect(sx - lw / 2, ly - fs, lw * k, fs * 2);
      g.clip();
      g.fillStyle = '#ff4d9d';
      g.fillText(line, sx, ly);
      g.restore();
    }
  });
  // spotlight on the singer
  const px = S.port ? L.w * 0.5 : ax;
  additive(g, () => {
    const gr = g.createLinearGradient(0, 0, 0, gy);
    gr.addColorStop(0, 'rgba(255,240,200,0)');
    gr.addColorStop(1, 'rgba(255,240,200,0.45)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(px - fh * 0.1, 0);
    g.lineTo(px + fh * 0.1, 0);
    g.lineTo(px + fh * 0.6, gy);
    g.lineTo(px - fh * 0.6, gy);
    g.closePath();
    g.fill();
  });
  const belt = Math.sin(t * 3);
  const p = fig(g, px, gy, fh, { color: '#10002b', accent: '#ff4d9d', dress: true, lean: -0.08 + belt * 0.05, hR: { x: px + fh * 0.1, y: gy - fh * 0.88 }, aL: -2.3 + belt * 0.3, hat: 'bun', hatColor: '#10002b' });
  g.fillStyle = '#adb5bd';
  g.save();
  g.translate(p.rh.x, p.rh.y);
  g.rotate(-0.6);
  g.fillRect(-fh * 0.015, 0, fh * 0.03, fh * 0.12);
  g.beginPath();
  g.arc(0, -fh * 0.01, fh * 0.035, 0, TAU);
  g.fill();
  g.restore();
  notes(f, 'nt', () => p.rh.x + fh * 0.05, p.rh.y - fh * 0.05, 7, ['#ffd166', '#ff4d9d', '#4cc9f0', '#ffffff'], fh * 0.08);
  risers(f, 'st', () => px + f.rand.range(-0.5, 0.5) * fh, gy - fh * 0.3, 3, ['#ffe066', '#ffffff'], fh * 0.04, 1);
  if (!S.port) {
    fig(g, bx - fh * 0.4, gy, fh * 0.95, { color: '#10002b', accent: '#4cc9f0', aL: -2.6 + Math.sin(t * 8) * 0.25, aR: 2.6 - Math.cos(t * 8) * 0.25, hat: 'cap', hatColor: '#4cc9f0' });
    fig(g, bx + fh * 0.4, gy, fh * 0.92, { color: '#10002b', accent: '#ffd166', dress: true, dir: -1, aL: -2.7 + Math.cos(t * 7) * 0.25, aR: 2.7 + Math.sin(t * 7) * 0.25 });
  }
});

// ---------------------------------------------------------------- spa

const spa = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#cdeee6', '#b8e3e6', '#d9ccef']);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  for (let y = gy; y > 0; y -= fh * 0.3) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(L.w, y);
    g.stroke();
  }
  floor(g, L, S, '#9fc9c2', '#7fb0a8');
  const [ax, bx] = pair(L, S, 0.2);
  // bamboo
  const bambooX = S.port ? [L.w * 0.06, L.w * 0.94] : [ax - fh * 1.0, bx + fh * 0.95];
  for (const x of bambooX) {
    for (let k = 0; k < 3; k++) {
      const xx = x + (k - 1) * fh * 0.09;
      g.fillStyle = k % 2 ? '#52b788' : '#40916c';
      g.fillRect(xx - fh * 0.025, gy - fh * (1.5 + k * 0.2), fh * 0.05, fh * (1.5 + k * 0.2));
      g.fillStyle = '#2d6a4f';
      for (let j = 1; j < 5; j++) g.fillRect(xx - fh * 0.03, gy - j * fh * 0.35, fh * 0.06, 3);
      g.fillStyle = '#74c69d';
      g.beginPath();
      g.ellipse(xx + fh * 0.1, gy - fh * (1.3 + k * 0.2) + Math.sin(t * 2 + k) * 2, fh * 0.12, fh * 0.03, -0.4, 0, TAU);
      g.fill();
    }
  }
  const tx = S.port ? L.w * 0.5 : ax;
  const tw = S.port ? Math.min(L.w * 0.42, fh * 1.1) : fh * 1.1;
  const rimY = gy - fh * 0.45;
  // tub body
  g.fillStyle = '#8b5a2b';
  rr(g, tx - tw, rimY, tw * 2, gy - rimY, fh * 0.06);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 1; i < 8; i++) g.fillRect(tx - tw + (i * tw * 2) / 8, rimY + fh * 0.04, 2, gy - rimY - fh * 0.04);
  // bather (head + shoulders above water), drawn a little larger than life
  const bk = 1.35;
  g.save();
  g.translate(tx, rimY);
  g.scale(bk, bk);
  g.translate(-tx, -rimY);
  const hx = tx + Math.sin(t * 0.8) * fh * 0.02;
  const hy = rimY - fh * 0.2;
  g.fillStyle = '#5a3d55';
  rr(g, hx - fh * 0.2, hy + fh * 0.08, fh * 0.4, fh * 0.2, fh * 0.08);
  g.fill();
  g.strokeStyle = '#5a3d55';
  g.lineWidth = fh * 0.07;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hx - fh * 0.16, hy + fh * 0.13);
  g.lineTo(tx - (tw * 0.85) / bk, rimY - fh * 0.03);
  g.moveTo(hx + fh * 0.16, hy + fh * 0.13);
  g.lineTo(tx + (tw * 0.85) / bk, rimY - fh * 0.03);
  g.stroke();
  g.fillStyle = '#5a3d55';
  g.beginPath();
  g.arc(hx, hy, fh * 0.12, 0, TAU);
  g.fill();
  // towel turban
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(hx, hy - fh * 0.1, fh * 0.14, fh * 0.08, 0, Math.PI, 0);
  g.fill();
  g.beginPath();
  g.arc(hx + fh * 0.03, hy - fh * 0.17, fh * 0.06, 0, TAU);
  g.fill();
  // cucumber slices
  for (const sd of [-1, 1]) {
    const cx = hx + sd * fh * 0.05;
    const cy = hy - fh * 0.01;
    g.fillStyle = '#2d6a4f';
    g.beginPath();
    g.arc(cx, cy, fh * 0.042, 0, TAU);
    g.fill();
    g.fillStyle = '#b7e4c7';
    g.beginPath();
    g.arc(cx, cy, fh * 0.032, 0, TAU);
    g.fill();
    g.fillStyle = '#74c69d';
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4 + 0.4;
      g.fillRect(cx + Math.cos(a) * fh * 0.016 - 1, cy + Math.sin(a) * fh * 0.016 - 1, 2, 2);
    }
  }
  g.restore();
  // water surface over the bather's chest
  g.fillStyle = '#48cae4';
  g.beginPath();
  g.ellipse(tx, rimY, tw * 0.96, fh * 0.07, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(tx + Math.sin(t * 2 + i * 1.3) * tw * 0.7, rimY + Math.cos(t * 1.7 + i) * fh * 0.02, fh * 0.07, fh * 0.012, 0, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#6f4518';
  g.lineWidth = fh * 0.035;
  g.beginPath();
  g.ellipse(tx, rimY, tw, fh * 0.08, 0, 0, TAU);
  g.stroke();
  // bubbles
  const bub = spawn(f, 'bb', 22, 70, () => ({ x: tx + f.rand.range(-0.85, 0.85) * tw, y: rimY, vx: f.rand.range(-8, 8), vy: -f.rand.range(30, 70), life: 0, max: f.rand.range(0.6, 1.3), size: fh * f.rand.range(0.015, 0.04), color: '#ffffff' }));
  stepParticles(bub, f.dt);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.5;
  const a0 = g.globalAlpha;
  for (const b of bub) {
    g.globalAlpha = a0 * clamp(1.2 - b.life / b.max);
    g.beginPath();
    g.arc(b.x, b.y, b.size * (b.life / b.max > 0.9 ? 1.5 : 1), 0, TAU);
    g.stroke();
  }
  g.globalAlpha = a0;
  // steam
  g.save();
  g.globalAlpha *= 0.7;
  steamWisps(g, tx, rimY - fh * 0.3, tw * 1.4, fh * 0.6, t * 0.6, 4, 'rgba(255,255,255,0.6)');
  g.restore();
  if (!S.port) {
    // rolled towels, stones and candles
    const cols = ['#ffffff', '#ffafcc', '#a2d2ff'];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3 - r; c++) {
        const x = bx - fh * 0.5 + c * fh * 0.26 + r * fh * 0.13;
        const y = gy - fh * 0.12 - r * fh * 0.2;
        g.fillStyle = cols[(r + c) % 3];
        rr(g, x - fh * 0.12, y - fh * 0.1, fh * 0.24, fh * 0.2, fh * 0.1);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.15)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x + fh * 0.04, y, fh * 0.05, 0, TAU * 0.8);
        g.stroke();
      }
    g.fillStyle = '#6c757d';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(bx + fh * 0.45, gy - fh * (0.06 + i * 0.1), fh * (0.18 - i * 0.04), fh * 0.05, 0, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 3; i++) {
      const cx = bx + fh * (0.2 + i * 0.18);
      const ch = fh * (0.16 + (i % 2) * 0.08);
      g.fillStyle = '#fff3e0';
      g.fillRect(cx - fh * 0.04, gy - ch, fh * 0.08, ch);
      glow(g, cx, gy - ch - fh * 0.05, fh * 0.25, 'rgba(255,200,100,0.6)');
      g.fillStyle = '#ffb703';
      g.beginPath();
      g.ellipse(cx, gy - ch - fh * 0.04, fh * 0.015, fh * 0.035 * (1 + Math.sin(t * 13 + i) * 0.15), 0, 0, TAU);
      g.fill();
    }
  }
  // drifting petals
  leaves(f, 'pt', 2, ['#ffafcc', '#ffc8dd', '#ffffff']);
});

// ---------------------------------------------------------------- amusement

function ferrisWheel(g: G, x: number, y: number, R: number, t: number, base: number): void {
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(3, R * 0.04);
  g.beginPath();
  g.moveTo(x - R * 0.55, base);
  g.lineTo(x, y);
  g.lineTo(x + R * 0.55, base);
  g.stroke();
  const rot = t * 0.4;
  g.lineWidth = Math.max(1.5, R * 0.015);
  g.strokeStyle = '#ff5d8f';
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = rot + (i * TAU) / 12;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
  }
  g.stroke();
  additive(g, () => {
    for (let i = 0; i < 24; i++) {
      const a = rot + (i * TAU) / 24;
      const on = (i + Math.floor(t * 6)) % 3 === 0;
      g.fillStyle = on ? '#ffe066' : 'rgba(255,224,102,0.4)';
      g.beginPath();
      g.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, R * 0.025, 0, TAU);
      g.fill();
    }
  });
  const cols = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
  for (let i = 0; i < 12; i += 2) {
    const a = rot + (i * TAU) / 12;
    const cx = x + Math.cos(a) * R;
    const cy = y + Math.sin(a) * R;
    g.fillStyle = cols[(i / 2) % cols.length];
    rr(g, cx - R * 0.09, cy + R * 0.02, R * 0.18, R * 0.14, R * 0.04);
    g.fill();
    g.beginPath();
    g.arc(cx, cy + R * 0.02, R * 0.1, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y, R * 0.06, 0, TAU);
  g.fill();
}

function coasterPos(u: number, cx: number, cy: number, R: number, run: number): { x: number; y: number; a: number } {
  if (u < 0.3) {
    const k = u / 0.3;
    return { x: cx - run + k * run, y: cy + R, a: 0 };
  }
  if (u < 0.72) {
    const k = (u - 0.3) / 0.42;
    const phi = k * TAU;
    return { x: cx + Math.sin(phi) * R, y: cy + Math.cos(phi) * R, a: -phi };
  }
  const k = (u - 0.72) / 0.28;
  return { x: cx + k * run, y: cy + R, a: 0 };
}

const amusement = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#5cc8f0', '#a6e4f5', '#ffe5ec']);
  cloud(g, (L.w * 0.3 + t * 9) % L.w, L.h * 0.1, fh * 0.3, 'rgba(255,255,255,0.95)');
  const [ax, bx] = pair(L, S, 0.2);
  // bunting
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  const bcols = CONFETTI_COLORS;
  for (let row = 0; row < 1; row++) {
    const y0 = L.h * 0.04;
    g.beginPath();
    g.moveTo(0, y0);
    for (let x = 0; x <= L.w; x += 20) g.lineTo(x, y0 + Math.sin((x / L.w) * Math.PI * 4) * 10 + 10);
    g.stroke();
    for (let x = 10, i = 0; x < L.w; x += 26, i++) {
      const yy = y0 + Math.sin((x / L.w) * Math.PI * 4) * 10 + 10;
      g.fillStyle = bcols[i % bcols.length];
      g.beginPath();
      g.moveTo(x - 7, yy);
      g.lineTo(x + 7, yy);
      g.lineTo(x, yy + 16 + Math.sin(t * 5 + i) * 2);
      g.fill();
    }
  }
  floor(g, L, S, '#8ed081', '#5fae5a');
  // ferris wheel
  const R = S.port ? fh * 0.75 : fh * 1.15;
  const fx = S.port ? L.w * 0.78 : bx;
  ferrisWheel(g, fx, gy - R - fh * 0.15, R, t, gy);
  // coaster loop
  const cx = S.port ? L.w * 0.36 : ax;
  const lr = S.port ? fh * 0.5 : fh * 0.75;
  const cy = gy - fh * 0.35 - lr;
  const run = S.port ? L.w * 0.4 : fh * 1.25;
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(2, fh * 0.015);
  g.beginPath();
  for (let i = -3; i <= 3; i++) {
    const x = cx + (i * run) / 3;
    g.moveTo(x, cy + lr);
    g.lineTo(x, gy);
  }
  g.moveTo(cx - lr, cy);
  g.lineTo(cx - lr * 0.3, gy);
  g.moveTo(cx + lr, cy);
  g.lineTo(cx + lr * 0.3, gy);
  g.stroke();
  g.strokeStyle = '#ef233c';
  g.lineWidth = Math.max(4, fh * 0.04);
  g.beginPath();
  g.moveTo(cx - run - 20, cy + lr);
  g.lineTo(cx + run + 20, cy + lr);
  g.moveTo(cx + lr, cy);
  g.arc(cx, cy, lr, 0, TAU);
  g.stroke();
  // train
  const u = (t / 3.0 + 0.35) % 1;
  const cars = ['#ffd166', '#4cc9f0', '#06d6a0'];
  for (let i = 0; i < 3; i++) {
    const q = coasterPos((u - i * 0.035 + 1) % 1, cx, cy, lr - fh * 0.04, run);
    g.save();
    g.translate(q.x, q.y);
    g.rotate(q.a);
    g.fillStyle = cars[i];
    rr(g, -fh * 0.1, -fh * 0.1, fh * 0.2, fh * 0.1, fh * 0.03);
    g.fill();
    g.fillStyle = '#1d2233';
    g.beginPath();
    g.arc(-fh * 0.03, -fh * 0.15, fh * 0.035, 0, TAU);
    g.arc(fh * 0.05, -fh * 0.15, fh * 0.035, 0, TAU);
    g.fill();
    g.strokeStyle = '#1d2233';
    g.lineWidth = fh * 0.02;
    g.beginPath();
    g.moveTo(-fh * 0.03, -fh * 0.15);
    g.lineTo(-fh * 0.07, -fh * 0.27);
    g.moveTo(fh * 0.05, -fh * 0.15);
    g.lineTo(fh * 0.09, -fh * 0.27);
    g.stroke();
    g.restore();
  }
  const head = coasterPos(u, cx, cy, lr, run);
  if (u > 0.3 && u < 0.72) caption(g, 'WHEE!', head.x + (head.x > cx ? fh * 0.4 : -fh * 0.4), head.y - fh * 0.1, fh * 0.13, '#ffe066');
  // balloons
  const bal = spawn(f, 'bl', 2, 12, () => ({ x: f.rand() * L.w, y: gy, vx: f.rand.range(-10, 10), vy: -f.rand.range(50, 80), life: 0, max: 6, size: fh * f.rand.range(0.07, 0.1), color: f.rand.pick(CONFETTI_COLORS) }));
  stepParticles(bal, f.dt);
  for (const b of bal) {
    const bxx = b.x + Math.sin(b.life * 2 + b.size) * 8;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(bxx, b.y + b.size * 1.2);
    g.lineTo(bxx + Math.sin(b.life * 3) * 4, b.y + b.size * 3.5);
    g.stroke();
    g.fillStyle = b.color;
    g.beginPath();
    g.ellipse(bxx, b.y, b.size, b.size * 1.2, 0, 0, TAU);
    g.fill();
  }
  // excited visitor
  if (!S.port) fig(g, ax + fh * 1.05, gy, fh * 0.7, { color: '#2b2d42', accent: '#ff5d8f', aL: -2.6 + Math.sin(t * 9) * 0.2, aR: 2.6 + Math.cos(t * 9) * 0.2 });
});

// ---------------------------------------------------------------- museum

function trex(g: G, x: number, y: number, s: number, t: number, col: string): void {
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const hip = { x: x + s * 0.05, y: y - s * 0.55 };
  // legs
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(hip.x, hip.y);
  g.lineTo(hip.x + s * 0.1, hip.y + s * 0.25);
  g.lineTo(hip.x - s * 0.02, y - s * 0.03);
  g.lineTo(hip.x + s * 0.1, y);
  g.moveTo(hip.x + s * 0.03, hip.y);
  g.lineTo(hip.x - s * 0.12, hip.y + s * 0.26);
  g.lineTo(hip.x - s * 0.2, y - s * 0.02);
  g.lineTo(hip.x - s * 0.08, y);
  g.stroke();
  // spine (tail to neck)
  const sp: P[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    sp.push({ x: x - s * 0.75 + u * s * 1.15, y: y - s * 0.3 - Math.sin(u * Math.PI * 0.85) * s * 0.35 - u * s * 0.05 + Math.sin(t * 2 + u * 3) * s * 0.005 });
  }
  g.lineWidth = s * 0.035;
  g.beginPath();
  sp.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  for (let i = 1; i < 16; i++) {
    g.beginPath();
    g.arc(sp[i].x, sp[i].y, s * 0.022, 0, TAU);
    g.fill();
  }
  // ribs
  g.lineWidth = s * 0.018;
  for (let i = 8; i <= 13; i++) {
    const p = sp[i];
    const len = s * (0.12 + Math.sin(((i - 8) / 5) * Math.PI) * 0.12);
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.quadraticCurveTo(p.x + s * 0.06, p.y + len * 0.6, p.x + s * 0.01, p.y + len);
    g.stroke();
  }
  // neck + skull
  const nk = sp[16];
  const jaw = Math.max(0, Math.sin(t * 2.5)) * 0.35;
  const sk = { x: nk.x + s * 0.12, y: nk.y - s * 0.08 };
  g.lineWidth = s * 0.035;
  g.beginPath();
  g.moveTo(nk.x, nk.y);
  g.lineTo(sk.x, sk.y);
  g.stroke();
  g.beginPath();
  g.moveTo(sk.x - s * 0.04, sk.y - s * 0.07);
  g.lineTo(sk.x + s * 0.24, sk.y - s * 0.05);
  g.lineTo(sk.x + s * 0.26, sk.y + s * 0.02);
  g.lineTo(sk.x - s * 0.02, sk.y + s * 0.04);
  g.closePath();
  g.fill();
  g.save();
  g.translate(sk.x, sk.y + s * 0.03);
  g.rotate(jaw);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(s * 0.22, s * 0.0);
  g.lineTo(s * 0.2, s * 0.05);
  g.lineTo(0, s * 0.05);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = '#2f4858';
  g.beginPath();
  g.arc(sk.x + s * 0.04, sk.y - s * 0.03, s * 0.022, 0, TAU);
  g.fill();
  // tiny arms
  g.strokeStyle = col;
  g.lineWidth = s * 0.018;
  g.beginPath();
  g.moveTo(sp[14].x, sp[14].y + s * 0.08);
  g.lineTo(sp[14].x + s * 0.07, sp[14].y + s * 0.14);
  g.lineTo(sp[14].x + s * 0.1, sp[14].y + s * 0.11);
  g.stroke();
}

function frameArt(g: G, x: number, y: number, w: number, h: number, kind: number, t: number): void {
  g.fillStyle = '#d4a017';
  g.fillRect(x - w / 2 - 7, y - 7, w + 14, h + 14);
  g.fillStyle = '#b8860b';
  g.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  if (kind === 0) {
    g.fillStyle = '#1d3557';
    g.fillRect(x - w / 2, y, w, h);
    g.fillStyle = '#ffd166';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x - w * 0.25 + i * w * 0.25, y + h * 0.3 + Math.sin(i * 2) * h * 0.08, h * 0.08, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#4cc9f0';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = 0; k <= 10; k++) g.lineTo(x - w / 2 + (k / 10) * w, y + h * 0.65 + Math.sin(k + t * 2) * h * 0.06);
    g.stroke();
  } else if (kind === 1) {
    g.fillStyle = '#f4a261';
    g.fillRect(x - w / 2, y, w, h);
    g.fillStyle = '#6d4c41';
    g.beginPath();
    g.ellipse(x, y + h * 0.95, w * 0.25, h * 0.4, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#2b2d42';
    g.beginPath();
    g.arc(x, y + h * 0.4, w * 0.18, 0, TAU);
    g.fill();
  } else {
    g.fillStyle = '#ffffff';
    g.fillRect(x - w / 2, y, w, h);
    g.fillStyle = '#e63946';
    g.fillRect(x - w / 2, y, w * 0.6, h * 0.55);
    g.fillStyle = '#1d3557';
    g.fillRect(x + w * 0.15, y + h * 0.6, w * 0.35, h * 0.4);
    g.fillStyle = '#ffd166';
    g.fillRect(x - w / 2, y + h * 0.7, w * 0.3, h * 0.3);
    g.fillStyle = '#111';
    g.fillRect(x + w * 0.1, y, 4, h);
    g.fillRect(x - w / 2, y + h * 0.57, w, 4);
  }
}

const museum = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#22384a', '#2f4858', '#33658a']);
  g.fillStyle = '#1b2a38';
  g.fillRect(0, gy - fh * 0.12, L.w, fh * 0.12);
  floor(g, L, S, '#6b5b4b', '#3e3227');
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, gy + 3, L.w, 3);
  const [ax, bx] = pair(L, S, 0.2);
  const spot = (x: number, y: number) =>
    additive(g, () => {
      const gr = g.createRadialGradient(x, y, 0, x, y, fh * 0.9);
      gr.addColorStop(0, 'rgba(255,240,200,0.45)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - fh * 0.05, 0);
      g.lineTo(x + fh * 0.05, 0);
      g.lineTo(x + fh * 0.8, y + fh * 0.5);
      g.lineTo(x - fh * 0.8, y + fh * 0.5);
      g.closePath();
      g.fill();
    });
  // dinosaur on its plinth
  const dx = S.port ? L.w * 0.5 : ax;
  const ds = S.port ? Math.min(fh * 1.5, L.w * 0.8) : fh * 1.6;
  spot(dx, gy - fh * 1.0);
  g.fillStyle = '#4a4e69';
  g.fillRect(dx - ds * 0.55, gy - fh * 0.12, ds * 1.1, fh * 0.12);
  trex(g, dx, gy - fh * 0.12, ds, t, '#f2e8cf');
  if (!S.port) {
    frameArt(g, bx - fh * 0.15, gy - fh * 1.9, fh * 0.8, fh * 0.6, 0, t);
    frameArt(g, bx + fh * 0.75, gy - fh * 1.75, fh * 0.4, fh * 0.55, 1, t);
    frameArt(g, bx - fh * 0.95, gy - fh * 1.7, fh * 0.42, fh * 0.42, 2, t);
    spot(bx - fh * 0.15, gy - fh * 1.6);
    // bench + visitors
    g.fillStyle = '#1b2a38';
    g.fillRect(bx - fh * 0.45, gy - fh * 0.3, fh * 0.6, fh * 0.06);
    g.fillRect(bx - fh * 0.42, gy - fh * 0.25, fh * 0.05, fh * 0.25);
    g.fillRect(bx + fh * 0.08, gy - fh * 0.25, fh * 0.05, fh * 0.25);
    fig(g, bx - fh * 0.18, gy, fh * 0.95, { color: '#0d1b2a', accent: '#e76f51', legs: 'sit', dir: 1, hR: { x: bx + fh * 0.05, y: gy - fh * 0.75 }, aL: 0.3, lean: -0.1 });
    fig(g, bx + fh * 0.55, gy, fh, { color: '#0d1b2a', accent: '#90be6d', dir: -1, aL: 0.5, bL: 1.6, aR: -0.5, bR: -1.6, hat: 'tophat', hatColor: '#0d1b2a' });
    additive(g, () => {
      for (let i = 0; i < 3; i++) {
        const tw = Math.max(0, Math.sin(t * 3 + i * 2));
        star(g, bx - fh * 0.15 + (i - 1) * fh * 0.42, gy - fh * 1.95 + (i % 2) * fh * 0.65, fh * 0.06 * tw, '#fff3b0', t);
      }
    });
  }
  // a child pointing up at the dinosaur and a parent
  const kx = S.port ? L.w * 0.18 : ax + fh * 0.95;
  fig(g, kx, gy, fh * 0.6, { color: '#0d1b2a', accent: '#ffd166', dir: -1, aL: -2.5 + Math.sin(t * 6) * 0.15, aR: 0.3, hat: 'cap', hatColor: '#ef476f' });
  if (!S.port) fig(g, ax - fh * 1.0, gy, fh, { color: '#0d1b2a', accent: '#4cc9f0', dir: 1, dress: true, aL: -0.2, hR: { x: ax - fh * 0.65, y: gy - fh * 0.95 } });
  risers(f, 'wow', () => kx + f.rand.range(-0.2, 0.2) * fh, gy - fh * 0.65, 1.5, ['#ffd166'], fh * 0.04, 1);
});

// ---------------------------------------------------------------- bar

function mug(g: G, x: number, y: number, s: number, wood: boolean, tilt: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = wood ? '#8b5a2b' : 'rgba(255,190,60,0.95)';
  rr(g, -s * 0.35, -s * 0.5, s * 0.7, s, s * 0.08);
  g.fill();
  if (wood) {
    g.fillStyle = '#5a3a22';
    g.fillRect(-s * 0.35, -s * 0.3, s * 0.7, s * 0.07);
    g.fillRect(-s * 0.35, s * 0.25, s * 0.7, s * 0.07);
  } else {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-s * 0.25, -s * 0.4, s * 0.1, s * 0.8);
  }
  g.strokeStyle = wood ? '#8b5a2b' : 'rgba(255,255,255,0.8)';
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.arc(s * 0.38, 0, s * 0.2, -1.3, 1.3);
  g.stroke();
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.arc(-s * 0.22, -s * 0.52, s * 0.17, 0, TAU);
  g.arc(0, -s * 0.58, s * 0.2, 0, TAU);
  g.arc(s * 0.22, -s * 0.52, s * 0.17, 0, TAU);
  g.fill();
  g.restore();
}

const bar = def(3.3, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  const tavern = preIndustrial(era);
  const ctY = gy - fh * 0.5;
  const [ax, bx] = pair(L, S, 0.2);
  if (tavern) {
    sky(g, L, ['#2a170c', '#3e2414', '#4e2e18']);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < L.w; x += fh * 0.28) g.fillRect(x, 0, 3, ctY);
    g.fillStyle = '#24130a';
    g.fillRect(0, L.h * 0.08, L.w, fh * 0.12);
    // barrels on the back wall
    for (let x = fh * 0.5; x < L.w; x += fh * 0.9) {
      g.fillStyle = '#7a4a24';
      g.beginPath();
      g.ellipse(x, ctY - fh * 0.75, fh * 0.28, fh * 0.32, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#3a2412';
      g.fillRect(x - fh * 0.28, ctY - fh * 0.92, fh * 0.56, fh * 0.04);
      g.fillRect(x - fh * 0.28, ctY - fh * 0.62, fh * 0.56, fh * 0.04);
      g.fillStyle = '#5a3a1a';
      g.beginPath();
      g.arc(x, ctY - fh * 0.75, fh * 0.07, 0, TAU);
      g.fill();
    }
    for (const x of S.port ? [L.w * 0.1, L.w * 0.9] : [ax - fh * 1.1, bx + fh * 1.05]) {
      g.fillStyle = '#3a2412';
      g.fillRect(x - 3, ctY - fh * 1.5, 6, fh * 0.3);
      additive(g, () => flame(g, x, ctY - fh * 1.5, fh * 0.16, t, ['#e85d04', '#faa307', '#ffe066']));
      glow(g, x, ctY - fh * 1.6, fh * 0.9, 'rgba(255,150,60,0.35)');
    }
  } else {
    sky(g, L, era === 'future' ? ['#050816', '#0d1333', '#1b1446'] : ['#120d1c', '#1f1530', '#2e1f3e']);
    // back shelves with backlit bottles
    for (let row = 0; row < 2; row++) {
      const sy = ctY - fh * (0.75 + row * 0.5);
      additive(g, () => {
        g.fillStyle = 'rgba(255,170,80,0.18)';
        g.fillRect(0, sy - fh * 0.38, L.w, fh * 0.38);
      });
      g.fillStyle = '#3a2a1e';
      g.fillRect(0, sy, L.w, fh * 0.04);
      const r = makeRand(40 + row);
      const bc = ['#2a9d8f', '#e9c46a', '#e76f51', '#8ecae6', '#b5179e', '#90be6d'];
      for (let x = r() * 20; x < L.w; x += fh * (0.13 + r() * 0.08)) {
        const h = fh * (0.22 + r() * 0.12);
        g.fillStyle = bc[Math.floor(r() * bc.length)];
        g.globalAlpha *= 0.9;
        rr(g, x - fh * 0.04, sy - h * 0.7, fh * 0.08, h * 0.7, fh * 0.02);
        g.fill();
        g.fillRect(x - fh * 0.015, sy - h, fh * 0.03, h * 0.32);
        g.globalAlpha /= 0.9;
      }
    }
    // neon sign
    const nx = S.port ? L.w * 0.5 : ax;
    const ny = S.port ? L.h * 0.07 : ctY - fh * 1.75;
    const flick = Math.sin(t * 40) > -0.9 ? 1 : 0.4;
    additive(g, () => glow(g, nx, ny, fh * 0.7, era === 'future' ? 'rgba(0,245,212,0.55)' : 'rgba(255,77,157,0.55)', flick));
    caption(g, era === 'industrial' ? 'SALOON' : 'BAR', nx, ny, fh * 0.3, era === 'future' ? '#9bfff0' : '#ffd1e8', flick);
  }
  // bartender behind the counter
  const btx = S.port ? L.w * 0.5 : bx;
  const pour = Math.sin(t * 3);
  const bp = fig(g, btx, gy, fh, { color: '#140c0a', accent: tavern ? '#e9c46a' : '#ffffff', dir: -1, hL: { x: btx - fh * 0.3, y: ctY - fh * 0.25 + pour * fh * 0.04 }, hR: { x: btx + fh * 0.2, y: ctY - fh * 0.1 }, hat: tavern ? 'bandana' : 'none', hatColor: '#c1121f' });
  if (!tavern) {
    g.strokeStyle = '#1d1d1d';
    g.lineWidth = fh * 0.05;
    g.beginPath();
    g.moveTo(bp.sh.x - fh * 0.03, bp.sh.y + fh * 0.06);
    g.lineTo(bp.sh.x + fh * 0.03, bp.sh.y + fh * 0.06);
    g.stroke();
  }
  // counter
  g.fillStyle = tavern ? '#5a3a1e' : '#4a2c1a';
  g.fillRect(0, ctY, L.w, gy - ctY);
  g.fillStyle = tavern ? '#7a5230' : '#8b5a2b';
  g.fillRect(0, ctY - fh * 0.05, L.w, fh * 0.06);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 0; x < L.w; x += fh * 0.45) g.fillRect(x, ctY + fh * 0.05, 3, gy - ctY - fh * 0.05);
  // beer pulled at the bar
  mug(g, btx - fh * 0.3, ctY - fh * 0.12, fh * 0.16, tavern, 0);
  // two friends clinking mugs
  const cx = S.port ? L.w * 0.5 : ax;
  const per = 1.3;
  const u = (t % per) / per;
  const close = u < 0.5 ? span(u, 0.1, 0.45) : 1 - span(u, 0.6, 0.95);
  const gap = lerp(fh * 0.45, fh * 0.12, close);
  const hy = gy - fh * 0.8 - close * fh * 0.12;
  fig(g, cx - fh * 0.45, gy, fh, { color: '#1b1020', accent: tavern ? '#6a994e' : '#ef476f', dir: 1, hR: { x: cx - gap / 2 - fh * 0.08, y: hy }, aL: -0.2, hat: tavern ? 'beanie' : 'cap', hatColor: tavern ? '#a7c957' : '#ef476f' });
  fig(g, cx + fh * 0.45, gy, fh * 0.97, { color: '#1b1020', accent: tavern ? '#bc6c25' : '#4cc9f0', dir: -1, hL: { x: cx + gap / 2 + fh * 0.08, y: hy }, aR: 0.2, dress: !tavern });
  mug(g, cx - gap / 2 - fh * 0.06, hy - fh * 0.03, fh * 0.17, tavern, 0.25 * close);
  mug(g, cx + gap / 2 + fh * 0.06, hy - fh * 0.03, fh * 0.17, tavern, -0.25 * close);
  const foam = particles(f.mem, 'fm');
  const prev = (f.mem.pc as number | undefined) ?? 0;
  if (prev < 0.97 && close >= 0.97) {
    for (let i = 0; i < 22; i++) foam.push({ x: cx, y: hy - fh * 0.12, vx: f.rand.range(-120, 120), vy: -f.rand.range(80, 240), life: 0, max: 0.9, size: f.rand.range(2, 4.5), color: f.rand() < 0.7 ? '#fffaf0' : '#ffd166' });
    f.mem.flash = t;
  }
  f.mem.pc = close;
  stepParticles(foam, f.dt, 600);
  dots(g, foam);
  const fl = t - ((f.mem.flash as number | undefined) ?? -9);
  if (fl < 0.35) {
    additive(g, () => {
      glow(g, cx, hy - fh * 0.12, fh * 0.5 * (1 - fl / 0.35) + 1, 'rgba(255,240,180,0.9)');
      star(g, cx, hy - fh * 0.2, fh * 0.12 * (1 - fl / 0.35), '#fff3b0', fl * 4);
    });
    caption(g, 'CLINK!', cx, hy - fh * 0.5, fh * 0.15, '#ffe066', 1 - fl / 0.35);
  }
});

// ---------------------------------------------------------------- volunteer

const volunteer = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#79c7f2', '#bfe6fa', '#fff1d6']);
  const [ax, bx] = pair(L, S, 0.2);
  sun(g, S.port ? L.w * 0.15 : ax - fh * 0.9, L.h * 0.12, fh * 0.22, '#fff3b0', 'rgba(255,230,120,0.8)');
  const r = makeRand(15);
  for (let x = fh * 0.2; x < L.w; x += fh * (0.7 + r() * 0.5)) roundTree(g, x, gy - fh * 0.1, fh * (0.9 + r() * 0.4), '#5a3d2b', '#74b45a', '#95d073');
  floor(g, L, S, '#7cc26b', '#4f9a4a');
  g.fillStyle = '#7cc26b';
  g.fillRect(0, gy - fh * 0.12, L.w, fh * 0.12);
  // tree planting
  const tx = S.port ? L.w * 0.5 : ax + fh * 0.1;
  g.fillStyle = '#6f4e37';
  g.beginPath();
  g.ellipse(tx, gy, fh * 0.32, fh * 0.07, 0, Math.PI, 0);
  g.fill();
  const grow = 0.25 + 0.75 * span(t, 0.4, 2.4);
  roundTree(g, tx, gy - fh * 0.02, fh * 1.0 * grow, '#6f4e37', '#52b788', '#95d5b2');
  const dig = Math.sin(t * 5);
  const sx = tx - fh * 0.55;
  const blade = { x: sx + fh * 0.3, y: gy - fh * 0.02 - Math.max(0, dig) * fh * 0.08 };
  fig(g, sx, gy, fh, { color: '#283618', accent: '#ffb703', hL: { x: blade.x - fh * 0.18, y: blade.y - fh * 0.45 }, hR: { x: blade.x - fh * 0.1, y: blade.y - fh * 0.3 }, lean: 0.12, hat: 'cap', hatColor: '#ffb703' });
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = Math.max(2, fh * 0.025);
  g.beginPath();
  g.moveTo(blade.x - fh * 0.22, blade.y - fh * 0.55);
  g.lineTo(blade.x, blade.y);
  g.stroke();
  g.fillStyle = '#adb5bd';
  g.beginPath();
  g.ellipse(blade.x + fh * 0.01, blade.y + fh * 0.02, fh * 0.035, fh * 0.06, -0.4, 0, TAU);
  g.fill();
  fig(g, tx + fh * 0.5, gy, fh * 0.95, { color: '#283618', accent: '#06d6a0', dir: -1, legs: 'kneel', hL: { x: tx + fh * 0.2, y: gy - fh * 0.04 + Math.abs(Math.sin(t * 6)) * -fh * 0.05 }, aR: 0.3, dress: true, hat: 'bun', hatColor: '#283618' });
  if (!S.port) {
    // soup kitchen table
    const kx = bx;
    g.fillStyle = '#ffffff';
    g.fillRect(kx - fh * 0.55, gy - fh * 0.45, fh * 1.1, fh * 0.06);
    g.fillStyle = '#e63946';
    g.fillRect(kx - fh * 0.55, gy - fh * 0.39, fh * 1.1, fh * 0.2);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) g.fillRect(kx - fh * 0.55 + i * fh * 0.2, gy - fh * 0.39, fh * 0.1, fh * 0.2);
    g.fillStyle = '#6c757d';
    g.fillRect(kx - fh * 0.5, gy - fh * 0.19, fh * 0.04, fh * 0.19);
    g.fillRect(kx + fh * 0.46, gy - fh * 0.19, fh * 0.04, fh * 0.19);
    g.fillStyle = '#495057';
    rr(g, kx - fh * 0.35, gy - fh * 0.68, fh * 0.32, fh * 0.23, fh * 0.03);
    g.fill();
    steamWisps(g, kx - fh * 0.19, gy - fh * 0.7, fh * 0.25, fh * 0.35, t, 3);
    const hand = { x: kx + Math.sin(t * 2) * fh * 0.06, y: gy - fh * 0.62 };
    fig(g, kx - fh * 0.72, gy, fh, { color: '#1d2233', accent: '#ffffff', dir: 1, hR: { x: kx - fh * 0.25, y: gy - fh * 0.7 }, aL: -0.2, hat: 'chef', hatColor: '#ffffff' });
    fig(g, kx + fh * 0.72, gy, fh * 0.95, { color: '#1d2233', accent: '#9b5de5', dir: -1, hL: hand, aR: 0.2, hat: 'beanie', hatColor: '#9b5de5' });
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.ellipse(hand.x - fh * 0.03, hand.y, fh * 0.08, fh * 0.04, 0, 0, Math.PI);
    g.fill();
    steamWisps(g, hand.x - fh * 0.03, hand.y - fh * 0.02, fh * 0.12, fh * 0.2, t + 1, 2);
  }
  risers(f, 'hz', () => (S.port ? tx : f.rand.pick([ax, bx])) + f.rand.range(-0.6, 0.6) * fh, gy - fh * 0.9, 5, ['#ff5d8f', '#ff8fab', '#ffb3c6', '#ef476f'], fh * 0.07, 0);
});

// ---------------------------------------------------------------- theater

function curtain(g: G, x0: number, x1: number, top: number, bot: number, t: number): void {
  if (x1 - x0 < 1) return;
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  const folds = Math.max(2, Math.round((x1 - x0) / 34));
  for (let i = 0; i <= folds; i++) gr.addColorStop(i / folds, i % 2 ? '#7a0010' : '#c1121f');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x0, top);
  g.lineTo(x1, top);
  for (let i = 0; i <= 8; i++) g.lineTo(x1 + Math.sin(i + t * 2) * 3, lerp(top, bot, i / 8));
  g.lineTo(x0, bot);
  g.closePath();
  g.fill();
}

const theater = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#1a0b0b', '#2b1010', '#3d1414']);
  const stY = S.port ? gy - fh * 0.15 : gy - fh * 0.05;
  g.fillStyle = '#8b5a2b';
  g.fillRect(0, stY, L.w, L.h - stY);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 0; x < L.w; x += fh * 0.3) g.fillRect(x, stY, 2, L.h - stY);
  const [ax, bx] = pair(L, S, 0.24);
  // spotlights
  for (const x of [ax, bx]) {
    additive(g, () => {
      const gr = g.createLinearGradient(0, 0, 0, stY);
      gr.addColorStop(0, 'rgba(255,240,200,0)');
      gr.addColorStop(1, 'rgba(255,240,200,0.4)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - fh * 0.1, 0);
      g.lineTo(x + fh * 0.1, 0);
      g.lineTo(x + fh * 0.7, stY);
      g.lineTo(x - fh * 0.7, stY);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,240,200,0.3)';
      g.beginPath();
      g.ellipse(x, stY + fh * 0.03, fh * 0.7, fh * 0.08, 0, 0, TAU);
      g.fill();
    });
  }
  // actors bowing
  const bow = (k: number) => Math.max(0, Math.sin(t * 2.2 - k)) * 0.9;
  const actor = (x: number, i: number, col: string, dress: boolean, hat: FigO['hat']) => fig(g, x, stY, fh, { color: '#1a0a0a', accent: col, dress, lean: bow(i * 0.3), dir: 1, aL: -0.2 - bow(i * 0.3) * 0.5, aR: 0.6 + bow(i * 0.3), hat, hatColor: col });
  if (S.port) {
    actor(L.w * 0.35, 0, '#ffd166', false, 'tophat');
    actor(L.w * 0.65, 1, '#ff5d8f', true, 'bun');
  } else {
    actor(ax - fh * 0.3, 0, '#ffd166', false, 'tophat');
    actor(ax + fh * 0.3, 1, '#ff5d8f', true, 'bun');
    actor(bx - fh * 0.3, 2, '#4cc9f0', false, 'none');
    actor(bx + fh * 0.3, 3, '#b388ff', true, 'bun');
  }
  // roses thrown from the audience
  const roses = spawn(f, 'rs', 5, 30, () => {
    const tx = (S.port ? L.w * 0.5 : f.rand.pick([ax, bx])) + f.rand.range(-0.7, 0.7) * fh;
    const sx = tx + f.rand.range(-1, 1) * fh;
    return { x: sx, y: L.h + 10, vx: (tx - sx) / 1.0, vy: -f.rand.range(560, 680) * (S.port ? 0.75 : 1), life: 0, max: 1.6, size: fh * 0.06, color: f.rand.pick(['#e5383b', '#ff4d6d', '#ffffff']), rot: f.rand() * TAU, vr: f.rand.range(-6, 6) };
  });
  stepParticles(roses, f.dt, S.port ? 520 : 700);
  for (const p of roses) {
    if (p.y > stY && p.vy > 0) {
      p.vy = 0;
      p.vx = 0;
      p.vr = 0;
      p.y = stY;
    }
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot ?? 0);
    g.strokeStyle = '#2d6a4f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(p.size * 2.2, 0);
    g.stroke();
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(0, 0, p.size * 0.6, 0, TAU);
    g.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.45, 0, TAU);
    g.arc(p.size * 0.3, -p.size * 0.3, p.size * 0.45, 0, TAU);
    g.fill();
    g.restore();
  }
  // footlights
  additive(g, () => {
    const fg = g.createLinearGradient(0, stY - fh * 0.25, 0, stY + fh * 0.05);
    fg.addColorStop(0, 'rgba(255,214,120,0)');
    fg.addColorStop(1, 'rgba(255,214,120,0.45)');
    g.fillStyle = fg;
    g.fillRect(0, stY - fh * 0.25, L.w, fh * 0.3);
  });
  g.fillStyle = '#ffe9a8';
  for (let x = fh * 0.2; x < L.w; x += fh * 0.45) {
    g.beginPath();
    g.arc(x, stY + fh * 0.03, fh * 0.025, 0, TAU);
    g.fill();
  }
  // curtains opening + valance
  const open = span(t, 0.1, 1.2);
  const top = 0;
  curtain(g, 0, lerp(L.w * 0.5, L.w * 0.04, open), top, stY + fh * 0.05, t);
  g.save();
  g.translate(L.w, 0);
  g.scale(-1, 1);
  curtain(g, 0, lerp(L.w * 0.5, L.w * 0.04, open), top, stY + fh * 0.05, t);
  g.restore();
  const vh = S.port ? L.h * 0.07 : L.h * 0.09;
  g.fillStyle = '#9d0208';
  g.fillRect(0, 0, L.w, vh);
  g.fillStyle = '#9d0208';
  for (let x = 0; x < L.w; x += fh * 0.5) {
    g.beginPath();
    g.arc(x + fh * 0.25, vh, fh * 0.25, 0, Math.PI);
    g.fill();
  }
  g.fillStyle = '#d4a017';
  g.fillRect(0, vh - 4, L.w, 4);
  // audience silhouettes
  audienceRow(g, L, S.port ? gy + fh * 0.35 : L.h + fh * 0.12, fh * 0.8, '#0a0404', 23, t);
  if (t > 1.2) risers(f, 'st', () => (S.port ? L.w * 0.5 : f.rand.pick([ax, bx])) + f.rand.range(-0.7, 0.7) * fh, stY - fh * 1.0, 4, ['#ffd166', '#ffffff'], fh * 0.05, 1);
});

// ---------------------------------------------------------------- zoo

function elephant(g: G, x: number, y: number, s: number, t: number): P {
  const col = '#8d99ae';
  g.fillStyle = '#6c7a91';
  for (const lx of [-0.32, 0.18]) g.fillRect(x + lx * s, y - s * 0.38, s * 0.14, s * 0.38);
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x - s * 0.05, y - s * 0.55, s * 0.5, s * 0.32, 0, 0, TAU);
  g.fill();
  for (const lx of [-0.42, 0.28]) g.fillRect(x + lx * s, y - s * 0.4, s * 0.15, s * 0.4);
  // tail
  g.strokeStyle = col;
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.moveTo(x - s * 0.53, y - s * 0.6);
  g.lineTo(x - s * 0.62, y - s * 0.38 + Math.sin(t * 5) * s * 0.03);
  g.stroke();
  // head
  const hx = x + s * 0.48;
  const hy = y - s * 0.68;
  g.fillStyle = col;
  g.beginPath();
  g.arc(hx, hy, s * 0.22, 0, TAU);
  g.fill();
  // trunk
  const sw = Math.sin(t * 2.5);
  const tip = { x: hx + s * (0.32 + sw * 0.1), y: hy - s * (0.15 + Math.max(0, sw) * 0.35) };
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.moveTo(hx + s * 0.12, hy + s * 0.08);
  g.quadraticCurveTo(hx + s * 0.35, hy + s * 0.35, tip.x, tip.y);
  g.stroke();
  // ear flapping
  const flap = 0.85 + Math.sin(t * 4) * 0.15;
  g.fillStyle = '#a3afc2';
  g.beginPath();
  g.ellipse(hx - s * 0.12, hy + s * 0.02, s * 0.2 * flap, s * 0.24, -0.2, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(hx + s * 0.14, hy + s * 0.14);
  g.lineTo(hx + s * 0.26, hy + s * 0.18);
  g.lineTo(hx + s * 0.16, hy + s * 0.2);
  g.fill();
  g.fillStyle = '#1d2233';
  g.beginPath();
  g.arc(hx + s * 0.08, hy - s * 0.05, s * 0.025, 0, TAU);
  g.fill();
  return tip;
}

function giraffe(g: G, x: number, y: number, s: number, t: number): void {
  const col = '#f4a259';
  const spot = '#a0522d';
  g.fillStyle = col;
  for (const lx of [-0.22, -0.12, 0.14, 0.24]) g.fillRect(x + lx * s, y - s * 0.5, s * 0.05, s * 0.5);
  g.beginPath();
  g.ellipse(x, y - s * 0.55, s * 0.3, s * 0.13, -0.1, 0, TAU);
  g.fill();
  const bob = Math.sin(t * 1.6) * 0.08;
  const nb = { x: x + s * 0.22, y: y - s * 0.6 };
  const hd = { x: x + s * (0.42 + bob), y: y - s * (1.25 - Math.abs(bob)) };
  g.strokeStyle = col;
  g.lineWidth = s * 0.09;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(nb.x, nb.y);
  g.lineTo(hd.x, hd.y);
  g.stroke();
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(hd.x + s * 0.06, hd.y + s * 0.01, s * 0.11, s * 0.055, 0.35, 0, TAU);
  g.fill();
  g.strokeStyle = spot;
  g.lineWidth = s * 0.02;
  g.beginPath();
  g.moveTo(hd.x - s * 0.02, hd.y - s * 0.03);
  g.lineTo(hd.x - s * 0.03, hd.y - s * 0.1);
  g.moveTo(hd.x + s * 0.02, hd.y - s * 0.03);
  g.lineTo(hd.x + s * 0.02, hd.y - s * 0.1);
  g.stroke();
  g.fillStyle = spot;
  const r = makeRand(2);
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(x + (r() - 0.5) * s * 0.45, y - s * 0.55 + (r() - 0.5) * s * 0.14, s * 0.03, 0, TAU);
    g.fill();
  }
  for (let i = 1; i < 5; i++) {
    const u = i / 5;
    g.beginPath();
    g.arc(lerp(nb.x, hd.x, u), lerp(nb.y, hd.y, u), s * 0.022, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#1d2233';
  g.beginPath();
  g.arc(hd.x + s * 0.03, hd.y - s * 0.01, s * 0.015, 0, TAU);
  g.fill();
}

const zoo = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#66c3f2', '#b0e2fa', '#f3fbe8']);
  const [ax, bx] = pair(L, S, 0.22);
  cloud(g, (L.w * 0.2 + t * 8) % L.w, L.h * 0.12, fh * 0.3, 'rgba(255,255,255,0.95)');
  const r = makeRand(8);
  for (let x = fh * 0.1; x < L.w; x += fh * (0.9 + r() * 0.6)) roundTree(g, x, gy - fh * 0.3, fh * (1.1 + r() * 0.5), '#6f4e37', '#4f9a4a', '#74b45a');
  floor(g, L, S, '#c9b37a', '#a8945e');
  g.fillStyle = '#c9b37a';
  g.fillRect(0, gy - fh * 0.3, L.w, fh * 0.3);
  const ex = S.port ? L.w * 0.3 : ax;
  const es = S.port ? fh * 0.85 : fh * 1.0;
  const tip = elephant(g, ex - es * 0.15, gy - fh * 0.12, es, t);
  const spray = spawn(f, 'sp', Math.sin(t * 2.5) > 0.6 ? 40 : 0, 70, () => ({ x: tip.x, y: tip.y, vx: f.rand.range(20, 120), vy: -f.rand.range(120, 220), life: 0, max: 0.9, size: f.rand.range(1.5, 3), color: '#90e0ef' }));
  stepParticles(spray, f.dt, 500);
  dots(g, spray);
  const gx = S.port ? L.w * 0.72 : bx;
  giraffe(g, gx - fh * 0.2, gy - fh * 0.15, S.port ? fh * 1.2 : fh * 1.6, t);
  // fence
  g.fillStyle = '#6f4e37';
  g.fillRect(0, gy - fh * 0.32, L.w, fh * 0.04);
  g.fillRect(0, gy - fh * 0.16, L.w, fh * 0.04);
  for (let x = 0; x < L.w; x += fh * 0.5) g.fillRect(x, gy - fh * 0.38, fh * 0.05, fh * 0.38);
  // children watching
  const kids = S.port ? [L.w * 0.2, L.w * 0.45, L.w * 0.7] : [ax - fh * 0.5, ax + fh * 0.2, bx - fh * 0.5, bx + fh * 0.35];
  const kc = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0'];
  kids.forEach((x, i) => {
    const jump = Math.abs(Math.sin(t * 5 + i * 1.3)) * fh * 0.06;
    fig(g, x, gy + fh * 0.12 - jump, fh * 0.55, { color: '#1d2233', accent: kc[i % 4], dress: i % 2 === 1, aL: -2.6 + Math.sin(t * 8 + i) * 0.3, aR: i % 2 ? 2.6 : 0.3, hat: i % 2 ? 'bun' : 'cap', hatColor: i % 2 ? '#1d2233' : kc[(i + 1) % 4] });
  });
  risers(f, 'hz', () => f.rand.pick(kids), gy - fh * 0.3, 2, ['#ff5d8f', '#ffd166'], fh * 0.04, 0);
});

// ---------------------------------------------------------------- picnic

const picnic = def(3.4, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#6cc5f5', '#b5e3fa', '#f2fbe4']);
  const [ax, bx] = pair(L, S, 0.2);
  sun(g, S.port ? L.w * 0.85 : bx + fh * 0.7, L.h * 0.1, fh * 0.22, '#fff3b0', 'rgba(255,230,120,0.8)');
  cloud(g, (L.w * 0.25 + t * 9) % L.w, L.h * 0.14, fh * 0.32, 'rgba(255,255,255,0.95)');
  cloud(g, (L.w * 0.65 + t * 6) % L.w, L.h * 0.22, fh * 0.24, 'rgba(255,255,255,0.9)');
  g.fillStyle = '#8fd17c';
  g.beginPath();
  g.moveTo(0, gy - fh * 0.3);
  for (let x = 0; x <= L.w; x += 40) g.lineTo(x, gy - fh * 0.3 - Math.sin(x * 0.004) * fh * 0.25);
  g.lineTo(L.w, gy);
  g.lineTo(0, gy);
  g.closePath();
  g.fill();
  floor(g, L, S, '#7cc26b', '#4f9a4a');
  // shade tree
  roundTree(g, S.port ? L.w * 0.12 : ax - fh * 0.9, gy, fh * 1.9, '#6f4e37', '#52b788', '#74c69d');
  // blanket in perspective
  const cx = S.port ? L.w * 0.55 : ax + fh * 0.1;
  const bw = fh * 1.1;
  const bd = fh * 0.22;
  const by = gy - fh * 0.02;
  const n = 6;
  for (let rI = 0; rI < 3; rI++)
    for (let c = 0; c < n; c++) {
      const y0 = by - bd + (rI * bd) / 3;
      const y1 = by - bd + ((rI + 1) * bd) / 3;
      const k0 = 0.8 + (0.2 * rI) / 3;
      const k1 = 0.8 + (0.2 * (rI + 1)) / 3;
      g.fillStyle = (rI + c) % 2 ? '#ffffff' : '#e63946';
      g.beginPath();
      g.moveTo(cx + (-bw / 2 + (c * bw) / n) * k0, y0);
      g.lineTo(cx + (-bw / 2 + ((c + 1) * bw) / n) * k0, y0);
      g.lineTo(cx + (-bw / 2 + ((c + 1) * bw) / n) * k1, y1);
      g.lineTo(cx + (-bw / 2 + (c * bw) / n) * k1, y1);
      g.closePath();
      g.fill();
    }
  // basket
  const kx = cx + fh * 0.25;
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = fh * 0.025;
  g.beginPath();
  g.arc(kx, by - fh * 0.16, fh * 0.12, Math.PI, 0);
  g.stroke();
  g.fillStyle = '#c68b59';
  rr(g, kx - fh * 0.16, by - fh * 0.18, fh * 0.32, fh * 0.16, fh * 0.03);
  g.fill();
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(kx - fh * 0.16, by - fh * 0.18 + i * fh * 0.04);
    g.lineTo(kx + fh * 0.16, by - fh * 0.18 + i * fh * 0.04);
    g.stroke();
  }
  g.fillStyle = '#e63946';
  g.beginPath();
  g.arc(kx - fh * 0.05, by - fh * 0.2, fh * 0.04, 0, TAU);
  g.fill();
  // sandwiches + juice
  const sand = (x: number, y: number, s: number) => {
    g.fillStyle = '#f4d58d';
    g.beginPath();
    g.moveTo(x - s, y);
    g.lineTo(x + s, y);
    g.lineTo(x, y - s * 1.1);
    g.closePath();
    g.fill();
    g.fillStyle = '#80b918';
    g.fillRect(x - s * 0.8, y - s * 0.2, s * 1.6, s * 0.15);
  };
  sand(cx - fh * 0.08, by - fh * 0.08, fh * 0.06);
  sand(cx + fh * 0.02, by - fh * 0.05, fh * 0.05);
  g.fillStyle = '#ff9f1c';
  g.fillRect(cx - fh * 0.24, by - fh * 0.16, fh * 0.06, fh * 0.12);
  // picnickers
  const bite = Math.max(0, Math.sin(t * 3));
  fig(g, cx - fh * 0.42, by - fh * 0.08, fh * 0.95, { color: '#1d2233', accent: '#ffd166', legs: 'cross', hR: { x: cx - fh * 0.32, y: by - fh * 0.62 - bite * fh * 0.08 }, aL: -0.4, hat: 'cap', hatColor: '#4cc9f0' });
  sand(cx - fh * 0.3, by - fh * 0.62 - bite * fh * 0.08, fh * 0.05);
  if (!S.port) fig(g, cx + fh * 0.62, by - fh * 0.06, fh * 0.92, { color: '#1d2233', accent: '#ff5d8f', dress: true, dir: -1, legs: 'cross', aL: -2.4 + Math.sin(t * 4) * 0.2, aR: 0.4, hat: 'bun', hatColor: '#1d2233' });
  if (!S.port) {
    // kite flyer
    const kxx = bx + fh * 0.4 + Math.sin(t * 1.3) * fh * 0.3;
    const kyy = gy - fh * 2.2 + Math.cos(t * 1.7) * fh * 0.2;
    const p = fig(g, bx - fh * 0.3, gy, fh * 0.75, { color: '#1d2233', accent: '#06d6a0', hR: { x: bx - fh * 0.1, y: gy - fh * 0.75 }, aL: -0.3 });
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p.rh.x, p.rh.y);
    g.quadraticCurveTo(kxx - fh * 0.3, kyy + fh * 0.8, kxx, kyy);
    g.stroke();
    g.save();
    g.translate(kxx, kyy);
    g.rotate(Math.sin(t * 2) * 0.2);
    const kc = ['#ef476f', '#ffd166', '#4cc9f0', '#06d6a0'];
    const pts: [number, number][] = [
      [0, -0.25],
      [0.17, 0],
      [0, 0.32],
      [-0.17, 0],
    ];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = kc[i];
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(pts[i][0] * fh, pts[i][1] * fh);
      g.lineTo(pts[(i + 1) % 4][0] * fh, pts[(i + 1) % 4][1] * fh);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = '#ef476f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, fh * 0.32);
    for (let i = 1; i <= 6; i++) g.lineTo(Math.sin(t * 6 + i) * fh * 0.04, fh * (0.32 + i * 0.06));
    g.stroke();
    g.restore();
  }
  butterflies(f, S.port ? 3 : 4, fh * 0.08, S.port ? [L.w * 0.5] : [ax, bx], gy - fh * 0.9, fh * 0.55);
});

// ---------------------------------------------------------------- road trip

function wheel(g: G, x: number, y: number, r: number, rot: number, spokes: boolean, col = '#1d2233'): void {
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  if (spokes) {
    g.strokeStyle = '#c8a165';
    g.lineWidth = Math.max(1.5, r * 0.12);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
    }
    g.stroke();
    g.strokeStyle = col;
    g.lineWidth = r * 0.18;
    g.beginPath();
    g.arc(x, y, r * 0.9, 0, TAU);
    g.stroke();
  } else {
    g.fillStyle = '#adb5bd';
    g.beginPath();
    g.arc(x, y, r * 0.5, 0, TAU);
    g.fill();
    g.fillStyle = col;
    g.fillRect(x + Math.cos(rot) * r * 0.2 - 2, y + Math.sin(rot) * r * 0.2 - 2, 4, 4);
  }
}

function vehicle(g: G, x: number, y: number, s: number, t: number, era: EraLook): void {
  const bounce = Math.abs(Math.sin(t * 9)) * s * 0.02;
  const rot = t * 12;
  if (preIndustrial(era)) {
    // covered wagon pulled by a horse
    const hx = x + s * 0.62;
    const step = t * 9;
    g.strokeStyle = '#5a3a22';
    g.lineWidth = s * 0.05;
    g.lineCap = 'round';
    g.beginPath();
    for (const [lx, ph] of [
      [-0.14, 0],
      [-0.08, Math.PI],
      [0.14, Math.PI],
      [0.2, 0],
    ] as const) {
      g.moveTo(hx + lx * s, y - s * 0.32);
      g.lineTo(hx + lx * s + Math.sin(step + ph) * s * 0.07, y);
    }
    g.stroke();
    g.fillStyle = '#7a4a24';
    g.beginPath();
    g.ellipse(hx + s * 0.03, y - s * 0.4 - bounce, s * 0.24, s * 0.11, 0, 0, TAU);
    g.fill();
    g.save();
    g.translate(hx + s * 0.22, y - s * 0.45 - bounce);
    g.rotate(-0.9);
    g.fillRect(0, -s * 0.05, s * 0.24, s * 0.1);
    g.restore();
    g.beginPath();
    g.ellipse(hx + s * 0.4, y - s * 0.63 - bounce, s * 0.11, s * 0.055, 0.5, 0, TAU);
    g.fill();
    g.fillStyle = '#3a2412';
    g.beginPath();
    g.moveTo(hx + s * 0.2, y - s * 0.62 - bounce);
    g.lineTo(hx + s * 0.32, y - s * 0.72 - bounce);
    g.lineTo(hx + s * 0.28, y - s * 0.55 - bounce);
    g.fill();
    g.strokeStyle = '#3a2412';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + s * 0.3, y - s * 0.32);
    g.lineTo(hx - s * 0.15, y - s * 0.42 - bounce);
    g.stroke();
    // wagon bed + canvas
    g.fillStyle = '#8b5a2b';
    g.fillRect(x - s * 0.45, y - s * 0.38 - bounce, s * 0.8, s * 0.14);
    g.fillStyle = '#f8f1e0';
    g.beginPath();
    g.moveTo(x - s * 0.45, y - s * 0.38 - bounce);
    g.bezierCurveTo(x - s * 0.5, y - s * 0.95, x + s * 0.4, y - s * 0.95, x + s * 0.35, y - s * 0.38 - bounce);
    g.closePath();
    g.fill();
    g.strokeStyle = '#d6c7a1';
    g.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const xx = x - s * 0.45 + i * s * 0.2;
      g.beginPath();
      g.moveTo(xx, y - s * 0.38 - bounce);
      g.lineTo(xx, y - s * 0.82 - bounce);
      g.stroke();
    }
    wheel(g, x - s * 0.3, y - s * 0.14, s * 0.14, rot, true, '#3a2412');
    wheel(g, x + s * 0.22, y - s * 0.14, s * 0.14, rot, true, '#3a2412');
    return;
  }
  const fut = era === 'future';
  const ind = era === 'industrial';
  const by = y - (fut ? s * 0.18 + Math.sin(t * 3) * s * 0.03 : bounce);
  if (fut) additive(g, () => glow(g, x, y - s * 0.05, s * 0.6, 'rgba(0,245,212,0.6)'));
  const body = fut ? '#9b5de5' : ind ? '#1d2233' : '#ef476f';
  g.fillStyle = body;
  if (ind) {
    g.fillRect(x - s * 0.5, by - s * 0.3, s * 0.95, s * 0.14);
    g.fillRect(x - s * 0.35, by - s * 0.62, s * 0.45, s * 0.34);
    g.fillRect(x + s * 0.1, by - s * 0.4, s * 0.35, s * 0.12);
    g.fillStyle = '#9fd3ff';
    g.fillRect(x - s * 0.3, by - s * 0.57, s * 0.16, s * 0.2);
    g.fillRect(x - s * 0.1, by - s * 0.57, s * 0.16, s * 0.2);
  } else {
    rr(g, x - s * 0.55, by - s * 0.36, s * 1.1, s * 0.24, s * 0.08);
    g.fill();
    g.beginPath();
    g.moveTo(x - s * 0.38, by - s * 0.34);
    g.lineTo(x - s * 0.25, by - s * 0.6);
    g.lineTo(x + s * 0.18, by - s * 0.6);
    g.lineTo(x + s * 0.35, by - s * 0.34);
    g.closePath();
    g.fill();
    g.fillStyle = fut ? '#00f5d4' : '#9fd3ff';
    g.beginPath();
    g.moveTo(x - s * 0.32, by - s * 0.36);
    g.lineTo(x - s * 0.22, by - s * 0.55);
    g.lineTo(x - s * 0.04, by - s * 0.55);
    g.lineTo(x - s * 0.04, by - s * 0.36);
    g.closePath();
    g.moveTo(x + s * 0.01, by - s * 0.36);
    g.lineTo(x + s * 0.01, by - s * 0.55);
    g.lineTo(x + s * 0.15, by - s * 0.55);
    g.lineTo(x + s * 0.28, by - s * 0.36);
    g.closePath();
    g.fill();
    // luggage on the roof
    if (!fut) {
      g.fillStyle = '#ffd166';
      rr(g, x - s * 0.22, by - s * 0.72, s * 0.22, s * 0.12, s * 0.02);
      g.fill();
      g.fillStyle = '#06d6a0';
      rr(g, x + s * 0.0, by - s * 0.7, s * 0.16, s * 0.1, s * 0.02);
      g.fill();
    }
    g.fillStyle = '#fff3b0';
    g.beginPath();
    g.arc(x + s * 0.52, by - s * 0.26, s * 0.04, 0, TAU);
    g.fill();
  }
  if (!fut) {
    wheel(g, x - s * 0.32, y - s * 0.1, s * 0.12, rot, ind);
    wheel(g, x + s * 0.3, y - s * 0.1, s * 0.12, rot, ind);
  }
  // driver with an arm out the window
  g.fillStyle = '#1d2233';
  g.beginPath();
  g.arc(x + s * 0.08, by - s * 0.45, s * 0.06, 0, TAU);
  g.fill();
}

function mapPin(g: G, x: number, y: number, s: number, col: string): void {
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath();
  g.ellipse(x, y + 2, s * 0.35, s * 0.1, 0, 0, TAU);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x - s * 0.2, y - s * 0.45, x - s * 0.55, y - s * 0.7, x - s * 0.5, y - s * 1.0);
  g.arc(x, y - s * 1.0, s * 0.5, Math.PI, 0);
  g.bezierCurveTo(x + s * 0.55, y - s * 0.7, x + s * 0.2, y - s * 0.45, x, y);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y - s * 1.0, s * 0.2, 0, TAU);
  g.fill();
}

const roadTrip = def(3.4, (f, S) => {
  const { g, L, t, era } = f;
  const { fh, gy } = S;
  sky(g, L, ['#ff9e7a', '#ffc996', '#ffe9b8']);
  const [ax, bx] = pair(L, S, 0.22);
  sun(g, S.port ? L.w * 0.8 : bx + fh * 0.6, L.h * 0.15, fh * 0.3, '#fff6cf', 'rgba(255,220,140,0.8)');
  const hor = gy - fh * 0.5;
  // parallax mountains
  g.save();
  g.translate(-((t * 12) % 340), 0);
  mountains(g, { ...L, w: L.w + 400 }, hor, fh * 1.8, '#a26b8f', 21, 340, '#ffe5ec');
  g.restore();
  g.save();
  g.translate(-((t * 30) % 220), 0);
  mountains(g, { ...L, w: L.w + 300 }, hor + fh * 0.1, fh * 0.9, '#6d597a', 33, 220);
  g.restore();
  g.fillStyle = '#7cb36a';
  g.fillRect(0, hor + fh * 0.1, L.w, gy - hor);
  // winding road climbing into the mountains, with map pins
  const wx = S.port ? L.w * 0.7 : bx;
  g.strokeStyle = preIndustrial(era) ? '#a47148' : '#495057';
  g.lineWidth = fh * 0.1;
  g.lineCap = 'round';
  const route: P[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    route.push({ x: wx + Math.sin(u * Math.PI * 3) * fh * 0.6 * (1 - u * 0.6), y: lerp(gy - fh * 0.05, hor - fh * (S.port ? 0.6 : 1.1), u) });
  }
  g.beginPath();
  route.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  g.strokeStyle = '#ffd166';
  g.lineWidth = 2;
  g.setLineDash([6, 6]);
  g.stroke();
  g.setLineDash([]);
  const pinCols = ['#ef233c', '#3a86ff', '#06d6a0', '#ff9f1c'];
  const pins = S.port ? [4, 12, 20] : [3, 10, 16, 22];
  pins.forEach((ri, i) => {
    const appear = clamp((t - 0.4 - i * 0.55) / 0.35);
    if (appear <= 0) return;
    const p = route[ri];
    const drop = (1 - easeOut(appear)) * fh * 0.5;
    mapPin(g, p.x, p.y - drop - Math.abs(Math.sin(t * 3 + i)) * fh * 0.03, fh * 0.2 * (0.6 + 0.4 * appear), pinCols[i % 4]);
  });
  // main road along the bottom
  const dirt = preIndustrial(era);
  g.fillStyle = dirt ? '#b08250' : '#343a40';
  g.fillRect(0, gy - fh * 0.12, L.w, fh * 0.24);
  g.fillStyle = dirt ? 'rgba(90,60,30,0.5)' : '#ffd166';
  const off = (t * 220) % (fh * 0.5);
  for (let x = -off; x < L.w; x += fh * 0.5) g.fillRect(x, gy - fh * (dirt ? 0.06 : 0.01), fh * (dirt ? 0.08 : 0.25), fh * 0.025);
  floor(g, L, { ...S, gy: gy + fh * 0.12 }, '#7cb36a', '#4f8a4a');
  // the vehicle
  const vx = S.port ? L.w * 0.35 : ax;
  vehicle(g, vx, gy + fh * 0.06, fh * 1.1, t, era);
  // dust or exhaust puffs
  const puffs = spawn(f, 'pf', 10, 40, () => ({ x: vx - fh * 0.6, y: gy, vx: -f.rand.range(60, 120), vy: -f.rand.range(10, 40), life: 0, max: 1, size: fh * f.rand.range(0.03, 0.06), color: preIndustrial(era) ? 'rgba(200,170,120,0.6)' : era === 'future' ? 'rgba(0,245,212,0.5)' : 'rgba(255,255,255,0.6)' }));
  for (const p of puffs) p.size += f.dt * fh * 0.06;
  stepParticles(puffs, f.dt);
  dots(g, puffs);
});

// ---------------------------------------------------------------- skiing

const skiing = def(3.3, (f, S) => {
  const { g, L, t } = f;
  const { fh, gy } = S;
  sky(g, L, ['#4ea8de', '#90cdf4', '#e3f4ff']);
  mountains(g, L, gy - fh * 0.4, fh * 1.9, '#b8c9e6', 41, 280, '#ffffff');
  const [ax, bx] = pair(L, S, 0.2);
  // slope: falls from left to right
  const k = S.port ? 0.32 : 0.22;
  const top = S.port ? L.h * 0.18 : gy - fh * 1.1;
  const slopeY = (x: number) => top + x * k;
  g.fillStyle = '#f8fbff';
  g.beginPath();
  g.moveTo(0, slopeY(0));
  g.lineTo(L.w, slopeY(L.w));
  g.lineTo(L.w, L.h);
  g.lineTo(0, L.h);
  g.closePath();
  g.fill();
  g.fillStyle = '#dbe9f7';
  g.beginPath();
  g.moveTo(0, slopeY(0) + fh * 0.25);
  g.lineTo(L.w, slopeY(L.w) + fh * 0.25);
  g.lineTo(L.w, L.h);
  g.lineTo(0, L.h);
  g.closePath();
  g.fill();
  // chairlift
  if (!S.port) {
    const c0 = { x: bx - fh * 1.2, y: gy - fh * 2.4 };
    const c1 = { x: bx + fh * 1.2, y: gy - fh * 1.6 };
    g.strokeStyle = '#343a40';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c0.x - fh, c0.y - fh * 0.33);
    g.lineTo(c1.x + fh, c1.y + fh * 0.33);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const u = (i / 4 + t * 0.12) % 1;
      const px = lerp(c0.x - fh, c1.x + fh, u);
      const py = lerp(c0.y - fh * 0.33, c1.y + fh * 0.33, u);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px, py + fh * 0.3);
      g.stroke();
      g.fillStyle = '#e63946';
      g.fillRect(px - fh * 0.12, py + fh * 0.3, fh * 0.24, fh * 0.05);
      g.fillStyle = '#1d2233';
      g.beginPath();
      g.arc(px, py + fh * 0.22, fh * 0.045, 0, TAU);
      g.fill();
    }
  }
  // scrolling pines along the slope
  const span0 = L.w + fh;
  for (let i = 0; i < 10; i++) {
    const x = ((i * span0) / 10 - t * 160 + span0 * 10) % span0 - fh * 0.5;
    pine(g, x, slopeY(x) + fh * (0.08 + (i % 3) * 0.12), fh * (0.55 + (i % 2) * 0.2), '#1b4332', '#ffffff');
  }
  // skier carving down
  const sx = S.port ? L.w * 0.5 : ax;
  const sy = slopeY(sx) + fh * 0.12 + Math.sin(t * 3) * fh * 0.02;
  const ang = Math.atan(k);
  g.save();
  g.translate(sx, sy);
  g.rotate(ang);
  const p = fig(g, 0, 0, fh, { color: '#1d2233', accent: '#ef476f', legs: 'crouch', lean: 0.35, hL: { x: fh * 0.12, y: -fh * 0.45 }, hR: { x: fh * 0.22, y: -fh * 0.5 }, hat: 'beanie', hatColor: '#ffd166' });
  g.strokeStyle = '#ef476f';
  g.lineWidth = Math.max(3, fh * 0.03);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-fh * 0.3, 0);
  g.lineTo(fh * 0.35, 0);
  g.quadraticCurveTo(fh * 0.42, 0, fh * 0.44, -fh * 0.05);
  g.stroke();
  g.strokeStyle = '#adb5bd';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(p.lh.x, p.lh.y);
  g.lineTo(p.lh.x - fh * 0.32, p.lh.y + fh * 0.38);
  g.moveTo(p.rh.x, p.rh.y);
  g.lineTo(p.rh.x - fh * 0.3, p.rh.y + fh * 0.42);
  g.stroke();
  // goggles
  g.fillStyle = '#ffb703';
  g.fillRect(p.head.x, p.head.y - p.hr * 0.3, p.hr * 1.0, p.hr * 0.45);
  g.restore();
  // snow spray behind the skis
  const spray = spawn(f, 'sp', 70, 220, () => ({ x: sx - fh * 0.25, y: sy, vx: -f.rand.range(80, 260), vy: -f.rand.range(60, 220), life: 0, max: f.rand.range(0.5, 0.9), size: f.rand.range(1.5, 4.5), color: f.rand() < 0.5 ? '#ffffff' : '#d6ecff' }));
  stepParticles(spray, f.dt, 450);
  dots(g, spray);
  // falling snow
  const flakes = spawn(f, 'fl', 25, 80, () => ({ x: f.rand() * L.w * 1.2, y: -10, vx: -f.rand.range(20, 60), vy: f.rand.range(50, 100), life: 0, max: 8, size: f.rand.range(1.2, 3), color: '#ffffff' }));
  stepParticles(flakes, f.dt);
  dots(g, flakes, false);
});

// ================================================================== registry

export const LEISURE_SCENE_DEFS: Record<LeisureSceneId, SceneDef> = {
  gym,
  yoga,
  cinema,
  concert,
  reading,
  shopping,
  restaurant,
  cooking,
  beach,
  camping,
  hiking,
  fishing,
  gardening,
  painting,
  music,
  gaming,
  karaoke,
  spa,
  amusement,
  museum,
  bar,
  volunteer,
  theater,
  zoo,
  picnic,
  roadTrip,
  skiing,
};
